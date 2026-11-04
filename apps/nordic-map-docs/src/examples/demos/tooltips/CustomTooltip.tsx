import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import { cities } from "../../data/cities.ts";

export function CustomTooltip() {
  return (
    <div style={{ height: "100%" }}>
      <NordicMap
        source={swedenOsmSource}
        label="Cities"
        pins={cities}
        cluster
        renderTooltip={(target) => {
          if (target.kind === "pin") {
            return (
              <>
                <strong>{target.pin.label}</strong>
                <br />
                {target.pin.data?.population.toLocaleString("sv-SE")} inhabitants
              </>
            );
          }
          if (target.kind === "cluster") {
            return target.pins
              .map((pin) => {
                return pin.label;
              })
              .join(", ");
          }
          return null;
        }}
      />
    </div>
  );
}
