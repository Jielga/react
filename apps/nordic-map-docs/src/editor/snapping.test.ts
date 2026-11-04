import { describe, expect, it } from "vitest";
import type { Part } from "./editorModel.ts";
import { buildOutlineIndex, buildSnapIndex, findSnap } from "./snapping.ts";
import type { ScreenProjection } from "./snapping.ts";

/** 1000 pixels per degree, with the y axis pointing down as on screen */
const projection: ScreenProjection = {
  project: ({ lat, lon }) => {
    return { x: (lon - 10) * 1000, y: (61 - lat) * 1000 };
  },
  unproject: ({ x, y }) => {
    return { lon: 10 + x / 1000, lat: 61 - y / 1000 };
  },
};

const square: Part = [
  [
    [10.1, 60.9],
    [10.2, 60.9],
    [10.2, 60.8],
    [10.1, 60.8],
  ],
];

describe("findSnap", () => {
  const index = buildSnapIndex({ shapes: [[square]] });

  it("snaps to a point within the radius before an edge", () => {
    // 6 pixels right of the corner at 10.1, 60.9, which is at 100, 100
    expect(findSnap({ pointer: { x: 106, y: 102 }, indexes: [index], projection, radius: 10 })).toEqual({
      at: [10.1, 60.9],
      kind: "vertex",
    });
  });

  it("snaps to the nearest point of an edge", () => {
    const snap = findSnap({ pointer: { x: 150, y: 104 }, indexes: [index], projection, radius: 10 });
    expect(snap?.kind).toBe("edge");
    expect(snap?.at[0]).toBeCloseTo(10.15, 6);
    expect(snap?.at[1]).toBeCloseTo(60.9, 6);
  });

  it("does not snap beyond the radius", () => {
    expect(findSnap({ pointer: { x: 150, y: 150 }, indexes: [index], projection, radius: 10 })).toBeNull();
  });

  it("leaves out the edges of an excluded point", () => {
    const corner = square[0]?.[0];
    const without = buildSnapIndex({ shapes: [[square]], exclude: corner });
    // Both edges at the corner are gone, so nothing is near it
    expect(findSnap({ pointer: { x: 103, y: 103 }, indexes: [without], projection, radius: 10 })).toBeNull();
  });
});

describe("buildOutlineIndex", () => {
  it("keeps only the edges that no other shape shares", () => {
    const left: Part = [
      [
        [10.1, 60.9],
        [10.2, 60.9],
        [10.2, 60.8],
        [10.1, 60.8],
      ],
    ];
    const right: Part = [
      [
        [10.2, 60.9],
        [10.3, 60.9],
        [10.3, 60.8],
        [10.2, 60.8],
      ],
    ];
    const outline = buildOutlineIndex([[left], [right]]);
    // On the shared edge at 10.2, between the corners: nothing to snap to
    expect(findSnap({ pointer: { x: 203, y: 150 }, indexes: [outline], projection, radius: 10 })).toBeNull();
    // On the outer edge at 10.1
    expect(findSnap({ pointer: { x: 104, y: 150 }, indexes: [outline], projection, radius: 10 })?.kind).toBe("edge");
  });
});
