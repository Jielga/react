import {
  copyInstancePropertiesWithoutMemos,
  type Row,
  type RowData,
  type RowModel,
  type Table,
  type TableFeatures,
} from "@tanstack/react-table";

/** How the sorted order follows the data - see `sortMode` on the hook options. */
export type TMDataGridSortMode = "live" | "frozen";

/**
 * What a frozen sort holds for one table.
 *
 * The order is held as a rank per row rather than as a copy of the values
 * sorted on, so the comparator never runs against held values: a `sortFn`
 * that reads `row.original`, `sortUndefined` and `invertSorting` all keep
 * working, because TanStack still does every comparison on live rows.
 */
type FrozenSortState = {
  /** The sorting and grouping the ranks were taken under, or `null`. */
  takenKey: string | null;
  /** Bumped by `sortAgain`; a take records the epoch it ran in. */
  epoch: number;
  takenEpoch: number;
  /**
   * Rank of each row among its siblings, by parent row id - `""` for the top
   * level. Keyed by parent so a row that moves to another group is new
   * there, rather than compared against ranks from a sibling list it left.
   */
  ranks: Map<string, Map<string, number>>;
  /** The live model last reordered, and what it was reordered into. */
  input: object | null;
  output: object | null;
  /** Whether `output` differs from a fresh sort of the same rows. */
  stale: boolean;
};

/**
 * Keyed on `table.store`: the row model factory is handed the table instance
 * itself, while the hook holds `useTable`'s spread copy of it, and the store
 * is the one object both share.
 */
const states = new WeakMap<object, FrozenSortState>();

function stateOf(table: { store: object }): FrozenSortState {
  let state = states.get(table.store);
  if (state === undefined) {
    state = {
      takenKey: null,
      epoch: 0,
      takenEpoch: 0,
      ranks: new Map(),
      input: null,
      output: null,
      stale: false,
    };
    states.set(table.store, state);
  }
  return state;
}

function release(state: FrozenSortState) {
  if (state.takenKey === null) return;
  state.takenKey = null;
  state.ranks = new Map();
  state.input = null;
  state.output = null;
  state.stale = false;
}

/**
 * What a held order is valid for: the sort, and the grouping that shapes the
 * sibling lists it ranks. `null` while frozen sorting does not apply.
 *
 * By content, not identity: a controlled `state.sorting` rebuilt with the
 * same entries is the same sort.
 */
function frozenKey<TFeatures extends TableFeatures, TData extends RowData>(
  table: Table<TFeatures, TData>,
): string | null {
  // Off the options and the store as plain records, for the same
  // generic-features reason as the reads in quickSearch.ts.
  const { sortMode, manualSorting } = table.options as {
    sortMode?: TMDataGridSortMode;
    manualSorting?: boolean;
  };
  if (sortMode !== "frozen" || manualSorting === true) return null;
  const { sorting, grouping } = table.store.state as {
    sorting?: Array<{ id: string; desc: boolean }>;
    grouping?: Array<string>;
  };
  if (!sorting?.length) return null;
  return JSON.stringify([
    sorting.map((sort) => [sort.id, sort.desc]),
    grouping ?? [],
  ]);
}

type AnyRow = Row<TableFeatures, RowData>;

function record(rows: ReadonlyArray<AnyRow>, parentId: string, ranks: FrozenSortState["ranks"]) {
  const level = new Map<string, number>();
  ranks.set(parentId, level);
  rows.forEach((row, index) => {
    level.set(row.id, index);
    if (row.subRows.length) record(row.subRows, row.id, ranks);
  });
}

/**
 * One sibling list in its held order. Held rows go by rank. A row with no
 * rank yet - added, new in `data`, back from a filter it was ranked outside
 * of, or in a group it was not in - goes after the held row it follows in the
 * live order, and is ranked there so the next change leaves it in place.
 */
function reorder(
  rows: ReadonlyArray<AnyRow>,
  parentId: string,
  ranks: FrozenSortState["ranks"],
  flatRows: Array<AnyRow>,
): { rows: Array<AnyRow>; changed: boolean } {
  let level = ranks.get(parentId);
  if (level === undefined) {
    level = new Map();
    ranks.set(parentId, level);
  }
  const held: Array<AnyRow> = [];
  const leading: Array<AnyRow> = [];
  const following = new Map<AnyRow, Array<AnyRow>>();
  let anchor: AnyRow | null = null;
  for (const row of rows) {
    if (level.has(row.id)) {
      held.push(row);
      anchor = row;
    } else if (anchor === null) {
      leading.push(row);
    } else {
      const after = following.get(anchor);
      if (after) after.push(row);
      else following.set(anchor, [row]);
    }
  }
  const rank = (row: AnyRow) => level.get(row.id) ?? 0;
  held.sort((a, b) => rank(a) - rank(b));

  // New ranks go between the neighbours they were placed between, so they
  // never collide with a held one. Fractions only accumulate until the next
  // take, which ranks every row by its index again.
  const first = held.length > 0 ? rank(held[0]!) : 0;
  leading.forEach((row, index) =>
    level.set(row.id, first - (leading.length - index)),
  );
  const ordered: Array<AnyRow> = [...leading];
  held.forEach((row, index) => {
    ordered.push(row);
    const after = following.get(row);
    if (!after) return;
    const low = rank(row);
    const next = held[index + 1];
    const high = next ? rank(next) : low + after.length + 1;
    after.forEach((newRow, offset) => {
      level.set(newRow.id, low + ((offset + 1) * (high - low)) / (after.length + 1));
      ordered.push(newRow);
    });
  });

  let changed = false;
  for (let index = 0; index < ordered.length; index++) {
    let row = ordered[index]!;
    if (row !== rows[index]) changed = true;
    const flatIndex = flatRows.length;
    flatRows.push(row);
    if (!row.subRows.length) continue;
    const sub = reorder(row.subRows, row.id, ranks, flatRows);
    if (!sub.changed) continue;
    // A row whose children moved is cloned rather than mutated, the way
    // TanStack's own sorted model does it: the live model still holds it.
    const cloned = Object.create(Object.getPrototypeOf(row)) as AnyRow;
    copyInstancePropertiesWithoutMemos(cloned, row);
    cloned.subRows = sub.rows;
    row = cloned;
    ordered[index] = row;
    flatRows[flatIndex] = row;
    changed = true;
  }
  return { rows: ordered, changed };
}

/**
 * Drops the ranks of rows that are gone from the data altogether, so a grid
 * whose rows come and go does not hold every id it has ever seen. A row only
 * filtered out keeps its rank, and comes back to its place.
 */
function prune(
  ranks: FrozenSortState["ranks"],
  present: (rowId: string) => boolean,
) {
  for (const [parentId, level] of ranks) {
    if (parentId !== "" && !present(parentId)) {
      ranks.delete(parentId);
      continue;
    }
    for (const rowId of level.keys()) {
      if (!present(rowId)) level.delete(rowId);
    }
  }
}

/**
 * Wraps a sorted row model so that, under `sortMode: "frozen"`, the order is
 * taken once when the sort is applied and then held. Edits, refetches and
 * filter changes keep the rows where they are; a new sort, a grouping change
 * or {@link requestSortAgain} takes the order again from the live values.
 *
 * Inert under `"live"`, without a sort, and under `manualSorting`, where the
 * server owns the order.
 */
export function withFrozenSort<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  createInner: (
    table: Table<TFeatures, TData>,
  ) => () => RowModel<TFeatures, TData>,
): (table: Table<TFeatures, TData>) => () => RowModel<TFeatures, TData> {
  return (table) => {
    const getSorted = createInner(table);
    return () => {
      const model = getSorted();
      const state = stateOf(table);
      const key = frozenKey(table);
      if (key === null) {
        release(state);
        return model;
      }
      const rows = model.rows as unknown as ReadonlyArray<AnyRow>;
      if (key !== state.takenKey || state.epoch !== state.takenEpoch) {
        state.ranks = new Map();
        record(rows, "", state.ranks);
        state.takenKey = key;
        state.takenEpoch = state.epoch;
        state.input = model;
        state.output = model;
        state.stale = false;
        return model;
      }
      if (model === state.input && state.output !== null) {
        return state.output as RowModel<TFeatures, TData>;
      }
      const flatRows: Array<AnyRow> = [];
      const result = reorder(rows, "", state.ranks, flatRows);
      // The core model, not this one: a row filtered out is still in the data.
      const core = (
        table as unknown as { getCoreRowModel: () => RowModel<TFeatures, TData> }
      ).getCoreRowModel().rowsById;
      prune(
        state.ranks,
        (rowId) => rowId in core || rowId in model.rowsById,
      );
      const output = result.changed
        ? ({
            rows: result.rows,
            flatRows,
            rowsById: model.rowsById,
          } as unknown as RowModel<TFeatures, TData>)
        : model;
      state.input = model;
      state.output = output;
      state.stale = result.changed;
      return output;
    };
  };
}

/**
 * Whether the held order differs from a fresh sort of the same rows - what
 * the header's "sort again" button shows for. Always `false` outside a
 * frozen sort.
 */
export function isFrozenSortStale<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(table: Table<TFeatures, TData>): boolean {
  if (frozenKey(table) === null) return false;
  // Brings the held order up to date with the current rows first.
  (table as unknown as { getSortedRowModel: () => unknown }).getSortedRowModel();
  return stateOf(table).stale;
}

/**
 * Makes the next read of the sorted rows take the order again from the live
 * values, with the same sort. The caller re-renders the grid; nothing here
 * notifies anyone.
 */
export function requestSortAgain(table: { store: object }) {
  stateOf(table).epoch++;
}
