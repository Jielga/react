import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderGrid } from "../../test/gridHarness";
import { buildMatchNeedles, findMatchRanges } from "./matchHighlight";
import type { TMDataGridFilterValue } from "./filterOperators";

describe("findMatchRanges", () => {
  it("finds every occurrence, case-insensitively", () => {
    expect(findMatchRanges("Anna and ANNA", ["anna"])).toEqual([
      { start: 0, end: 4 },
      { start: 9, end: 13 },
    ]);
  });

  it("merges overlapping and touching needles into one range", () => {
    expect(findMatchRanges("Stockholm", ["Stock", "ockh", "holm"])).toEqual([
      { start: 0, end: 9 },
    ]);
  });

  it("returns null when nothing matches, and ignores empty needles", () => {
    expect(findMatchRanges("Stockholm", ["Malmö", ""])).toBeNull();
  });
});

describe("buildMatchNeedles", () => {
  it("is null while nothing highlightable is active", () => {
    const grid = renderGrid({});
    expect(buildMatchNeedles(grid.result.current.table)).toBeNull();
  });

  it("maps the quick search to searchable columns and filters to their own", () => {
    const grid = renderGrid({});

    act(() => {
      grid.result.current.table.setGlobalFilter("anna");
      grid.result.current.table.getColumn("city")?.setFilterValue({
        operator: "contains",
        value: "holm",
      } satisfies TMDataGridFilterValue);
    });

    const needles = buildMatchNeedles(grid.result.current.table);
    expect(needles?.get("name")).toEqual(["anna"]);
    expect(needles?.get("city")).toEqual(["anna", "holm"]);
  });

  it("skips operators whose match is not a substring", () => {
    const grid = renderGrid({});

    act(() => {
      grid.result.current.table.getColumn("age")?.setFilterValue({
        operator: "greaterThan",
        value: "30",
      } satisfies TMDataGridFilterValue);
    });

    expect(buildMatchNeedles(grid.result.current.table)).toBeNull();
  });
});
