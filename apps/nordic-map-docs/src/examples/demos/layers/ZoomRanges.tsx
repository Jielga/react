import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";

export function ZoomRanges() {
  return (
    <div style={{ height: "100%" }}>
      <NordicMap
        source={swedenOsmSource}
        label="Map of Sweden"
        // Roads from zoom 2, their number signs from zoom 4
        showRoads={{ minZoom: 2 }}
        showRoadLabels={{ minZoom: 4 }}
        // City names only on the overview, until zoom 6
        showPlaceLabels={{ maxZoom: 6 }}
        // No coastline line when zoomed far in
        showBorder={{ maxZoom: 20 }}
      />
    </div>
  );
}
