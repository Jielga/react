import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { erased, renderGrid } from "../../test/gridHarness";
import { areAllRowsExpanded, resolveExpandAll } from "./expanding";

/**
 * The two kinds of expansion share one `expanded` state, so what these guard is
 * that a control for one kind leaves the other alone. Built through the hook,
 * so the rows are real grouped rows rather than stand-ins.
 */
function groupedGrid() {
  const { result } = renderGrid({ renderDetails: () => null });
  const api = erased(result.current);
  act(() => api.table.setGrouping(["city"]));
  return {
    table: api.table,
    rows: () => api.table.getPrePaginatedRowModel().flatRows,
  };
}

describe("resolveExpandAll", () => {
  it("opens every group and no detail", () => {
    const grid = groupedGrid();

    const next = resolveExpandAll({
      rows: grid.rows(),
      expanded: {},
      target: "groups",
      expand: true,
    });

    expect(next).toEqual({
      "city:Stockholm": true,
      "city:Göteborg": true,
      "city:Malmö": true,
    });
  });

  it("opens every detail and no group", () => {
    const grid = groupedGrid();

    const next = resolveExpandAll({
      rows: grid.rows(),
      expanded: {},
      target: "details",
      expand: true,
    });

    // A set: a grouped model lists its leaves both under their group and in the
    // flat list, so `rows` repeats them. Writing the same id twice is the same
    // as writing it once, which is why the helpers can ignore that.
    expect(new Set(Object.keys(next as Record<string, boolean>))).toEqual(
      new Set(
        grid
          .rows()
          .filter((row) => !row.getIsGrouped())
          .map((row) => row.id),
      ),
    );
  });

  it("leaves the other kind exactly as it was", () => {
    const grid = groupedGrid();

    const next = resolveExpandAll({
      rows: grid.rows(),
      expanded: { "city:Stockholm": true, "3": true },
      target: "details",
      expand: false,
    });

    // The open group survives collapsing every detail.
    expect(next).toEqual({ "city:Stockholm": true });
  });

  it("writes the whole-table form out before taking one kind back out of it", () => {
    const grid = groupedGrid();

    const next = resolveExpandAll({
      rows: grid.rows(),
      expanded: true,
      target: "details",
      expand: false,
    }) as Record<string, boolean>;

    // `true` means everything is open. Collapsing the details has to leave the
    // groups open, which the state can only say as a map.
    expect(next["city:Stockholm"]).toBe(true);
    expect(next["3"]).toBeUndefined();
  });
});

describe("areAllRowsExpanded", () => {
  it("asks only about its own kind", () => {
    const grid = groupedGrid();
    const rows = grid.rows();
    const everyGroup = resolveExpandAll({
      rows,
      expanded: {},
      target: "groups",
      expand: true,
    });

    expect(areAllRowsExpanded({ rows, expanded: everyGroup, target: "groups" }))
      .toBe(true);
    expect(
      areAllRowsExpanded({ rows, expanded: everyGroup, target: "details" }),
    ).toBe(false);
  });

  it("counts the whole-table form as all expanded", () => {
    const grid = groupedGrid();

    expect(
      areAllRowsExpanded({
        rows: grid.rows(),
        expanded: true,
        target: "details",
      }),
    ).toBe(true);
  });

  it("is false when there are none of that kind - nothing to collapse", () => {
    const { result } = renderGrid({ renderDetails: () => null });
    const rows = erased(result.current).table.getPrePaginatedRowModel().flatRows;

    // Ungrouped: every row is a data row, so there is no group to be open.
    expect(areAllRowsExpanded({ rows, expanded: true, target: "groups" })).toBe(
      false,
    );
  });
});
