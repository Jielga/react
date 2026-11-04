import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  cellAt,
  part,
  renderWithMantine,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import {
  buildExportData,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridApi,
  type UseTMDataGridOptions,
} from "../index";

/**
 * The table state the edit engine has to leave alone, and the table state it
 * has to keep in step with the draft store. Rendered through the full grid:
 * TanStack's auto-resets run from the core row model's memo, which only
 * recomputes when something reads it, and the table body does on every
 * render.
 */
function DraftGrid({
  onReady,
  ...options
}: Partial<UseTMDataGridOptions<TestRow>> & {
  onReady: (api: TMDataGridApi<TestRow>) => void;
}) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row) => String(row.id),
    editing: { mode: "row", draft: true, onSaveDrafts: vi.fn() },
    ...options,
  } as UseTMDataGridOptions<TestRow>);
  onReady(grid);
  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.DraftActions />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<TestRow> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}

function renderDraftGrid(options: Partial<UseTMDataGridOptions<TestRow>> = {}) {
  let api!: TMDataGridApi<TestRow>;
  renderWithMantine(<DraftGrid {...options} onReady={(grid) => (api = grid)} />);
  return api;
}

/** TanStack schedules its auto-resets in a microtask; let them run. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe("table state across a draft commit", () => {
  it("keeps the page the commit was made on", async () => {
    const api = renderDraftGrid({
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    });
    act(() => {
      api.table.setPageIndex(1);
    });

    await act(async () => {
      await api.edit.setCellValue("7", "name", "Edited");
    });
    await settle();

    expect(api.table.store.state.pagination.pageIndex).toBe(1);
  });

  it("keeps details panels and groups open", async () => {
    const api = renderDraftGrid({
      renderDetails: ({ row }) => <div>{row.original.name}</div>,
    });
    act(() => {
      api.table.getRow("2").toggleExpanded(true);
    });

    await act(async () => {
      await api.edit.setCellValue("1", "name", "Edited");
    });
    await settle();
    expect(api.table.store.state.expanded).toEqual({ "2": true });

    act(() => {
      api.table.setGrouping(["city"]);
    });
    await settle();
    act(() => {
      api.table.setExpanded({ "city:Stockholm": true });
    });
    await act(async () => {
      await api.edit.setCellValue("1", "name", "Edited again");
    });
    await settle();
    expect(api.table.store.state.expanded).toEqual({ "city:Stockholm": true });
  });

  it("still goes back to the first page when the query changes", async () => {
    const api = renderDraftGrid({
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    });
    const city = api.table.getColumn("city")!;

    act(() => {
      api.table.setPageIndex(1);
    });
    act(() => {
      city.setFilterValue({ operator: "contains", value: "Malmö" });
    });
    expect(api.table.store.state.pagination.pageIndex).toBe(0);

    act(() => {
      city.setFilterValue(undefined);
    });
    act(() => {
      api.table.setPageIndex(1);
    });
    act(() => {
      api.table.setSorting([{ id: "name", desc: true }]);
    });
    expect(api.table.store.state.pagination.pageIndex).toBe(0);

    act(() => {
      api.table.setPageIndex(1);
    });
    act(() => {
      api.table.setGrouping(["city"]);
    });
    expect(api.table.store.state.pagination.pageIndex).toBe(0);
  });
});

describe("deletion-marked rows", () => {
  it("are skipped by select-all and their own box is disabled", () => {
    const api = renderDraftGrid();
    act(() => {
      api.edit.deleteRows(["1", "2"]);
    });

    act(() => {
      api.table.toggleAllRowsSelected(true);
    });

    const selected = Object.keys(api.table.store.state.rowSelection);
    expect(selected).toHaveLength(testRows.length - 2);
    expect(selected).not.toContain("1");
    expect(api.table.getIsAllRowsSelected()).toBe(true);
    expect(part("select-row", { rowId: "1" })).toBeDisabled();
    expect(part("select-row", { rowId: "3" })).toBeEnabled();
  });

  it("count as out of a group's selection once marked", () => {
    const api = renderDraftGrid({
      enableGrouping: true,
      initialState: { grouping: ["city"] },
    });
    // Stockholm holds rows 1, 4, 7 and 10.
    act(() => {
      for (const id of ["1", "4", "7"]) api.table.getRow(id).toggleSelected(true);
    });
    const groupBox = () =>
      part("select-row", { rowId: "city:Stockholm" }) as HTMLInputElement;
    expect(groupBox().indeterminate).toBe(true);

    act(() => {
      api.edit.deleteRow("10");
    });
    // Every selectable leaf is selected now.
    expect(groupBox().indeterminate).toBe(false);
    expect(groupBox().checked).toBe(true);

    act(() => {
      api.edit.restoreRow("10");
    });
    expect(groupBox().checked).toBe(false);
    expect(groupBox().indeterminate).toBe(true);
  });

  it("cannot be opened from the keyboard", () => {
    const api = renderDraftGrid();
    act(() => {
      api.edit.deleteRow("1");
    });
    const nameCell = cellAt(0, 2);
    act(() => {
      fireEvent.mouseDown(nameCell);
      fireEvent.click(nameCell);
    });

    act(() => {
      fireEvent.keyDown(nameCell, { key: "Enter" });
    });
    act(() => {
      fireEvent.keyDown(nameCell, { key: "F2" });
    });

    expect(api.edit.state.openRowIds).toEqual([]);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("are left out of an export and count once in Save", async () => {
    const api = renderDraftGrid();
    await act(async () => {
      await api.edit.setCellValue("1", "name", "Edited");
    });
    act(() => {
      api.edit.deleteRows(["1", "2"]);
    });

    const exported = buildExportData({ table: api.table, rows: "all" });
    expect(exported.rows).toHaveLength(testRows.length - 2);
    // Row 1 is edited and marked: one deletion, not an update as well.
    expect(part("save-all").textContent).toMatch(/\b2\b/);
  });
});
