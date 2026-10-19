import { describe, expect, it } from "vitest";
import {
  boundsCellCount,
  boundsEdges,
  isWithinBounds,
  resolveRangeBounds,
} from "./cellRange";

const ROWS = ["1", "2", "3", "4", "5"];
const COLUMNS = ["id", "name", "age", "city"];

const bounds = (
  anchor: [string, string],
  focus: [string, string],
) =>
  resolveRangeBounds({
    range: {
      anchor: { rowId: anchor[0], columnId: anchor[1] },
      focus: { rowId: focus[0], columnId: focus[1] },
    },
    rowIndexOf: (rowId) => ROWS.indexOf(rowId),
    columnIndexOf: (columnId) => COLUMNS.indexOf(columnId),
  });

describe("resolveRangeBounds", () => {
  it("orders the corners, whichever way the range was drawn", () => {
    const downRight = bounds(["2", "name"], ["4", "city"]);
    const upLeft = bounds(["4", "city"], ["2", "name"]);

    expect(downRight).toEqual({ top: 1, bottom: 3, left: 1, right: 3 });
    expect(upLeft).toEqual(downRight);
  });

  it("is a single cell when both corners are the same", () => {
    expect(bounds(["3", "age"], ["3", "age"])).toEqual({
      top: 2,
      bottom: 2,
      left: 2,
      right: 2,
    });
  });

  it("has no rectangle when a corner is filtered or hidden away", () => {
    // A row that is not in the current model, and a column that is not visible.
    expect(bounds(["99", "name"], ["4", "city"])).toBeNull();
    expect(bounds(["2", "name"], ["4", "secret"])).toBeNull();
  });

  it("has no rectangle without a range", () => {
    expect(
      resolveRangeBounds({
        range: null,
        rowIndexOf: () => 0,
        columnIndexOf: () => 0,
      }),
    ).toBeNull();
  });
});

describe("isWithinBounds", () => {
  const block = { top: 1, bottom: 3, left: 1, right: 2 };

  it("includes both edges", () => {
    expect(isWithinBounds(block, 1, 1)).toBe(true);
    expect(isWithinBounds(block, 3, 2)).toBe(true);
    expect(isWithinBounds(block, 2, 2)).toBe(true);
  });

  it("excludes everything outside", () => {
    expect(isWithinBounds(block, 0, 1)).toBe(false);
    expect(isWithinBounds(block, 4, 1)).toBe(false);
    expect(isWithinBounds(block, 2, 0)).toBe(false);
    expect(isWithinBounds(block, 2, 3)).toBe(false);
    expect(isWithinBounds(null, 2, 2)).toBe(false);
  });
});

describe("boundsCellCount", () => {
  it("counts the cells the rectangle covers", () => {
    expect(boundsCellCount({ top: 1, bottom: 3, left: 1, right: 2 })).toBe(6);
    expect(boundsCellCount({ top: 0, bottom: 0, left: 0, right: 0 })).toBe(1);
    expect(boundsCellCount(null)).toBe(0);
  });
});

describe("boundsEdges", () => {
  const block = { top: 1, bottom: 3, left: 1, right: 2 };

  it("marks the sides a cell sits on", () => {
    expect(boundsEdges(block, 1, 1)).toEqual({
      top: true,
      bottom: false,
      left: true,
      right: false,
    });
    expect(boundsEdges(block, 2, 2)).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: true,
    });
  });

  it("marks all four for a range of one cell", () => {
    expect(boundsEdges({ top: 2, bottom: 2, left: 2, right: 2 }, 2, 2)).toEqual({
      top: true,
      bottom: true,
      left: true,
      right: true,
    });
  });

  it("has nothing to say about a cell outside the rectangle", () => {
    expect(boundsEdges(block, 0, 0)).toBeNull();
    expect(boundsEdges(null, 0, 0)).toBeNull();
  });

  it("addresses a spanning cell by its first column", () => {
    const bounds = { top: 1, bottom: 1, left: 2, right: 3 };
    // The cell covers columns 2-5: inside by its first column, and the
    // rectangle's right edge falls inside it.
    expect(boundsEdges(bounds, 1, 2, 5)).toEqual({
      top: true,
      bottom: true,
      left: true,
      right: true,
    });
    // A cell at 1 covering 1-5 is outside: the rectangle does not hold its
    // first column.
    expect(isWithinBounds(bounds, 1, 1)).toBe(false);
    expect(boundsEdges(bounds, 1, 1, 5)).toBeNull();
  });

});
