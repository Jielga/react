import type { RowSelectionState } from "@tanstack/react-table";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { erased, renderGrid } from "../../test/gridHarness";
import type { TMDataGridRowData } from "../TMDataGridContext";
import {
  getDisplayedRows,
  getSelectableRowIds,
  resolveRowSelectionClick,
  type ResolveRowSelectionClickArgs,
  type TMDataGridRowClickModifiers,
} from "./rowSelection";

/**
 * `resolveRowSelectionClick` is the whole click-to-select convention in one
 * pure function - the table in its doc comment is the contract tested here.
 * `getDisplayedRows` and `getSelectableRowIds` have their grouping behaviour
 * covered in `grouping.test.ts`; what this file adds for them is the row
 * pinning exclusion.
 *
 * The harness grid has twelve rows with ids "1"–"12" in display order.
 */
const plain: TMDataGridRowClickModifiers = { toggle: false, extend: false };
const ctrl: TMDataGridRowClickModifiers = { toggle: true, extend: false };
const shift: TMDataGridRowClickModifiers = { toggle: false, extend: true };
const ctrlShift: TMDataGridRowClickModifiers = { toggle: true, extend: true };

type GridOptions = Parameters<typeof renderGrid>[0];

function displayedRows(options: GridOptions = {}) {
  const api = erased(renderGrid(options).result.current);
  return { api, rows: getDisplayedRows(api.table, api.features) };
}

/** All arguments explicit at every call site would drown the one that varies. */
function resolveOn(
  rows: ReturnType<typeof displayedRows>["rows"],
  overrides: Partial<ResolveRowSelectionClickArgs<TMDataGridRowData>> & {
    rowId: string;
  },
) {
  return resolveRowSelectionClick({
    rows,
    anchorRowId: null,
    modifiers: plain,
    selection: {},
    canReplaceSelection: true,
    ...overrides,
  });
}

const selected = (ids: Array<string>): RowSelectionState =>
  Object.fromEntries(ids.map((id) => [id, true] as const));

describe("a plain click", () => {
  it("replaces the selection with the clicked row and moves the anchor there", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "3",
      selection: selected(["1", "7"]),
      anchorRowId: "7",
    });

    expect(resolved.selection).toEqual(selected(["3"]));
    expect(resolved.anchorRowId).toBe("3");
  });

  it("leaves the state untouched when the clicked row is not displayed", () => {
    const { rows } = displayedRows();
    const selection = selected(["1"]);

    const resolved = resolveOn(rows, {
      rowId: "99",
      selection,
      anchorRowId: "1",
    });

    expect(resolved.selection).toBe(selection);
    expect(resolved.anchorRowId).toBe("1");
  });
});

describe("a ctrl/cmd click", () => {
  it("toggles the row on and leaves the rest alone", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "3",
      selection: selected(["1"]),
      modifiers: ctrl,
    });

    expect(resolved.selection).toEqual(selected(["1", "3"]));
    expect(resolved.anchorRowId).toBe("3");
  });

  it("toggles an already selected row off", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "1",
      selection: selected(["1", "3"]),
      modifiers: ctrl,
    });

    expect(resolved.selection).toEqual(selected(["3"]));
  });
});

describe("a shift click", () => {
  it("becomes the range from the anchor, replacing what was there", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "5",
      selection: selected(["9"]),
      anchorRowId: "2",
      modifiers: shift,
    });

    expect(resolved.selection).toEqual(selected(["2", "3", "4", "5"]));
  });

  it("measures the range upward from the anchor just as well", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "2",
      anchorRowId: "5",
      modifiers: shift,
    });

    expect(resolved.selection).toEqual(selected(["2", "3", "4", "5"]));
  });

  it("keeps the pivot, so the next shift-click reshapes the range rather than chaining", () => {
    const { rows } = displayedRows();

    const grown = resolveOn(rows, {
      rowId: "6",
      anchorRowId: "2",
      modifiers: shift,
    });
    expect(grown.anchorRowId).toBe("2");

    const shrunk = resolveOn(rows, {
      rowId: "3",
      selection: grown.selection,
      anchorRowId: grown.anchorRowId,
      modifiers: shift,
    });

    expect(shrunk.selection).toEqual(selected(["2", "3"]));
    expect(shrunk.anchorRowId).toBe("2");
  });

  it("acts as a fresh click while there is no anchor yet", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, { rowId: "4", modifiers: shift });

    expect(resolved.selection).toEqual(selected(["4"]));
    expect(resolved.anchorRowId).toBe("4");
  });

  it("acts as a fresh click when the anchor has been paged away", () => {
    // Page one holds rows "1"–"5"; the anchor sits on a later page.
    const { rows } = displayedRows({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    });
    expect(rows.map((row) => row.id)).toEqual(["1", "2", "3", "4", "5"]);

    const resolved = resolveOn(rows, {
      rowId: "4",
      anchorRowId: "7",
      modifiers: shift,
    });

    expect(resolved.selection).toEqual(selected(["4"]));
    expect(resolved.anchorRowId).toBe("4");
  });
});

describe("a ctrl+shift click", () => {
  it("adds the range to the selection instead of becoming it", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "4",
      selection: selected(["9"]),
      anchorRowId: "2",
      modifiers: ctrlShift,
    });

    expect(resolved.selection).toEqual(selected(["9", "2", "3", "4"]));
    expect(resolved.anchorRowId).toBe("2");
  });
});

describe("a checkbox gesture", () => {
  // `canReplaceSelection: false` - ticking one box never clears the others.
  it("adds without clearing the rest, even unmodified", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "3",
      selection: selected(["1"]),
      canReplaceSelection: false,
    });

    expect(resolved.selection).toEqual(selected(["1", "3"]));
  });

  it("unticks on the second click", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "3",
      selection: selected(["1", "3"]),
      canReplaceSelection: false,
    });

    expect(resolved.selection).toEqual(selected(["1"]));
  });

  it("shift-clicks a range in as an addition, not a replacement", () => {
    const { rows } = displayedRows();

    const resolved = resolveOn(rows, {
      rowId: "4",
      selection: selected(["9"]),
      anchorRowId: "2",
      modifiers: shift,
      canReplaceSelection: false,
    });

    expect(resolved.selection).toEqual(selected(["9", "2", "3", "4"]));
  });
});

describe("under enableMultiRowSelection: false", () => {
  const singleSelect = () => displayedRows({ enableMultiRowSelection: false });

  it("collapses a ctrl-click to the one row", () => {
    const { rows } = singleSelect();

    const resolved = resolveOn(rows, {
      rowId: "3",
      selection: selected(["1"]),
      modifiers: ctrl,
    });

    expect(resolved.selection).toEqual(selected(["3"]));
    expect(resolved.anchorRowId).toBe("3");
  });

  it("collapses a shift-range to its endpoint", () => {
    const { rows } = singleSelect();

    const resolved = resolveOn(rows, {
      rowId: "4",
      anchorRowId: "1",
      modifiers: shift,
    });

    expect(resolved.selection).toEqual(selected(["4"]));
  });

  it("keeps a row click from emptying the selection on a re-click", () => {
    const { rows } = singleSelect();

    const resolved = resolveOn(rows, {
      rowId: "3",
      selection: selected(["3"]),
    });

    expect(resolved.selection).toEqual(selected(["3"]));
  });

  it("still lets a checkbox untick the one selected row", () => {
    const { rows } = singleSelect();

    const resolved = resolveOn(rows, {
      rowId: "3",
      selection: selected(["3"]),
      canReplaceSelection: false,
    });

    expect(resolved.selection).toEqual({});
  });
});

describe("with a selection predicate", () => {
  // Rows "2", "5", "8" and "11" refuse to be selected.
  const predicated = () =>
    displayedRows({
      enableRowSelection: (row) => Number(row.id) % 3 !== 2,
    } as GridOptions);

  it("leaves the state untouched when the clicked row refuses", () => {
    const { rows } = predicated();
    const selection = selected(["1"]);

    const resolved = resolveOn(rows, {
      rowId: "2",
      selection,
      anchorRowId: "1",
    });

    expect(resolved.selection).toBe(selection);
    expect(resolved.anchorRowId).toBe("1");
  });

  it("sweeps a range over refused rows without taking them", () => {
    const { rows } = predicated();

    const resolved = resolveOn(rows, {
      rowId: "6",
      anchorRowId: "1",
      modifiers: shift,
    });

    expect(resolved.selection).toEqual(selected(["1", "3", "4", "6"]));
  });
});

describe("under grouping", () => {
  function groupedByCity() {
    const rendered = renderGrid();
    const api = erased(rendered.result.current);
    act(() => {
      api.table.setGrouping(["city"]);
    });
    // Three collapsed city groups over the twelve rows, four leaves each.
    return { api, rows: getDisplayedRows(api.table, api.features) };
  }

  it("clicking a collapsed group selects its leaves, never the group row", () => {
    const { rows } = groupedByCity();
    const group = rows[0];
    if (group === undefined) throw new Error("expected a group row");

    const resolved = resolveOn(rows, { rowId: group.id });

    expect(resolved.selection).toEqual(selected(getSelectableRowIds(group)));
    expect(resolved.selection[group.id]).toBeUndefined();
    expect(resolved.anchorRowId).toBe(group.id);
  });

  it("takes the whole subtree of every group a range sweeps past", () => {
    const { rows } = groupedByCity();
    const [first, , third] = rows;
    if (first === undefined || third === undefined)
      throw new Error("expected three group rows");

    const resolved = resolveOn(rows, {
      rowId: third.id,
      anchorRowId: first.id,
      modifiers: shift,
    });

    // All twelve leaves, though none of them are displayed.
    expect(Object.keys(resolved.selection)).toHaveLength(12);
  });

  it("ctrl-clicking a fully selected group unticks exactly its leaves", () => {
    const { rows } = groupedByCity();
    const group = rows[0];
    if (group === undefined) throw new Error("expected a group row");
    const leaves = getSelectableRowIds(group);

    const resolved = resolveOn(rows, {
      rowId: group.id,
      selection: selected([...leaves, "99"]),
      modifiers: ctrl,
    });

    expect(resolved.selection).toEqual(selected(["99"]));
  });

  it("refuses a group under single-select, which cannot express it", () => {
    const rendered = renderGrid({ enableMultiRowSelection: false });
    const api = erased(rendered.result.current);
    act(() => {
      api.table.setGrouping(["city"]);
    });
    const rows = getDisplayedRows(api.table, api.features);
    const group = rows[0];
    if (group === undefined) throw new Error("expected a group row");
    const selection = selected(["1"]);

    const resolved = resolveOn(rows, { rowId: group.id, selection });

    expect(resolved.selection).toBe(selection);
  });
});

describe("getDisplayedRows and row pinning", () => {
  it("leaves pinned rows out of the displayed order", () => {
    const rendered = renderGrid({ enableRowPinning: true });
    const api = erased(rendered.result.current);

    act(() => {
      api.table.getRow("2").pin("top");
      api.table.getRow("5").pin("bottom");
    });

    // They render in their own sticky blocks, so a shift-click range and the
    // virtualizer must both walk an order without them.
    const ids = getDisplayedRows(api.table, api.features).map((row) => row.id);
    expect(ids).toHaveLength(10);
    expect(ids).not.toContain("2");
    expect(ids).not.toContain("5");
  });
});
