import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import { cities } from "../../data/cities.ts";

export function CustomStyle() {
  return (
    <div style={{ height: "100%" }}>
      <NordicMap
        source={swedenOsmSource}
        label="Cities"
        pins={cities}
        colorScheme="dark"
        mapStyle={{
          land: "#1f2a1f",
          contextLand: "#151c15",
          border: "#9be15d",
          road: "#5f7a5f",
          pin: "#9be15d",
          pinStroke: "#0d140d",
          pinSelected: "#ffd43b",
          pinRadius: 6,
        }}
        // The buttons take their colors from CSS variables
        style={{
          "--nordic-map-control-bg": "#1f2a1f",
          "--nordic-map-control-border": "#3b4f3b",
          "--nordic-map-focus-ring": "#9be15d",
        } as React.CSSProperties}
      />
    </div>
  );
}
