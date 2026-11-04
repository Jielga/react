import type { LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";

/** A point on the map, at a GPS position in WGS 84 degrees */
export type MapPin<T = unknown> = {
  id: string;
  lat: number;
  lon: number;
  /** Name of the pin: its visible label, its tooltip and its accessible name */
  label?: string;
  /** Color when not selected. Overrides `mapStyle.pin` for this pin. */
  color?: string;
  /**
   * Higher first. A pin with a higher priority keeps its label when labels collide, and starts its own
   * cluster instead of joining a neighbour's. @default 0
   */
  priority?: number;
  /** Your own data, handed back in callbacks */
  data?: T;
};

/** A filled region, for example a county. Areas are drawn over the land, and under lakes, roads and borders. */
export type MapArea = {
  id: string;
  /** WGS 84 degrees */
  geometry: Polygon | MultiPolygon;
  /** Shown as a tooltip on hover */
  label?: string;
  /** Overrides `mapStyle.areaFill` */
  fill?: string;
  /** Overrides `mapStyle.areaStroke` */
  stroke?: string;
};

/** A line, for example a GPS track or a route. Paths are drawn over roads and under pins. */
export type MapPath = {
  id: string;
  /** WGS 84 degrees */
  geometry: LineString | MultiLineString;
  /** Shown as a tooltip on hover */
  label?: string;
  /** Overrides `mapStyle.path` */
  color?: string;
  /** Line width in pixels. Overrides `mapStyle.pathWidth`. */
  width?: number;
};

/** What the pointer is over, or what has keyboard focus, when a tooltip shows */
export type MapTooltipTarget<T = unknown> =
  | { kind: "pin"; pin: MapPin<T> }
  | { kind: "cluster"; pins: MapPin<T>[] }
  | { kind: "area"; area: MapArea }
  | { kind: "path"; path: MapPath };

/**
 * How pins are selected:
 *
 * - `multiple`: drag a box to select the pins in it, click a pin to toggle it
 * - `single`: click a pin to select only it, drag to pan
 * - `none`: pins are not selected, drag to pan
 */
export type SelectionMode = "multiple" | "single" | "none";

export type ClusterOptions = {
  /** Pins closer than this, in pixels, join one cluster @default 40 */
  radius?: number;
};
