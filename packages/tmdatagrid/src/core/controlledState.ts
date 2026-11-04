import type { TableState } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";

type GridState = TableState<TMDataGridFeatures>;

/**
 * Support for TanStack's `state` option (controlled state).
 *
 * table-core re-reads `options.state` on every render (`useTable` calls
 * `setOptions` while rendering) and writes any slice whose value is not
 * identical to the table's current value into the table's atom. The write
 * publishes the store and re-renders the consumer, so a slice object built in
 * the render body causes an infinite render loop.
 *
 * {@link stabilizeControlledState} prevents the loop by forwarding the
 * previous render's value for a slice whose contents are unchanged.
 * {@link findFrozenStateSlices} detects a controlled slice without its
 * `onXChange` callback, which the grid cannot write to.
 */

/**
 * The `onXChange` option that owns each controlled slice - every slice v9
 * defines. `globalFilterFn` is not among them: in this beta it is a table
 * option, not state.
 */
export const CONTROLLED_SLICE_HANDLERS = {
  columnFilters: "onColumnFiltersChange",
  columnOrder: "onColumnOrderChange",
  columnPinning: "onColumnPinningChange",
  columnResizing: "onColumnResizingChange",
  columnSizing: "onColumnSizingChange",
  columnVisibility: "onColumnVisibilityChange",
  expanded: "onExpandedChange",
  globalFilter: "onGlobalFilterChange",
  grouping: "onGroupingChange",
  pagination: "onPaginationChange",
  rowPinning: "onRowPinningChange",
  rowSelection: "onRowSelectionChange",
  sorting: "onSortingChange",
} as const satisfies Partial<Record<keyof GridState, string>>;

export type TMDataGridControlledSlice = keyof typeof CONTROLLED_SLICE_HANDLERS;

/** The options {@link findFrozenStateSlices} reads - a subset of `TableOptions`. */
type ControlledOptions = {
  state?: Partial<GridState>;
  /**
   * The v9 way of owning a slice: an atom the table writes through directly.
   * It outranks `state`, so a slice backed by one is never frozen.
   */
  atoms?: Record<string, unknown>;
} & Partial<
  Record<(typeof CONTROLLED_SLICE_HANDLERS)[TMDataGridControlledSlice], unknown>
>;

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

/**
 * A plain data object: `Object.prototype` or null prototype. table-core builds
 * its state maps with `Object.create(null)`, so null prototypes must compare
 * as plain objects.
 */
function isDataObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Structural equality for state values.
 *
 * `Date`s compare by time; the built-in date filters hold them in filter
 * values. `Map`s and class instances compare by identity, so a controlled
 * slice containing one rebuilt each render reads as changed on every render
 * and re-renders the table. Use primitives, plain objects, arrays or `Date`s
 * in controlled state.
 */
export function sameStateValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return (
      a.length === b.length &&
      a.every((item, index) => sameStateValue(item, b[index]))
    );
  }
  if (!isDataObject(a) || !isDataObject(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => hasOwn(b, key) && sameStateValue(a[key], b[key]));
}

/**
 * Removes keys whose value is `undefined`, as in
 * `state: { sorting: cond ? sorting : undefined }`.
 *
 * TanStack's sync writes every present key into the slice's atom, `undefined`
 * included, which breaks everything that reads the slice. A key set to
 * `undefined` is treated as not controlled: the key is removed and the slice
 * falls back to the table's own state. Identity is preserved when there is
 * nothing to remove; the stabilizer compares by it.
 */
export function withoutUndefinedSlices(
  state: Partial<GridState> | undefined,
): Partial<GridState> | undefined {
  if (state === undefined) return state;
  if (!Object.values(state).includes(undefined)) return state;
  const compacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (value !== undefined) compacted[key] = value;
  }
  return compacted as Partial<GridState>;
}

/**
 * Returns `next` with every slice that structurally equals its counterpart in
 * `previous` replaced by the previous object, so table-core's identity-based
 * sync finds nothing to write. Returns `previous` when nothing changed.
 */
export function stabilizeControlledState(
  next: Partial<GridState> | undefined,
  previous: Partial<GridState> | undefined,
): Partial<GridState> | undefined {
  if (next === undefined || previous === undefined || next === previous) {
    return next;
  }

  const keys = Object.keys(next);
  const stabilized: Record<string, unknown> = {};
  let changed = keys.length !== Object.keys(previous).length;

  for (const key of keys) {
    const nextValue = (next as Record<string, unknown>)[key];
    const previousValue = (previous as Record<string, unknown>)[key];
    if (hasOwn(previous, key) && sameStateValue(nextValue, previousValue)) {
      // Unchanged contents: keep the object the table already holds.
      stabilized[key] = previousValue;
    } else {
      stabilized[key] = nextValue;
      changed = true;
    }
  }

  return changed ? (stabilized as Partial<GridState>) : previous;
}

/**
 * Controlled slices without a write path: `state.x` is set but no `onXChange`
 * was passed and no external atom owns the slice. TanStack routes every write
 * through the callback, so such a slice cannot change. Reported so the hook
 * can warn in development; `initialState` is the option for a starting value.
 */
export function findFrozenStateSlices(
  options: ControlledOptions,
): Array<{ slice: TMDataGridControlledSlice; handler: string }> {
  const state = options.state;
  if (state === undefined) return [];

  return (
    Object.entries(CONTROLLED_SLICE_HANDLERS) as Array<
      [TMDataGridControlledSlice, string]
    >
  )
    .filter(
      ([slice, handler]) =>
        // Undefined-valued keys are removed before the table sees them; the
        // slice is not controlled.
        (state as Record<string, unknown>)[slice] !== undefined &&
        (options as Record<string, unknown>)[handler] === undefined &&
        options.atoms?.[slice] === undefined,
    )
    .map(([slice, handler]) => ({ slice, handler }));
}
