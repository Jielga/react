import { describe, expect, it } from "vitest";
import { erased, renderGrid } from "../../test/gridHarness";
import { GROUP_COLUMN_ID } from "../components/TMDataGridGroupColumn";
import { SELECT_COLUMN_ID } from "../components/TMDataGridSelectColumn";
import {
  getColumnCapabilities,
  getGridCapabilities,
  readFeatureFlags,
} from "./capabilities";

describe("readFeatureFlags", () => {
  it("defaults everything but pagination to on", () => {
    expect(readFeatureFlags({})).toEqual({
      sorting: true,
      frozenSort: false,
      filtering: true,
      globalFiltering: true,
      hiding: true,
      pinning: true,
      resizing: true,
      ordering: true,
      rowSelection: true,
      selectionMode: "checkbox",
      selectColumn: true,
      rowClickSelects: false,
      multiRowSelection: true,
      showSelectedBackground: false,
      highlightRow: false,
      cellSelection: false,
      cellSelectionMode: "none",
      cellRangeSelection: false,
      pagination: false,
      grouping: true,
      editing: false,
      editMode: null,
      editDraft: false,
      editNewRowsSticky: false,
      rowNumbers: false,
      rowPinning: false,
      matchHighlighting: false,
    });
  });

  it("brings the cell cursor along with editing, unless told otherwise", () => {
    expect(readFeatureFlags({ editing: { mode: "cell" } })).toMatchObject({
      editing: true,
      editMode: "cell",
      cellSelectionMode: "single",
    });
    expect(
      readFeatureFlags({ editing: { mode: "cell" }, cellSelection: "range" }),
    ).toMatchObject({ cellSelectionMode: "range" });
    expect(readFeatureFlags({})).toMatchObject({ cellSelectionMode: "none" });
  });

  it("keeps parked entry rows sticky only where the draft store asks for it", () => {
    expect(readFeatureFlags({}).editNewRowsSticky).toBe(false);
    expect(
      readFeatureFlags({ editing: { mode: "cell", draft: true } })
        .editNewRowsSticky,
    ).toBe(false);
    expect(
      readFeatureFlags({
        editing: { mode: "cell", draft: true, newRowsSticky: true },
      }).editNewRowsSticky,
    ).toBe(true);
  });

  it("reads the two editing axes apart", () => {
    expect(readFeatureFlags({})).toMatchObject({
      editing: false,
      editMode: null,
      editDraft: false,
    });
    expect(readFeatureFlags({ editing: { mode: "row" } })).toMatchObject({
      editing: true,
      editMode: "row",
      editDraft: false,
    });
    expect(
      readFeatureFlags({ editing: { mode: "row", draft: true } }),
    ).toMatchObject({ editMode: "row", editDraft: true });
  });

  it("reads the cell selection mode", () => {
    expect(readFeatureFlags({ cellSelection: "single" })).toMatchObject({
      cellSelection: true,
      cellSelectionMode: "single",
      // A rectangle needs somewhere to anchor and a second corner to move; a
      // grid with one focused cell has neither.
      cellRangeSelection: false,
    });
    expect(readFeatureFlags({ cellSelection: "range" })).toMatchObject({
      cellSelection: true,
      cellRangeSelection: true,
    });
    expect(readFeatureFlags({ cellSelection: "none" }).cellSelection).toBe(
      false,
    );
  });

  it("only turns a flag off for an explicit false", () => {
    expect(readFeatureFlags({ enableSorting: false }).sorting).toBe(false);
    expect(readFeatureFlags({ enableSorting: undefined }).sorting).toBe(true);
    expect(readFeatureFlags({ enableColumnFilters: false }).filtering).toBe(
      false,
    );
    expect(readFeatureFlags({ enableHiding: false }).hiding).toBe(false);
    expect(readFeatureFlags({ enableColumnPinning: false }).pinning).toBe(false);
    expect(readFeatureFlags({ enableColumnResizing: false }).resizing).toBe(
      false,
    );
    expect(readFeatureFlags({ enableColumnOrdering: false }).ordering).toBe(
      false,
    );
    expect(readFeatureFlags({ enableRowSelection: false }).rowSelection).toBe(
      false,
    );
  });

  describe("pagination", () => {
    it("is off unless asked for", () => {
      expect(readFeatureFlags({}).pagination).toBe(false);
      expect(readFeatureFlags({ enablePagination: true }).pagination).toBe(true);
    });

    it("is implied by manual pagination", () => {
      expect(readFeatureFlags({ manualPagination: true }).pagination).toBe(true);
    });
  });

  describe("grouping", () => {
    it("is on unless turned off", () => {
      expect(readFeatureFlags({}).grouping).toBe(true);
      expect(readFeatureFlags({ enableGrouping: false }).grouping).toBe(false);
    });

    it("stands down for a server-paged grid, which holds only one page", () => {
      expect(readFeatureFlags({ manualPagination: true }).grouping).toBe(false);
    });

    it("can still be asked for alongside manual pagination", () => {
      expect(
        readFeatureFlags({ manualPagination: true, enableGrouping: true })
          .grouping,
      ).toBe(true);
    });
  });

  describe("row selection mode", () => {
    it("highlights by default only in row mode", () => {
      expect(readFeatureFlags({}).showSelectedBackground).toBe(false);
      expect(
        readFeatureFlags({ selectionMode: "row" }).showSelectedBackground,
      ).toBe(true);
    });

    it("lets the highlight be set against the mode", () => {
      expect(
        readFeatureFlags({ showSelectedBackground: true }).showSelectedBackground,
      ).toBe(true);
      expect(
        readFeatureFlags({
          selectionMode: "row",
          showSelectedBackground: false,
        }).showSelectedBackground,
      ).toBe(false);
    });
  });
});

describe("getColumnCapabilities", () => {
  it("allows everything on an ordinary column", () => {
    const { result } = renderGrid();
    const column = erased(result.current).table.getColumn("name");

    expect(
      column && getColumnCapabilities(column, result.current.features),
    ).toEqual({
      canSort: true,
      canFilter: true,
      canHide: true,
      canPin: true,
      canResize: true,
      canReorder: true,
      canGroup: true,
    });
  });

  it("locks down the generated checkbox column", () => {
    const { result } = renderGrid();
    const column = erased(result.current).table.getColumn(SELECT_COLUMN_ID);
    const capabilities =
      column && getColumnCapabilities(column, result.current.features);

    expect(capabilities?.canSort).toBe(false);
    expect(capabilities?.canFilter).toBe(false);
    expect(capabilities?.canPin).toBe(false);
    expect(capabilities?.canResize).toBe(false);
    expect(capabilities?.canReorder).toBe(false);
    // Not written anywhere: `getCanGroup()` insists on an accessor, and a
    // display column has none.
    expect(capabilities?.canGroup).toBe(false);
  });

  it("locks down the generated tree column", () => {
    const { result } = renderGrid();
    const column = erased(result.current).table.getColumn(GROUP_COLUMN_ID);
    const capabilities =
      column && getColumnCapabilities(column, result.current.features);

    expect(capabilities?.canSort).toBe(false);
    expect(capabilities?.canFilter).toBe(false);
    expect(capabilities?.canHide).toBe(false);
    expect(capabilities?.canPin).toBe(false);
    expect(capabilities?.canReorder).toBe(false);
    expect(capabilities?.canGroup).toBe(false);
  });

  it("a table-level switch overrides a column that allows the feature", () => {
    const { result } = renderGrid({ enableSorting: false });
    const column = erased(result.current).table.getColumn("name");

    expect(
      column && getColumnCapabilities(column, result.current.features).canSort,
    ).toBe(false);
  });
});

describe("getGridCapabilities", () => {
  it("reports what any column can do", () => {
    const { result } = renderGrid();

    expect(
      getGridCapabilities(erased(result.current).table, result.current.features),
    ).toMatchObject({
      canSortAny: true,
      canFilterAny: true,
      canHideAny: true,
      canPinAny: true,
      canReorderAny: true,
      canSelectRows: true,
      canPaginate: false,
    });
  });

  it("goes false across the board when the table switches a feature off", () => {
    const { result } = renderGrid({
      enableSorting: false,
      enableColumnFilters: false,
      enableHiding: false,
      enableColumnPinning: false,
      enableColumnOrdering: false,
      enableRowSelection: false,
    });

    expect(
      getGridCapabilities(erased(result.current).table, result.current.features),
    ).toMatchObject({
      canSortAny: false,
      canFilterAny: false,
      canHideAny: false,
      canPinAny: false,
      canReorderAny: false,
      canSelectRows: false,
    });
  });

  it("follows the pagination flag", () => {
    const { result } = renderGrid({ enablePagination: true });

    expect(
      getGridCapabilities(erased(result.current).table, result.current.features)
        .canPaginate,
    ).toBe(true);
  });
});
