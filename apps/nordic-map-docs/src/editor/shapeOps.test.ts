import { describe, expect, it } from "vitest";
import { boundsOfParts } from "./editorModel.ts";
import type { Part } from "./editorModel.ts";
import { clipParts, unionParts } from "./shapeOps.ts";

function box({ west, south, east, north }: { west: number; south: number; east: number; north: number }): Part {
  return [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
    ],
  ];
}

describe("shapeOps", () => {
  it("joins neighbours into one part without the border they share", () => {
    const joined = unionParts([[box({ west: 0, south: 0, east: 1, north: 1 })], [box({ west: 1, south: 0, east: 2, north: 1 })]]);
    expect(joined).toHaveLength(1);
    expect(boundsOfParts(joined)).toEqual({ west: 0, south: 0, east: 2, north: 1 });
  });

  it("keeps what lies inside any of the land shapes", () => {
    const land = [[box({ west: 0, south: 0, east: 1, north: 1 })], [box({ west: 1, south: 0, east: 2, north: 1 })], [box({ west: 5, south: 5, east: 6, north: 6 })]];
    const clipped = clipParts({ parts: [box({ west: 0.5, south: -1, east: 1.5, north: 0.5 })], land });
    expect(clipped).toHaveLength(1);
    expect(boundsOfParts(clipped)).toEqual({ west: 0.5, south: 0, east: 1.5, north: 0.5 });
    expect(clipParts({ parts: [box({ west: 3, south: 3, east: 4, north: 4 })], land })).toEqual([]);
  });
});
