import { geoPath } from "d3-geo";
import type { Geometry } from "geojson";
import type { MapBounds } from "./camera.ts";
import { rewindPolygon } from "./geometry.ts";
import type { MapArea, MapPath } from "./mapItems.ts";
import type { MapProjection } from "./mapProjection.ts";

/** An area projected to map units, ready to draw and to hit-test */
export type PreparedArea = {
  area: MapArea;
  shape: Path2D;
  bounds: MapBounds;
};

/** A path projected to map units, ready to draw and to hit-test */
export type PreparedPath = {
  path: MapPath;
  shape: Path2D;
  bounds: MapBounds;
};

type Projected = { shape: Path2D; bounds: MapBounds };

/**
 * Projected shapes by projection and geometry object. An area whose fill changes keeps its geometry object,
 * so it is not projected again, even when the `areas` array is new.
 */
const projectedShapes = new WeakMap<MapProjection, WeakMap<Geometry, Projected | null>>();

function project({ geometry, projection }: { geometry: Geometry; projection: MapProjection }): Projected | null {
  // Path2D is a browser API, and there is nothing to draw without it
  if (typeof Path2D === "undefined") {
    return null;
  }
  let shapes = projectedShapes.get(projection);
  if (!shapes) {
    shapes = new WeakMap();
    projectedShapes.set(projection, shapes);
  }
  const known = shapes.get(geometry);
  if (known !== undefined) {
    return known;
  }
  const toPath = geoPath(projection.projection);
  const drawn = geometry.type === "Polygon" || geometry.type === "MultiPolygon" ? rewindPolygon(geometry) : geometry;
  const d = toPath(drawn);
  const [[minX, minY], [maxX, maxY]] = toPath.bounds(drawn);
  const projected =
    d && [minX, minY, maxX, maxY].every(Number.isFinite)
      ? { shape: new Path2D(d), bounds: { minX, minY, maxX, maxY } }
      : null;
  shapes.set(geometry, projected);
  return projected;
}

export function prepareAreas({ areas, projection }: { areas: MapArea[]; projection: MapProjection }): PreparedArea[] {
  return areas.flatMap((area) => {
    const projected = project({ geometry: area.geometry, projection });
    return projected ? [{ area, ...projected }] : [];
  });
}

export function preparePaths({ paths, projection }: { paths: MapPath[]; projection: MapProjection }): PreparedPath[] {
  return paths.flatMap((path) => {
    const projected = project({ geometry: path.geometry, projection });
    return projected ? [{ path, ...projected }] : [];
  });
}
