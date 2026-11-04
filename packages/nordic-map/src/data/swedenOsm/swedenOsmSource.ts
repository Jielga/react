import type { MapLayers, MapSource } from "../../NordicMap/mapSource.ts";
import { cellUrls, levels } from "./cellUrls.ts";

const emptyLayers: MapLayers = { land: [], water: [], borders: [], roads: [] };

/**
 * Sweden from OpenStreetMap: coast and land border, lakes, E-roads, national roads, regional roads and the names
 * of cities, towns and villages, in three detail levels. Built by scripts/map-data/build_sweden_osm.py.
 * Each cell is a separate file that the bundler copies, and it loads when it comes into view.
 */
export const swedenOsmSource: MapSource = {
  extent: { west: 10.9, south: 55.3, east: 24.2, north: 69.1 },
  // Close to SWEREF 99 TM, so the map looks like other Swedish maps
  centralMeridian: 15,
  levels,
  attribution: { text: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" },
  loadCell: async ({ level, x, y }) => {
    const url = cellUrls[`${level}/${x}/${y}`];
    // Cells without land, lakes or roads are not built
    if (!url) {
      return emptyLayers;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Map cell ${level}/${x}/${y} failed with HTTP ${response.status}`);
    }
    // The cell files are generated in the MapLayers shape by the build script
    const layers: MapLayers = await response.json();
    return layers;
  },
};
