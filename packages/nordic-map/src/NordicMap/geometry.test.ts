import type { Polygon } from "geojson";
import { describe, expect, it } from "vitest";
import { rewindPolygon } from "./geometry.ts";

const counterclockwise = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

describe("rewindPolygon", () => {
  it("turns a counterclockwise outer ring clockwise, as d3-geo needs it", () => {
    const polygon: Polygon = { type: "Polygon", coordinates: [counterclockwise] };
    expect(rewindPolygon(polygon).coordinates[0]).toEqual([...counterclockwise].reverse());
  });

  it("turns a clockwise hole counterclockwise", () => {
    const outer = [...counterclockwise].reverse();
    const hole = [
      [0.2, 0.2],
      [0.2, 0.8],
      [0.8, 0.8],
      [0.8, 0.2],
      [0.2, 0.2],
    ];
    const polygon: Polygon = { type: "Polygon", coordinates: [outer, hole] };
    expect(rewindPolygon(polygon).coordinates).toEqual([outer, [...hole].reverse()]);
  });

  it("rewinds every polygon of a multipolygon", () => {
    const result = rewindPolygon({ type: "MultiPolygon", coordinates: [[counterclockwise], [counterclockwise]] });
    expect(result.coordinates[1]?.[0]).toEqual([...counterclockwise].reverse());
  });
});
