import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapPin } from "@jielga/nordic-map";
import { useState } from "react";

const pins: MapPin[] = [
  { id: "sto", lat: 59.33, lon: 18.07, label: "Stockholm" },
  { id: "got", lat: 57.71, lon: 11.97, label: "Göteborg" },
  { id: "mal", lat: 55.61, lon: 13.0, label: "Malmö" },
];

export function FirstMap() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    // The map fills its container, so the container sets the height
    <div style={{ height: "100%" }}>
      <NordicMap
        source={swedenOsmSource}
        label="Offices"
        pins={pins}
        selected={selected}
        onSelectionChange={setSelected}
      />
    </div>
  );
}
