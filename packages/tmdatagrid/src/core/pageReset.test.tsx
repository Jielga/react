import { act, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import {
  MantineWrapper,
  part,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { TMDataGrid } from "../components/TMDataGrid";
import { type TMDataGridApi, useTMDataGrid } from "../index";

/** One entry per query the consumer would have sent to a server. */
type Query = { pageIndex: number; filters: number; sorts: number };

function ServerGrid({
  onReady,
  queries,
  resetPageOnQueryChange,
  withSummaryCount,
}: {
  onReady: (api: TMDataGridApi<TestRow>) => void;
  queries: Array<Query>;
  resetPageOnQueryChange?: boolean;
  withSummaryCount?: boolean;
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  // What a consumer's fetch effect would have sent, recorded per render pass
  // rather than in an effect so the assertions can count render passes too.
  queries.push({
    pageIndex: pagination.pageIndex,
    filters: columnFilters.length,
    sorts: sorting.length,
  });

  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row: TestRow) => String(row.id),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    rowCount: 200,
    resetPageOnQueryChange,
    state: { pagination, columnFilters, sorting },
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
  } as never);
  onReady(grid);

  return (
    <TMDataGrid {...grid}>
      {withSummaryCount ? (
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
        </TMDataGrid.Toolbar>
      ) : null}
      <TMDataGrid.Table<TestRow> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}

const filterCity = (api: TMDataGridApi<TestRow>) =>
  act(() =>
    api.table
      .getColumn("city")!
      .setFilterValue({ operator: "contains", value: "Malmö" }),
  );

describe("the first-page reset under manualPagination", () => {
  it("takes a filter change back to page 0", () => {
    let api: TMDataGridApi<TestRow> | null = null;
    const queries: Array<Query> = [];
    render(
      <ServerGrid queries={queries} onReady={(grid) => (api = grid)} />,
      { wrapper: MantineWrapper },
    );

    act(() => api!.table.setPageIndex(3));
    expect(api!.table.store.state.pagination.pageIndex).toBe(3);

    queries.length = 0;
    filterCity(api!);

    expect(api!.table.store.state.pagination.pageIndex).toBe(0);
    // The page and the filter move together, so the consumer never sees a
    // render carrying the new filter against the old page - which is the
    // request that would have come back empty.
    expect(queries).not.toContainEqual({
      pageIndex: 3,
      filters: 1,
      sorts: 0,
    });
    expect(queries.at(-1)).toEqual({ pageIndex: 0, filters: 1, sorts: 0 });
  });

  it("takes a sort change back to page 0", () => {
    let api: TMDataGridApi<TestRow> | null = null;
    const queries: Array<Query> = [];
    render(
      <ServerGrid queries={queries} onReady={(grid) => (api = grid)} />,
      { wrapper: MantineWrapper },
    );

    act(() => api!.table.setPageIndex(2));
    act(() => api!.table.getColumn("name")!.toggleSorting());

    expect(api!.table.store.state.pagination.pageIndex).toBe(0);
    expect(queries.at(-1)).toEqual({ pageIndex: 0, filters: 0, sorts: 1 });
  });

  it("takes a quick search back to page 0", () => {
    let api: TMDataGridApi<TestRow> | null = null;
    const queries: Array<Query> = [];
    render(
      <ServerGrid queries={queries} onReady={(grid) => (api = grid)} />,
      { wrapper: MantineWrapper },
    );

    act(() => api!.table.setPageIndex(2));
    act(() => api!.table.setGlobalFilter("anna"));

    expect(api!.table.store.state.pagination.pageIndex).toBe(0);
  });

  it("stays put when the filter panel seeds an empty row", () => {
    let api: TMDataGridApi<TestRow> | null = null;
    const queries: Array<Query> = [];
    render(
      <ServerGrid queries={queries} onReady={(grid) => (api = grid)} />,
      { wrapper: MantineWrapper },
    );

    act(() => api!.table.setPageIndex(3));
    // What opening the filter panel does: a row on the first filterable
    // column, with nothing in it. It matches every row, so the result set is
    // the same one and page 4 is still page 4.
    act(() =>
      api!.table
        .getColumn("city")!
        .setFilterValue({ operator: "contains", value: "" }),
    );

    expect(api!.table.store.state.columnFilters).toHaveLength(1);
    expect(api!.table.store.state.pagination.pageIndex).toBe(3);
  });

  it("resets for a raw filter value it cannot recognise", () => {
    let api: TMDataGridApi<TestRow> | null = null;
    render(
      <ServerGrid queries={[]} onReady={(grid) => (api = grid)} />,
      { wrapper: MantineWrapper },
    );

    act(() => api!.table.setPageIndex(3));
    // Not the grid's own { operator, value } shape - a custom filter control,
    // or state restored from a URL. The reset cannot see whether such a value
    // is "still empty", so it has to count as a query change.
    act(() => api!.table.getColumn("city")!.setFilterValue("Malmö"));

    expect(api!.table.store.state.columnFilters).toHaveLength(1);
    expect(api!.table.store.state.pagination.pageIndex).toBe(0);
  });

  it("stays where it is when the option is off", () => {
    let api: TMDataGridApi<TestRow> | null = null;
    const queries: Array<Query> = [];
    render(
      <ServerGrid
        queries={queries}
        resetPageOnQueryChange={false}
        onReady={(grid) => (api = grid)}
      />,
      { wrapper: MantineWrapper },
    );

    act(() => api!.table.setPageIndex(3));
    filterCity(api!);

    expect(api!.table.store.state.pagination.pageIndex).toBe(3);
  });
});

describe("SummaryCount on a server-driven grid", () => {
  it("shows the matched count alone without meta.totalRowCount", () => {
    render(
      <ServerGrid queries={[]} onReady={() => {}} withSummaryCount />,
      { wrapper: MantineWrapper },
    );

    // `rowCount` is the server's 200. The fallback denominator would be the
    // rows in `data` - one page - so a grid without `meta.totalRowCount`
    // would have read "200 / 12": a plausible-looking wrong total.
    expect(part("summary-count")).toHaveTextContent(/^200$/);
  });
});

/** Same grid, with the query slices left to the table. */
function UncontrolledServerGrid({
  onReady,
}: {
  onReady: (api: TMDataGridApi<TestRow>) => void;
}) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row: TestRow) => String(row.id),
    manualPagination: true,
    manualFiltering: true,
    rowCount: 200,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  } as never);
  onReady(grid);

  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>
  );
}

describe("the first-page reset with the slices uncontrolled", () => {
  it("still writes the filter, and still resets the page", () => {
    let api: TMDataGridApi<TestRow> | null = null;
    render(<UncontrolledServerGrid onReady={(grid) => (api = grid)} />, {
      wrapper: MantineWrapper,
    });

    act(() => api!.table.setPageIndex(3));
    filterCity(api!);

    // The wrapper replaces TanStack's default write for the slice, so the
    // filter has to land in the table's own state as it did before.
    expect(api!.table.store.state.columnFilters).toHaveLength(1);
    expect(api!.table.store.state.pagination.pageIndex).toBe(0);
  });
});
