import type { ExpandedState, Row, RowData } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";

/**
 * Which rows an expand-all control is about.
 *
 * TanStack keeps one `expanded` state, and the grid opens two unrelated things
 * out of it: a group row opens into its children, a data row opens into its
 * detail panel. So `toggleAllRowsExpanded` - which writes the state's
 * whole-table form - is the wrong verb for either control. "Expand all groups"
 * in the tree menu would open every panel in the grid, and the details lane's
 * chevron would unfold the whole tree.
 *
 * These helpers narrow both to the rows their control is for, and leave the
 * other kind exactly as it was.
 */
export type TMDataGridExpandTarget = "groups" | "details";

function isTarget<TData extends RowData>(
  row: Row<TMDataGridFeatures, TData>,
  target: TMDataGridExpandTarget,
): boolean {
  // A record a consumer's `getRowCanExpand` turns down has no panel to open.
  return target === "groups"
    ? row.getIsGrouped()
    : !row.getIsGrouped() && row.getCanExpand();
}

/**
 * The state as a map. `true` is the whole-table form, which has to be written
 * out before one kind of row can be taken back out of it - the same thing
 * TanStack does before toggling a single row.
 */
function toExpandedMap<TData extends RowData>(
  rows: ReadonlyArray<Row<TMDataGridFeatures, TData>>,
  expanded: ExpandedState,
): Record<string, boolean> {
  if (expanded !== true) return { ...expanded };
  const all: Record<string, boolean> = {};
  for (const row of rows) all[row.id] = true;
  return all;
}

export type TMDataGridExpandAllArgs<TData extends RowData> = {
  /**
   * Every row in the model, groups and records alike - `flatRows` off any of
   * them. A grouped model lists its leaves both under their group and in the
   * flat list, so this may repeat rows; both helpers are written so that a
   * repeat costs nothing.
   */
  rows: ReadonlyArray<Row<TMDataGridFeatures, TData>>;
  expanded: ExpandedState;
  target: TMDataGridExpandTarget;
};

/**
 * Whether every row of this kind is open - what the control shows, and what a
 * bare toggle inverts.
 *
 * `false` when there are none of them, matching TanStack's own
 * `getIsAllRowsExpanded()` on an empty state: an empty set is nothing to
 * collapse.
 */
export function areAllRowsExpanded<TData extends RowData>({
  rows,
  expanded,
  target,
}: TMDataGridExpandAllArgs<TData>): boolean {
  let found = false;
  for (const row of rows) {
    if (!isTarget(row, target)) continue;
    found = true;
    if (expanded === true) continue;
    if (expanded[row.id] !== true) return false;
  }
  return found;
}

/**
 * The next `expanded` state after an expand-all or collapse-all on one kind of
 * row. Rows of the other kind keep whatever they had.
 */
export function resolveExpandAll<TData extends RowData>({
  rows,
  expanded,
  target,
  expand,
}: TMDataGridExpandAllArgs<TData> & { expand: boolean }): ExpandedState {
  const next = toExpandedMap(rows, expanded);
  for (const row of rows) {
    if (!isTarget(row, target)) continue;
    if (expand) next[row.id] = true;
    else delete next[row.id];
  }
  return next;
}
