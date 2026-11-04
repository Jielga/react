/**
 * Colors and sizes of everything the map draws on its canvas. Colors take any CSS color, and `"none"` or
 * `"transparent"` leaves a layer undrawn. Sizes are in screen pixels and stay the same at every zoom.
 */
export type MapStyle = {
  /** Sea, and the area around the map */
  sea: string;
  /** The map's own land, for example Sweden */
  land: string;
  /** Lakes */
  lake: string;
  /** Lake outline */
  lakeBorder: string;
  /** Coastline and land border of the map's own land */
  border: string;
  /**
   * Width of `border`. Below 1 the line is drawn fainter on normal screens, and stays crisp on high resolution
   * screens.
   */
  borderWidth: number;
  /** Background land around the map's own land, for example the neighbouring countries */
  contextLand: string;
  /** Coasts and borders of the background land */
  contextBorder: string;
  road: string;
  /** Width of E-roads. Smaller roads are thinner. */
  roadWidth: number;
  /** Place names and pin labels */
  text: string;
  /** Outline around text, so it reads on any background */
  textHalo: string;
  /** Unselected pins, and the fill of clusters */
  pin: string;
  /** Outline of pins, and the count in clusters */
  pinStroke: string;
  /** Selected pins, and the drag-select box */
  pinSelected: string;
  /** Radius of a pin. Clusters are larger. */
  pinRadius: number;
  /** Fill of areas that set no `fill` of their own */
  areaFill: string;
  /** Outline of areas that set no `stroke` of their own */
  areaStroke: string;
  /** Paths that set no `color` of their own */
  path: string;
  /** Width of paths that set no `width` of their own */
  pathWidth: number;
  /** Ring around the hovered or focused pin, and the outline of the hovered area or path */
  highlight: string;
};

/** The map's colors on a light page */
export const lightMapStyle: MapStyle = {
  sea: "#b9d7ea",
  land: "#fdfcf8",
  lake: "#b9d7ea",
  lakeBorder: "none",
  border: "#1d5fa8",
  borderWidth: 1,
  contextLand: "#e9e6df",
  contextBorder: "#b3ab9f",
  road: "#c98a3a",
  roadWidth: 1.2,
  text: "#1b2b40",
  textHalo: "#ffffff",
  pin: "#1b2b40",
  pinStroke: "#ffffff",
  pinSelected: "#d6336c",
  pinRadius: 5,
  areaFill: "rgb(29 95 168 / 15%)",
  areaStroke: "#1d5fa8",
  path: "#0b7a5c",
  pathWidth: 3,
  highlight: "#1b2b40",
};

/** The map's colors on a dark page */
export const darkMapStyle: MapStyle = {
  sea: "#06111f",
  land: "#12284a",
  lake: "#06111f",
  lakeBorder: "none",
  border: "#fecc02",
  borderWidth: 1,
  contextLand: "#0c1c33",
  contextBorder: "#2a4365",
  road: "#7fa7d9",
  roadWidth: 1.2,
  text: "#e6edf7",
  textHalo: "#06111f",
  pin: "#ffffff",
  pinStroke: "#0b1f3a",
  pinSelected: "#fecc02",
  pinRadius: 5,
  areaFill: "rgb(127 167 217 / 25%)",
  areaStroke: "#7fa7d9",
  path: "#4dd4ac",
  pathWidth: 3,
  highlight: "#ffffff",
};
