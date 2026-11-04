import { describe, expect, it } from "vitest";
import type { MapArea, MapPin } from "./mapItems.ts";
import { pinsInArea } from "./pinsInArea.ts";

const pins: MapPin[] = [
  { id: "inside", lat: 61, lon: 15 },
  { id: "in-hole", lat: 61.5, lon: 15.5 },
  { id: "outside", lat: 59, lon: 15 },
  { id: "other-part", lat: 66, lon: 20 },
];

const ring = (west: number, south: number, east: number, north: number) => {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
};

describe("pinsInArea", () => {
  it("finds the pins inside, leaves out holes, and reads every part", () => {
    const area: MapArea = {
      id: "a",
      geometry: {
        type: "MultiPolygon",
        coordinates: [[ring(14, 60, 17, 62), ring(15.2, 61.2, 15.8, 61.8)], [ring(19, 65, 21, 67)]],
      },
    };
    expect(
      pinsInArea(pins, area).map((pin) => {
        return pin.id;
      }),
    ).toEqual(["inside", "other-part"]);
  });

  it("accepts rings wound either way", () => {
    const area: MapArea = { id: "b", geometry: { type: "Polygon", coordinates: [ring(14, 60, 17, 62).reverse()] } };
    expect(
      pinsInArea(pins, area).map((pin) => {
        return pin.id;
      }),
    ).toEqual(["inside", "in-hole"]);
  });

  it("follows the great circle of a long edge, as the map draws it", () => {
    // The north edge from 10°E to 30°E at 64°N bows north to about 64.35°N in the middle
    const area: MapArea = { id: "c", geometry: { type: "Polygon", coordinates: [ring(10, 60, 30, 64)] } };
    const bulge: MapPin[] = [{ id: "bulge", lat: 64.2, lon: 20 }];
    expect(pinsInArea(bulge, area)).toEqual(bulge);
  });
});
