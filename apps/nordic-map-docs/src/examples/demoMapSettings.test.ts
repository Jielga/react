import { describe, expect, it } from "vitest";
import { demoMapLayerProps } from "./demoMapSettings.ts";

describe("demoMapLayerProps", () => {
  it("turns off the layers the reader turned off", () => {
    expect(demoMapLayerProps({ settings: { roads: false, roadLabels: false, places: false }, props: {} as never })).toEqual({
      showRoads: false,
      showRoadLabels: false,
      showPlaceLabels: false,
    });
  });

  it("keeps a layer the demo sets itself", () => {
    const props = { showRoads: { minZoom: 3 }, showPlaceLabels: false } as never;
    expect(demoMapLayerProps({ settings: { roads: false, roadLabels: true, places: true }, props })).toEqual({
      showRoads: { minZoom: 3 },
      showRoadLabels: true,
      showPlaceLabels: false,
    });
  });
});
