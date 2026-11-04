import { describe, expect, it } from "vitest";
import type { Point } from "./camera.ts";
import type { MapPin } from "./mapItems.ts";
import { buildMarkers, clusterPoints, markerPins, markerRadius } from "./markers.ts";
import type { PlacedPin } from "./markers.ts";

function place(pins: { pin: MapPin; point: Point }[]): PlacedPin<unknown>[] {
  return pins.map(({ pin, point }, order) => {
    return { pin, point, order };
  });
}

describe("clusterPoints", () => {
  it("groups points within the radius of the first free point", () => {
    const groups = clusterPoints({
      points: [
        [0, 0],
        [3, 0],
        [100, 100],
        [6, 0],
      ],
      radius: 5,
    });
    // [6, 0] is 6 from the seed, so it starts its own group
    expect(groups).toEqual([[0, 1], [2], [3]]);
  });

  it("finds neighbours across grid cells", () => {
    expect(
      clusterPoints({
        points: [
          [4.9, 4.9],
          [5.1, 5.1],
        ],
        radius: 5,
      }),
    ).toEqual([[0, 1]]);
  });
});

describe("buildMarkers", () => {
  const pins = place([
    { pin: { id: "a", lat: 0, lon: 0 }, point: [0, 0] },
    { pin: { id: "b", lat: 0, lon: 0 }, point: [1, 0] },
    { pin: { id: "c", lat: 0, lon: 0, priority: 5 }, point: [50, 0] },
  ]);

  it("gives every pin its own marker without a radius", () => {
    expect(
      buildMarkers({ placed: pins, radius: null }).map((marker) => {
        return marker.key;
      }),
    ).toEqual(["pin:a", "pin:b", "pin:c"]);
  });

  it("joins close pins into a cluster at their middle, in pins order", () => {
    const markers = buildMarkers({ placed: pins, radius: 10 });
    expect(
      markers.map((marker) => {
        return marker.key;
      }),
    ).toEqual(["cluster:a", "pin:c"]);
    const [first] = markers;
    expect(first?.point).toEqual([0.5, 0]);
    expect(
      first
        ? markerPins(first).map((pin) => {
            return pin.id;
          })
        : [],
    ).toEqual(["a", "b"]);
  });

  it("lets the pin with the higher priority start the cluster", () => {
    const markers = buildMarkers({
      placed: place([
        { pin: { id: "low", lat: 0, lon: 0 }, point: [0, 0] },
        { pin: { id: "high", lat: 0, lon: 0, priority: 1 }, point: [1, 0] },
      ]),
      radius: 10,
    });
    expect(markers[0]?.key).toBe("cluster:high");
  });

  it("makes clusters larger than pins", () => {
    const [cluster] = buildMarkers({ placed: pins, radius: 10 });
    expect(cluster && markerRadius({ marker: cluster, pinRadius: 5 })).toBeGreaterThan(5);
  });
});
