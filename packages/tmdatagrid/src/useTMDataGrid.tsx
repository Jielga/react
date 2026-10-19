import { useCreateStore, useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import {
  type AccessorFn,
  type AccessorFnColumnDef,
  type AccessorKeyColumnDef,
  aggregationFns,
  type ColumnDef,
  type ColumnHelper,
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  type ColumnPinningState,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  type DeepKeys,
  type DeepValue,
  type DisplayColumnDef,
  filterFns,
  getInitialTableState,
  type GroupColumnDef,
  globalFilteringFeature,
  type IdentifiedColumnDef,
  metaHelper,
  type Row,
  type RowData,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  type Table,
  tableFeatures,
  type TableOptions,
  type TableState,
  useTable,
} from "@tanstack/react-table";
import type { Store } from "@tanstack/store";
import {
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TMDataGridRowData } from "./TMDataGridContext";
import type { TMDataGridOptionsSource } from "./core/columnOptions";
import {
  createEditEngine,
  type TMDataGridEditApi,
  type TMDataGridEditCommitArgs,
  type TMDataGridSaveDraftsArgs,
  type TMDataGridSaveDraftsResponse,
  type TMDataGridEditEngineContext,
  type TMDataGridColumnEditOptions,
  type TMDataGridEditMode,
  type TMDataGridRowAddArgs,
  type TMDataGridRowDeleteArgs,
  type TMDataGridRowValidators,
  type TMDataGridTableValidators,
} from "./core/editEngine";
import {
  emptyValueForOperator,
  type TMDataGridColumnType,
  tmDataGridFilterFn,
} from "./core/filterOperators";
import {
  DEFAULT_COLUMN_MIN_SIZE,
  getColumnDefaultOperator,
  isControlColumn,
  isGeneratedColumn,
} from "./core/columnUtils";
import type { TMDataGridColumnFilterOptions } from "./core/filterControls";
import {
  resolveFilterOptions,
  type TMDataGridFiltersOptions,
  type TMDataGridFiltersSettings,
} from "./core/filterSurface";
import {
  columnCanQuickSearch,
  createFuzzyRankedSortedRowModel,
  fuzzyGlobalFilterFn,
  type TMDataGridQuickSearchMode,
} from "./core/quickSearch";
import {
  mergeLabels,
  type TMDataGridLabels,
  type TMDataGridLabelsOverride,
} from "./core/labels";
import {
  collectLeafColumnIds,
  collectUrlExcludedColumnIds,
  findOverlappingSlices,
  hasPersistenceKeys,
  readPersistedState,
  type TMDataGridPersistence,
  writePersistedState,
} from "./core/persistence";
import {
  readFeatureFlags,
  type TMDataGridCellSelectionMode,
  type TMDataGridFeatureFlags,
  type TMDataGridSelectionMode,
} from "./core/capabilities";
import {
  isSameCell,
  type TMDataGridCellPosition,
} from "./core/cellNavigation";
import {
  findFrozenStateSlices,
  stabilizeControlledState,
  withoutUndefinedSlices,
} from "./core/controlledState";
import {
  beginControlledStateSync,
  deferControlledStateSyncPublishes,
  endControlledStateSync,
} from "./core/controlledStateSync";
import { registerDeletedRows } from "./core/deletedRows";
import {
  withPageReset,
  type TMDataGridQueryTable,
} from "./core/pageReset";
import type { TMDataGridCellRange } from "./core/cellRange";
import {
  resolveExportOptions,
  type TMDataGridExportOptions,
  type TMDataGridExportPickerRequest,
  type TMDataGridExportSettings,
  type TMDataGridExportValueGetter,
} from "./core/export";
import { SELECT_COLUMN_ID } from "./components/TMDataGridSelectColumn";
import { GROUP_COLUMN_ID } from "./components/TMDataGridGroupColumn";
import { DETAILS_COLUMN_ID } from "./components/TMDataGridDetailsColumn";
import { EDIT_COLUMN_ID } from "./components/TMDataGridEditColumn";
import {
  createDetailsColumn,
  createEditColumn,
  createGroupColumn,
  createSelectColumn,
} from "./components/generatedColumns";
import {
  createRowNumberColumn,
  ROW_NUMBER_COLUMN_ID,
} from "./components/TMDataGridRowNumberColumn";

/**
 * How long the grid waits after the last state change before writing to
 * storage. Long enough to collapse a resize drag into one write, short enough
 * that a reload right after a change still sees it.
 */
const PERSIST_DEBOUNCE_MS = 200;

/**
 * Per-column configuration the grid's own components read.
 *
 * The filter and edit stages each get a namespace, `filter` and `edit`,
 * mirroring the feature's runtime API. What the column *is* stays flat:
 * `label`, `type`, `options`, `align`, `flex`, `autoSize`, `enableOrdering`.
 * `type` and `options` are read by both stages, so one declaration of each
 * feeds the filter panel and the cell editor, which is why they sit outside
 * both namespaces.
 *
 * `TData` types the row that `options` and `edit.enabled` callbacks receive.
 * `createTMDataGridColumnHelper<TData>()` fills it in.
 */
export type TMDataGridColumnMeta<TData extends RowData = TMDataGridRowData> = {
  /** Name shown in menus and the column manager. Falls back to a string header. */
  label?: string;
  /**
   * Drives which filter operators are offered and, once editing is on, which
   * editor the cell opens. Defaults to `"string"`.
   */
  type?: TMDataGridColumnType;
  /**
   * The choices of a `select` / `multiSelect` column - one declaration feeding
   * the filter panel's value control and the cell editor alike. A static
   * array, `"faceted"` (the distinct values present in the data), or a
   * function of the table, column and, for editors, the row. See
   * {@link TMDataGridOptionsSource}.
   */
  options?: TMDataGridOptionsSource<TData>;
  /** Share of the leftover width this column claims. Defaults to `1`. */
  flex?: number;
  align?: "left" | "right" | "center";
  /**
   * How many columns this column's cell covers on a row, counting itself.
   * Defaults to `1`.
   *
   * A cell spanning `n` is one cell `n` columns wide; the `n - 1` cells to its
   * right do not render on that row. A function decides per row:
   *
   * ```tsx
   * meta: {
   *   // An open row's title takes the rest of the row.
   *   colSpan: ({ row }) => (row.getIsExpanded() ? Infinity : 1),
   * }
   * ```
   *
   * Counted over the displayed columns, so hiding or moving a column changes
   * what a span covers. A span stops at the last of your columns - it never
   * covers the checkbox, tree, details or edit lane - and at the edge of its
   * pinned block. Group rows, and a row open in row edit mode, ignore it.
   *
   * Display only: sorting, filtering, copy and export still see every column.
   */
  colSpan?: number | ((args: TMDataGridColSpanArgs<TData>) => number);
  /**
   * Size the column to its widest mounted content once, after the first rows
   * render - unless a persisted or user-set width already covers it. The same
   * measurement as double-clicking the resize divider; see `autosizeColumn`.
   */
  autoSize?: boolean;
  /**
   * `false` keeps the column where it is: no header dragging, no move items.
   * Column ordering is the one feature TanStack defines no column option for,
   * so its switch lives here rather than on the column definition.
   */
  enableOrdering?: boolean;
  /**
   * How this column filters: which operators it offers, the operator a fresh
   * filter starts with, and the value control the filter panel renders for it.
   *
   * ```tsx
   * meta: {
   *   type: "number",
   *   filter: { defaultOperator: "between", control: DgRangeSliderFilter },
   * }
   * ```
   *
   * See {@link TMDataGridColumnFilterOptions}.
   */
  filter?: TMDataGridColumnFilterOptions;
  /**
   * How this column is edited: whether it takes edits, which field they write
   * to, which editor opens, what validates the field and what maps the value
   * on its way in.
   *
   * ```tsx
   * meta: {
   *   type: "string",
   *   edit: { validate: z.string().min(2, "Too short") },
   * }
   * ```
   *
   * See {@link TMDataGridColumnEditOptions}.
   */
  edit?: TMDataGridColumnEditOptions<TData>;
  /**
   * `false` leaves the column out of every export and out of Ctrl+C - for a
   * column of buttons, or one whose value means nothing outside the grid.
   * Defaults to `true`.
   */
  enableExport?: boolean;
  /**
   * The value an export writes for this column, in place of
   * `row.getValue(column.id)`. The export otherwise writes the value, never
   * what the cell renders, so this is where a status code becomes its label
   * or a nested object becomes one field.
   *
   * ```tsx
   * meta: {
   *   exportValue: ({ value }) => STATUS_LABELS[value as Status],
   * }
   * ```
   */
  exportValue?: TMDataGridExportValueGetter;
};

/** Grid-wide configuration passed through `options.meta`. */
export type TMDataGridTableMeta = {
  loading?: boolean;
  noResultsLabel?: string;
  /** Row height used by the virtualizer. Defaults to `52`. */
  rowHeight?: number;
  /**
   * Unfiltered row total. Only needed for server-driven grids, where the client
   * never holds the full data set - `TMDataGrid.SummaryCount` uses it as denominator.
   */
  totalRowCount?: number;
};

/**
 * Every feature the TMDataGrid chrome can drive. Defined at module scope so the
 * reference stays stable across renders (see the TanStack table-state skill).
 */
export const tmDataGridFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnFacetingFeature,
  columnGroupingFeature,
  rowAggregationFeature,
  // Registered for grouping's sake rather than for tree data: the grouped row
  // model builds the parent rows, and this is what flattens the expanded ones
  // back into the flat list the body virtualizes.
  rowExpandingFeature,
  rowPinningFeature,

  filteredRowModel: createFilteredRowModel(),
  groupedRowModel: createGroupedRowModel(),
  // The sorted model plus the fuzzy quick search's rank ordering - see
  // core/quickSearch.ts for when the ordering applies.
  sortedRowModel: createFuzzyRankedSortedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  facetedUniqueValues: createFacetedUniqueValues(),

  filterFns: {
    ...filterFns,
    tmDataGrid: tmDataGridFilterFn,
    tmDataGridFuzzy: fuzzyGlobalFilterFn,
  },
  sortFns,
  // The names `columnDef.aggregationFn` accepts. Only consulted for columns
  // that ask for one - a column with no `aggregationFn` reports `undefined` on
  // a group row, which is what keeps a plain "group by" free of aggregates.
  aggregationFns,

  tableMeta: metaHelper<TMDataGridTableMeta>(),
  columnMeta: metaHelper<TMDataGridColumnMeta>(),
});

export type TMDataGridFeatures = typeof tmDataGridFeatures;

export type TMDataGridTable<TData extends RowData> = Table<
  TMDataGridFeatures,
  TData
>;

/** A column definition with `meta` typed against the row type. */
type WithRowTypedMeta<TDef, TData extends RowData> = TDef extends unknown
  ? Omit<TDef, "meta"> & { meta?: TMDataGridColumnMeta<TData> }
  : never;

/**
 * TanStack's column helper with `meta` typed against `TData`, so the
 * `meta.options` and `meta.edit.enabled` callbacks receive
 * `Row<TMDataGridFeatures, TData>`.
 */
export type TMDataGridColumnHelper<TData extends RowData> = {
  accessor: <
    TAccessor extends AccessorFn<TData> | DeepKeys<TData>,
    TValue extends TAccessor extends AccessorFn<TData, infer TReturn>
      ? TReturn
      : TAccessor extends DeepKeys<TData>
        ? DeepValue<TData, TAccessor>
        : never,
  >(
    accessor: TAccessor,
    column: WithRowTypedMeta<
      TAccessor extends AccessorFn<TData>
        ? DisplayColumnDef<TMDataGridFeatures, TData, TValue>
        : IdentifiedColumnDef<TMDataGridFeatures, TData, TValue>,
      TData
    >,
  ) => TAccessor extends AccessorFn<TData>
    ? AccessorFnColumnDef<TMDataGridFeatures, TData, TValue>
    : AccessorKeyColumnDef<TMDataGridFeatures, TData, TValue>;
  columns: ColumnHelper<TMDataGridFeatures, TData>["columns"];
  display: (
    column: WithRowTypedMeta<DisplayColumnDef<TMDataGridFeatures, TData>, TData>,
  ) => DisplayColumnDef<TMDataGridFeatures, TData, unknown>;
  group: (
    column: WithRowTypedMeta<
      GroupColumnDef<TMDataGridFeatures, TData, unknown>,
      TData
    >,
  ) => GroupColumnDef<TMDataGridFeatures, TData, unknown>;
};

export function createTMDataGridColumnHelper<
  TData extends RowData,
>(): TMDataGridColumnHelper<TData> {
  // Same runtime helper. The features object registers one meta type for
  // every table, so the row-typed meta exists only in this signature; the
  // grid calls the callbacks with the rows of the table they belong to.
  return createColumnHelper<
    TMDataGridFeatures,
    TData
  >() as unknown as TMDataGridColumnHelper<TData>;
}

/** What the `renderDetails` render prop is handed for an expanded row. */
export type TMDataGridDetailsArgs<TData extends RowData> = {
  row: Row<TMDataGridFeatures, TData>;
  table: TMDataGridTable<TData>;
};

/** What a `meta.colSpan` function receives. */
export type TMDataGridColSpanArgs<TData extends RowData> = {
  row: Row<TMDataGridFeatures, TData>;
  table: TMDataGridTable<TData>;
};

/** Builds the panel shown underneath an expanded row. See `renderDetails`. */
export type TMDataGridDetailsRenderer<TData extends RowData> = (
  args: TMDataGridDetailsArgs<TData>,
) => ReactNode;

/**
 * What the virtualizer assumes a detail panel it has not measured yet is worth.
 * Only a seed - every mounted row is measured, so the real height replaces it.
 */
const DEFAULT_DETAILS_EST_HEIGHT = 160;

/** Rows kept mounted on each side of the viewport. See `overscan`. */
const DEFAULT_OVERSCAN = 6;

/** One empty array, so a selector answering "none" never changes identity. */
const EMPTY_IDS: ReadonlyArray<string> = [];

/**
 * Chrome state that is *not* table state: which panels are open, and which
 * column opened the filter panel. Kept in a TanStack Store so consumers can
 * subscribe to it the same way they subscribe to `table.store`.
 */
export type TMDataGridUiState = {
  filterPanelOpen: boolean;
  /**
   * Column whose *panel* row should take the focus. Cleared once the row has
   * taken it, so pointing at the same column twice focuses twice.
   */
  filterPanelColumnId: string | null;
  /**
   * Column whose *header filter* control should take the focus, under
   * `filters.inHeader`. Cleared once taken, like the one above.
   *
   * Its own slot rather than a second reader of `filterPanelColumnId`: a grid
   * can have header filters and a panel at once, and two controls racing to
   * answer one id means whichever mounted last wins the caret.
   */
  headerFilterColumnId: string | null;
  /**
   * Column being dragged by its header, if any. Held here rather than read from
   * `dataTransfer`, which browsers keep unreadable until the drop.
   */
  draggedColumnId: string | null;
  /**
   * The single highlighted row - the one a detail panel would be showing. Its
   * own concept, not a slice of `rowSelection`: under
   * `selectionMode: "checkboxAndHighlight"` the two coexist, and TanStack's one
   * selection map cannot hold both.
   *
   * Not pruned when the row is filtered out, paged away or dropped from `data`,
   * matching how TanStack treats `rowSelection` - nothing there resets it
   * either. The row simply renders unhighlighted, and highlights again if it
   * comes back.
   */
  highlightedRowId: string | null;
  /** The pivot a shift-click extends from. See resolveRowSelectionClick. */
  selectionAnchorRowId: string | null;
  /**
   * The cell the keyboard is on, under `enableCellSelection`. `null` until the
   * grid is first entered - and again whenever a consumer clears it.
   *
   * The state is the source of truth and DOM focus follows it, not the other
   * way around: under virtualization the cell it names is often not mounted,
   * which is exactly what a coordinate has to survive. Held as ids for the
   * same reason - see {@link TMDataGridCellPosition}.
   */
  focusedCell: TMDataGridCellPosition | null;
  /**
   * The selected rectangle, under `cellSelection: "range"`. Held as the two
   * cells that span it - see {@link TMDataGridCellRange}.
   *
   * Always covers the focused cell: every gesture that moves the focus either
   * extends the rectangle or collapses it onto the new cell, so the two never
   * describe different places.
   */
  cellRange: TMDataGridCellRange | null;
  /**
   * The export column picker, while it is open: which rows it exports and the
   * options of the item that opened it. `null` while closed. Held here rather
   * than in the menu item, which unmounts with the dropdown the moment it is
   * clicked.
   */
  exportPicker: TMDataGridExportPickerRequest | null;
};

export type TMDataGridUiActions = {
  openFilterPanel: (columnId?: string | null) => void;
  closeFilterPanel: () => void;
  /** Opens the export column picker for `request`. See `TMDataGrid.Menu.Export`'s `columns="custom"`. */
  openExportPicker: (request: TMDataGridExportPickerRequest) => void;
  closeExportPicker: () => void;
  /**
   * Points at a column's row in the filter panel without opening anything.
   * `openFilterPanel` does this as well as opening; this is the half a panel
   * that is already showing needs.
   */
  focusPanelFilter: (columnId: string | null) => void;
  /**
   * Points at a column's header filter control - what `openColumnFilter` does
   * under `filters.inHeader`, where there is no panel to open. The header row
   * scrolls the column into view and focuses it.
   */
  focusHeaderFilter: (columnId: string | null) => void;
  startColumnDrag: (columnId: string) => void;
  endColumnDrag: () => void;
  /**
   * Moves the active row, or clears it with `null` - which is how a consumer
   * closing its detail panel puts the grid back in step.
   */
  setHighlightedRow: (rowId: string | null) => void;
  setSelectionAnchor: (rowId: string | null) => void;
  /**
   * Moves the focused cell, or clears it with `null`. DOM focus follows while
   * the grid holds it - so this both moves the keyboard and, when the row is
   * off screen, scrolls it into view. Called for every arrow key, and available
   * for a consumer putting the keyboard somewhere itself.
   */
  setFocusedCell: (cell: TMDataGridCellPosition | null) => void;
  /**
   * Sets the selected rectangle, or clears it with `null`. Does not move the
   * focused cell - the two are set together by the gestures that change both,
   * which is what keeps "extend the selection" and "move the cursor" separable.
   */
  setCellRange: (range: TMDataGridCellRange | null) => void;
};

export type TMDataGridUiStore = Store<TMDataGridUiState, TMDataGridUiActions>;

/** Where a scrolled-to row lands in the viewport. TanStack's own alignments. */
export type TMDataGridScrollAlign = "auto" | "start" | "center" | "end";

export type TMDataGridScrollToRowArgs = {
  /** The row's id, as `getRowId` produced it. */
  rowId: string;
  /** Defaults to `"auto"` - the nearest edge, leaving a visible row alone. */
  align?: TMDataGridScrollAlign;
};

/** @internal The body's scroll implementation. See `scrollToRow`. */
export type TMDataGridScroller = (args: TMDataGridScrollToRowArgs) => boolean;

/** What `useTMDataGrid` returns - spread straight onto `<TMDataGrid />`. */
export type TMDataGridApi<TData extends RowData> = {
  table: TMDataGridTable<TData>;
  ui: TMDataGridUiStore;
  /**
   * The edit engine - open forms, dirty/error projections, and the verbs
   * (`begin`, `commit`, `cancel`, `saveDrafts`). `edit.getForm(rowId)` hands
   * out the same TanStack Form the inline editors write through while a row
   * is open, so a drawer or detail panel can share a row's draft; a
   * committed row has no form until `begin` reopens it. Inert until
   * `editing` is set.
   */
  edit: TMDataGridEditApi<TData>;
  /** Table-level feature switches, re-read from options on every render. */
  features: TMDataGridFeatureFlags;
  /**
   * Where the filter controls live, the `filters` option with its defaults
   * filled in. On the api rather than in a component's props because the
   * pills, the column menu and `openColumnFilter` all have to agree with the
   * table about which surface is on.
   */
  filters: TMDataGridFiltersSettings;
  /**
   * How the grid exports, the `exportOptions` option with its defaults filled
   * in. Read by `useTMDataGridExport`, the `TMDataGrid.Menu.Export*` items and
   * the cell-range menu, so every export of the grid agrees on the format.
   */
  exportOptions: TMDataGridExportSettings;
  /** Every string the chrome renders, `labels` merged over the English defaults. */
  labels: TMDataGridLabels;
  /** The detail renderer, when row details are on. See `renderDetails`. */
  renderDetails?: TMDataGridDetailsRenderer<TData>;
  /** Detail estimate in px: the option, or {@link DEFAULT_DETAILS_EST_HEIGHT}. */
  renderDetailsEstHeight: number;
  /** Virtualizer overscan: the option, or {@link DEFAULT_OVERSCAN}. */
  overscan: number;
  /**
   * Puts the settings state - visibility, order, widths, pinning, grouping -
   * back to what a first visit with clean storage would have shown: the
   * consumer's `initialState` plus the structural lanes. With persistence
   * configured the reset writes through to storage like any other change.
   *
   * This, not TanStack's `resetColumnX()` family, is the reset for a
   * persisted grid: those reset to `initialState`, and the grid bakes the
   * restored payload into `initialState` at mount - they would "reset" to
   * the very layout being discarded.
   */
  resetSettings: () => void;
  /**
   * Scrolls a row into view. The grid is always virtualized, so a row far down
   * the list has no element to scroll to - this moves the virtualizer instead,
   * which is the only thing that can put one there.
   *
   * ```ts
   * grid.scrollToRow({ rowId: "42", align: "center" });
   * ```
   *
   * Answers whether the row could be reached. `false` means it is not in the
   * current view at all - filtered out, on another page, or an id that matches
   * no row - and nothing scrolled. A pinned row answers `true` without
   * scrolling: it is already parked at an edge.
   *
   * Identity is stable, so it is safe in a dependency array.
   */
  scrollToRow: (args: TMDataGridScrollToRowArgs) => boolean;
  /**
   * @internal Wiring for `TMDataGrid.Table`, which holds the virtualizer and
   * fills this in. Not part of the public API.
   */
  scrollerRef: MutableRefObject<TMDataGridScroller>;
};

/** The editing members every mode shares. See {@link TMDataGridEditingOptions}. */
type TMDataGridEditingCallbacks<TData extends RowData> = {
  /**
   * Form-level validators for the whole editing row - where cross-field
   * rules live. TanStack Form's own vocabulary, Standard Schema included:
   *
   * ```tsx
   * rowValidators: {
   *   onSubmit: z.object({ salary: z.number().positive() })
   *     .refine((r) => r.status !== "Terminated" || r.salary === 0, {
   *       message: "A terminated employee has no salary",
   *     }),
   * }
   * ```
   *
   * Pathed issues land on the matching columns; pathless ones on the row.
   */
  rowValidators?: TMDataGridRowValidators;
  /**
   * Rules that need the other rows - no duplicate keys, no overlapping
   * ranges, allocations summing to a total. Handed the committing row and
   * `rows`, the collection as it would stand if the commit landed: every
   * draft overlaid, entry rows appended, deletion-marked rows removed.
   *
   * ```tsx
   * tableValidators: {
   *   onSubmit: ({ value, rowId, rows }) =>
   *     rows.some((r) => r.rowId !== rowId && r.value.code === value.code)
   *       ? { fields: { code: "Duplicate code" } }
   *       : undefined,
   * }
   * ```
   *
   * Runs at every commit, after the row's own validators, and again per
   * parked row during `saveDrafts` - a draft another edit has invalidated
   * blocks the save. Pathed issues land on the committing row's cells,
   * pathless ones on the row.
   */
  tableValidators?: TMDataGridTableValidators<TData>;
  /** Rows the pencil skips - `false` keeps a row read-only in every mode. */
  isRowEditable?: (row: Row<TMDataGridFeatures, TData>) => boolean;
  /**
   * Called when an edit commits. The grid never mutates `data`: apply the
   * change and let the new data arrive back through `data` as always. The
   * engine drops the draft only when this resolves - a slow save keeps the
   * draft visible with a busy marker - and a rejection keeps the form open
   * with the error on the row.
   *
   * `changes` is the per-field diff (one entry in cell mode), for a PATCH.
   * `value` is the entire edited row, for saving a record.
   */
  onCommit?: (args: TMDataGridEditCommitArgs<TData>) => void | Promise<void>;
  /**
   * Seed values for `edit.addRow()` - the entry row's starting point. A
   * function is called per added row (fresh timestamps, empty arrays).
   * `edit.addRow(values)` overrides this key by key for that one row.
   */
  newRowDefaults?: TData | (() => TData);
  /**
   * Called when an entry row commits: `Enter` or the lane's ✓, or
   * `saveDrafts` under `editing.draft`. Create the record and let it arrive
   * back through `data`; the engine's `tempId` never leaves the grid.
   */
  onRowAdd?: (args: TMDataGridRowAddArgs<TData>) => void | Promise<void>;
  /**
   * Called by `edit.deleteRow` - confirmation, if any, belongs in here. Under
   * `editing.draft` deletions accumulate in `edit.state.deletedRowIds`
   * instead and are reported by `saveDrafts`. Setting this also puts the
   * trash can in the edit lane.
   */
  onRowDelete?: (args: TMDataGridRowDeleteArgs<TData>) => void | Promise<void>;
};

/**
 * The `editing` option: one object that turns editing on and holds
 * everything about it. Two axes, and they are independent: `mode` picks what
 * counts as a commit, `draft` picks where that commit goes.
 *
 * | Mode | Commit | Cancel | Controls |
 * | ---- | ------ | ------ | -------- |
 * | `"cell"` | Enter, Tab, blur - Sheets | Escape | none |
 * | `"cellConfirm"` | ✓ or Enter; Tab and blur keep the draft | ✕ or Escape | ✓ / ✕ beside the input |
 * | `"row"` | Save in the edit lane, or Enter | Cancel, or Escape | generated edit lane |
 *
 * | `draft` | Where a commit goes |
 * | ------- | ------------------- |
 * | `false` (default) | Out as it happens - `onCommit`, `onRowAdd`, `onRowDelete` |
 * | `true` | Into the grid's draft store; `edit.saveDrafts()` sends the lot |
 *
 * So `{ mode: "row", draft: true }` is "edit a row, the lane's ✓ parks it,
 * the toolbar's Save sends every parked row at once", and
 * `{ mode: "cell", draft: true }` is the same store filled cell by cell.
 *
 * Setting `editing` makes `getRowId` required - drafts are keyed by row id,
 * and the index fallback would name a different record after any sort - and
 * `onSaveDrafts` exists only under `draft: true`, the one configuration with
 * a draft store to save.
 *
 * The object may be written inline: the callbacks are read through a ref
 * every render, so its identity does not matter.
 *
 * One TanStack Form per editing row; drafts survive scrolling because the
 * forms live outside the DOM, keyed by row id. Which columns edit, and with
 * what, is declared per column under `meta.edit`: `meta.type` picks the
 * built-in editor, and `enabled`, `field`, `editor`, `validate` and `mapValue`
 * override the rest.
 */
export type TMDataGridEditingOptions<TData extends RowData> =
  TMDataGridEditingCallbacks<TData> & {
    /** What counts as a commit. See the table above. */
    mode: TMDataGridEditMode;
    /**
     * The column ids that take edits, by id. Unset - the default - every
     * column mapping to a data path is editable, which is what a grid whose
     * columns are mostly the record itself wants.
     *
     * Set it for the other shape: a grid of reference data with one or two
     * columns the user maintains, where naming those is shorter and harder to
     * get wrong than switching every other column off one by one.
     *
     * This gates before `meta.edit`, never past it: a column left out takes no
     * edits whatever its own meta says, and a column listed here still answers
     * to its `meta.edit.enabled`.
     */
    columns?: ReadonlyArray<string>;
  } & (
      | {
          /**
           * Commits park in the grid's draft store instead of reaching the
           * consumer, and leave together through `edit.saveDrafts()`. The
           * edit lane gains the change markers and the per-row revert, the
           * trash marks a row for deletion rather than deleting it, and
           * `TMDataGrid.DraftActions` gets something to save.
           */
          draft: true;
          /**
           * The bulk save: called once by `edit.saveDrafts()` with the
           * whole draft store - committed edits, added rows and deletion
           * marks - so a server can apply it as one transaction. Without it,
           * `saveDrafts` falls back to the per-row
           * {@link TMDataGridEditingCallbacks.onCommit} loop.
           *
           * Rows still open are not in the payload and stay open. Returning
           * nothing saves the whole store and throwing saves none of it;
           * return a {@link TMDataGridSaveDraftsResponse} to save part of it.
           */
          onSaveDrafts?: (
            args: TMDataGridSaveDraftsArgs<TData>,
          ) =>
            | void
            | TMDataGridSaveDraftsResponse
            | Promise<void | TMDataGridSaveDraftsResponse>;
          /**
           * Keep committed entry rows pinned in the sticky entry block until
           * the draft store is saved, out of the body's sort. Off by default:
           * a committed row joins the body rows instead, sorted and filtered
           * with them - the block a row is *typed* into is always sticky, but
           * committed rows scroll, so entering many cannot fill the viewport
           * with sticky chrome.
           */
          newRowsSticky?: boolean;
        }
      | {
          /** Every commit reaches the consumer as it happens. The default. */
          draft?: false;
          /** Only `draft: true` has a store to save - see the other branch. */
          onSaveDrafts?: never;
          /** Parked entry rows exist only under `draft: true` - see there. */
          newRowsSticky?: never;
        }
    );

export type UseTMDataGridOptions<TData extends RowData> = Omit<
  TableOptions<TMDataGridFeatures, TData>,
  "features"
> &
  (
    | { editing?: undefined }
    | {
        /** Turns editing on. See {@link TMDataGridEditingOptions}. */
        editing: TMDataGridEditingOptions<TData>;
        /**
         * Required once `editing` is set: the forms are keyed by row id and
         * live outside the DOM, and the index fallback points at a different
         * record after any sort.
         */
        getRowId: NonNullable<
          TableOptions<TMDataGridFeatures, TData>["getRowId"]
        >;
      }
  ) & {
  /**
   * Restore and persist table state across mounts. Two storage keys, because
   * the two kinds of state have different lifetimes, and a URL search param
   * for the data slices a link should carry - see {@link TMDataGridPersistence}.
   *
   * Keep the object referentially stable (module scope or `useMemo`); it is a
   * dependency of the subscription that writes back.
   */
  persist?: TMDataGridPersistence;
  /**
   * Overrides for the grid's strings - menu items, panels, the pager, and
   * every `aria-label`. Any subset, merged over the English defaults; a full
   * Swedish dictionary ships as `TMDATAGRID_LABELS_SV`.
   *
   * ```tsx
   * useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
   * useTMDataGrid({ data, columns, labels: { noResults: "Inga rader" } });
   * ```
   *
   * Keep the object referentially stable (module scope or `useMemo`) - the
   * chrome re-renders when its identity changes.
   */
  labels?: TMDataGridLabelsOverride;
  /**
   * Header drag-and-drop and the move items in the column menu. Defaults to
   * `true`.
   *
   * The one feature switch the grid defines itself: TanStack's
   * `columnOrderingFeature` ships state and APIs but no `enable` option, since
   * reordering is entirely a matter of interface.
   */
  enableColumnOrdering?: boolean;
  /**
   * Client-side pagination and the built-in `TMDataGrid.Footer` pager.
   * Defaults to `false`: the grid renders every filtered row and relies on
   * virtualization.
   *
   * The second grid-defined switch (TanStack defines no `enablePagination`
   * option). `manualPagination: true` implies it - a server-paged grid needs
   * no extra flag.
   */
  enablePagination?: boolean;
  /**
   * Sends the grid back to the first page whenever the query changes - a
   * column filter, the quick search, the sort or the grouping. On by
   * default. TanStack's own `autoResetPageIndex` is switched off by the
   * grid: it fires on any change to the `data` array, which under
   * `editing.draft` is every commit.
   *
   * Server-side, `pageIndex` is a position in a result set the grid does not
   * own: narrowing the query leaves it pointing past the last page, and the
   * next request comes back empty. The reset is applied in the same event as
   * the change, so one request goes out, for the first page of the new query.
   */
  resetPageOnQueryChange?: boolean;
  /**
   * The row-number gutter: a generated lane, outermost left, numbering the
   * rows of the current view - sorted, filtered, continuing across pages,
   * with group rows unnumbered. Off by default.
   */
  enableRowNumbers?: boolean;
  /**
   * Where the grid puts its filter controls - a popup over the rows, a sidebar
   * beside them, controls in the header row, or nowhere at all so you place
   * `TMDataGrid.FilterPanel` yourself.
   *
   * ```tsx
   * useTMDataGrid({ data, columns, filters: { surface: "sidebar", inHeader: true } });
   * ```
   *
   * Defaults to `{ surface: "popup" }` - the floating panel the grid has
   * always shown. See {@link TMDataGridFiltersOptions}.
   *
   * Read field by field, so a literal is fine here - unlike `labels` or
   * `persist`, this one does not have to be referentially stable.
   */
  filters?: TMDataGridFiltersOptions;
  /**
   * How the grid exports: the file format, the file name and whether the
   * column labels go in as the first row. Defaults to `csvExcelFormat()`,
   * `"export"` and `true`. See {@link TMDataGridExportOptions}.
   *
   * ```tsx
   * useTMDataGrid({ data, columns, exportOptions: { format: csvFormat(), fileName: "employees" } });
   * ```
   *
   * Read field by field like `filters`, so a literal is fine. A `format`
   * built inline is rebuilt every render, which costs nothing but a small
   * object; keep it at module scope when that bothers you.
   */
  exportOptions?: TMDataGridExportOptions;
  /**
   * How the quick search (`TMDataGrid.Search`) matches. `"fuzzy"` - the
   * default - forgives typos and skipped characters, and while it is the
   * only thing narrowing the grid (no sort, no grouping) the rows order by
   * match quality, best first. `"contains"` is plain substring matching.
   * An explicit `globalFilterFn` overrides both.
   */
  quickSearchMode?: TMDataGridQuickSearchMode;
  /**
   * Highlights the matched text in cells while a contains-family column
   * filter or the quick search is active. Default-rendered cells only - a
   * column with its own `cell` renderer opts out by existing; a fuzzy
   * typo-match with no contiguous occurrence shows no highlight. Off by
   * default.
   */
  enableMatchHighlighting?: boolean;
  /**
   * How rows are selected. Defaults to `"checkbox"`.
   *
   * | Mode | Checkbox column | Row click |
   * | ---- | --------------- | --------- |
   * | `"checkbox"` | yes, multi-select | nothing |
   * | `"row"` | no | multi-selects, Ctrl/Shift modifiers |
   * | `"checkboxAndHighlight"` | yes, multi-select | highlights one row |
   * | `"highlight"` | no | highlights one row, no selection at all |
   *
   * One option rather than two, so the combination that cannot work - a click
   * that both toggles a multi-selection and moves the highlight - is not
   * expressible.
   *
   * The first two write to TanStack's `rowSelection`. The highlight is separate
   * state, which is what lets `"checkboxAndHighlight"` run both at once: tick
   * rows for a bulk action, click one to open its detail panel. See
   * `defaultHighlightedRowId` / `onHighlightedRowChange`.
   *
   * `enableRowSelection` still gates the selection half, predicate form
   * included; under `"highlight"` there is nothing for it to gate.
   */
  selectionMode?: TMDataGridSelectionMode;
  /**
   * Give selected rows the highlight background. Defaults to `true` under
   * `selectionMode: "row"`, where the highlight is the only feedback a click
   * gives, and `false` under `"checkbox"`, where the box already shows it.
   *
   * The colour is the `--dg-row-selected-bg` CSS variable, so it can be changed
   * without turning the flag on or off:
   *
   * ```tsx
   * <TMDataGrid
   *   {...grid}
   *   style={{ "--dg-row-selected-bg": "var(--mantine-color-blue-0)" }}
   * />
   * ```
   */
  showSelectedBackground?: boolean;
  /**
   * The row that starts out highlighted, under a `selectionMode` that has a
   * highlight. Read once on mount, like `initialState`.
   *
   * The grid never persists the highlighted row. Pair this with
   * {@link onHighlightedRowChange} and keep it wherever it belongs - for a
   * detail panel that is usually the route, which gets you a shareable link and
   * a working back button as well as surviving a reload:
   *
   * ```tsx
   * const { rowId } = useParams();
   * useTMDataGrid({
   *   selectionMode: "highlight",
   *   defaultHighlightedRowId: rowId,
   *   onHighlightedRowChange: (id) => navigate(id ? `/employees/${id}` : "/employees"),
   * });
   * ```
   */
  defaultHighlightedRowId?: string | null;
  /**
   * Called with the newly highlighted row id, or `null` when it is cleared.
   * Fires for `ui.actions.setHighlightedRow` too, not only for clicks.
   */
  onHighlightedRowChange?: (rowId: string | null) => void;
  /**
   * How cells are selected. Defaults to `"none"`.
   *
   * | Mode | What it gives |
   * | ---- | ------------- |
   * | `"none"` | nothing; the body's tab stop stays on the row |
   * | `"single"` | one focused cell, moved with the arrow keys |
   * | `"range"` | as `"single"`, plus a rectangle of cells |
   *
   * Under either live mode:
   *
   * | Key | Moves to |
   * | --- | --- |
   * | Arrows | the neighbouring cell, clamped at the edges |
   * | PageUp / PageDown | one viewport of rows |
   * | Home / End | first / last cell of the row |
   * | Ctrl+Home / Ctrl+End | first / last cell of the grid |
   * | Enter or F2 | into the cell - the checkbox, link or button it holds |
   * | Escape | back out to the cell |
   * | Space | selects the row, as it does in row-selection mode |
   *
   * And under `"range"`, additionally:
   *
   * | Gesture | Does |
   * | ------- | ---- |
   * | Drag across cells | selects the rectangle they span |
   * | Shift+click, Shift+arrows | extends the rectangle from its anchor |
   * | Ctrl+C | copies it as tab-separated text - paste lands in Excel's cells |
   * | Right-click inside it | offers the CSV export, headers optional |
   *
   * Off, nothing about the body changes. On, three things do: the body's tab
   * stop moves from the row to a cell, so the whole grid is one Tab stop; the
   * grid reports itself as a `grid` of `gridcell`s rather than a `table` of
   * `cell`s, which is what tells a screen reader the arrow keys are live; and
   * the cells take `data-focused` / `data-selected` for the ring and the tint.
   *
   * The state is `ui.state.focusedCell` and `ui.state.cellRange`, and moving it
   * is `ui.actions.setFocusedCell` / `setCellRange` - so a consumer can put the
   * keyboard on a cell, or follow it:
   *
   * ```tsx
   * const grid = useTMDataGrid({
   *   data,
   *   columns,
   *   cellSelection: "range",
   *   onFocusedCellChange: (cell) => setStatus(cell?.columnId ?? ""),
   * });
   * ```
   *
   * Ids rather than a row/column index pair, so sorting, filtering and column
   * reordering move the selection with the cells instead of leaving it over
   * whatever slid into those positions.
   */
  cellSelection?: TMDataGridCellSelectionMode;
  /**
   * Called with the newly focused cell, or `null` when it is cleared. Fires for
   * `ui.actions.setFocusedCell` too, not only for keys and clicks.
   */
  onFocusedCellChange?: (cell: TMDataGridCellPosition | null) => void;
  /**
   * Renders a panel underneath an expanded row, spanning every column. Setting
   * it is what turns row details on.
   *
   * Which rows are open is TanStack's own `expanded` state, so opening one is
   * `row.toggleExpanded()` from wherever suits - a chevron in a cell, a button
   * in the context menu, a double-click:
   *
   * ```tsx
   * const grid = useTMDataGrid({
   *   data,
   *   columns,
   *   renderDetails: ({ row }) => <EmployeeCard employee={row.original} />,
   * });
   * ```
   *
   * The panel is as tall as what it renders - see {@link renderDetailsEstHeight}
   * for what the virtualizer assumes before it has measured one.
   *
   * Group rows are left out: expanding one opens its children, and a panel there
   * would be about an arbitrary one of them. The same reason they sit out
   * `onRowClick`.
   *
   * Row details and `selectionMode: "highlight"` are two answers to the same
   * question. Details keep the record in place and in context, which suits a few
   * fields or an action strip; a highlight-driven side panel has room for more
   * and survives scrolling. Nothing stops a grid from doing both.
   */
  renderDetails?: TMDataGridDetailsRenderer<TData>;
  /**
   * What the virtualizer assumes an unmeasured detail panel is worth, in px.
   * Defaults to 160.
   *
   * An estimate, not a height: every mounted row is measured, so the real one
   * takes over as soon as the panel is on screen. It keeps the scrollbar
   * accurate for panels that open off screen, such as restored `expanded`
   * state. An approximate value is enough.
   */
  renderDetailsEstHeight?: number;
  /**
   * Which edge the details lane sits on. Defaults to `"left"`.
   *
   * `"left"` pins the chevron after the row number, checkbox and tree lanes,
   * before every column of yours. `"right"` pins it after every column of
   * yours, inside the edit lane, so the chevron closes the row the way an
   * accordion's does. On either edge it stays a structural lane: the user
   * cannot move, hide or unpin it.
   */
  detailsColumnPosition?: "left" | "right";
  /**
   * Rows the virtualizer keeps mounted above and below the viewport. Defaults
   * to 6.
   *
   * Raise it to trade memory for a scroll that stays painted - fast wheel or
   * touch flings can outrun the virtualizer and flash blank rows, and a larger
   * buffer covers the gap. Lower it when rows are expensive to render.
   */
  overscan?: number;
};

type TMDataGridColumnDef<TData extends RowData> = ColumnDef<
  TMDataGridFeatures,
  TData,
  unknown
>;

/**
 * Drops the control lanes' entries from a visibility map.
 *
 * They are all `enableHiding: false`, but TanStack applies `columnVisibility`
 * regardless - the option only gates `toggleVisibility` - so a stale `false`
 * would hide a lane nothing in the grid can bring back: restored from storage
 * written before 2.1 (when the checkbox lane was still hideable), or passed in
 * `initialState`. The tree column is not scrubbed; its entry is the grid's own,
 * written after this.
 */
function withoutControlColumnVisibility(
  visibility: Record<string, boolean>,
): Record<string, boolean> {
  const scrubbed = { ...visibility };
  for (const id of Object.keys(scrubbed)) {
    if (isControlColumn(id)) delete scrubbed[id];
  }
  return scrubbed;
}

/**
 * The pagination the table starts with before anything is restored. Shared by
 * the table's `initialState` and the persistence baseline, so the URL param
 * compares against the page size the table really starts on.
 */
function startingPagination(
  initial: Partial<TableState<TMDataGridFeatures>> | undefined,
): TableState<TMDataGridFeatures>["pagination"] {
  return { pageIndex: 0, pageSize: 25, ...initial?.pagination };
}

/**
 * Point every column at the operator-dispatching filter function, and take
 * the aggregation defaults back off, unless the column opted into its own.
 * Anything the consumer set wins - it is spread over these.
 *
 * The aggregation pair needs explaining. TanStack's row aggregation feature
 * hands every column `aggregationFn: "auto"` and an `aggregatedCell` that
 * stringifies whatever comes out, so merely registering the feature would have
 * every numeric column silently sum itself and every date column show a range
 * the moment anything is grouped. That is a summary table, and "group by" is
 * not a request for one. Cleared here, so a grouped grid is a tree until a
 * column says otherwise - `aggregationFn: "sum"` on the column that wants it.
 */
function withTMDataGridDefaults<TData extends RowData>(
  columns: ReadonlyArray<TMDataGridColumnDef<TData>>,
): Array<TMDataGridColumnDef<TData>> {
  return columns.map((column) => {
    if ("columns" in column && Array.isArray(column.columns)) {
      return {
        ...column,
        columns: withTMDataGridDefaults<TData>(column.columns),
      };
    }
    return {
      filterFn: "tmDataGrid",
      aggregationFn: undefined,
      aggregatedCell: undefined,
      ...column,
    } as TMDataGridColumnDef<TData>;
  });
}

/**
 * Builds a TMDataGrid table plus its chrome store.
 *
 * Every `TableOptions` field passes straight through, so a server-driven grid
 * only needs `manualPagination` / `manualFiltering` / `manualSorting`,
 * `rowCount` and the matching `onXChange` callbacks - the chrome reads
 * `getRowCount()` / `getPageCount()` / `getPaginatedRowModel()`, all of which
 * already respect manual mode. `manualPagination` also switches the pagination
 * flag on, so `<TMDataGrid.Footer />` renders its pager without further
 * options.
 */
export function useTMDataGrid<TData extends RowData>({
  persist,
  // Not TanStack options, so they are kept out of what `useTable` receives.
  labels: labelsOverride,
  enableColumnOrdering,
  enablePagination,
  resetPageOnQueryChange,
  enableRowNumbers,
  selectionMode,
  showSelectedBackground,
  defaultHighlightedRowId,
  onHighlightedRowChange,
  cellSelection,
  onFocusedCellChange,
  filters: filterOptions,
  exportOptions: exportOptionsOverride,
  editing,
  renderDetails,
  renderDetailsEstHeight = DEFAULT_DETAILS_EST_HEIGHT,
  detailsColumnPosition = "left",
  overscan = DEFAULT_OVERSCAN,
  ...options
}: UseTMDataGridOptions<TData>): TMDataGridApi<TData> {
  // The one place `editing` is unpacked - the engine and the flags keep their
  // own vocabulary (`editMode`, `onEditCommit`), so the mapping lives here.
  const editMode = editing?.mode;
  const editDraft = editing?.draft === true;

  // Derived up here, rather than just before the return, because the rest of the
  // hook needs `selectColumn` - one place decides what each mode means.
  //
  // Deliberately not memoized on `table`: the flags must re-derive whenever the
  // caller passes different options, and `table` keeps the same identity when
  // they do. See readFeatureFlags.
  const features = readFeatureFlags({
    ...options,
    enableColumnOrdering,
    enablePagination,
    enableRowNumbers,
    selectionMode,
    showSelectedBackground,
    cellSelection,
    editing,
  });

  // Resolved on the override's identity, so a module-scope dictionary costs one
  // merge for the lifetime of the grid.
  const labels = useMemo(() => mergeLabels(labelsOverride), [labelsOverride]);
  // Field by field for the same reason as `filters` below.
  const {
    format: exportFormat,
    fileName: exportFileName,
    includeHeaders: exportIncludeHeaders,
    columns: exportColumns,
  } = exportOptionsOverride ?? {};
  const exportOptions = useMemo(
    () =>
      resolveExportOptions({
        format: exportFormat,
        fileName: exportFileName,
        includeHeaders: exportIncludeHeaders,
        columns: exportColumns,
      }),
    [exportFormat, exportFileName, exportIncludeHeaders, exportColumns],
  );
  // Unpacked before the memo, so the api is keyed on the five fields rather
  // than on the object's identity - which is what lets `filters` be written as
  // a literal, the way it reads best, without republishing every render.
  const {
    surface: filterSurface,
    sidebarSide: filterSidebarSide,
    sidebarWidth: filterSidebarWidth,
    defaultOpen: filtersDefaultOpen,
    inHeader: filtersInHeader,
  } = filterOptions ?? {};
  const filters = useMemo(
    () =>
      resolveFilterOptions({
        surface: filterSurface,
        sidebarSide: filterSidebarSide,
        sidebarWidth: filterSidebarWidth,
        defaultOpen: filtersDefaultOpen,
        inHeader: filtersInHeader,
      }),
    [
      filterSurface,
      filterSidebarSide,
      filterSidebarWidth,
      filtersDefaultOpen,
      filtersInHeader,
    ],
  );

  const selectColumnEnabled = features.selectColumn;
  const groupColumnEnabled = features.grouping;
  // The lane that opens the panels. Nothing to switch on: a grid with no
  // `renderDetails` has nothing for it to open.
  const detailsColumnEnabled = renderDetails !== undefined;
  // Row mode's Save sits at the end of the row - the lane is its chrome. It
  // also appears wherever the trash can has somewhere to report to, and
  // always under `draft`, where it is the change marker and the per-row
  // revert - with or without `onSaveDrafts`, since the per-row fallback is a
  // first-class configuration.
  const editColumnEnabled =
    editing !== undefined &&
    (editing.mode === "row" || editDraft || editing.onRowDelete !== undefined);

  // The generated lanes bake `meta.label` into their definitions, so the memo
  // depends on the strings rather than on the labels object - a fresh
  // inline `labels` must not rebuild the table's columns.
  const selectColumnLabel = labels.selectColumnLabel;
  const groupColumnLabel = labels.groupColumnLabel;
  const detailsColumnLabel = labels.detailsColumnLabel;
  const editColumnLabel = labels.editColumnLabel;
  const rowNumberColumnLabel = labels.rowNumberColumnLabel;
  const rowNumbersEnabled = features.rowNumbers;
  // A draft lane holds three controls (state icon, undo, trash) where the
  // rest hold two - it gets the wider track.
  const editWideLane = editDraft;

  // The generated lanes are structurally pinned, outermost first on each edge,
  // and re-applied on top of anything restored: a snapshot cannot unpin one,
  // and a snapshot taken before `detailsColumnPosition` changed cannot pin the
  // details lane to the edge it has since left.
  //
  // Not gated on `enableColumnPinning`: that switch takes pinning away from the
  // user, not from the grid's own lanes, which hold the edges either way.
  const structuralPinning = (
    restored: Partial<ColumnPinningState> | undefined,
  ): ColumnPinningState => {
    const own = (ids: string[] | undefined) =>
      (ids ?? []).filter((id) => !isGeneratedColumn(id));
    const lane = (enabled: boolean, id: string) => (enabled ? [id] : []);
    const detailsOn = (edge: "left" | "right") =>
      detailsColumnEnabled && detailsColumnPosition === edge;
    return {
      start: [
        ...lane(rowNumbersEnabled, ROW_NUMBER_COLUMN_ID),
        ...lane(selectColumnEnabled, SELECT_COLUMN_ID),
        ...lane(groupColumnEnabled, GROUP_COLUMN_ID),
        ...lane(detailsOn("left"), DETAILS_COLUMN_ID),
        ...own(restored?.start),
      ],
      end: [
        ...own(restored?.end),
        ...lane(detailsOn("right"), DETAILS_COLUMN_ID),
        ...lane(editColumnEnabled, EDIT_COLUMN_ID),
      ],
    };
  };

  const columns = useMemo(() => {
    const base = withTMDataGridDefaults<TData>(
      options.columns as ReadonlyArray<TMDataGridColumnDef<TData>>,
    );
    // Every generated column is present whenever its feature is on, and the
    // tree column hides itself while nothing is grouped. Adding it to the array
    // only once a column is grouped would make the column list depend on table
    // state, which is the one thing that cannot be a `useMemo` dependency here
    // - the table is built from these columns.
    //
    // The order is the order they are pinned in, and it follows what each one
    // is about: tick a row, find it in the tree the user grouped it into, then
    // open it. The details chevron sits innermost on whichever edge it was
    // given - last of the left lanes, or first of the right ones - because it
    // acts on the record the lanes outside it have narrowed down to.
    const detailsColumn = detailsColumnEnabled
      ? [createDetailsColumn<TData>(detailsColumnLabel)]
      : [];
    return [
      // The gutter sits outside everything, the way a spreadsheet's does.
      ...(rowNumbersEnabled
        ? [createRowNumberColumn<TData>(rowNumberColumnLabel)]
        : []),
      ...(selectColumnEnabled
        ? [createSelectColumn<TData>(selectColumnLabel)]
        : []),
      ...(groupColumnEnabled ? [createGroupColumn<TData>(groupColumnLabel)] : []),
      ...(detailsColumnPosition === "left" ? detailsColumn : []),
      ...base,
      ...(detailsColumnPosition === "right" ? detailsColumn : []),
      // Last and pinned right - the row's Save belongs at the end of the row.
      ...(editColumnEnabled
        ? [createEditColumn<TData>(editColumnLabel, editWideLane)]
        : []),
    ];
  }, [
    options.columns,
    rowNumbersEnabled,
    selectColumnEnabled,
    detailsColumnEnabled,
    detailsColumnPosition,
    groupColumnEnabled,
    editColumnEnabled,
    editWideLane,
    rowNumberColumnLabel,
    selectColumnLabel,
    groupColumnLabel,
    detailsColumnLabel,
    editColumnLabel,
  ]);

  // Leaf columns whose filter stays out of the `urlKey` param. Follows the
  // columns, since the write subscription below outlives a column change.
  const urlExcludedColumnIds = useMemo(
    () => collectUrlExcludedColumnIds(columns),
    [columns],
  );
  // What the table would start with if nothing were restored: TanStack's
  // feature defaults under the consumer's `initialState`, with the grid's own
  // page size. The `urlKey` param carries only the slices that differ from
  // it, and an opted-out column keeps its filter from it on read. Only the
  // data slices are used, so the layout part of the `initialState` recipe
  // below is not repeated here. Read once on mount, like `initialState`.
  const [persistBaseline] = useState(() =>
    getInitialTableState(tmDataGridFeatures, {
      ...options.initialState,
      pagination: startingPagination(options.initialState),
    }),
  );
  // Read once on mount: `initialState` is only consumed on the first render,
  // and re-reading later would fight the user's live edits.
  // Realigned against the ids this render is about to construct - lanes
  // included - so a column removed between deploys does not leave a ghost
  // sort, filter or width behind.
  const [persistedState] = useState(() =>
    readPersistedState(persist, collectLeafColumnIds(columns), {
      baseline: persistBaseline,
      excludedFilterColumnIds: urlExcludedColumnIds,
    }),
  );

  // Restored grouping decides whether the tree column starts out visible, so a
  // reload comes back to the tree the user left rather than to a hidden lane.
  const initialGrouping =
    persistedState.grouping ?? options.initialState?.grouping ?? [];

  // Current grouping state, feeding the tree column's entry in a controlled
  // `columnVisibility` (below). A ref, not state: it is only read while
  // building the options, and the store change that updates it re-renders the
  // hook anyway. A controlled `grouping` takes precedence over the persisted
  // one; grouping held in an external atom is not readable here and is
  // corrected by the effect below with one extra write on mount.
  const groupingActiveRef = useRef(
    (options.state?.grouping ?? initialGrouping).length > 0,
  );

  // Removes keys set to `undefined` before TanStack writes them into the
  // slice atoms; such a key means the slice is not controlled.
  const consumerState = withoutUndefinedSlices(options.state);

  // A controlled `columnVisibility` replaces the whole map on every options
  // sync, including the grid's own entries, so the tree column's entry must be
  // re-applied here. Entries for the control columns are removed, as they are
  // for `initialState`: their visibility follows the feature options, not the
  // visibility map.
  const controlledColumnVisibility = consumerState?.columnVisibility;
  const requestedState =
    consumerState !== undefined && controlledColumnVisibility !== undefined
      ? {
          ...consumerState,
          columnVisibility: {
            ...withoutControlColumnVisibility(controlledColumnVisibility),
            ...(groupColumnEnabled
              ? { [GROUP_COLUMN_ID]: groupingActiveRef.current }
              : {}),
          },
        }
      : consumerState;

  // Controlled state is synced to the table on every render and compared by
  // identity, so a `state` object built in the consumer's render body would
  // cause an infinite render loop. Unchanged slices are forwarded with the
  // previous render's identity instead - see controlledState.ts.
  const controlledStateRef = useRef<Partial<TableState<TMDataGridFeatures>>>(
    undefined,
  );
  // Exception: the grouping workaround below republishes `columnOrder` and
  // `columnVisibility` with unchanged contents and a new identity to repair
  // table-core's missing memo deps - the exact write stabilization cancels.
  // After it runs, one render forwards the controlled state unstabilized so
  // the new identities reach the atoms. A single render cannot loop.
  const republishControlledStateRef = useRef(false);
  const controlledState = republishControlledStateRef.current
    ? requestedState
    : stabilizeControlledState(requestedState, controlledStateRef.current);
  republishControlledStateRef.current = false;
  controlledStateRef.current = controlledState;

  /**
   * What the hook's own subscription watches.
   *
   * `useTable` re-renders whoever called it whenever a state slice changes
   * identity, and `columnResizing` publishes a new delta on every pointer move
   * of a resize drag - so without this the consumer's component, and the whole
   * grid under it, would re-render for each of those moves. The slice is
   * pinned to the identity it had when the drag started: a drag starting and a
   * drag ending still publish, the deltas in between do not.
   *
   * The live deltas stay on `table.store.state`, which is where the grid reads
   * them - see the resize preview in TMDataGridTable.
   */
  const pinnedResizingRef = useRef<
    TableState<TMDataGridFeatures>["columnResizing"] | null
  >(null);
  const selectSettledState = useCallback(
    (state: TableState<TMDataGridFeatures>) => {
      const resizing = state.columnResizing;
      const pinned = pinnedResizingRef.current;
      if (
        pinned === null ||
        pinned.isResizingColumn !== resizing.isResizingColumn
      ) {
        pinnedResizingRef.current = resizing;
        return state;
      }
      return { ...state, columnResizing: pinned };
    },
    [],
  );

  // The edit engine. Built once per mount; everything it needs later - the
  // table, the mode, the consumer's callbacks - is read through a ref updated
  // every render, so forms created at `begin()` always call the latest
  // `onEditCommit` (the onHighlightedRowChangeRef pattern, applied wholesale).
  // Created ahead of the table because the table's `data` reads its store;
  // the ref is filled in once the table exists, and the engine only reads it
  // inside verbs, never while being built.
  const editContextRef = useRef<TMDataGridEditEngineContext>(null as never);
  // The engine is erased; the row type comes back on the way out, which is
  // what makes `edit.addRow(values)` check against `TData`.
  const [engine] = useState(() =>
    createEditEngine(() => editContextRef.current),
  );
  const edit = engine as unknown as TMDataGridEditApi<TData>;

  // The rows as shown. Under `editing.draft` a committed row is a row like any
  // other to the table: its draft replaces the consumer's record and a
  // committed entry row is prepended, so sorting, filtering, grouping and
  // aggregates all read the draft store's values. Rows still being typed
  // into are not here - their values are undecided, and re-sorting under a
  // caret is not something anyone wants. `newRowsSticky` keeps committed
  // entry rows in the entry block, so those stay out too.
  //
  // Everything is keyed on identities the engine keeps stable while nothing
  // is decided, so a keystroke in an open editor never rebuilds the model.
  // `committedValues` rather than `committedRowIds`: the snapshot outlives a
  // reopen, so a parked row being edited again keeps its place until the
  // next commit or a cancel decides otherwise.
  const editCommittedValues = useSelector(
    edit.store,
    (state) => state.committedValues,
  );
  // Subscribed for the re-render alone - the selection predicate below reads
  // the marks live. TanStack 9.2 caches a group row's "all / some selected"
  // on the predicate's identity, and only a render hands it a new one; without
  // this a mark would leave the group's checkbox on its old answer.
  useSelector(edit.store, (state) => state.deletedRowIds);
  const newRowsSticky = features.editNewRowsSticky;
  const editCreatedIds = useSelector(
    edit.store,
    (state) =>
      newRowsSticky
        ? EMPTY_IDS
        : state.newRows
            .filter((newRow) => newRow.committed)
            .map((newRow) => newRow.tempId),
    { compare: shallow },
  );
  // Read through a ref, not listed as a dependency: an inline `getRowId` is
  // a fresh function every render, and the merged array must keep its
  // identity across renders or the table rebuilds its row models on each.
  const consumerGetRowIdRef = useRef(options.getRowId);
  consumerGetRowIdRef.current = options.getRowId;
  const shown = useMemo(() => {
    const consumerGetRowId = consumerGetRowIdRef.current;
    const idOf = new Map<object, string>();
    const created: Array<TData> = [];
    for (const tempId of editCreatedIds) {
      const values = editCommittedValues[tempId];
      if (values === undefined) continue;
      idOf.set(values, tempId);
      created.push(values as TData);
    }
    const snapshots = Object.keys(editCommittedValues).length;
    if (snapshots === 0) return { rows: options.data, idOf };
    // Every snapshot may stand in for a record; only the created ones are
    // known not to. The rest are looked up by the record's own id.
    const rows =
      snapshots === created.length
        ? options.data
        : options.data.map((record, index) => {
            const rowId =
              consumerGetRowId?.(record, index, undefined) ?? String(index);
            const values = editCommittedValues[rowId];
            if (values === undefined) return record;
            idOf.set(values, rowId);
            return values as TData;
          });
    return {
      rows: created.length === 0 ? rows : [...created, ...rows],
      idOf,
    };
  }, [options.data, editCommittedValues, editCreatedIds]);
  const shownIdOfRef = useRef(shown.idOf);
  shownIdOfRef.current = shown.idOf;
  // A stable id resolver over the merged rows. A draft answers the id of the
  // record it stands in for - the consumer's `getRowId` never sees a draft
  // object, so an editable id field cannot rename the row - and a created
  // row answers its temp id. Everything else is the consumer's own, or
  // TanStack's index fallback.
  const shownGetRowId = useCallback(
    (record: TData, index: number, parent?: Row<TMDataGridFeatures, TData>) =>
      shownIdOfRef.current.get(record) ??
      consumerGetRowIdRef.current?.(record, index, parent) ??
      (parent !== undefined ? `${parent.id}.${index}` : String(index)),
    [],
  );

  // Filled immediately after the call below. The query-change wrappers close
  // over it rather than over `table`, since they are built as part of the
  // options the table is constructed from.
  const tableRef = useRef<TMDataGridTable<TData>>(null as never);
  // A narrower query invalidates the page the grid is on - see pageReset.ts.
  // On by default everywhere: TanStack's own `autoResetPageIndex` is switched
  // off below, since it also fires on every draft commit.
  const resetPage = resetPageOnQueryChange ?? true;
  const getQueryTable = useCallback(
    () => tableRef.current as unknown as TMDataGridQueryTable,
    [],
  );
  // The grid's `minSize` floor under the consumer's `defaultColumn`, which
  // still wins per key. Keyed on the consumer's object, because TanStack
  // memoizes the default column def on `options.defaultColumn` identity.
  const consumerDefaultColumn = options.defaultColumn;
  const defaultColumn = useMemo(
    () => ({ minSize: DEFAULT_COLUMN_MIN_SIZE, ...consumerDefaultColumn }),
    [consumerDefaultColumn],
  );

  // The sync of `state` into the table's atoms happens inside this call, in
  // the render body, and publishing from there makes React warn about the
  // consumer's component - see controlledStateSync.ts.
  beginControlledStateSync();
  const table = useTable({
    // The grid paints a running drag itself, one style write per frame - see
    // the resize preview in TMDataGridTable - and takes the width into state
    // once, when the pointer is released. `"onChange"` publishes a width on
    // every pointer move instead, which re-renders the grid for each of them.
    columnResizeMode: "onEnd",
    // TanStack resets both whenever the `data` array's identity changes, and
    // the rows as shown are a new array on every draft commit (see `shown`),
    // so a commit on page 3 would land on page 1 with every details panel
    // closed. Off here; the page reset the grid does want - on a query
    // change - is its own, below. A consumer's explicit option still wins.
    autoResetExpanded: false,
    autoResetPageIndex: false,
    enableSorting: true,
    enableColumnResizing: true,
    // The quick search's matcher. Fuzzy by default (Q4); `"contains"` keeps
    // plain substring matching, and an explicit `globalFilterFn` in the
    // options below overrides both - which also switches the rank ordering
    // off, since it keys off this exact name.
    globalFilterFn:
      options.quickSearchMode === "contains"
        ? "includesString"
        : "tmDataGridFuzzy",
    // Which columns the quick search reads - TanStack's rule, computed once
    // per data change instead of once per call. See columnCanQuickSearch.
    getColumnCanGlobalFilter: columnCanQuickSearch,
    // Grouping by a column takes it out of the grid, the way AG Grid does it:
    // its values have moved into the tree column, so leaving it in place would
    // show every row the same value it was grouped under. Overridable - pass
    // `"reorder"` to keep the column and have it moved to the front instead.
    groupedColumnMode: "remove",
    ...options,
    // The query slices, wrapped so a change also takes the grid back to the
    // first page - see pageReset.ts. Spread conditionally: the keys carry a
    // `makeStateUpdater` default, and an explicit `undefined` would overwrite
    // it and leave the slice unwritable.
    ...(resetPage
      ? {
          onColumnFiltersChange: withPageReset(
            "columnFilters",
            options.onColumnFiltersChange as never,
            getQueryTable,
          ) as TableOptions<
            TMDataGridFeatures,
            TData
          >["onColumnFiltersChange"],
          onGlobalFilterChange: withPageReset(
            "globalFilter",
            options.onGlobalFilterChange as never,
            getQueryTable,
          ) as TableOptions<TMDataGridFeatures, TData>["onGlobalFilterChange"],
          onSortingChange: withPageReset(
            "sorting",
            options.onSortingChange as never,
            getQueryTable,
          ) as TableOptions<TMDataGridFeatures, TData>["onSortingChange"],
          onGroupingChange: withPageReset(
            "grouping",
            options.onGroupingChange as never,
            getQueryTable,
          ) as TableOptions<TMDataGridFeatures, TData>["onGroupingChange"],
        }
      : {}),
    defaultColumn,
    // The rows as shown - see `shown` above. The consumer's own array passes
    // through untouched while nothing is committed.
    data: shown.rows,
    getRowId: shownGetRowId,
    // Row details ride on `expanded`, the same state the tree uses - but a data
    // row answers `getCanExpand()` false, since TanStack's fallback is
    // `subRows.length > 0`, so under `renderDetails` every row can expand.
    // A consumer's own predicate decides the data rows, never a group row:
    // TanStack builds a group row on its first child's record, and since 9.2
    // `toggleExpanded` refuses a row that cannot expand - so a predicate
    // rejecting that record would leave the group's chevron dead.
    ...(renderDetails !== undefined || options.getRowCanExpand !== undefined
      ? {
          getRowCanExpand: (row: Row<TMDataGridFeatures, TData>) =>
            row.getIsGrouped() ||
            (options.getRowCanExpand?.(row) ?? true),
        }
      : {}),
    // Always a predicate, never the passthrough: TanStack defaults the option
    // to `true` once the feature is registered, and the grid's default is off.
    // Group rows never pin - TanStack builds one on its first child's record,
    // so a pinned group would drag an arbitrary data row's identity to the
    // edge. The consumer's own predicate still decides the data rows.
    enableRowPinning: (row: Row<TMDataGridFeatures, TData>) =>
      !row.getIsGrouped() &&
      (typeof options.enableRowPinning === "function"
        ? options.enableRowPinning(row)
        : options.enableRowPinning === true),
    // A deletion-marked row is not selectable: it is on its way out, and a
    // bulk action over the selection must not see it. TanStack reads the
    // predicate on every call, so the mark is checked live against the
    // engine. Only under `editing.draft`, the one place marks exist; the
    // consumer's own option keeps the final say, predicate form included.
    ...(editDraft
      ? {
          enableRowSelection: (row: Row<TMDataGridFeatures, TData>) =>
            !engine.isRowDeleted(row.id) &&
            (typeof options.enableRowSelection === "function"
              ? options.enableRowSelection(row)
              : options.enableRowSelection !== false),
        }
      : {}),
    features: tmDataGridFeatures,
    columns: columns as TableOptions<TMDataGridFeatures, TData>["columns"],
    // The stabilized controlled state; `undefined` when nothing is controlled.
    state: controlledState,
    initialState: {
      ...options.initialState,
      ...persistedState,
      columnVisibility: {
        ...withoutControlColumnVisibility({
          ...options.initialState?.columnVisibility,
          ...persistedState.columnVisibility,
        }),
        // Last word, because the tree column's visibility is not a user setting
        // - it tracks the grouping state. See the effect below.
        ...(groupColumnEnabled
          ? { [GROUP_COLUMN_ID]: initialGrouping.length > 0 }
          : {}),
      },
      columnPinning: structuralPinning({
        start:
          persistedState.columnPinning?.start ??
          options.initialState?.columnPinning?.start,
        end:
          persistedState.columnPinning?.end ??
          options.initialState?.columnPinning?.end,
      }),
      pagination: {
        ...startingPagination(options.initialState),
        ...persistedState.pagination,
      },
    },
  }, selectSettledState);
  endControlledStateSync();
  tableRef.current = table as unknown as TMDataGridTable<TData>;
  deferControlledStateSyncPublishes(table.store);

  // The engine's view of this render - see the engine's creation above.
  editContextRef.current = {
    table: table as unknown as TMDataGridTable<TMDataGridRowData>,
    editMode: editMode ?? "cell",
    draft: editDraft,
    rowValidators: editing?.rowValidators,
    tableValidators: editing?.tableValidators as
      TMDataGridEditEngineContext["tableValidators"],
    editableColumnIds: editing?.columns,
    isRowEditable:
      editing?.isRowEditable as TMDataGridEditEngineContext["isRowEditable"],
    onEditCommit:
      editing?.onCommit as TMDataGridEditEngineContext["onEditCommit"],
    onSaveDrafts:
      editing?.onSaveDrafts as TMDataGridEditEngineContext["onSaveDrafts"],
    newRowDefaults:
      editing?.newRowDefaults as TMDataGridEditEngineContext["newRowDefaults"],
    onRowAdd: editing?.onRowAdd as TMDataGridEditEngineContext["onRowAdd"],
    onRowDelete:
      editing?.onRowDelete as TMDataGridEditEngineContext["onRowDelete"],
  };

  // Switching either axis mid-flight drops every draft: the policies disagree
  // about what an open form means, and carrying one across is how a row
  // parked for `saveDrafts` silently commits to the consumer instead.
  const previousEditPolicyRef = useRef({ editMode, editDraft });
  useEffect(() => {
    const previous = previousEditPolicyRef.current;
    if (previous.editMode === editMode && previous.editDraft === editDraft) {
      return;
    }
    previousEditPolicyRef.current = { editMode, editDraft };
    edit.cancelAll();
  }, [editMode, editDraft, edit]);

  // A refetch that drops a record takes the engine's state for it along -
  // see forgetMissingRows. Not where the grid does not own the result set:
  // there a row missing from `data` is on another page or filtered away
  // server-side, not gone, and its draft has to wait for Save. Keyed on the
  // rows as shown, which is what the core row model is built from.
  // Through the ref, not `table`: `useTable` hands out a fresh copy of the
  // table every render, and listing it would run this on every one.
  const editingOn = editing !== undefined;
  const serverSideRows =
    options.manualPagination === true || options.manualFiltering === true;
  useEffect(() => {
    if (!editingOn || serverSideRows) return;
    engine.forgetMissingRows(tableRef.current.getCoreRowModel().rowsById);
  }, [shown.rows, editingOn, serverSideRows, engine]);

  // Readers that hold the table and nothing else - `exportGrid` - still
  // leave a deletion-marked row out. Keyed on
  // the store, which every copy of the table shares, so once is enough.
  useEffect(
    () => registerDeletedRows(tableRef.current, engine.isRowDeleted),
    [engine],
  );

  // Editing without stable ids points every draft at whatever record slides
  // into that index after a sort. Loud, once, in development.
  useEffect(() => {
    if (editing !== undefined && options.getRowId === undefined) {
      console.error(
        "TMDataGrid: editing requires getRowId - drafts are keyed by row id, and the index fallback names a different record after any sort or filter.",
      );
    }
    // The check is a mount-time contract, not something to re-run per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A controlled slice without its `onXChange` cannot change: TanStack routes
  // every write through the callback, and the next options sync restores the
  // consumer's value. Warned once in development; `initialState` is the option
  // for a starting value.
  useEffect(() => {
    for (const { slice, handler } of findFrozenStateSlices(options)) {
      console.warn(
        `TMDataGrid: state.${slice} is controlled but no ${handler} was passed - the slice cannot change. Add ${handler}, or use initialState.${slice} for a starting value.`,
      );
    }
    // A mount-time contract, like the check above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A slice listed under both `dataKey` and `urlKey` is handled by `urlKey`
  // alone - see resolveKeys in persistence.ts. Reported once, because the
  // consumer most likely expects the stored copy to still apply.
  useEffect(() => {
    for (const slice of findOverlappingSlices(persist)) {
      console.error(
        `TMDataGrid: persist.dataKey and persist.urlKey both list ${slice} - a slice lives in one group; urlKey takes it.`,
      );
    }
    // A mount-time contract, like the checks above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The tree column appears with the first grouped column and goes away with
  // the last, so an ungrouped grid looks exactly as it did before grouping
  // existed. Driven from a subscription rather than by rebuilding the column
  // array, because the array is what the table is built from - deriving it from
  // table state would close the loop. Visibility is the one column property
  // that can be changed after the fact without touching the definitions.
  //
  // Writing back into the store from its own subscriber is safe: the guard is
  // on `grouping`'s identity, and the write does not touch it, so the callback
  // it triggers short-circuits.
  useEffect(() => {
    if (!groupColumnEnabled) return;
    let previousGrouping = table.store.state.grouping;
    // Update the ref before any write: it feeds the visibility injection
    // above, and a write below re-renders the hook. With a stale ref the
    // injection would restore the old value on every render. This also
    // corrects the mount value when an external atom owns `grouping`, which
    // the ref's initializer cannot read.
    groupingActiveRef.current = previousGrouping.length > 0;

    // The tree column's entry in `initialState` only reaches a slice the
    // table owns. With `columnVisibility` in an external atom the entry is
    // missing, and a missing entry means visible: the tree column would
    // render in an ungrouped grid. The entry is seeded here through the table
    // API instead, so the write reaches whichever store owns the slice. No-op
    // when the entry is already correct. `?.`: an external atom can hold
    // `undefined`.
    if (
      table.store.state.columnVisibility?.[GROUP_COLUMN_ID] !==
      (previousGrouping.length > 0)
    ) {
      table.setColumnVisibility((old) => ({
        ...old,
        [GROUP_COLUMN_ID]: previousGrouping.length > 0,
      }));
    }

    const subscription = table.store.subscribe((state) => {
      if (state.grouping === previousGrouping) return;
      previousGrouping = state.grouping;
      // Keeps the entry injected into a controlled `columnVisibility` (see
      // requestedState) in sync with grouping.
      groupingActiveRef.current = state.grouping.length > 0;
      // On a controlled slice the write below round-trips through the
      // consumer's handler; the next render must forward it unstabilized.
      // See republishControlledStateRef.
      republishControlledStateRef.current = true;

      table.setColumnVisibility((old) => ({
        ...old,
        [GROUP_COLUMN_ID]: state.grouping.length > 0,
      }));
    });

    return () => subscription.unsubscribe();
  }, [groupColumnEnabled, table]);

  // Mirror every state change back to storage. Subscribing (rather than writing
  // from an effect on a state snapshot) means nothing is missed, including
  // changes made straight through the table API by the consumer.
  //
  // Writes are debounced because a state change can arrive on every pointer
  // move - a resize drag under `columnResizeMode: "onChange"`, a range
  // selection - and `setItem` serialises synchronously on the main thread. The
  // trailing edge is enough: storage only has to agree with the table once the
  // user stops.
  //
  // The `urlKey` inputs are read through a ref: the excluded columns follow
  // the column defs, and re-subscribing on a column change would write once
  // more for nothing.
  const urlPersistInputsRef = useRef({
    baseline: persistBaseline,
    excludedFilterColumnIds: urlExcludedColumnIds,
  });
  urlPersistInputsRef.current = {
    baseline: persistBaseline,
    excludedFilterColumnIds: urlExcludedColumnIds,
  };
  // Keyed on the store, not the table: `useTable` returns a new copy of the
  // table on every render (it memoizes on the options object, built inline
  // above), while every copy shares the one store. Keyed on the table, each
  // render re-ran this effect, whose cleanup flushed and whose setup wrote
  // again at once - no debounce at all.
  const tableStore = table.store;
  useEffect(() => {
    if (!hasPersistenceKeys(persist)) return;
    writePersistedState(tableStore.state, persist, urlPersistInputsRef.current);

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let pending: TableState<TMDataGridFeatures> | null = null;

    const flush = ({ writeUrl }: { writeUrl: boolean }) => {
      timeout = undefined;
      if (pending === null) return;
      writePersistedState(pending, persist, {
        ...urlPersistInputsRef.current,
        writeUrl,
      });
      pending = null;
    };

    const subscription = tableStore.subscribe((state) => {
      pending = state;
      if (timeout !== undefined) clearTimeout(timeout);
      timeout = setTimeout(() => flush({ writeUrl: true }), PERSIST_DEBOUNCE_MS);
    });

    return () => {
      subscription.unsubscribe();
      if (timeout !== undefined) clearTimeout(timeout);
      // An unmount mid-debounce would otherwise drop the last change. Storage
      // only: an unmount inside the debounce window is typically an SPA
      // navigation, and by now the router has already moved to the next page -
      // the param would land on that page's URL.
      flush({ writeUrl: false });
    };
  }, [persist, tableStore]);

  const ui = useCreateStore<TMDataGridUiState, TMDataGridUiActions>(
    {
      // `useCreateStore` builds the store once per mount, so `defaultOpen` is
      // read the way `initialState` is - a starting point, not a controller.
      filterPanelOpen: filters.defaultOpen,
      filterPanelColumnId: null,
      headerFilterColumnId: null,
      draggedColumnId: null,
      // `useCreateStore` builds the store once per mount, so this is a genuine
      // default rather than a value that would fight later clicks.
      highlightedRowId: defaultHighlightedRowId ?? null,
      selectionAnchorRowId: null,
      focusedCell: null,
      cellRange: null,
      exportPicker: null,
    },
    ({ setState }) => ({
      openFilterPanel: (columnId = null) =>
        setState((prev) => ({
          ...prev,
          filterPanelOpen: true,
          filterPanelColumnId: columnId,
        })),
      closeFilterPanel: () =>
        setState((prev) => ({
          ...prev,
          filterPanelOpen: false,
          filterPanelColumnId: null,
        })),
      openExportPicker: (request) =>
        setState((prev) => ({ ...prev, exportPicker: request })),
      closeExportPicker: () =>
        setState((prev) => ({ ...prev, exportPicker: null })),
      focusPanelFilter: (columnId) =>
        setState((prev) => ({ ...prev, filterPanelColumnId: columnId })),
      focusHeaderFilter: (columnId) =>
        setState((prev) => ({ ...prev, headerFilterColumnId: columnId })),
      startColumnDrag: (columnId) =>
        setState((prev) => ({ ...prev, draggedColumnId: columnId })),
      endColumnDrag: () =>
        setState((prev) => ({ ...prev, draggedColumnId: null })),
      setHighlightedRow: (rowId) =>
        setState((prev) => ({ ...prev, highlightedRowId: rowId })),
      setSelectionAnchor: (rowId) =>
        setState((prev) => ({ ...prev, selectionAnchorRowId: rowId })),
      setFocusedCell: (cell) =>
        setState((prev) =>
          // Same cell, same object: the body re-renders on every scroll frame
          // and mouse events land on the cell that already has the focus, so a
          // fresh identity here would republish the store for nothing.
          isSameCell(prev.focusedCell, cell)
            ? prev
            : { ...prev, focusedCell: cell },
        ),
      setCellRange: (range) =>
        setState((prev) =>
          // Same guard as above, and it matters more here: a drag publishes a
          // new corner on every mouse move, and most of those land on the cell
          // the range already ends at.
          isSameCell(prev.cellRange?.anchor ?? null, range?.anchor ?? null) &&
          isSameCell(prev.cellRange?.focus ?? null, range?.focus ?? null)
            ? prev
            : { ...prev, cellRange: range },
        ),
    }),
  );

  // `onHighlightedRowChange` is fired from a subscription rather than from the store
  // action, so it covers every route to a new active row - a row click, and a
  // consumer calling `setHighlightedRow` itself. Held in a ref because the store is
  // built once and its actions would otherwise close over the first render's
  // callback.
  const onHighlightedRowChangeRef = useRef(onHighlightedRowChange);
  useEffect(() => {
    onHighlightedRowChangeRef.current = onHighlightedRowChange;
  }, [onHighlightedRowChange]);

  useEffect(() => {
    // Seeded from the current value so mounting with a `defaultHighlightedRowId`
    // does not report a change that nothing made.
    let previous = ui.state.highlightedRowId;
    const subscription = ui.subscribe((state) => {
      if (state.highlightedRowId === previous) return;
      previous = state.highlightedRowId;
      onHighlightedRowChangeRef.current?.(state.highlightedRowId);
    });
    return () => subscription.unsubscribe();
  }, [ui]);

  // Same shape for the focused cell, and for the same reason: arrow keys, a
  // click and `setFocusedCell` all have to report through one place.
  const onFocusedCellChangeRef = useRef(onFocusedCellChange);
  useEffect(() => {
    onFocusedCellChangeRef.current = onFocusedCellChange;
  }, [onFocusedCellChange]);

  useEffect(() => {
    let previous = ui.state.focusedCell;
    const subscription = ui.subscribe((state) => {
      // Identity is enough: `setFocusedCell` keeps the previous object when the
      // cell has not changed, so a new one always means a new cell.
      if (state.focusedCell === previous) return;
      previous = state.focusedCell;
      onFocusedCellChangeRef.current?.(state.focusedCell);
    });
    return () => subscription.unsubscribe();
  }, [ui]);

  // The same recipe the mount uses for `initialState`, minus the persisted
  // layer - see the api's JSDoc for why TanStack's own resets cannot do this.
  // Ref-and-stable-wrapper, like the edit engine's context: the recipe reads
  // this render's flags, the callback identity never changes.
  const resetSettingsRef = useRef<() => void>(() => {});
  resetSettingsRef.current = () => {
    const initial = options.initialState;
    const grouping = [...(initial?.grouping ?? [])];
    table.setGrouping(grouping);
    table.setColumnVisibility({
      ...withoutControlColumnVisibility({ ...initial?.columnVisibility }),
      // The tree lane's visibility tracks the grouping, never the user.
      ...(groupColumnEnabled ? { [GROUP_COLUMN_ID]: grouping.length > 0 } : {}),
    });
    table.setColumnSizing({ ...initial?.columnSizing });
    table.setColumnOrder([...(initial?.columnOrder ?? [])]);
    table.setColumnPinning(structuralPinning(initial?.columnPinning));
  };
  const resetSettings = useCallback(() => resetSettingsRef.current(), []);

  // Filled in by `TMDataGrid.Table` on every render, because only the body
  // holds the virtualizer and the current view. Returns `false` until one is
  // mounted, since there is nothing to scroll before then.
  const scrollerRef = useRef<TMDataGridScroller>(() => false);
  const scrollToRow = useCallback(
    (args: TMDataGridScrollToRowArgs) => scrollerRef.current(args),
    [],
  );

  return {
    table,
    ui,
    edit,
    features,
    filters,
    exportOptions,
    labels,
    renderDetails,
    renderDetailsEstHeight,
    overscan,
    resetSettings,
    scrollToRow,
    scrollerRef,
  };
}

/**
 * Gives a column an empty filter of its default operator, unless it already
 * has one - which is what makes a surface open on a row rather than on
 * nothing.
 *
 * @internal Shared by `openColumnFilter` and the toolbar's filter button.
 */
export function seedColumnFilter<TData extends RowData>(
  api: TMDataGridApi<TData>,
  columnId: string,
): void {
  const column = api.table.getColumn(columnId);
  if (column === undefined || column.getFilterValue() !== undefined) return;
  const operator = getColumnDefaultOperator(column);
  column.setFilterValue({ operator, value: emptyValueForOperator(operator) });
}

/**
 * Sends the user to a column's filter control, seeding an empty filter when
 * the column has none yet - what "Filter" in the column menu and a click on a
 * filter pill both do.
 *
 * Which control that is follows the grid's `filters` option. Under
 * `inHeader` it is the column's header control, which is already on screen, so
 * the call focuses it and leaves the popup or sidebar closed. Otherwise it is
 * the panel's row for that column, and the call opens the surface on it.
 */
export function openColumnFilter<TData extends RowData>(
  api: TMDataGridApi<TData>,
  columnId: string,
): void {
  seedColumnFilter(api, columnId);
  if (api.filters.inHeader) {
    // The header control is always visible, so there is nothing to open -
    // only a column to point at. The header row watching this focuses it and
    // scrolls it into view. The panel, if one is also showing, is left alone:
    // it reads the other slot.
    api.ui.actions.focusHeaderFilter(columnId);
    return;
  }
  api.ui.actions.openFilterPanel(columnId);
}
