import {
  FILTER_OPERATOR_LABELS,
  type TMDataGridFilterOperator,
} from "./filterOperators";
import { BOOLEAN_LABELS_EN } from "./valueText";

/**
 * Every user-facing string in the grid - menu items, panels, tooltips, the
 * pager, and the `aria-label`s a screen reader speaks. One flat object, so an
 * override is a spread rather than a deep merge; `operators` is the single
 * nested record and {@link mergeLabels} folds it separately.
 *
 * Labels that carry a value are functions rather than template strings, so a
 * language is free to put the value wherever its grammar wants it.
 */
export type TMDataGridLabels = {
  /** Filter operator names, as shown in the operator dropdown and on pills. */
  operators: Record<TMDataGridFilterOperator, string>;

  // Toolbar
  /** "Filters" - the funnel button and the filter panel's title. */
  filters: string;
  searchPlaceholder: string;
  searchLabel: string;
  clearSearch: string;

  // Grid menu
  /** Tooltip and `aria-label` of `TMDataGrid.Menu`'s burger trigger. */
  menuButton: string;
  /** "Manage columns" - the header menu's submenu. */
  manageColumns: string;

  // Columns panel
  columnsSearchPlaceholder: string;
  columnsNoMatch: (search: string) => string;
  columnsShowHideAll: string;
  columnsReset: string;
  /** Tooltip on the reset button, stating everything the reset covers. */
  columnsResetHint: string;
  /** Menu/panel name of the generated row-number gutter. */
  rowNumberColumnLabel: string;
  /**
   * The truly-empty message - no data and no filters. Filtered-empty says
   * {@link noResults} instead; only one of the two is the user's own doing.
   */
  noRows: string;

  // Filter panel
  filterColumn: string;
  filterOperator: string;
  filterValue: string;
  filterValuePlaceholder: string;
  /** The lower bound of a `between` filter. */
  filterFrom: string;
  /** The upper bound of a `between` filter. */
  filterTo: string;
  /** `DgTriStateFilter`'s no-filter segment. */
  filterAll: string;
  /** What a boolean `true` reads as - its filter choice, filter pill and group row. */
  booleanTrue: string;
  booleanFalse: string;
  addFilter: string;
  clearAllFilters: string;
  closeFilters: string;
  removeFilter: string;
  /** Names the operator button in a column's header filter control. */
  filterOperatorFor: (column: string) => string;

  // Filter pills
  activeFilters: string;
  clearFilter: (column: string) => string;

  // Header menu
  sortAsc: string;
  sortDesc: string;
  filterMenuItem: string;
  groupBy: (column: string) => string;
  ungroup: (column: string) => string;
  expandAllGroups: string;
  collapseAllGroups: string;
  pinLeft: string;
  pinRight: string;
  unpin: string;
  moveLeft: string;
  moveRight: string;
  autosizeColumn: string;
  hideColumn: string;
  filterOn: (column: string) => string;
  sortColumn: (column: string) => string;
  columnMenu: (column: string) => string;

  // Footer / pager
  rowsPerPage: string;
  pageRange: (args: { from: number; to: number; total: number }) => string;
  /** `pageCount` is `-1` when a manual grid declares an unknown total. */
  pageNumber: (args: { page: number; pageCount: number }) => string;
  groupedAllRows: (total: number) => string;
  pagingSuspendedHint: string;
  previousPage: string;
  nextPage: string;

  // Body
  noResults: string;
  loading: string;

  // Cell editing
  /** `aria-label` of an open cell editor's input. */
  editCell: (column: string) => string;
  /** cellConfirm's ✓ beside the input. */
  confirmEdit: string;
  /** cellConfirm's ✕ beside the input. */
  cancelEdit: string;
  /** The generated edit lane's name in the column manager. */
  editColumnLabel: string;
  /** The lane's pencil. */
  editRow: string;
  /** The lane's ✓ while a row edit is open. */
  saveRow: string;
  /** The lane's ✕ while a row edit is open. */
  cancelRowEdit: string;
  /** Save tooltip when field errors block the row, with no row message. */
  editRowErrors: string;
  /** `DraftActions`' Save, with the count of rows in the draft store. */
  saveAllEdits: (rows: number) => string;
  /** `DraftActions`' Discard. */
  discardAllEdits: string;
  /**
   * `DraftActions`' note about rows still open - edited but not committed, so
   * not part of the save. Shown only while there are any.
   */
  editRowsStillOpen: (rows: number) => string;
  /** The entry row's ✓ - commit the add. */
  confirmNewRow: string;
  /** The entry row's ✕ - drop the entry. */
  discardNewRow: string;
  /** The lane's trash can. */
  deleteRow: string;
  /** The lane's undo on a row marked deleted (draft). */
  restoreRow: string;
  /** The lane's undo on a row with a dirty draft (draft) - drops it. */
  revertRow: string;
  /** The lane's state icon on a confirmed entry row (draft). */
  rowStateNew: string;
  /** The lane's state icon on a row with a dirty draft (draft). */
  rowStateEdited: string;
  /** The lane's state icon on a row marked deleted (draft). */
  rowStateDeleted: string;

  // Cell selection menu
  cellCount: (count: number) => string;
  copy: string;
  exportCells: string;
  includeHeaders: string;

  // Export
  exportAll: string;
  exportSelected: (count: number) => string;
  /** Title of the column picker `columns="custom"` opens; `format` is the file extension in upper case, "CSV". */
  exportPickerTitle: (format: string) => string;
  /** The line under the title; `selected` is the selected row count, or `null` for an export of all rows. */
  exportPickerHint: (selected: number | null) => string;
  exportPickerConfirm: string;
  exportPickerCancel: string;
  /** The select-all row over the picker's list. */
  exportPickerSelectAll: string;
  /** The "3 of 12" count beside it. */
  exportPickerCount: (checked: number, total: number) => string;
  /** Marks a column the grid hides at the moment. */
  exportPickerHidden: string;

  // Generated checkbox lane
  selectColumnLabel: string;
  selectAllRows: string;
  selectRow: string;
  selectGroup: string;

  // Generated details lane
  detailsColumnLabel: string;
  showDetails: string;
  hideDetails: string;
  expandAllDetails: string;
  collapseAllDetails: string;

  // Generated tree lane
  groupColumnLabel: string;
  blankGroupValue: string;
  expandGroup: (label: string) => string;
  collapseGroup: (label: string) => string;
};

/**
 * What the `labels` option accepts: any subset, merged over the English
 * defaults - so `{ noResults: "Inga rader" }` is a complete configuration.
 */
export type TMDataGridLabelsOverride = Partial<
  Omit<TMDataGridLabels, "operators">
> & {
  operators?: Partial<Record<TMDataGridFilterOperator, string>>;
};

/** The built-in defaults. Also the reference for what a preset must cover. */
export const TMDATAGRID_LABELS_EN: TMDataGridLabels = {
  operators: FILTER_OPERATOR_LABELS,

  filters: "Filters",
  searchPlaceholder: "Search",
  searchLabel: "Search rows",
  clearSearch: "Clear search",

  menuButton: "Menu",
  manageColumns: "Manage columns",

  columnsSearchPlaceholder: "Search",
  columnsNoMatch: (search) => `No columns match “${search}”`,
  columnsShowHideAll: "Show/Hide All",
  columnsReset: "Reset layout",
  columnsResetHint:
    "Resets column visibility, order, widths, pinning and grouping",
  rowNumberColumnLabel: "Row number",
  noRows: "No rows to show",

  filterColumn: "Column",
  filterOperator: "Operator",
  filterValue: "Value",
  filterValuePlaceholder: "Filter value",
  filterFrom: "From",
  filterTo: "To",
  filterAll: "All",
  booleanTrue: BOOLEAN_LABELS_EN.booleanTrue,
  booleanFalse: BOOLEAN_LABELS_EN.booleanFalse,
  addFilter: "Add filter",
  clearAllFilters: "Clear all",
  closeFilters: "Close filters",
  removeFilter: "Remove filter",
  filterOperatorFor: (column) => `${column} filter operator`,

  activeFilters: "Active filters",
  clearFilter: (column) => `Clear ${column} filter`,

  sortAsc: "Sort ascending",
  sortDesc: "Sort descending",
  filterMenuItem: "Filter",
  groupBy: (column) => `Group by ${column}`,
  ungroup: (column) => `Ungroup ${column}`,
  expandAllGroups: "Expand all groups",
  collapseAllGroups: "Collapse all groups",
  pinLeft: "Pin to left",
  pinRight: "Pin to right",
  unpin: "Unpin",
  moveLeft: "Move left",
  moveRight: "Move right",
  autosizeColumn: "Autosize column",
  hideColumn: "Hide column",
  filterOn: (column) => `Filter on ${column}`,
  sortColumn: (column) => `Sort ${column}`,
  columnMenu: (column) => `${column} column menu`,

  rowsPerPage: "Rows per page:",
  pageRange: ({ from, to, total }) => `${from}–${to} of ${total}`,
  pageNumber: ({ page, pageCount }) =>
    pageCount < 0 ? `Page ${page}` : `Page ${page} of ${pageCount}`,
  groupedAllRows: (total) => `Grouped · all ${total} rows`,
  pagingSuspendedHint:
    "Paging is off while the rows are grouped, and every row is shown. Ungroup to page again.",
  previousPage: "Previous page",
  nextPage: "Next page",

  noResults: "No rows match your filters",
  loading: "Loading",

  editCell: (column) => `Edit ${column}`,
  confirmEdit: "Save",
  cancelEdit: "Cancel",
  editColumnLabel: "Edit",
  editRow: "Edit row",
  saveRow: "Save row",
  cancelRowEdit: "Cancel edit",
  editRowErrors: "Fix the marked cells",
  saveAllEdits: (rows) => (rows === 1 ? "Save 1 row" : `Save ${rows} rows`),
  discardAllEdits: "Discard",
  editRowsStillOpen: (rows) =>
    rows === 1 ? "1 row still being edited" : `${rows} rows still being edited`,
  confirmNewRow: "Add row",
  discardNewRow: "Discard new row",
  deleteRow: "Delete row",
  restoreRow: "Restore row",
  revertRow: "Revert changes",
  rowStateNew: "New row",
  rowStateEdited: "Edited row",
  rowStateDeleted: "Marked for deletion",

  cellCount: (count) => (count === 1 ? "1 cell" : `${count} cells`),
  copy: "Copy",
  exportCells: "Export cells",
  includeHeaders: "Include headers",

  exportAll: "Export all rows",
  exportSelected: (count) =>
    count === 1 ? "Export 1 selected row" : `Export ${count} selected rows`,
  exportPickerTitle: (format) => `Export as ${format}`,
  exportPickerHint: (selected) =>
    selected === null
      ? "Select the columns to export"
      : selected === 1
        ? "Select the columns to export for the selected row"
        : `Select the columns to export for the ${selected} selected rows`,
  exportPickerConfirm: "Export",
  exportPickerCancel: "Cancel",
  exportPickerSelectAll: "Select all",
  exportPickerCount: (checked, total) => `${checked} of ${total}`,
  exportPickerHidden: "Hidden",

  selectColumnLabel: "Checkbox selection",
  selectAllRows: "Select all rows",
  selectRow: "Select row",
  selectGroup: "Select group",

  detailsColumnLabel: "Details",
  showDetails: "Show details",
  hideDetails: "Hide details",
  expandAllDetails: "Expand all details",
  collapseAllDetails: "Collapse all details",

  groupColumnLabel: "Group",
  blankGroupValue: "(Blank)",
  expandGroup: (label) => `Expand ${label}`,
  collapseGroup: (label) => `Collapse ${label}`,
};

/** A partial override folded over the English defaults. */
export function mergeLabels(
  override?: TMDataGridLabelsOverride,
): TMDataGridLabels {
  if (!override) return TMDATAGRID_LABELS_EN;
  return {
    ...TMDATAGRID_LABELS_EN,
    ...override,
    operators: {
      ...TMDATAGRID_LABELS_EN.operators,
      ...override.operators,
    },
  };
}
