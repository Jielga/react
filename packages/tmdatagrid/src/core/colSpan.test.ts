import { describe, expect, it } from "vitest";
import {
  resolveColSpans,
  spanAnchorIndex,
  spanEndIndex,
  type TMDataGridColumnSection,
} from "./colSpan";
import { DETAILS_COLUMN_ID } from "../components/TMDataGridDetailsColumn";
import { EDIT_COLUMN_ID } from "../components/TMDataGridEditColumn";
import { SELECT_COLUMN_ID } from "../components/TMDataGridSelectColumn";

const center = (...ids: Array<string>) =>
  ids.map((id) => ({ id, section: "center" as TMDataGridColumnSection }));

describe("resolveColSpans", () => {
  it("is all ones when nothing spans", () => {
    expect(resolveColSpans(center("a", "b", "c"), () => 1)).toEqual([1, 1, 1]);
  });

  it("covers the columns to the right of the spanning cell", () => {
    const spans = resolveColSpans(center("a", "b", "c", "d", "e"), (index) =>
      index === 1 ? 3 : 1,
    );
    expect(spans).toEqual([1, 3, 0, 0, 1]);
  });

  it("clamps to the last column", () => {
    expect(
      resolveColSpans(center("a", "b", "c"), (index) =>
        index === 0 ? Infinity : 1,
      ),
    ).toEqual([3, 0, 0]);
  });

  it("ignores the request of a covered column", () => {
    expect(
      resolveColSpans(center("a", "b", "c", "d"), (index) =>
        index === 0 ? 2 : index === 1 ? 3 : 1,
      ),
    ).toEqual([2, 0, 1, 1]);
  });

  it("treats a request below 1 or not a number as 1, and floors the rest", () => {
    expect(resolveColSpans(center("a", "b"), () => 0)).toEqual([1, 1]);
    expect(resolveColSpans(center("a", "b"), () => Number.NaN)).toEqual([1, 1]);
    expect(
      resolveColSpans(center("a", "b", "c"), (index) => (index === 0 ? 2.9 : 1)),
    ).toEqual([2, 0, 1]);
  });

  it("never covers or spans a generated lane", () => {
    const columns = [
      { id: SELECT_COLUMN_ID, section: "left" as const },
      { id: DETAILS_COLUMN_ID, section: "left" as const },
      ...center("a", "b"),
      { id: EDIT_COLUMN_ID, section: "right" as const },
    ];
    const spans = resolveColSpans(columns, () => Infinity);
    expect(spans).toEqual([1, 1, 2, 0, 1]);
  });

  it("stops at the edge of the pinned block", () => {
    const columns = [
      { id: "a", section: "left" as const },
      { id: "b", section: "left" as const },
      ...center("c", "d"),
      { id: "e", section: "right" as const },
    ];
    expect(resolveColSpans(columns, () => Infinity)).toEqual([2, 0, 2, 0, 1]);
  });
});

describe("spanAnchorIndex / spanEndIndex", () => {
  const spans = [1, 3, 0, 0, 1];

  it("maps a covered column onto the cell covering it", () => {
    expect(spanAnchorIndex(spans, 3)).toBe(1);
    expect(spanAnchorIndex(spans, 1)).toBe(1);
    expect(spanAnchorIndex(spans, 4)).toBe(4);
  });

  it("finds the last column a cell covers", () => {
    expect(spanEndIndex(spans, 1)).toBe(3);
    expect(spanEndIndex(spans, 2)).toBe(3);
    expect(spanEndIndex(spans, 0)).toBe(0);
  });
});
