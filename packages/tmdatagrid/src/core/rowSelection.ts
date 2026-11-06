import type { Row, RowData, RowSelectionState } from "@tanstack/react-table";
import type { TMDataGridFeatureFlags } from "./capabilities";
import { getGroupDataRows } from "./grouping";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

/**
 * Rows in the order they are displayed, which is the order a shift-click range
 * is measured over - so a range follows the active sort and skips filtered-out
 * rows. Under pagination it is the current page, so a range cannot cross a page
 * boundary.
 *
 * Once a column is grouped this includes the group rows, and only the leaves of
 * groups that are open - and paging is suspended, so it is the whole tree. That
 * is the right list for a range: it is what the user can see, and a range that
 * swept collapsed rows would select things off screen. What a group row in the
 * range contributes is decided by {@link getSelectableRowIds}.
 *
 * Rows pinned to an edge leave this list - they render in their own sticky
 * blocks, outside the scrolling order a shift-click range or the virtualizer
 * walks. See `readPinnedRows`.
 */
export function getDisplayedRows<TData extends RowData>(
  table: TMDataGridTable<TData>,
  features: TMDataGridFeatureFlags,
): Array<Row<TMDataGridFeatures, TData>> {
  const rows = isPagingActive(table, features)
    ? table.getPaginatedRowModel().rows
    : table.getPrePaginatedRowModel().rows;
  if (!features.rowPinning) return rows;
  const { top, bottom } = table.store.state.rowPinning;
  if (top.length === 0 && bottom.length === 0) return rows;
  const pinned = new Set([...top, ...bottom]);
  return rows.filter((row) => !pinned.has(row.id));
}

/**
 * Whether the built-in pager is actually slicing anything.
 *
 * Grouping suspends it. A page can only count one kind of thing, and once the
 * rows are a tree neither answer works: counting every row splits a group
 * across a page boundary and strands the rest of the tree on pages the user has
 * to go looking for, and counting only the top-level rows quietly redefines
 * "rows per page" as groups per page, so a page of 25 can hold thousands of
 * rows. Rather than pick, the grid renders the whole tree and leans on the
 * virtualizer - which is its default mode anyway, pagination being opt-in.
 *
 * `TMDataGrid.Footer` reads this too, and greys the pager out rather than
 * hiding it, so the pager going quiet is visible instead of mysterious.
 */
export function isPagingActive<TData extends RowData>(
  table: TMDataGridTable<TData>,
  features: TMDataGridFeatureFlags,
): boolean {
  return features.pagination && table.store.state.grouping.length === 0;
}

/**
 * Which modifiers were held. Named for what they mean rather than for the keys,
 * because the keys differ per platform - `toggle` is Ctrl on Windows/Linux and
 * Cmd on macOS.
 */
export type TMDataGridRowClickModifiers = {
  toggle: boolean;
  extend: boolean;
};

export type ResolveRowSelectionClickArgs<TData extends RowData> = {
  /** Displayed order - see {@link getDisplayedRows}. */
  rows: ReadonlyArray<Row<TMDataGridFeatures, TData>>;
  rowId: string;
  /** The pivot a shift-click extends from. */
  anchorRowId: string | null;
  modifiers: TMDataGridRowClickModifiers;
  selection: RowSelectionState;
  /**
   * Whether this gesture is allowed to clear rows it did not touch.
   *
   * `true` for a bare row click, which replaces the selection. `false` for a
   * checkbox, which is only ever additive: ticking one box does not clear the
   * others, and shift-clicking one adds the range rather than replacing it.
   */
  canReplaceSelection: boolean;
};

export type ResolvedRowSelection = {
  selection: RowSelectionState;
  anchorRowId: string | null;
};

/**
 * The row ids one gesture on this row selects.
 *
 * A group row is never selected itself: it holds no record, and TanStack
 * derives its checked state from its descendants. So ticking a group means
 * ticking every selectable leaf under it, which is also what makes the group's
 * own box light up.
 *
 * Leaves rather than direct children, so one click on a top-level group takes
 * the whole subtree however deeply it nests.
 */
export function getSelectableRowIds<TData extends RowData>(
  row: Row<TMDataGridFeatures, TData>,
): Array<string> {
  return getGroupDataRows(row)
    .filter((dataRow) => dataRow.getCanSelect())
    .map((dataRow) => dataRow.id);
}

/**
 * Turns one click into the next selection, following the convention every
 * desktop list uses:
 *
 * | Gesture | Effect |
 * | ------- | ------ |
 * | Click | selection becomes only this row |
 * | Ctrl/Cmd + click | toggle this row, leave the rest |
 * | Shift + click | selection becomes the range anchor → this row |
 * | Ctrl/Cmd + Shift + click | add that range to the selection |
 *
 * The anchor is a *pivot*, not "the last row touched": only a plain or
 * Ctrl-click moves it, which is what lets a run of shift-clicks grow and shrink
 * the same range from a fixed point.
 *
 * Selection state is rebuilt here and handed to `setRowSelection` wholesale
 * rather than going through `row.toggleSelected()` per row, which would publish
 * one state update each. That skips TanStack's sub-row cascade, so the cascade
 * is done here instead: every row in the gesture is expanded through
 * {@link getSelectableRowIds} before it reaches the map. Under grouping that is
 * what makes one tick on a group select all of it.
 */
export function resolveRowSelectionClick<TData extends RowData>({
  rows,
  rowId,
  anchorRowId,
  modifiers,
  selection,
  canReplaceSelection,
}: ResolveRowSelectionClickArgs<TData>): ResolvedRowSelection {
  const index = rows.findIndex((row) => row.id === rowId);
  const clickedRow = rows[index];
  if (index === -1 || clickedRow === undefined)
    return { selection, anchorRowId };

  const targets = getSelectableRowIds(clickedRow);
  if (targets.length === 0) return { selection, anchorRowId };

  // This has to be enforced here. Handing a rebuilt map to `setRowSelection`
  // skips `mutateRowIsSelected`, which is where TanStack clears the other rows,
  // so Ctrl and Shift would produce the multi-selection the option ruled out.
  if (!clickedRow.getCanMultiSelect()) {
    const only = targets.length === 1 ? targets[0] : undefined;
    if (only === undefined) return { selection, anchorRowId };
    const untick = !canReplaceSelection && selection[only] === true;
    return {
      selection: untick ? {} : { [only]: true },
      anchorRowId: rowId,
    };
  }

  const anchorIndex =
    anchorRowId === null ? -1 : rows.findIndex((row) => row.id === anchorRowId);

  if (modifiers.extend && anchorIndex !== -1) {
    const from = Math.min(anchorIndex, index);
    const to = Math.max(anchorIndex, index);
    const next: RowSelectionState =
      modifiers.toggle || !canReplaceSelection ? { ...selection } : {};
    for (const row of rows.slice(from, to + 1)) {
      for (const id of getSelectableRowIds(row)) next[id] = true;
    }
    return { selection: next, anchorRowId };
  }

  if (modifiers.toggle || !canReplaceSelection) {
    const next: RowSelectionState = { ...selection };
    // Asked of the targets rather than of `rowId`: a group row carries no id in
    // the map, so it counts as selected exactly when all of its leaves do -
    // which is also when its checkbox shows a tick rather than a dash.
    const allSelected = targets.every((id) => selection[id] === true);
    for (const id of targets) {
      if (allSelected) delete next[id];
      else next[id] = true;
    }
    return { selection: next, anchorRowId: rowId };
  }

  const next: RowSelectionState = {};
  for (const id of targets) next[id] = true;
  return { selection: next, anchorRowId: rowId };
}
