import type { RowData } from "@tanstack/react-table";
import type { TMDataGridTable } from "../useTMDataGrid";

/** What the pager is showing. The read half of {@link TMDataGridPaginationApi}. */
export type TMDataGridPaginationState = {
  pageIndex: number;
  pageSize: number;
  /** `-1` when a manual grid declares `pageCount: -1` (unknown total). */
  pageCount: number;
  rowCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  /**
   * Whether the pager is slicing anything right now. `false` while a grouping
   * is active, which suspends paging - see `isPagingActive`.
   */
  isPagingActive: boolean;
  /** First and last row number on this page, 1-based, for a range label. */
  from: number;
  to: number;
};

/** What the pager can do. The write half of {@link TMDataGridPaginationApi}. */
export type TMDataGridPaginationActions = {
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  previousPage: () => void;
  nextPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
};

/**
 * Pagination state and actions, split into the half you read and the half you
 * call.
 *
 * The split is what makes a partial override possible: a consumer replacing
 * only the range label reads `state` and never touches `actions`, and one
 * replacing only the buttons does the opposite.
 */
export type TMDataGridPaginationApi = {
  state: TMDataGridPaginationState;
  actions: TMDataGridPaginationActions;
};

/**
 * Reads {@link TMDataGridPaginationApi} off a table. The Footer feeds it to the
 * `renderPagination` slot; a pager living outside the Footer can call it with
 * the table from `useTMDataGrid` directly.
 *
 * `Controls` are not here: they are components bound to the grid context, and
 * this function takes only a table.
 */
export function getTMDataGridPaginationApi<TData extends RowData>(
  table: TMDataGridTable<TData>,
  isPaging = true,
): TMDataGridPaginationApi {
  const { pageIndex, pageSize } = table.store.state.pagination;
  const rowCount = table.getRowCount();
  return {
    state: {
      pageIndex,
      pageSize,
      pageCount: table.getPageCount(),
      rowCount,
      canPreviousPage: table.getCanPreviousPage(),
      canNextPage: table.getCanNextPage(),
      isPagingActive: isPaging,
      from: rowCount === 0 ? 0 : pageIndex * pageSize + 1,
      to: Math.min(rowCount, (pageIndex + 1) * pageSize),
    },
    actions: {
      setPageIndex: (index) => table.setPageIndex(index),
      setPageSize: (size) => table.setPageSize(size),
      previousPage: () => table.previousPage(),
      nextPage: () => table.nextPage(),
      firstPage: () => table.firstPage(),
      lastPage: () => table.lastPage(),
    },
  };
}
