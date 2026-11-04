import { describe, expect, it } from "vitest";
import {
  geometryFromParts,
  insertVertex,
  moveVertex,
  partsContain,
  partsFromGeometry,
  removeVertex,
  ringCrossesItself,
} from "./editorModel.ts";
import type { Part } from "./editorModel.ts";

const square: Part = [
  [
    [10, 60],
    [12, 60],
    [12, 62],
    [10, 62],
  ],
];

describe("editorModel", () => {
  it("opens closed rings, and closes them again for GeoJSON", () => {
    const parts = partsFromGeometry({
      type: "Polygon",
      coordinates: [
        [
          [10, 60],
          [12, 60],
          [12, 62],
          [10, 62],
          [10, 60],
        ],
      ],
    });
    expect(parts).toEqual([square]);
    expect(geometryFromParts({ parts, decimals: 5 })).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [10, 60],
          [12, 60],
          [12, 62],
          [10, 62],
          [10, 60],
        ],
      ],
    });
  });

  it("drops repeated points and rings with fewer than 3 points", () => {
    const parts = partsFromGeometry({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [1, 1],
            [1, 1],
            [2, 1],
            [2, 2],
            [1, 1],
          ],
        ],
        [
          [
            [5, 5],
            [6, 6],
            [5, 5],
          ],
        ],
      ],
    });
    expect(parts).toEqual([
      [
        [
          [1, 1],
          [2, 1],
          [2, 2],
        ],
      ],
    ]);
  });

  it("writes a MultiPolygon for more than one part, rounded", () => {
    const geometry = geometryFromParts({
      parts: [
        square,
        [
          [
            [20.123456, 65],
            [21, 65],
            [21, 66],
          ],
        ],
      ],
      decimals: 2,
    });
    expect(geometry?.type).toBe("MultiPolygon");
    expect(geometry?.coordinates[1]).toEqual([
      [
        [20.12, 65],
        [21, 65],
        [21, 66],
        [20.12, 65],
      ],
    ]);
    expect(geometryFromParts({ parts: [], decimals: 5 })).toBeNull();
  });

  it("moves, inserts and removes points without touching the other rings", () => {
    const parts = [square];
    const moved = moveVertex({ parts, ref: { part: 0, ring: 0, index: 1 }, to: [13, 59] });
    expect(moved[0]?.[0]?.[1]).toEqual([13, 59]);
    expect(parts[0]?.[0]?.[1]).toEqual([12, 60]);

    const inserted = insertVertex({ parts, ref: { part: 0, ring: 0, index: 4 }, at: [9, 61] });
    expect(inserted[0]?.[0]).toHaveLength(5);
    expect(inserted[0]?.[0]?.[4]).toEqual([9, 61]);

    const removed = removeVertex({ parts: inserted, ref: { part: 0, ring: 0, index: 4 } });
    expect(removed).toEqual(parts);
  });

  it("removes a part whose outer ring falls below 3 points, and a hole that does", () => {
    const triangle: Part = [
      [
        [0, 0],
        [4, 0],
        [0, 4],
      ],
      [
        [1, 1],
        [2, 1],
        [1, 2],
      ],
    ];
    expect(removeVertex({ parts: [triangle], ref: { part: 0, ring: 1, index: 0 } })).toEqual([[triangle[0]]]);
    expect(removeVertex({ parts: [triangle, square], ref: { part: 0, ring: 0, index: 0 } })).toEqual([square]);
  });

  it("finds a ring that crosses itself", () => {
    expect(ringCrossesItself(square[0] ?? [])).toBe(false);
    expect(
      ringCrossesItself([
        [0, 0],
        [2, 2],
        [2, 0],
        [0, 2],
      ]),
    ).toBe(true);
  });

  it("tells whether a point is inside, holes left out", () => {
    const withHole: Part = [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
      ],
    ];
    expect(partsContain({ parts: [withHole], point: [2, 2] })).toBe(true);
    expect(partsContain({ parts: [withHole], point: [5, 5] })).toBe(false);
    expect(partsContain({ parts: [withHole], point: [11, 5] })).toBe(false);
  });
});
