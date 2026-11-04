import { NORDIC_MAP_LABELS_SV, NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import { cities } from "../../data/cities.ts";

export function Swedish() {
  return (
    <div style={{ height: "100%" }}>
      <NordicMap
        source={swedenOsmSource}
        label="Städer"
        labels={NORDIC_MAP_LABELS_SV}
        pins={cities}
        cluster
      />
    </div>
  );
}
