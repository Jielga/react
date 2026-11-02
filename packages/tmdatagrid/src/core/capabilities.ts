import type { Column, RowData } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import { isColumnReorderable } from "./columnUtils";
import type { TMDataGridEditMode } from "./editEngine";
import type {
  TMDataGridFeatures,
  TMDataGridTable,
  UseTMDataGridOptions,
} from "../useTMDataGrid";

/**
 * Table-level feature switches, read straight off the options object.
 *
 * Why not just call `column.getCanSort()` everywhere? Because that is a method
 * call on a `column` whose identity survives an options change, so the React
 * Compiler caches the result and the chrome keeps rendering for a feature that
 * was switched off. Reading the options into a fresh object each render gives
 * every derived value something that actually changes to invalidate on.
 *
 * TanStack still decides: these flags are combined with `getCanX()`, which is
 * what applies the per-column overrides.
 */
/**
 * How rows are selected - see `selectionMode` on {@link UseTMDataGridOptions}.
 *
 * One axis, because the two things a config could set independently - which
 * chrome selects, and what a bare row click does - cannot both be free: a click
 * can either toggle a multi-selection or move the highlight, never both. Folding
 * them into one value makes that conflict unrepresentable rather than something
 * to warn about.
 */
export type TMDataGridSelectionMode =
  /** Checkbox column, multi-select. Clicking a row elsewhere does nothing. */
  | "checkbox"
  /** No checkbox column; row click multi-selects, with Ctrl/Shift modifiers. */
  | "row"
  /** Checkbox column multi-selects, and a row click highlights one row. */
  | "checkboxAndHighlight"
  /** No selection at all - a row click only highlights. Master-detail. */
  | "highlight";

/**
 * How cells are selected - see `cellSelection` on {@link UseTMDataGridOptions}.
 *
 * A mode rather than a pair of booleans, for the reason
 * {@link TMDataGridSelectionMode} is one: "cells can be selected" and "more
 * than one at a time" are not independent, and a range that cannot be anchored
 * anywhere is not a state worth being able to write down.
 */
export type TMDataGridCellSelectionMode =
  /** No cell cursor at all. The body's tab stop stays on the row. */
  | "none"
  /** One cell takes the focus and the arrow keys move it. */
  | "single"
  /** As `"single"`, plus a rectangle: drag, Shift+click, Shift+arrows, Ctrl+C. */
  | "range";

export type TMDataGridFeatureFlags = {
  sorting: boolean;
  /**
   * Whether the sorted order is held until the user sorts again -
   * `sortMode: "frozen"`. Off under `manualSorting`, where the server owns
   * the order.
   */
  frozenSort: boolean;
  filtering: boolean;
  /** Whether the quick search may filter - `enableGlobalFilter`. */
  globalFiltering: boolean;
  hiding: boolean;
  pinning: boolean;
  resizing: boolean;
  ordering: boolean;
  /** Whether any row selection is possible. Off outright under `"highlight"`. */
  rowSelection: boolean;
  /** Defaults to `"checkbox"`. */
  selectionMode: TMDataGridSelectionMode;
  /** Whether the generated checkbox column is prepended. */
  selectColumn: boolean;
  /** Whether a bare row click toggles the selection. Only under `"row"`. */
  rowClickSelects: boolean;
  /**
   * Whether more than one row can be selected at once - TanStack's
   * `enableMultiRowSelection`. Off, the grid drops the select-all header
   * checkbox: TanStack's `toggleAllRowsSelected` only consults `getCanSelect`,
   * so that control would select every row and walk straight past the limit.
   *
   * A per-row predicate counts as on, since some rows may still multi-select.
   */
  multiRowSelection: boolean;
  /** Whether a selected row takes the highlight colour. Follows the mode. */
  showSelectedBackground: boolean;
  /**
   * The single highlighted row - clicking a row highlights it, for a detail
   * panel to follow. State of its own, not a slice of `rowSelection`, which is
   * what lets it coexist with a checkbox multi-selection.
   */
  highlightRow: boolean;
  /**
   * Whether cells can be selected at all. Off unless `cellSelection` asks for
   * it - it takes the body's tab stop off the row and puts it on a cell, and
   * reports the grid to assistive technology as a `grid` rather than a `table`,
   * which is a different promise about what the keyboard does.
   */
  cellSelection: boolean;
  /** Defaults to `"none"`. */
  cellSelectionMode: TMDataGridCellSelectionMode;
  /** Whether a rectangle of cells can be selected. Only under `"range"`. */
  cellRangeSelection: boolean;
  /**
   * The one default-off flag: pagination must be asked for, either with the
   * grid's `enablePagination` or implicitly by declaring `manualPagination`.
   * Off, the grid renders every filtered row and relies on virtualization.
   */
  pagination: boolean;
  /**
   * Row grouping: the "Group by" items in the header menu and the generated
   * tree column. On unless `enableGrouping: false`, since an ungrouped grid
   * looks and behaves exactly as it did before - `grouping` starts empty, and
   * an empty grouping state passes straight through the row model.
   *
   * The exception is `manualPagination`, where the client holds one page rather
   * than the whole set: grouping that page would build groups out of an
   * arbitrary slice and quietly show wrong counts. A server-side grid that does
   * its own grouping can still say `enableGrouping: true` to override.
   */
  grouping: boolean;
  /** Whether cells can be edited at all - the `editing` option was set. */
  editing: boolean;
  /** What counts as a commit, or `null` while editing is off. */
  editMode: TMDataGridEditMode | null;
  /**
   * Where a commit goes - `editing.draft`. On, commits park in the grid's
   * draft store and leave through `edit.saveDrafts()`; off, each one reaches
   * the consumer as it happens.
   */
  editDraft: boolean;
  /**
   * Whether a committed entry row stays pinned in the sticky entry block
   * until the draft store is saved - `editing.newRowsSticky`, which needs
   * `editing.draft`. Off by default: a committed row joins the body rows
   * instead, sorted and filtered with them, so entering many rows cannot
   * fill the viewport with sticky chrome.
   */
  editNewRowsSticky: boolean;
  /** The generated row-number gutter - `enableRowNumbers`. Off by default. */
  rowNumbers: boolean;
  /**
   * Whether rows can be pinned to the top or bottom edge - `enableRowPinning`,
   * boolean or per-row predicate. Off by default: pinning has no built-in
   * gesture, so a grid that never calls `row.pin()` has nothing to gain from
   * the body watching the state.
   */
  rowPinning: boolean;
  /**
   * Whether cells highlight the matched text while a contains-family filter
   * or the quick search is active - `enableMatchHighlighting`. Off by
   * default, so a grid that has not asked pays nothing per cell.
   */
  matchHighlighting: boolean;
};

export function readFeatureFlags<TData extends RowData>(
  options: Pick<
    UseTMDataGridOptions<TData>,
    | "enableSorting"
    | "sortMode"
    | "manualSorting"
    | "enableColumnFilters"
    | "enableGlobalFilter"
    | "enableHiding"
    | "enableColumnPinning"
    | "enableColumnResizing"
    | "enableColumnOrdering"
    | "enableRowSelection"
    | "enableMultiRowSelection"
    | "selectionMode"
    | "showSelectedBackground"
    | "cellSelection"
    | "enablePagination"
    | "manualPagination"
    | "enableGrouping"
    | "editing"
    | "enableRowNumbers"
    | "enableRowPinning"
    | "enableMatchHighlighting"
  >,
): TMDataGridFeatureFlags {
  const selectionMode = options.selectionMode ?? "checkbox";
  // Editing brings the cell cursor with it: Enter, F2 and type-to-edit all
  // address "the focused cell", which only exists under cell selection. An
  // explicit `cellSelection` still wins, `"range"` included.
  const cellSelectionMode =
    options.cellSelection ?? (options.editing !== undefined ? "single" : "none");
  // `"highlight"` is the master-detail mode: no selection to speak of, so the
  // checkbox column and the click-to-select behaviour both fall away. Otherwise
  // `enableRowSelection` still has the final say, including its predicate form.
  const rowSelection =
    selectionMode !== "highlight" && options.enableRowSelection !== false;

  return {
    sorting: options.enableSorting !== false,
    frozenSort: options.sortMode === "frozen" && options.manualSorting !== true,
    filtering: options.enableColumnFilters !== false,
    globalFiltering: options.enableGlobalFilter !== false,
    hiding: options.enableHiding !== false,
    pinning: options.enableColumnPinning !== false,
    resizing: options.enableColumnResizing !== false,
    ordering: options.enableColumnOrdering !== false,
    rowSelection,
    selectionMode,
    selectColumn:
      rowSelection &&
      (selectionMode === "checkbox" || selectionMode === "checkboxAndHighlight"),
    rowClickSelects: rowSelection && selectionMode === "row",
    multiRowSelection: options.enableMultiRowSelection !== false,
    // In "row" mode the highlight *is* the feedback for a click, so it is on.
    // With checkboxes the box already says it, so it is off unless asked for.
    showSelectedBackground:
      options.showSelectedBackground ?? selectionMode === "row",
    highlightRow:
      selectionMode === "checkboxAndHighlight" || selectionMode === "highlight",
    cellSelection: cellSelectionMode !== "none",
    cellSelectionMode,
    cellRangeSelection: cellSelectionMode === "range",
    pagination:
      options.enablePagination === true || options.manualPagination === true,
    grouping: options.enableGrouping ?? options.manualPagination !== true,
    editing: options.editing !== undefined,
    editMode: options.editing?.mode ?? null,
    editDraft: options.editing?.draft === true,
    editNewRowsSticky:
      options.editing?.draft === true &&
      options.editing.newRowsSticky === true,
    rowNumbers: options.enableRowNumbers === true,
    // A predicate counts as on - some rows may still pin.
    rowPinning:
      options.enableRowPinning === true ||
      typeof options.enableRowPinning === "function",
    matchHighlighting: options.enableMatchHighlighting === true,
  };
}

/**
 * What one column's header may offer.
 *
 * | Affordance | Turned off by |
 * | ---------- | ------------- |
 * | Sort arrow, Sort ASC/DESC | `enableSorting` (table or column) |
 * | Filter item, panel entry  | `enableColumnFilters` / `enableColumnFilter` |
 * | Hide column               | `enableHiding` (table or column) |
 * | Pin to left / right       | `enableColumnPinning` / `enablePinning` |
 * | Resize dragging           | `enableColumnResizing` / `enableResizing` |
 * | Header dragging, Move left / right | `enableColumnOrdering` / `meta.enableOrdering` |
 * | Group by / Ungroup        | `enableGrouping` (table or column) |
 */
export type TMDataGridColumnCapabilities = {
  canSort: boolean;
  canFilter: boolean;
  canHide: boolean;
  canPin: boolean;
  canResize: boolean;
  canReorder: boolean;
  canGroup: boolean;
};

export function getColumnCapabilities(
  column: Column<TMDataGridFeatures, TMDataGridRowData, unknown>,
  features: TMDataGridFeatureFlags,
): TMDataGridColumnCapabilities {
  return {
    canSort: features.sorting && column.getCanSort(),
    canFilter: features.filtering && column.getCanFilter(),
    canHide: features.hiding && column.getCanHide(),
    canPin: features.pinning && column.getCanPin(),
    canResize: features.resizing && column.getCanResize(),
    // Ordering has no TanStack capability method - see isColumnReorderable.
    canReorder: features.ordering && isColumnReorderable(column),
    // `getCanGroup()` also insists on an accessor, which is what keeps the
    // generated checkbox and tree columns from offering to group on themselves.
    canGroup: features.grouping && column.getCanGroup(),
  };
}

/** The same questions, asked of the whole grid - used to hide toolbar buttons. */
export type TMDataGridCapabilities = {
  canSortAny: boolean;
  canFilterAny: boolean;
  canHideAny: boolean;
  canPinAny: boolean;
  canReorderAny: boolean;
  canGroupAny: boolean;
  canSelectRows: boolean;
  canPaginate: boolean;
  /** At least one leaf column takes part in the global quick search. */
  canSearch: boolean;
};

export function getGridCapabilities(
  table: TMDataGridTable<TMDataGridRowData>,
  features: TMDataGridFeatureFlags,
): TMDataGridCapabilities {
  const columns = table.getAllLeafColumns();
  const any = (predicate: (capabilities: TMDataGridColumnCapabilities) => boolean) =>
    columns.some((column) => predicate(getColumnCapabilities(column, features)));

  return {
    canSortAny: any((c) => c.canSort),
    canFilterAny: any((c) => c.canFilter),
    canHideAny: any((c) => c.canHide),
    canPinAny: any((c) => c.canPin),
    canReorderAny: any((c) => c.canReorder),
    canGroupAny: any((c) => c.canGroup),
    canSelectRows: features.rowSelection,
    canPaginate: features.pagination,
    canSearch:
      features.globalFiltering &&
      columns.some((column) => column.getCanGlobalFilter()),
  };
}
