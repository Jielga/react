import type { LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";

/** [longitude, latitude] in WGS 84 degrees */
export type LonLat = [number, number];

/** Area in WGS 84 degrees */
export type LonLatBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * Road importance, shared by all countries so their roads can be drawn the same way.
 *
 * - `european`: E-roads
 * - `national`: national roads, for example Swedish riksvägar, and main ring roads
 * - `regional`: important regional roads
 */
export type RoadClass = "european" | "national" | "regional";

export type MapRoad = {
  geometry: LineString | MultiLineString;
  roadClass: RoadClass;
  /** Road number, for example "E4" */
  ref?: string;
};

/** A road number sign, drawn where the road runs */
export type MapRoadLabel = {
  /** Road number, for example "E4" */
  text: string;
  at: LonLat;
};

/**
 * Importance of a named place, from the most important. The map names cities first, and towns and villages
 * where there is room.
 */
export type PlaceClass = "city" | "town" | "village";

export type MapPlace = {
  name: string;
  at: LonLat;
  placeClass: PlaceClass;
  /** Breaks ties between places of the same class: the larger one is named first */
  population?: number;
};

/**
 * What one cell draws. A cell may cut its features at the cell edges.
 * Land is only filled, and coast and borders come as separate lines, so the cut edges stay invisible.
 */
export type MapLayers = {
  land: (Polygon | MultiPolygon)[];
  /** Lakes, drawn over the land */
  water: (Polygon | MultiPolygon)[];
  /** Coastline and country borders */
  borders: (LineString | MultiLineString)[];
  roads: MapRoad[];
  /** Road number signs */
  roadLabels?: MapRoadLabel[];
  /** Names of cities, towns and villages */
  places?: MapPlace[];
  /**
   * Plain background around the map's own area, for example the neighbouring countries. Only overview cells
   * (level 0) carry it, and it is drawn at every zoom under everything else.
   */
  context?: MapContext;
};

export type MapContext = {
  /** Land, filled, and outlined as its coast */
  land: (Polygon | MultiPolygon)[];
  /** Land borders between countries */
  borders: (LineString | MultiLineString)[];
};

/** One detail level. Its data is cut into square cells of `cellSize` degrees, aligned to longitude -180 and latitude -90. */
export type MapLevel = {
  /** Smallest zoom factor that shows this level. The first level must start at 1. */
  minZoom: number;
  /** Cell size in degrees. Use 360 for a level that is one cell. */
  cellSize: number;
};

export type MapAttribution = {
  text: string;
  /** Page with the license or copyright details */
  url?: string;
};

export type MapCell = {
  /** Index in `levels` */
  level: number;
  x: number;
  y: number;
};

/**
 * Where a map gets its data. Keep the object stable, for example as a module constant,
 * because the map reloads all cells when it changes.
 */
export type MapSource = {
  /** Area the map shows at zoom 1 */
  extent: LonLatBox;
  /** Meridian of the Transverse Mercator projection. Defaults to the middle of `extent`. */
  centralMeridian?: number;
  /** Detail levels, from the least detailed */
  levels: MapLevel[];
  /** Credit the data's license asks for, shown in the map's corner, for example "© OpenStreetMap contributors" */
  attribution?: MapAttribution;
  loadCell: (cell: MapCell) => Promise<MapLayers>;
};

export function cellKey(cell: MapCell): string {
  return `${cell.level}/${cell.x}/${cell.y}`;
}

/** Cells of `level` that touch `box`. */
export function cellsInBox({ source, level, box }: { source: MapSource; level: number; box: LonLatBox }): MapCell[] {
  const size = source.levels[level]?.cellSize;
  if (size === undefined) {
    return [];
  }
  const west = Math.max(box.west, source.extent.west);
  const east = Math.min(box.east, source.extent.east);
  const south = Math.max(box.south, source.extent.south);
  const north = Math.min(box.north, source.extent.north);
  if (west > east || south > north) {
    return [];
  }
  const cells: MapCell[] = [];
  const toIndex = (degrees: number, origin: number) => {
    return Math.floor((degrees + origin) / size);
  };
  for (let x = toIndex(west, 180); x <= toIndex(east, 180); x += 1) {
    for (let y = toIndex(south, 90); y <= toIndex(north, 90); y += 1) {
      cells.push({ level, x, y });
    }
  }
  return cells;
}

/** The most detailed level that `zoom` shows. */
export function levelForZoom({ source, zoom }: { source: MapSource; zoom: number }): number {
  let level = 0;
  source.levels.forEach((candidate, index) => {
    if (candidate.minZoom <= zoom) {
      level = index;
    }
  });
  return level;
}
