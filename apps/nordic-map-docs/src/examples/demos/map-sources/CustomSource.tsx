import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapSource } from "@jielga/nordic-map";

// A module constant: a new source on every render loads every cell again
const motorwaysOnly: MapSource = {
  ...swedenOsmSource,
  loadCell: async (cell) => {
    const layers = await swedenOsmSource.loadCell(cell);
    return {
      ...layers,
      roads: layers.roads.filter((road) => {
        return road.roadClass === "european";
      }),
      // Only the cities, at every zoom
      places: layers.places?.filter((place) => {
        return place.placeClass === "city";
      }),
    };
  },
};

export function CustomSource() {
  return (
    <div style={{ height: "100%" }}>
      <NordicMap source={motorwaysOnly} label="E-roads of Sweden" />
    </div>
  );
}
