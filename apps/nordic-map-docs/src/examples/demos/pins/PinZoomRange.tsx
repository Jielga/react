import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import { cities } from "../../data/cities.ts";

export function PinZoomRange() {
  return (
    <div style={{ height: "100%" }}>
      <NordicMap
        source={swedenOsmSource}
        label="Cities"
        pins={cities}
        // Zoom in three times to see the pins, and four times to see their labels
        showPins={{ minZoom: 3 }}
        showPinLabels={{ minZoom: 4 }}
        showPlaceLabels={false}
      />
    </div>
  );
}
