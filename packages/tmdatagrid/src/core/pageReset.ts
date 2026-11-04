import {
  functionalUpdate,
  makeStateUpdater,
  type TableState,
  type Updater,
} from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { sameStateValue } from "./controlledState";
import { isFilterActive, isTMDataGridFilterValue } from "./filterOperators";

/**
 * Sends a server-paged grid back to the first page when the query changes.
 *
 * Under `manualPagination` the grid does not own the result set, so a column
 * filter, the quick search or a sort leaves `pageIndex` pointing into a page
 * range that no longer exists: the next request asks the server for page 8 of
 * a result set that now has three, and the consumer gets an empty grid with
 * no error.
 *
 * TanStack's `autoResetPageIndex` does not cover it. It defaults to
 * `!manualPagination`, so it is off exactly when this is needed, and it fires
 * on a data change - which server-side is the response landing, one request
 * too late.
 *
 * The reset rides on the slice's own change callback rather than on an effect
 * over table state, so both writes land in the same render and the query goes
 * out once. From an effect the request for the stale page would leave first.
 */

/**
 * The state a query is built from, plus grouping: paging is suspended while
 * a column is grouped, and the page it hands back on the way out was
 * measured over the ungrouped rows before the group was made.
 */
export type TMDataGridQuerySlice =
  | "columnFilters"
  | "globalFilter"
  | "sorting"
  | "grouping";

/** What the reset reads and writes - the table, narrowed to that. */
export type TMDataGridQueryTable = {
  store: { state: TableState<TMDataGridFeatures> };
  setPageIndex: (index: number) => void;
};

type QueryHandler = (updater: never) => void;

type ColumnFilters = TableState<TMDataGridFeatures>["columnFilters"];

/**
 * The entries the server could answer differently. Only the grid's own
 * `{ operator, value }` shape can be recognised as "still empty" - anything
 * else, a custom filter control's raw value or state restored from a URL,
 * narrows the grid as far as this module can know, so it always counts.
 */
function querySignificantFilters(filters: ColumnFilters): ColumnFilters {
  return filters.filter(
    (entry) =>
      !isTMDataGridFilterValue(entry.value) || isFilterActive(entry.value),
  );
}

/**
 * Whether the server would answer the next state differently.
 *
 * A column filter with an empty value matches every row, so it is not part of
 * the query: opening the filter panel seeds a row on the first filterable
 * column, and the user then types into it. Neither moves the result set, and
 * neither may throw away the page the user is on.
 */
function changesTheQuery(
  slice: TMDataGridQuerySlice,
  previous: unknown,
  next: unknown,
): boolean {
  if (slice === "columnFilters") {
    return !sameStateValue(
      querySignificantFilters(previous as ColumnFilters),
      querySignificantFilters(next as ColumnFilters),
    );
  }
  return !sameStateValue(previous, next);
}

/**
 * Wraps one slice's change callback. `handler` is the consumer's, where they
 * control the slice; without one the write is the same `makeStateUpdater`
 * TanStack would have defaulted to, which this option replaces.
 */
export function withPageReset(
  slice: TMDataGridQuerySlice,
  handler: QueryHandler | undefined,
  getTable: () => TMDataGridQueryTable,
): QueryHandler {
  return (updater) => {
    const table = getTable();
    const previous = table.store.state[slice];
    // Resolved here rather than read back off the table afterwards: where the
    // consumer owns the slice the write is their `setState`, so the table
    // still holds the old value when this returns. The updater therefore runs
    // twice per change - once here, once in the write path - which is safe
    // for every updater the grid and table-core produce, and a requirement on
    // the consumer's: an updater has to be a pure derivation of the previous
    // value. The decision is also best-effort under batching: two writes to
    // one slice in the same tick both read the same `previous`, so the second
    // decision is computed from a stale base. A wrong reset decision at
    // worst, never a wrong write.
    const next = functionalUpdate(updater as Updater<unknown>, previous);

    (handler ?? (makeStateUpdater(slice, table as never) as QueryHandler))(
      updater,
    );

    if (!changesTheQuery(slice, previous, next)) return;
    // Already on the first page: writing anyway would publish the store and
    // re-render the grid for a value that did not move.
    if (table.store.state.pagination.pageIndex !== 0) table.setPageIndex(0);
  };
}
