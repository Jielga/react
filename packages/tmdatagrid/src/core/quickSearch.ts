import {
  compareItems,
  rankItem,
  type RankingInfo,
} from "@tanstack/match-sorter-utils";
import {
  createSortedRowModel,
  type Column,
  type Row,
  type RowData,
  type RowModel,
  type Table,
  type TableFeatures,
} from "@tanstack/react-table";

/** How the quick search matches - see `quickSearchMode` on the hook options. */
export type TMDataGridQuickSearchMode = "fuzzy" | "contains";

/**
 * The fuzzy filter's registry name - what `globalFilterFn` resolves to while
 * `quickSearchMode` is `"fuzzy"`. The rank ordering keys off this name, so an
 * explicit `globalFilterFn` override switches the ordering off with it.
 */
export const FUZZY_FILTER_FN_NAME = "tmDataGridFuzzy";

/**
 * Which columns the quick search reads, per core row model: the answer only
 * changes with the data, and the model's identity changes with the data.
 */
const searchableColumns = new WeakMap<object, Map<string, boolean>>();

/**
 * The grid's `getColumnCanGlobalFilter`: TanStack's own rule - a column takes
 * part when its first non-empty value is a string or a number, or when it
 * says `enableGlobalFilter: true` - computed once per data change.
 *
 * TanStack's default scans the rows for that first value on every call,
 * building every cell of every row it passes, and the grid asks on every
 * header render. A column empty in every row therefore cost a full scan per
 * header per render. Here the scan reads values only, and its answer is kept
 * until the data changes.
 */
export function columnCanQuickSearch<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TValue,
>(column: Column<TFeatures, TData, TValue>): boolean {
  const { enableGlobalFilter } = column.columnDef as {
    enableGlobalFilter?: boolean;
  };
  if (enableGlobalFilter === true) return true;
  // A display column has no value to search.
  if (!column.accessorFn) return false;
  // Off the table as a plain record, for the same generic-features reason as
  // the options read in isRankingActive.
  const model = (
    column.table as unknown as { getCoreRowModel: () => RowModel<TFeatures, TData> }
  ).getCoreRowModel();
  let byColumn = searchableColumns.get(model);
  if (byColumn === undefined) {
    byColumn = new Map();
    searchableColumns.set(model, byColumn);
  }
  const known = byColumn.get(column.id);
  if (known !== undefined) return known;
  let searchable = false;
  for (const row of model.flatRows) {
    const value = row.getValue(column.id);
    if (value == null) continue;
    searchable = typeof value === "string" || typeof value === "number";
    break;
  }
  byColumn.set(column.id, searchable);
  return searchable;
}

/** What {@link fuzzyGlobalFilterFn} records per column via `addMeta`. */
type FuzzyFilterMeta = { fuzzyRank: RankingInfo };

function isFuzzyFilterMeta(value: unknown): value is FuzzyFilterMeta {
  if (typeof value !== "object" || value === null) return false;
  const rank = (value as { fuzzyRank?: unknown }).fuzzyRank;
  return (
    typeof rank === "object" &&
    rank !== null &&
    typeof (rank as { rank?: unknown }).rank === "number"
  );
}

/**
 * Match-sorter ranking as the global filter: a row passes when a globally
 * filterable column ranks above match-sorter's threshold - typos and skipped
 * characters forgiven - and the rank is recorded for the ordering to read.
 *
 * TanStack stops probing a row's columns at the first passing one, so the
 * recorded ranks cover the columns up to and including it; the best of those
 * stands for the row. Good enough for a quick search: the first passing
 * column is almost always the one the user is looking at.
 */
export function fuzzyGlobalFilterFn<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  row: Row<TFeatures, TData>,
  columnId: string,
  filterValue: unknown,
  addMeta?: (meta: FuzzyFilterMeta) => void,
): boolean {
  const rank = rankItem(
    String(row.getValue(columnId) ?? ""),
    String(filterValue),
  );
  addMeta?.({ fuzzyRank: rank });
  return rank.passed;
}

/** The best fuzzy rank any column recorded for this row, or `null`. */
function bestRank<TFeatures extends TableFeatures, TData extends RowData>(
  row: Row<TFeatures, TData>,
): RankingInfo | null {
  let best: RankingInfo | null = null;
  // As a plain record, for the same generic-features reason as the options
  // read in isRankingActive.
  const { columnFiltersMeta } = row as {
    columnFiltersMeta?: Record<string, unknown>;
  };
  for (const meta of Object.values(columnFiltersMeta ?? {})) {
    if (!isFuzzyFilterMeta(meta)) continue;
    if (best === null || meta.fuzzyRank.rank > best.rank) best = meta.fuzzyRank;
  }
  return best;
}

/**
 * Whether the ranked ordering applies: the fuzzy quick search is narrowing
 * the grid, and nothing else claims an order - no sort, no grouping.
 */
function isRankingActive<TFeatures extends TableFeatures, TData extends RowData>(
  table: Table<TFeatures, TData>,
): boolean {
  // Off the options as a plain record: a generic `TFeatures` does not carry
  // the global-filtering feature's option types, and this file stays generic
  // to avoid a cycle with useTMDataGrid.
  const { globalFilterFn } = table.options as { globalFilterFn?: unknown };
  if (globalFilterFn !== FUZZY_FILTER_FN_NAME) return false;
  const state = table.store.state as {
    sorting?: Array<unknown>;
    grouping?: Array<unknown>;
    globalFilter?: unknown;
  };
  return (
    (state.sorting?.length ?? 0) === 0 &&
    (state.grouping?.length ?? 0) === 0 &&
    typeof state.globalFilter === "string" &&
    state.globalFilter.trim() !== ""
  );
}

/**
 * The sorted row model, with one addition: while {@link isRankingActive},
 * rows order by match quality, best first. Declarative - the ordering is
 * derived from filter state, never written into `sorting`, so no column
 * claims `aria-sort`, the persisted slice stays untouched, and the user's
 * next sort click suspends it just by existing.
 *
 * Sits upstream of pagination, so a ranked first page really is the best
 * matches of the whole set.
 */
export function createFuzzyRankedSortedRowModel<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(): (table: Table<TFeatures, TData>) => () => RowModel<TFeatures, TData> {
  const base = createSortedRowModel<TFeatures, TData>();
  return (table) => {
    const getSorted = base(table);
    // One-slot memo: every input of the ordering - filter text, data, the
    // sorting and grouping states - changes the sorted model's identity, so
    // the model alone is the cache key.
    let lastModel: RowModel<TFeatures, TData> | null = null;
    let ranked: RowModel<TFeatures, TData> | null = null;
    return () => {
      const model = getSorted();
      if (!isRankingActive(table)) return model;
      if (model === lastModel && ranked !== null) return ranked;
      const rows = [...model.rows].sort((a, b) => {
        const rankA = bestRank(a);
        const rankB = bestRank(b);
        if (rankA !== null && rankB !== null) return compareItems(rankA, rankB);
        return rankA !== null ? -1 : rankB !== null ? 1 : 0;
      });
      ranked = { rows, flatRows: model.flatRows, rowsById: model.rowsById };
      lastModel = model;
      return ranked;
    };
  };
}
