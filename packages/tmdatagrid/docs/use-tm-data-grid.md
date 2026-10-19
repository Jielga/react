# useTMDataGrid

Creates the table instance and the state used by the grid interface.

```tsx
const grid = useTMDataGrid<TData>(options);
// TMDataGridApi<TData>, see Return value
```

Spread the result onto `TMDataGrid`.

## Options

All TanStack `TableOptions` are supported and passed through unchanged,
including `data`, `columns`, `getRowId`, `state` and the `onXChange` callbacks
(see [Controlled state](#controlled-state)), the `manual*` flags and `rowCount`.
The `features` option is supplied internally and cannot be overridden.

The grid defines these options itself: `persist`, `labels`, `editing`,
`filters`, `exportOptions`, `enableColumnOrdering`, `enablePagination`,
`resetPageOnQueryChange`, `enableRowNumbers`, `selectionMode`,
`showSelectedBackground`, `defaultHighlightedRowId`, `onHighlightedRowChange`,
`cellSelection`, `onFocusedCellChange`, `renderDetails`,
`renderDetailsEstHeight`, `detailsColumnPosition`, `overscan`,
`quickSearchMode` and `enableMatchHighlighting`. The table below marks them
"Defined by the grid"; every other row is a TanStack option, listed where the
grid changes its default or where it decides something visible. A TanStack
default the grid changes reads, for example, `"remove"` (grid default;
TanStack: `"reorder"`). A TanStack option that is not listed passes through
with TanStack's own default.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `TData[]` | – | Row data. When the reference changes the table reprocesses the row models, so keep it stable with `useMemo`; a fresh `[]` for the empty case belongs in a module-scope constant. |
| `columns` | `ColumnDef[]` | – | Created with `createTMDataGridColumnHelper`. Define them outside the component. |
| `getRowId` | `(row, index, parent?) => string` | Row index | The id that row selection, expansion, row pinning and editing are keyed by. The index points at another record after a sort or a refetch, so return the entity id. Required once `editing` is set. |
| `defaultColumn` | `Partial<ColumnDef>` | `{ minSize: 80 }` (grid default; TanStack: `{}`) | Defaults merged under every column. The grid sets `filterFn: "tmDataGrid"` and clears `aggregationFn` and `aggregatedCell` on every column, so those three keys have no effect here; a value on the column wins. |
| `enableRowSelection` | `boolean \| (row) => boolean` | `true` | `false` removes row selection and its checkbox column. |
| `enableMultiRowSelection` | `boolean \| (row) => boolean` | `true` | `false` removes the select-all checkbox and limits the selection to one row. |
| `selectionMode` | `"checkbox" \| "row" \| "checkboxAndHighlight" \| "highlight"` | `"checkbox"` | What selecting looks like and what a bare row click does. Defined by the grid, see [Row selection](/docs/row-selection). |
| `showSelectedBackground` | `boolean` | On for `"row"`, off for `"checkbox"` | Determines whether selected rows take a background tint, coloured by `--dg-row-selected-bg`. Defined by the grid, see [Row selection](/docs/row-selection). |
| `defaultHighlightedRowId` | `string \| null` | – | Row highlighted on mount, under a mode with a highlight. Read once, like `initialState`. Defined by the grid. |
| `onHighlightedRowChange` | `(rowId: string \| null) => void` | – | Follows the highlighted row, from clicks and from `ui.actions.setHighlightedRow`. Defined by the grid. |
| `enableSorting` | `boolean` | `true` | `false` removes the sort indicator, the sort menu items and click-to-sort. Also a column option. See [Sorting](/docs/sorting). |
| `enableMultiSort` | `boolean` | `true` for accessor columns | Shift+click on a header adds a sort instead of replacing it. Also a column option. See [Sorting](/docs/sorting). |
| `maxMultiSortColCount` | `number` | `Number.MAX_SAFE_INTEGER` | How many sorts are kept; past it the oldest is dropped. |
| `enableColumnFilters` | `boolean` | `true` | `false` removes the filter menu item, the `FilterButton`, the header filter row and the panel's column list, and disables the panel's "Add filter" button. Filters already in state still apply. See [Filtering](/docs/filtering#turning-it-off). |
| `enableGlobalFilter` | `boolean` | `true` | `false` removes `Search`. Also a column option, removing one column from the search. See [Quick search](/docs/quick-search). |
| `globalFilterFn` | filter fn \| name | `"tmDataGridFuzzy"`; `"includesString"` under `quickSearchMode: "contains"` (grid default; TanStack: `"auto"`) | How the quick search matches. An explicit value also switches the fuzzy rank ordering off. |
| `enableHiding` | `boolean` | `true` | `false` removes the Hide column item, the Manage columns submenu and the column chooser. Also a column option. |
| `enableColumnPinning` | `boolean` | `true` | Enables pinning for the table. `false` removes the pin menu items; the generated lanes stay pinned. |
| `enableColumnResizing` | `boolean` | `true` | With `false` the divider is displayed but cannot be dragged, and double-click autosize and the Autosize menu item are removed. Also a column option, as `enableResizing`. |
| `enableColumnOrdering` | `boolean` | `true` | Enables header dragging and the move menu items. Defined by the grid, see [Column layout](/docs/column-layout#ordering). |
| `enableGrouping` | `boolean` | `true`; `false` under `manualPagination` (grid default; TanStack: `true`) | `false` removes the Group by and Ungroup menu items and the tree lane. Also a column option. See [Grouping](/docs/grouping). |
| `groupedColumnMode` | `"remove" \| "reorder" \| false` | `"remove"` (grid default; TanStack: `"reorder"`) | What happens to a column the rows are grouped by: `"remove"` takes it out of the grid, `"reorder"` moves it to the front, `false` leaves it in place. See [Grouping](/docs/grouping). |
| `enablePagination` | `boolean` | `false` | Enables client-side paging and the `Footer` pager. Implied by `manualPagination`. Defined by the grid, see [Pagination](/docs/pagination). |
| `resetPageOnQueryChange` | `boolean` | `true` | Returns to the first page when a column filter, the quick search, the sorting or the grouping changes through the table. A `data` change does not count. Defined by the grid, see [Pagination](/docs/pagination). |
| `autoResetPageIndex` | `boolean` | `false` (grid default; TanStack: `!manualPagination`) | TanStack's return to the first page on every `data` change. Off, since `resetPageOnQueryChange` covers the query. |
| `autoResetExpanded` | `boolean` | `false` (grid default; TanStack: `!manualExpanding`) | TanStack's collapse of every expanded row on a `data` change. Off, so open details panels survive a refetch. |
| `manualFiltering`, `manualSorting`, `manualGrouping`, `manualPagination` | `boolean` | `false` | The server does that step and the grid shows `data` as given. `manualPagination` also implies `enablePagination`. See [Server-side data](/docs/server-side). |
| `rowCount` | `number` | – | The total row count under `manualPagination`, read by the pager. |
| `enableRowNumbers` | `boolean` | `false` | The row-number gutter, outermost left. Defined by the grid, see [Row pinning and numbering](/docs/row-pinning). |
| `enableRowPinning` | `boolean \| (row) => boolean` | `false` (grid default; TanStack: `true`) | Rows can be pinned to sticky edge blocks with `row.pin()`. See [Row pinning and numbering](/docs/row-pinning). |
| `quickSearchMode` | `"fuzzy" \| "contains"` | `"fuzzy"` | How `Search` matches. Fuzzy forgives typos and orders unsorted results by match quality; `"contains"` is plain substring matching. Defined by the grid, see [Quick search](/docs/quick-search). |
| `enableMatchHighlighting` | `boolean` | `false` | Cells mark the matched text while a contains-family filter or the quick search is active. Defined by the grid, see [Quick search](/docs/quick-search#match-highlighting). |
| `renderDetails` | `({ row, table }) => ReactNode` | – | Panel rendered under an expanded row, spanning every column. Setting it turns row details on and adds the pinned chevron lane. Defined by the grid, see [Row details](/docs/row-details). |
| `renderDetailsEstHeight` | `number` | `160` | What the virtualizer assumes for a panel it has not measured yet. Panels are measured once mounted, so an approximation is enough. Defined by the grid. |
| `detailsColumnPosition` | `"left" \| "right"` | `"left"` | Which edge the details lane is pinned to. `"right"` places it after every column, inside the edit lane. Defined by the grid, see [Row details](/docs/row-details). |
| `cellSelection` | `"none" \| "single" \| "range"` | `"none"` | Cell cursor and, under `"range"`, a selectable rectangle with Ctrl+C and CSV export. Defined by the grid, see [Cell selection](/docs/cell-selection). |
| `onFocusedCellChange` | `(cell: TMDataGridCellPosition \| null) => void` | – | Called whenever the focused cell moves, by key, click or `setFocusedCell`. Defined by the grid. |
| `overscan` | `number` | `6` | Rows the virtualizer keeps mounted above and below the viewport. Raise it if fast scrolling flashes blank rows, lower it when rows are expensive to render. Defined by the grid. |
| `columnResizeMode` | `"onChange" \| "onEnd"` | `"onEnd"` | When a resize drag writes `columnSizing`. The grid paints a running drag itself either way; `"onChange"` also publishes a width on every pointer move, which re-renders the grid with each of them. |
| `initialState` | `Partial<TableState>` | – | Starting state, read once on mount. Merged over the [grid defaults](#default-initial-state). |
| `state` | `Partial<TableState>` | – | Controlled state. Each slice requires its `onXChange`. See [Controlled state](#controlled-state). |
| `atoms` | `Partial<Record<slice, Atom>>` | – | External atoms owning state slices. No callback required. Takes precedence over `state`. |
| `meta` | `TMDataGridTableMeta` | `{}` | Grid configuration. See [meta](#meta). |
| `filters` | `TMDataGridFiltersOptions` | `{ surface: "popup" }` | Where the filter controls go - a popup, a sidebar, the column headers, or nowhere. Defined by the grid, see [Filtering](/docs/filtering#the-filters-option). |
| `exportOptions` | `TMDataGridExportOptions` | `csvExcelFormat()`, `"export"`, headers on, `"visible"` columns | The export's `format`, `fileName`, `includeHeaders` and `columns`. Defined by the grid, see [Export](/docs/export). |
| `editing` | `TMDataGridEditingOptions` | off | Turns editing on. `mode` picks what counts as a commit and `draft` whether edits collect in the draft store. Requires `getRowId`. Defined by the grid, see [Editing](/docs/editing). |
| `persist` | `TMDataGridPersistence` | – | State persistence. Defined by the grid, see [persist](#persist). |
| `labels` | `TMDataGridLabelsOverride` | English | Overrides for the grid's strings and `aria-label`s. Defined by the grid, see [Localization](#localization). |

### Default initial state

| Slice | Default |
| --- | --- |
| `pagination` | `{ pageIndex: 0, pageSize: 25 }`. Inert until pagination is enabled |
| `columnPinning.start` | The row number, checkbox, tree and details columns, followed by any columns you provide. The details column moves to `end` under `detailsColumnPosition: "right"` |
| `columnPinning.end` | Any columns you provide, then the details column under `detailsColumnPosition: "right"`, then the edit column |

### Controlled state

`state` makes a slice controlled: the parent owns the value and the grid reads
it on every render. Each controlled slice requires its `onXChange` callback -
all writes go through it. Without the callback the slice cannot change; the
grid logs a console warning in development. For a starting value only, use
`initialState`.

```tsx
const [columnVisibility, setColumnVisibility] = useState({ play: false });

const grid = useTMDataGrid({
  data,
  columns,
  state: { columnVisibility },
  onColumnVisibilityChange: setColumnVisibility,
});
```

- Controllable slices: `columnFilters`, `columnOrder`, `columnPinning`,
  `columnResizing`, `columnSizing`, `columnVisibility`, `expanded`,
  `globalFilter`, `grouping`, `pagination`, `rowPinning`, `rowSelection`,
  `sorting`. Each has a matching `onXChange`.
- A key set to `undefined` is ignored; the slice is uncontrolled.
- Slices are compared structurally between renders, so the `state` object can
  be built inline. `Date` values compare by time. `Map`s and class instances
  compare by identity; keep a slice containing one in `useState` or `useMemo`.
- `atoms` also controls a slice, with no callback: the table writes through the
  atom. An atom takes precedence over `state` for the same slice.
- `columnVisibility` toggles user-defined columns only. Entries for the
  generated columns (checkbox, details, edit, row number) are ignored; enable
  or disable those through their feature options. The tree column's entry is
  managed by the grid and follows `grouping`.
- `persist` restores through `initialState` and cannot restore a controlled
  slice. It still writes the slice to storage on change.

## meta

Grid configuration, passed through the `meta` option.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | Displays a loader while the grid is empty. Takes precedence over every empty state. |
| `noResultsLabel` | `string` | `"No rows match your filters"` | The filtered-empty message. A grid with no data and no filters says `labels.noRows` instead; `renderEmptyState` on the Table replaces both. |
| `rowHeight` | `number` | From `size` | Row height in px. Overrides the size scale. |
| `totalRowCount` | `number` | – | Unfiltered total used by `SummaryCount`. Without it a `manualFiltering` or `manualPagination` grid shows the shown count alone. |

## Localization

Every string the grid renders - menu items, panels, tooltips, the pager and the
`aria-label`s - comes from one labels object, English by default. The `labels`
option takes any subset and merges it over the defaults:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  labels: { noResults: "Inga rader matchar dina filter" },
});
```

Labels that carry a value are functions, so each language can place the value
where its grammar requires:

```tsx
labels: {
  groupBy: (column) => `Gruppera efter ${column}`,
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
}
```

Keep the object referentially stable (module scope or `useMemo`); the grid
re-renders when its identity changes.

The full dictionary type is `TMDataGridLabels`; the English defaults are
exported as `TMDATAGRID_LABELS_EN`, and a complete Swedish dictionary as
`TMDATAGRID_LABELS_SV`:

```tsx
import { TMDATAGRID_LABELS_SV } from "@jielga/tmdatagrid";

const grid = useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
```

`meta.noResultsLabel` still works as a per-instance override of
`labels.noResults`.

The resolved dictionary is returned from the hook as `grid.labels`, so custom
toolbar components can read the same strings as the built-in parts.

## persist

Restores table state on mount and writes it back on every change. State is
split across three keys: `settingsKey` for the column layout, `dataKey` for
filters, sorting and pagination, and `urlKey` for data slices kept in the URL
as a deep link. Each can be cleared without the others.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` | `string \| [string, DataSlice[]]` | – | Storage key for the data group. |
| `settingsKey` | `string \| [string, SettingsSlice[]]` | – | Storage key for the settings group. |
| `urlKey` | `string \| [string, DataSlice[]]` | – | Search param for data slices kept in the URL. See [Deep links](/docs/persistence#deep-links). |
| `urlStorage` | `TMDataGridUrlStorage` | `location.search` and `history.replaceState` | Reads and writes the URL param. |
| `storageMode` | `"localStorage" \| "sessionStorage"` | `"localStorage"` | Storage area. Use `"sessionStorage"` for per-tab state. |
| `serialize` | `(value) => string` | `JSON.stringify` | Serializes a payload before storing. |
| `deserialize` | `(value: string) => unknown` | `JSON.parse` | Parses a stored payload. |

Both keys are optional.

```tsx
// Defined at module scope: the object is a dependency of the write subscription.
const persist = {
  dataKey: "employees.data",
  settingsKey: "employees.settings",
} satisfies TMDataGridPersistence;

const grid = useTMDataGrid({ data, columns, persist });
```

### Selecting slices

Passing a key on its own persists every slice in its group. Pass a tuple of
`[key, slices]` to persist only some of them:

```tsx
const persist = {
  // Restore filters and sorting, but always start on the first page.
  dataKey: ["employees.data", ["columnFilters", "sorting"]],
  // Restore column layout but not widths.
  settingsKey: ["employees.settings", ["columnVisibility", "columnOrder"]],
  storageMode: "sessionStorage",
} satisfies TMDataGridPersistence;
```

| Group | Available slices |
| --- | --- |
| `dataKey` | `columnFilters`, `globalFilter`, `sorting`, `pagination`, `expanded` |
| `urlKey` | The data slices. A slice listed here is taken out of `dataKey`. |
| `settingsKey` | `columnVisibility`, `columnSizing`, `columnOrder`, `columnPinning`, `grouping` |

The exported `DATA_STATE_SLICES` and `SETTINGS_STATE_SLICES` arrays contain the
same values. Slice names are typed per group, so only valid names are accepted.

### Behaviour

Restoring happens once on mount through `initialState`. Writing is implemented
as a subscription to the table store, so state changed directly through the
table API is persisted as well.

Only the selected slices are read back. A payload written before the selection
was narrowed cannot reintroduce slices you have since opted out of. Unrecognised
keys are ignored.

Payloads carry a version stamp, the exported `PERSIST_PAYLOAD_VERSION`. A
payload from a different version, including anything written by a 0.x build,
which had no stamp, is dropped whole rather than migrated.

Restored state is realigned against the columns that exist. Entries naming a
column removed between deploys are dropped: a stale id in the order, a width for
a column that no longer exists, or a sort or filter that would be active with no
column to show it. New columns need no handling, since TanStack appends columns
missing from `columnOrder` in definition order.

`resetSettings()` on the returned API puts the settings state back to what a
first visit with clean storage would have shown - your `initialState` plus the
structural lanes - and, with persistence configured, writes through to storage
like any other change. The columns panel's **Reset layout** button calls it.
TanStack's own `resetColumnX()` family cannot do it on a persisted grid: those
reset to `initialState`, which the mount built from the restored payload.

All storage access is guarded. If storage is unavailable, disabled or full,
persistence is skipped rather than throwing.

Storage keys are not namespaced automatically. Include a tenant or user
identifier if several users can share a browser profile.

## Return value

| Field | Type | Description |
| --- | --- | --- |
| `table` | `Table<TMDataGridFeatures, TData>` | The TanStack table instance. |
| `ui` | `Store<TMDataGridUiState, TMDataGridUiActions>` | State of the filter and column panels. |
| `filters` | `TMDataGridFiltersSettings` | The `filters` option with its defaults filled in. See [Filtering](/docs/filtering#the-filters-option). |
| `exportOptions` | `TMDataGridExportSettings` | The `exportOptions` option with its defaults filled in. See [Export](/docs/export). |
| `edit` | `TMDataGridEditApi` | The edit engine, inert until `editing` is set. See [Editing](/docs/editing). |
| `features` | `TMDataGridFeatureFlags` | Table-level feature switches, re-read from options on each render. See [Toolbar](/docs/toolbar#reading-options-reactively). |
| `labels` | `TMDataGridLabels` | The resolved label set, overrides merged over English. See [Localization](/docs/localization). |
| `renderDetails` | `TMDataGridDetailsRenderer<TData> \| undefined` | The detail renderer, passed through for `TMDataGrid.Table` to call. |
| `renderDetailsEstHeight` | `number` | The estimate, resolved to its default when the option was not set. |
| `overscan` | `number` | The overscan, resolved to its default when the option was not set. |
| `resetSettings` | `() => void` | Puts the settings state back to a clean first visit. See [persist](#persist). |
| `scrollToRow` | `({ rowId, align? }) => boolean` | Scrolls a row into view; see below. |

### scrollToRow

The grid is always virtualized, so a row far down the list has no element and
`scrollIntoView` has nothing to act on. `scrollToRow` moves the virtualizer
instead:

```ts
grid.scrollToRow({ rowId: "42" });
grid.scrollToRow({ rowId: "42", align: "center" });
```

`align` is TanStack Virtual's: `"auto"` (the default: nearest edge, leaving a
visible row where it is), `"start"`, `"center"` or `"end"`.

It returns whether the row could be reached. `false` means the row is not in the
current view - filtered out, on another page, or an id matching no row - and
nothing scrolled. A pinned row returns `true` without scrolling.

The identity is stable, so it is safe in a dependency array. Before
`TMDataGrid.Table` has mounted there is nothing to scroll and it returns
`false`.

### Reading state

`table.store` and `ui` are TanStack stores. Read a slice with `useSelector`
from `@tanstack/react-store`, which subscribes the component to what the
selector returns:

```tsx
import { useSelector } from "@tanstack/react-store";

const selectedCount = useSelector(
  grid.table.store,
  () => grid.table.getSelectedRowModel().rows.length,
);
const isGrouped = useSelector(grid.table.store, (state) =>
  state.grouping.includes("department"),
);
const pageIndex = useSelector(grid.table.store, (state) => state.pagination.pageIndex);
const filterPanelOpen = useSelector(grid.ui, (state) => state.filterPanelOpen);
```

`grid.table.store.state` is a plain read and does not subscribe the component.
A bare read is stale in any component that does not call `useTMDataGrid`
itself, and under the React Compiler also in the one that does; `useSelector`
subscribes either way. A table or column getter such as
`table.getSelectedRowModel()` or `column.getIsGrouped()` is a plain read as
well; call it inside a selector, as above. Note that `table.getState()` does
not exist in TanStack Table v9, and `table.state` is not part of
`TMDataGridTable`.

### ui actions

| Action | Signature |
| --- | --- |
| `openFilterPanel` | `(columnId?: string \| null) => void` |
| `closeFilterPanel` | `() => void` |
| `openExportPicker` | `(request: TMDataGridExportPickerRequest) => void` |
| `closeExportPicker` | `() => void` |
| `focusPanelFilter` | `(columnId: string \| null) => void` |
| `focusHeaderFilter` | `(columnId: string \| null) => void` |
| `startColumnDrag` | `(columnId: string) => void` |
| `endColumnDrag` | `() => void` |
| `setHighlightedRow` | `(rowId: string \| null) => void` |
| `setSelectionAnchor` | `(rowId: string \| null) => void` |
| `setFocusedCell` | `(cell: TMDataGridCellPosition \| null) => void` |
| `setCellRange` | `(range: TMDataGridCellRange \| null) => void` |

`setFocusedCell` and `setCellRange` move the cell cursor and the selected
rectangle under `cellSelection`. See [Cell selection](/docs/cell-selection). DOM
focus follows `focusedCell` while the grid holds it, scrolling the row into view
when it is off screen.

`startColumnDrag` and `endColumnDrag` are called by the header cells while a
column is being dragged. `ui.state.draggedColumnId` holds the column being moved,
since `dataTransfer` is unreadable until the drop.

`openColumnFilter(grid, columnId)` combines two steps used by the column menu:
it adds an empty filter row for the column if none exists, then sends the user
to that column's control. Which control that is follows the `filters` option -
the panel row, or, under `filters.inHeader`, the column's header control.

The two focus actions are the halves of that, and they write separate state
(`filterPanelColumnId` and `headerFilterColumnId`) so a grid showing both a
panel and header controls never has the two racing for the caret.

## What each switch removes

Almost every control is bound to the TanStack capability check for its feature,
so setting the standard table or column option removes the corresponding
interface. Empty menus and inactive buttons are never rendered, except `TMDataGrid.Menu`, which cannot see what its children render; see [Grid menu](/docs/menu).

Column ordering and pagination are the two exceptions: TanStack ships state and
APIs for both but no `enable` option, so the grid defines `enableColumnOrdering`
(with `meta.enableOrdering`) and `enablePagination` itself. Pagination defaults
to off; ordering, like the options around it, defaults to on.

| Option | Level | Interface removed |
| --- | --- | --- |
| `enableSorting: false` | Table, column | Sort indicator, sort menu items, click-to-sort. See [Sorting](/docs/sorting) |
| `enableColumnFilters: false` | Table | Filter menu item, `FilterButton`, header filter row, the panel's column list; the panel's "Add filter" button is disabled. Filters already in state still apply, with their pills and header indicators. See [Filtering](/docs/filtering#turning-it-off) |
| `enableColumnFilter: false` | Column | That column's filter menu item, panel entry and header control |
| `enableGlobalFilter: false` | Table, column | `Search`: the whole input at table level, one column's participation at column level |
| `enableHiding: false` | Table, column | Hide column, Manage columns, `TMDataGrid.Menu.Columns`. See [Column layout](/docs/column-layout) |
| `enableColumnPinning: false` | Table | Pin and unpin menu items. See [Column layout](/docs/column-layout) |
| `enablePinning: false` | Column | That column's pin menu items |
| `enableColumnResizing: false` | Table | Resize dragging, double-click autosize, the Autosize menu item. The divider remains as a separator |
| `enableResizing: false` | Column | That column's resize dragging and autosize |
| `enableColumnOrdering: false` | Table | Header dragging and the move menu items. See [Column layout](/docs/column-layout#ordering) |
| `meta.enableOrdering: false` | Column | That column's header dragging and move menu items |
| `enableRowSelection: false` | Table | The checkbox column |
| `selectionMode: "row"` / `"highlight"` | Table | The checkbox column. The row click selects instead. See [Row selection](/docs/row-selection) |
| `showSelectedBackground: false` | Table | The highlight background on selected rows. Follows the selection mode by default |
| `enablePagination: true` | Table | Opt-in: adds paging and the `Footer` pager. Off by default |
| `enableRowNumbers: true` | Table | Opt-in: the row-number gutter, outermost left. Numbers the current view: sorted, filtered, continuing across pages. Group rows take no number |
| `enableRowPinning: true` | Table | Opt-in: rows can be pinned to sticky edge blocks with `row.pin()`. Also takes a per-row predicate. See [Row pinning](/docs/row-pinning) |
| `enableMatchHighlighting: true` | Table | Opt-in: cells mark the matched text while a contains-family filter or the quick search is active. See [Quick search](/docs/quick-search#match-highlighting) |
| `enableGrouping: false` | Table, column | Group by and Ungroup menu items, and the tree lane at table level. The default is `false` under `manualPagination`. See [Grouping](/docs/grouping) |
| `renderDetails` | Table | Opt-in: adds the details lane, and an expanded row opens a panel underneath it. See [Row details](/docs/row-details) |
| `detailsColumnPosition: "right"` | Table | The details lane on the right edge, inside the edit lane, instead of the left. See [Row details](/docs/row-details) |
