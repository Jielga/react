import { geoPath } from "d3-geo";
import type { Geometry } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Camera, Frame, MapBounds, Point } from "./camera.ts";
import { rewindPolygon } from "./geometry.ts";
import { viewBox } from "./mapProjection.ts";
import type { MapProjection } from "./mapProjection.ts";
import { cellKey, cellsInBox, levelForZoom } from "./mapSource.ts";
import type { MapCell, MapLayers, MapSource, PlaceClass, RoadClass } from "./mapSource.ts";

/** A loaded cell, projected to map units and ready to draw */
export type PreparedCell = {
  key: string;
  land: Path2D | null;
  water: Path2D | null;
  borders: Path2D | null;
  roads: { roadClass: RoadClass; path: Path2D }[];
  roadLabels: { text: string; at: Point }[];
  places: { name: string; at: Point; placeClass: PlaceClass; population: number }[];
  /** Background land and borders around the map's own area. Only overview cells have them. */
  contextLand: Path2D | null;
  contextBorders: Path2D | null;
  /** Extent of the land and borders, in map units. The context does not count. */
  bounds: MapBounds | null;
};

type Entry = { status: "ready"; cell: PreparedCell } | { status: "failed" };

const roadClasses: RoadClass[] = ["regional", "national", "european"];

function prepareCell({ key, layers, projection }: { key: string; layers: MapLayers; projection: MapProjection }): PreparedCell {
  const toPath = geoPath(projection.projection);
  const toPath2D = (geometries: Geometry[]) => {
    if (geometries.length === 0) {
      return null;
    }
    const d = toPath({ type: "GeometryCollection", geometries });
    return d ? new Path2D(d) : null;
  };

  // Custom sources may wind their polygons either way, and d3-geo fills the whole map for the wrong one
  const land = layers.land.map(rewindPolygon);
  const outline: Geometry[] = [...land, ...layers.borders];
  const [[minX, minY], [maxX, maxY]] = toPath.bounds({ type: "GeometryCollection", geometries: outline });
  const bounds = [minX, minY, maxX, maxY].every(Number.isFinite) ? { minX, minY, maxX, maxY } : null;

  return {
    key,
    land: toPath2D(land),
    water: toPath2D(layers.water.map(rewindPolygon)),
    borders: toPath2D(layers.borders),
    roads: roadClasses.flatMap((roadClass) => {
      const path = toPath2D(
        layers.roads
          .filter((road) => {
            return road.roadClass === roadClass;
          })
          .map((road) => {
            return road.geometry;
          }),
      );
      return path ? [{ roadClass, path }] : [];
    }),
    roadLabels: (layers.roadLabels ?? []).flatMap((label) => {
      const at = projection.project(label.at);
      return at ? [{ text: label.text, at }] : [];
    }),
    places: (layers.places ?? []).flatMap((place) => {
      const at = projection.project(place.at);
      return at ? [{ name: place.name, at, placeClass: place.placeClass, population: place.population ?? 0 }] : [];
    }),
    contextLand: toPath2D((layers.context?.land ?? []).map(rewindPolygon)),
    contextBorders: toPath2D(layers.context?.borders ?? []),
    bounds,
  };
}

function parseKey(key: string): MapCell | null {
  const [level, x, y] = key.split("/").map(Number);
  return level === undefined || x === undefined || y === undefined ? null : { level, x, y };
}

const noEntries: ReadonlyMap<string, Entry> = new Map();

/** Loads `cells` that are not loaded yet. Keeps every loaded cell until the source changes. */
function useLoadedCells({
  source,
  projection,
  cells,
}: {
  source: MapSource;
  projection: MapProjection;
  cells: MapCell[];
}): ReadonlyMap<string, Entry> {
  const [store, setStore] = useState<{ source: MapSource; entries: ReadonlyMap<string, Entry> }>({
    source,
    entries: noEntries,
  });
  const requested = useRef<{ source: MapSource; keys: Set<string> }>({ source, keys: new Set() });
  const wantedKeys = cells.map(cellKey).join(",");

  useEffect(() => {
    if (requested.current.source !== source) {
      requested.current = { source, keys: new Set() };
    }
    const { keys } = requested.current;
    for (const key of wantedKeys.split(",")) {
      const cell = parseKey(key);
      if (!cell || keys.has(key)) {
        continue;
      }
      keys.add(key);
      const save = (entry: Entry) => {
        setStore((previous) => {
          const base = previous.source === source ? previous.entries : noEntries;
          return { source, entries: new Map(base).set(key, entry) };
        });
      };
      source.loadCell(cell).then(
        (layers) => {
          save({ status: "ready", cell: prepareCell({ key, layers, projection }) });
        },
        (error: unknown) => {
          console.error(`Could not load map cell ${key}`, error);
          save({ status: "failed" });
        },
      );
    }
  }, [source, projection, wantedKeys]);

  return store.source === source ? store.entries : noEntries;
}

function readyCells({ entries, cells }: { entries: ReadonlyMap<string, Entry>; cells: MapCell[] }): PreparedCell[] {
  return cells.flatMap((cell) => {
    const entry = entries.get(cellKey(cell));
    return entry?.status === "ready" ? [entry.cell] : [];
  });
}

function allSettled({ entries, cells }: { entries: ReadonlyMap<string, Entry>; cells: MapCell[] }): boolean {
  return cells.every((cell) => {
    return entries.has(cellKey(cell));
  });
}

/**
 * Loads level 0, the overview. It is always loaded in full, it gives the map its extent, and it is drawn
 * while a more detailed level is loading. Returns null until every overview cell has loaded or failed.
 */
export function useOverviewCells({
  source,
  projection,
}: {
  source: MapSource;
  projection: MapProjection;
}): PreparedCell[] | null {
  const cells = useMemo(() => {
    return cellsInBox({ source, level: 0, box: source.extent });
  }, [source]);
  const entries = useLoadedCells({ source, projection, cells });
  // Stable between renders, so what is built from the cells is only rebuilt when they change
  return useMemo(() => {
    return allSettled({ entries, cells }) ? readyCells({ entries, cells }) : null;
  }, [entries, cells]);
}

/**
 * Loads the cells of the level that fits the zoom, for the area in view, and picks what to draw.
 * A level is drawn once all its visible cells are loaded. Until then a less detailed level that is loaded
 * is drawn, or else the overview.
 */
export function useDetailCells({
  source,
  projection,
  camera,
  frame,
  overview,
}: {
  source: MapSource;
  projection: MapProjection;
  camera: Camera | null;
  frame: Frame | null;
  overview: PreparedCell[];
}): PreparedCell[] {
  const level = camera ? levelForZoom({ source, zoom: camera.k }) : 0;
  // A bit larger than the view, so cells just outside it are ready when panning
  const box =
    camera && frame && level > 0
      ? viewBox({ camera, frame, projection, margin: Math.max(frame.size.width, frame.size.height) * 0.25 })
      : null;

  // From the wanted level down to level 1, the cells that cover the view
  const candidates: MapCell[][] = [];
  if (box) {
    for (let candidate = level; candidate >= 1; candidate -= 1) {
      candidates.push(cellsInBox({ source, level: candidate, box }));
    }
  }

  const entries = useLoadedCells({ source, projection, cells: candidates[0] ?? [] });
  const loaded = candidates.find((cells) => {
    return allSettled({ entries, cells });
  });
  // The camera changes every frame, but the cells to draw rarely do. Keep the same array while they stay the same.
  const loadedKey = loaded ? loaded.map(cellKey).join(",") : "";
  return useMemo(() => {
    const cells = loadedKey === "" ? [] : loadedKey.split(",").flatMap((key) => parseKey(key) ?? []);
    return cells.length > 0 ? readyCells({ entries, cells }) : overview;
  }, [entries, loadedKey, overview]);
}
