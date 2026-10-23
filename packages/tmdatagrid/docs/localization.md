# Localization

Every string the grid renders - menu items, panels, tooltips, the pager and
every `aria-label` - comes from one labels object. English by default.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  labels: { noResults: "Inga rader matchar dina filter" },
});
```

`labels` takes **any subset** and merges it over the defaults.

```demo
file: customization/Localization.tsx
extraSources: data/employeeColumns.tsx
```

## A complete translation

A full Swedish dictionary ships as `TMDATAGRID_LABELS_SV`:

```tsx
import { TMDATAGRID_LABELS_SV } from "@jielga/tmdatagrid";

const grid = useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
```

`TMDATAGRID_LABELS_EN` is the English base, and `TMDataGridLabels` is the full
dictionary type, so a missing key in a new translation is a compile error.

## Labels that carry a value

These labels are functions, so each language can place the value where its
grammar requires:

```tsx
labels: {
  groupBy: (column) => `Gruppera efter ${column}`,
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
}
```

## Keep the object stable

Define it at module scope, or memoize it. The grid re-renders when the labels
object changes identity.

```tsx
const labels = { noResults: "Inga träffar" } satisfies TMDataGridLabelsOverride;
```

## Reading them yourself

The resolved dictionary comes back from the hook as `grid.labels`, and from
context as `useTMDataGridContext().labels`, so a
[toolbar component of your own](/docs/toolbar) uses the same strings as the
built-in parts, in whatever language is configured.

`mergeLabels(override)` is the merge itself: it folds a partial override over
the English defaults, `operators` included, and returns the full dictionary.
Called without an argument, it returns `TMDATAGRID_LABELS_EN` itself.

`meta.noResultsLabel` remains as a per-instance override of
`labels.noResults`.

## Label keys

Every key of `TMDataGridLabels`, with its English default and where the grid
shows it; a function label shows its template:

| Key | Default | Where it shows |
| --- | --- | --- |
| `operators.contains` | `contains` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.equals` | `equals` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.notEquals` | `does not equal` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.startsWith` | `starts with` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.endsWith` | `ends with` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.greaterThan` | `is greater than` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.greaterThanOrEqual` | `is greater than or equal to` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.lessThan` | `is less than` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.lessThanOrEqual` | `is less than or equal to` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.between` | `is between` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.before` | `is before` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.after` | `is after` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.onOrBefore` | `is on or before` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.onOrAfter` | `is on or after` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.isAnyOf` | `is any of` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.isNoneOf` | `is none of` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.isEmpty` | `is empty` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `operators.isNotEmpty` | `is not empty` | The operator select of `TMDataGrid.FilterPanel`, the text of a filter pill, and the operator button of a header filter. |
| `filters` | `Filters` | Tooltip and `aria-label` of `TMDataGrid.FilterButton`, the title and `aria-label` of the filter popup and sidebar, and the `aria-label` of `TMDataGrid.FilterPanel`. |
| `searchPlaceholder` | `Search` | Placeholder of `TMDataGrid.Search`. Its `placeholder` prop wins. |
| `searchLabel` | `Search rows` | `aria-label` of the `TMDataGrid.Search` input. |
| `clearSearch` | `Clear search` | `aria-label` of the clear button in `TMDataGrid.Search`. |
| `menuButton` | `Menu` | Tooltip and `aria-label` of the `TMDataGrid.Menu` trigger. Its `label` prop wins. |
| `manageColumns` | `Manage columns` | Column menu: the submenu that lists the columns. |
| `columnsSearchPlaceholder` | `Search` | Search box of `TMDataGrid.ColumnsPanel`, `TMDataGrid.Menu.Columns` and the export column picker. |
| `columnsNoMatch` | `` `No columns match “${search}”` `` | The same three lists, when the search matches no column. |
| `columnsShowHideAll` | `Show/Hide All` | `TMDataGrid.ColumnsPanel` and `TMDataGrid.Menu.ShowHideAll`. |
| `columnsReset` | `Reset layout` | `TMDataGrid.ColumnsPanel` and `TMDataGrid.Menu.ResetLayout`. |
| `columnsResetHint` | `Resets column visibility, order, widths, pinning and grouping` | Tooltip of the reset button in `TMDataGrid.ColumnsPanel`. |
| `rowNumberColumnLabel` | `Row number` | `meta.label` of the generated row-number lane. |
| `noRows` | `No rows to show` | Body, when the view is empty, no column filter is active (`isFilterActive`) and the quick search is blank. |
| `filterColumn` | `Column` | Label of the column field in `TMDataGrid.FilterPanel`. |
| `filterOperator` | `Operator` | Label of the operator field in `TMDataGrid.FilterPanel`. |
| `filterValue` | `Value` | Label of the value field in `TMDataGrid.FilterPanel`. |
| `filterValuePlaceholder` | `Filter value` | Placeholder of the filter value input. |
| `filterFrom` | `From` | The lower bound of a `between` filter: its input, or its slider thumb. |
| `filterTo` | `To` | The upper bound of a `between` filter: its input, or its slider thumb. |
| `filterAll` | `All` | The no-filter segment of the tri-state filter. |
| `booleanTrue` | `Yes` | The `true` choice of a boolean filter value control and of the tri-state filter, and a `true` value on a filter pill and in a group row. |
| `booleanFalse` | `No` | The `false` choice of a boolean filter value control and of the tri-state filter, and a `false` value on a filter pill and in a group row. |
| `addFilter` | `Add filter` | Button in `TMDataGrid.FilterPanel`. |
| `clearAllFilters` | `Clear all` | Button in `TMDataGrid.FilterPanel` and in `TMDataGrid.FilterPills`. |
| `closeFilters` | `Close filters` | `aria-label` of the close button of the filter popup and sidebar. |
| `removeFilter` | `Remove filter` | `aria-label` of the remove button on a filter row in `TMDataGrid.FilterPanel`. |
| `filterOperatorFor` | `` `${column} filter operator` `` | `aria-label` of the operator button of a header filter. |
| `activeFilters` | `Active filters` | `aria-label` of the `TMDataGrid.FilterPills` group. |
| `clearFilter` | `` `Clear ${column} filter` `` | `aria-label` of the remove button on a filter pill. |
| `sortAsc` | `Sort ascending` | Column menu item. |
| `sortDesc` | `Sort descending` | Column menu item. |
| `filterMenuItem` | `Filter` | Column menu item. |
| `groupBy` | `` `Group by ${column}` `` | Column menu item. |
| `ungroup` | `` `Ungroup ${column}` `` | Column menu item. |
| `expandAllGroups` | `Expand all groups` | Column menu item. |
| `collapseAllGroups` | `Collapse all groups` | Column menu item. |
| `pinLeft` | `Pin to left` | Column menu item. |
| `pinRight` | `Pin to right` | Column menu item. |
| `unpin` | `Unpin` | Column menu item. |
| `moveLeft` | `Move left` | Column menu item. |
| `moveRight` | `Move right` | Column menu item. |
| `autosizeColumn` | `Autosize column` | Column menu item. |
| `hideColumn` | `Hide column` | Column menu item. |
| `filterOn` | `` `Filter on ${column}` `` | `aria-label` of the header filter button, of the header filter cell of a column that can filter, and of the value control in it. |
| `sortColumn` | `` `Sort ${column}` `` | `aria-label` of the header sort button. |
| `columnMenu` | `` `${column} column menu` `` | `aria-label` of the column menu trigger. |
| `rowsPerPage` | `Rows per page:` | `TMDataGrid.Footer`: the text before the page size select. |
| `pageRange` | `` `${from}–${to} of ${total}` `` | `TMDataGrid.Footer`: the range of rows on the page. |
| `pageNumber` | `` `Page ${page} of ${pageCount}` ``, or `` `Page ${page}` `` when `pageCount` is `-1` | `TMDataGrid.Footer`: the page number. |
| `groupedAllRows` | `` `Grouped · all ${total} rows` `` | `TMDataGrid.Footer`: in place of the range and the page number while the rows are grouped. |
| `pagingSuspendedHint` | `Paging is off while the rows are grouped, and every row is shown. Ungroup to page again.` | `TMDataGrid.Footer`: tooltip of the pager while the rows are grouped. |
| `previousPage` | `Previous page` | `TMDataGrid.Footer`: `aria-label` of the previous page button. |
| `nextPage` | `Next page` | `TMDataGrid.Footer`: `aria-label` of the next page button. |
| `noResults` | `No rows match your filters` | Body, when the view is empty and a column filter is active (`isFilterActive`) or the quick search is not blank. `meta.noResultsLabel` overrides it. |
| `loading` | `Loading` | `aria-label` of the body loader, of `TMDataGrid.LoadingIndicator`, and of the edit lane spinner while a row saves. |
| `editCell` | `` `Edit ${column}` `` | `aria-label` of an open cell editor. |
| `confirmEdit` | `Save` | `aria-label` of the ✓ button beside a cell editor. |
| `cancelEdit` | `Cancel` | `aria-label` of the ✕ button beside a cell editor. |
| `editColumnLabel` | `Edit` | `meta.label` of the generated edit lane. |
| `editRow` | `Edit row` | Edit lane: tooltip and `aria-label` of the pencil button. |
| `saveRow` | `Save row` | Edit lane: tooltip and `aria-label` of the ✓ button while a row edit is open. |
| `cancelRowEdit` | `Cancel edit` | Edit lane: tooltip and `aria-label` of the ✕ button while a row edit is open. |
| `editRowErrors` | `Fix the marked cells` | Edit lane: tooltip of the save button when field errors block the row and the row has no message of its own. |
| `saveAllEdits` | `"Save 1 row"` when `rows` is 1, else `` `Save ${rows} rows` `` | `TMDataGrid.DraftActions`: the save button. |
| `discardAllEdits` | `Discard` | `TMDataGrid.DraftActions`: the discard button. |
| `editRowsStillOpen` | `"1 row still being edited"` when `rows` is 1, else `` `${rows} rows still being edited` `` | `TMDataGrid.DraftActions`: the note shown while rows are still open in an edit. |
| `confirmNewRow` | `Add row` | Edit lane: tooltip and `aria-label` of the ✓ button on the entry row. |
| `discardNewRow` | `Discard new row` | Edit lane: tooltip and `aria-label` of the ✕ button on the entry row. |
| `deleteRow` | `Delete row` | Edit lane: tooltip and `aria-label` of the trash button. |
| `restoreRow` | `Restore row` | Edit lane: tooltip and `aria-label` of the undo button on a row marked for deletion. |
| `revertRow` | `Revert changes` | Edit lane: tooltip and `aria-label` of the undo button on a row with a draft. |
| `rowStateNew` | `New row` | Edit lane: the row-state marker of a confirmed entry row. |
| `rowStateEdited` | `Edited row` | Edit lane: the row-state marker of a row with a draft. |
| `rowStateDeleted` | `Marked for deletion` | Edit lane: the row-state marker of a row marked for deletion. |
| `cellCount` | `"1 cell"` when `count` is 1, else `` `${count} cells` `` | Cell-selection context menu: its heading. |
| `copy` | `Copy` | Cell-selection context menu item. |
| `exportCells` | `Export cells` | Cell-selection context menu item. |
| `includeHeaders` | `Include headers` | Cell-selection context menu: the checkbox. |
| `exportAll` | `Export all rows` | `TMDataGrid.Menu.Export`. Its `label` prop wins. |
| `exportSelected` | `"Export 1 selected row"` when `count` is 1, else `` `Export ${count} selected rows` `` | `TMDataGrid.Menu.ExportSelected`. Its `label` prop wins. |
| `exportPickerTitle` | `` `Export as ${format}` `` | Export column picker: the title. `format` is the file extension in upper case. |
| `exportPickerHint` | `"Select the columns to export"` when `selected` is `null`, `"Select the columns to export for the selected row"` when it is 1, else `` `Select the columns to export for the ${selected} selected rows` `` | Export column picker: the line under the title. |
| `exportPickerConfirm` | `Export` | Export column picker: the confirm button. |
| `exportPickerCancel` | `Cancel` | Export column picker: the cancel button. |
| `exportPickerSelectAll` | `Select all` | Export column picker: the select-all checkbox over the list. |
| `exportPickerCount` | `` `${checked} of ${total}` `` | Export column picker: the count beside the select-all checkbox. |
| `exportPickerHidden` | `Hidden` | Export column picker: the mark on a column the grid hides. |
| `selectColumnLabel` | `Checkbox selection` | `meta.label` of the generated checkbox lane. |
| `selectAllRows` | `Select all rows` | `aria-label` of the header checkbox. |
| `selectRow` | `Select row` | `aria-label` of a row checkbox. |
| `selectGroup` | `Select group` | `aria-label` of a group row checkbox. |
| `detailsColumnLabel` | `Details` | `meta.label` of the generated details lane. |
| `showDetails` | `Show details` | `aria-label` of a collapsed row's details toggle. |
| `hideDetails` | `Hide details` | `aria-label` of an expanded row's details toggle. |
| `expandAllDetails` | `Expand all details` | `aria-label` of the details lane's header toggle while some row is collapsed. |
| `collapseAllDetails` | `Collapse all details` | `aria-label` of the details lane's header toggle while every row is expanded. |
| `groupColumnLabel` | `Group` | `meta.label` of the generated tree lane, and its header text while nothing is grouped. |
| `blankGroupValue` | `(Blank)` | Group row text for an empty group key. |
| `expandGroup` | `` `Expand ${label}` `` | `aria-label` of a collapsed group row's toggle. |
| `collapseGroup` | `` `Collapse ${label}` `` | `aria-label` of an expanded group row's toggle. |

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `labels` | Option | `TMDataGridLabelsOverride` | English | Any subset, merged over the defaults. Keep it stable. |
| `grid.labels` | Hook return | `TMDataGridLabels` | – | The resolved dictionary. |
| `TMDATAGRID_LABELS_EN` | Export | `TMDataGridLabels` | – | The English base. |
| `TMDATAGRID_LABELS_SV` | Export | `TMDataGridLabels` | – | A complete Swedish dictionary. |
| `TMDataGridLabels` | Export | type | – | The full dictionary. What a new translation must cover. |
| `TMDataGridLabelsOverride` | Export | type | – | A partial dictionary. |
| `mergeLabels` | Export | `(override?: TMDataGridLabelsOverride) => TMDataGridLabels` | – | Folds a partial override over the English defaults. Returns `TMDATAGRID_LABELS_EN` itself without an argument. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | Per-instance override of the filtered-empty message. |
