---
name: options
description: >
  useTMDataGrid options, return value and state persistence. Covers passthrough
  of TanStack TableOptions, every default the grid changes (globalFilterFn,
  groupedColumnMode, autoResetExpanded, autoResetPageIndex,
  defaultColumn.minSize), the default initialState, the meta object (loading,
  noResultsLabel, rowHeight, totalRowCount), the grid's own options (persist,
  labels, editing, filters, exportOptions, enableColumnOrdering,
  enablePagination, resetPageOnQueryChange, enableRowNumbers, selectionMode,
  showSelectedBackground, cellSelection, renderDetails, overscan,
  quickSearchMode), persist with dataKey/settingsKey slices, storageMode and
  urlKey and createTMDataGridUrlState deep links, the returned api (table, ui,
  edit, features, labels, resetSettings, scrollToRow), ui actions, and reading
  grid state with useSelector over table.store, since table.getState() does not
  exist in v9. Load when configuring the hook, looking up an option's default,
  persisting layout or filters, or reacting to grid state from a parent.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.4.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/use-tm-data-grid.md'
  - 'Jielga/react:packages/tmdatagrid/docs/persistence.md'
  - 'Jielga/react:packages/tmdatagrid/docs/typed-deep-links.md'
  - 'Jielga/react:packages/tmdatagrid/src/useTMDataGrid.tsx'
  - 'Jielga/react:packages/tmdatagrid/src/core/persistence.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/urlState.ts'
---

# TMDataGrid - useTMDataGrid

Creates the table instance and the state used by the grid interface.

```tsx
const grid = useTMDataGrid<TData>(options);
// { table, ui, edit, features, labels, filters, exportOptions, renderDetails,
//   renderDetailsEstHeight, overscan, resetSettings, scrollToRow }
```

The signature is
`useTMDataGrid<TData>(options: UseTMDataGridOptions<TData>): TMDataGridApi<TData>`.
Spread the result onto `TMDataGrid`.

## Options

All TanStack `TableOptions` are supported and passed through unchanged, including
`data`, `columns`, `getRowId`, `state`, the `onXChange` callbacks, the `manual*`
flags and `rowCount`. The `features` option is supplied internally and cannot be
overridden.

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
| `selectionMode` | `"checkbox" \| "row" \| "checkboxAndHighlight" \| "highlight"` | `"checkbox"` | What selecting looks like and what a bare row click does. Defined by the grid, see the `rows` skill. |
| `showSelectedBackground` | `boolean` | On for `"row"`, off for `"checkbox"` | Determines whether selected rows take a background tint, coloured by `--dg-row-selected-bg`. Defined by the grid, see the `rows` skill. |
| `defaultHighlightedRowId` | `string \| null` | – | Row highlighted on mount, under a mode with a highlight. Read once, like `initialState`. Defined by the grid. |
| `onHighlightedRowChange` | `(rowId: string \| null) => void` | – | Follows the highlighted row, from clicks and from `ui.actions.setHighlightedRow`. Defined by the grid. |
| `enableSorting` | `boolean` | `true` | `false` removes the sort indicator, the sort menu items and click-to-sort. Also a column option. See the `columns` skill. |
| `enableMultiSort` | `boolean` | `true` for accessor columns | Shift+click on a header adds a sort instead of replacing it. Also a column option. See the `columns` skill. |
| `maxMultiSortColCount` | `number` | `Number.MAX_SAFE_INTEGER` | How many sorts are kept; past it the oldest is dropped. |
| `enableColumnFilters` | `boolean` | `true` | `false` removes the filter menu item, the `FilterButton`, the header filter row and the panel's column list, and disables the panel's "Add filter" button. Filters already in state still apply. See the `filtering` skill. |
| `enableGlobalFilter` | `boolean` | `true` | `false` removes `Search`. Also a column option, removing one column from the search. See the `filtering` skill. |
| `globalFilterFn` | filter fn \| name | `"tmDataGridFuzzy"`; `"includesString"` under `quickSearchMode: "contains"` (grid default; TanStack: `"auto"`) | How the quick search matches. An explicit value also switches the fuzzy rank ordering off. |
| `enableHiding` | `boolean` | `true` | `false` removes the Hide column item, the Manage columns submenu and the column chooser. Also a column option. |
| `enableColumnPinning` | `boolean` | `true` | Enables pinning for the table. `false` removes the pin menu items; the generated lanes stay pinned. |
| `enableColumnResizing` | `boolean` | `true` | With `false` the divider is displayed but cannot be dragged, and double-click autosize and the Autosize menu item are removed. Also a column option, as `enableResizing`. |
| `enableColumnOrdering` | `boolean` | `true` | Enables header dragging and the move menu items. Defined by the grid, see the `columns` skill. |
| `enableGrouping` | `boolean` | `true`; `false` under `manualPagination` (grid default; TanStack: `true`) | `false` removes the Group by and Ungroup menu items and the tree lane. Also a column option. See the `grouping` skill. |
| `groupedColumnMode` | `"remove" \| "reorder" \| false` | `"remove"` (grid default; TanStack: `"reorder"`) | What happens to a column the rows are grouped by: `"remove"` takes it out of the grid, `"reorder"` moves it to the front, `false` leaves it in place. See the `grouping` skill. |
| `enablePagination` | `boolean` | `false` | Enables client-side paging and the `Footer` pager. Implied by `manualPagination`. Defined by the grid, see the `data` skill. |
| `resetPageOnQueryChange` | `boolean` | `true` | Returns to the first page when a column filter, the quick search, the sorting or the grouping changes through the table. A `data` change does not count. Defined by the grid, see the `data` skill. |
| `autoResetPageIndex` | `boolean` | `false` (grid default; TanStack: `!manualPagination`) | TanStack's return to the first page on every `data` change. Off, since `resetPageOnQueryChange` covers the query. |
| `autoResetExpanded` | `boolean` | `false` (grid default; TanStack: `!manualExpanding`) | TanStack's collapse of every expanded row on a `data` change. Off, so open details panels survive a refetch. |
| `manualFiltering`, `manualSorting`, `manualGrouping`, `manualPagination` | `boolean` | `false` | The server does that step and the grid shows `data` as given. `manualPagination` also implies `enablePagination`. See the `server-side` skill. |
| `rowCount` | `number` | – | The total row count under `manualPagination`, read by the pager. |
| `enableRowNumbers` | `boolean` | `false` | The row-number gutter, outermost left. Defined by the grid, see the `rows` skill. |
| `enableRowPinning` | `boolean \| (row) => boolean` | `false` (grid default; TanStack: `true`) | Rows can be pinned to sticky edge blocks with `row.pin()`. See the `rows` skill. |
| `quickSearchMode` | `"fuzzy" \| "contains"` | `"fuzzy"` | How `Search` matches. Fuzzy forgives typos and orders unsorted results by match quality; `"contains"` is plain substring matching. Defined by the grid, see the `filtering` skill. |
| `enableMatchHighlighting` | `boolean` | `false` | Cells mark the matched text while a contains-family filter or the quick search is active. Defined by the grid, see the `filtering` skill. |
| `renderDetails` | `({ row, table }) => ReactNode` | – | Panel rendered under an expanded row, spanning every column. Setting it turns row details on and adds the pinned chevron lane. Defined by the grid, see the `rows` skill. |
| `renderDetailsEstHeight` | `number` | `160` | What the virtualizer assumes for a panel it has not measured yet. Panels are measured once mounted, so an approximation is enough. Defined by the grid. |
| `detailsColumnPosition` | `"left" \| "right"` | `"left"` | Which edge the details lane is pinned to. `"right"` places it after every column, inside the edit lane. Defined by the grid, see the `rows` skill. |
| `cellSelection` | `"none" \| "single" \| "range"` | `"none"` | Cell cursor and, under `"range"`, a selectable rectangle with Ctrl+C and CSV export. Defined by the grid, see the `cell-selection` skill. |
| `onFocusedCellChange` | `(cell: TMDataGridCellPosition \| null) => void` | – | Called whenever the focused cell moves, by key, click or `setFocusedCell`. Defined by the grid. |
| `overscan` | `number` | `6` | Rows the virtualizer keeps mounted above and below the viewport. Raise it if fast scrolling flashes blank rows, lower it when rows are expensive to render. Defined by the grid. |
| `columnResizeMode` | `"onChange" \| "onEnd"` | `"onEnd"` | When a resize drag writes `columnSizing`. The grid paints a running drag itself either way; `"onChange"` also publishes a width on every pointer move, which re-renders the grid with each of them. |
| `initialState` | `Partial<TableState>` | – | Starting state, read once on mount. Merged over the grid defaults below. |
| `state` | `Partial<TableState>` | – | Controlled state. Each slice requires its `onXChange`. See below. |
| `atoms` | `Partial<Record<slice, Atom>>` | – | External atoms owning state slices. No callback required. Takes precedence over `state`. |
| `meta` | `TMDataGridTableMeta` | `{}` | Grid configuration. See below. |
| `filters` | `TMDataGridFiltersOptions` | `{ surface: "popup" }` | Where the filter controls go - a popup, a sidebar, the column headers, or nowhere. Defined by the grid, see the `filtering` skill. |
| `exportOptions` | `TMDataGridExportOptions` | `csvExcelFormat()`, `"export"`, headers on, `"visible"` columns | The export's `format`, `fileName`, `includeHeaders` and `columns`. Defined by the grid, see the `data` skill. |
| `editing` | `TMDataGridEditingOptions` | off | Turns editing on. `mode` picks what counts as a commit and `draft` whether edits collect in the draft store. Requires `getRowId`. Defined by the grid, see the `editing` skill. |
| `persist` | `TMDataGridPersistence` | – | State persistence. Defined by the grid, see below. |
| `labels` | `TMDataGridLabelsOverride` | English | Overrides for the grid's strings and `aria-label`s. Defined by the grid, see the `appearance` skill. |

### Default initial state

| Slice | Default |
| --- | --- |
| `pagination` | `{ pageIndex: 0, pageSize: 25 }`. Inert until pagination is enabled |
| `columnPinning.start` | The row number, checkbox, tree and details columns, followed by any columns you provide. The details column moves to `end` under `detailsColumnPosition: "right"` |
| `columnPinning.end` | Any columns you provide, then the details column under `detailsColumnPosition: "right"`, then the edit column |

### Controlled state

`state` makes a slice controlled: the parent owns the value, the grid reads it
every render, and all writes go through the matching `onXChange`. Without the
callback the slice cannot change; the grid logs a console warning in
development. For a starting value only, use `initialState`.

```tsx
const [columnVisibility, setColumnVisibility] = useState({ play: false });

const grid = useTMDataGrid({
  data,
  columns,
  state: { columnVisibility },
  onColumnVisibilityChange: setColumnVisibility,
});
```

- A key set to `undefined` is ignored; the slice is uncontrolled.
- Slices compare structurally between renders, so the `state` object can be
  built inline. `Date`s compare by time; `Map`s and class instances compare by
  identity and belong in `useState` or `useMemo`.
- `atoms` also controls a slice, with no callback. Takes precedence over
  `state` for the same slice.
- `columnVisibility` toggles user-defined columns only. Entries for the
  generated columns are ignored; enable or disable those through their feature
  options. The tree column's entry follows `grouping`.
- `persist` cannot restore a controlled slice; it still writes it to storage.

## meta

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | While `true` and the view is empty, a loader replaces the empty state; `renderEmptyState` is not called. Rows on screen stay. See the `data` skill. |
| `noResultsLabel` | `string` | `labels.noResults` | The text shown when a filter or the search leaves no rows. |
| `rowHeight` | `number` | From `size` | Row height in px. Overrides the size scale. |
| `totalRowCount` | `number` | – | Unfiltered total used by `SummaryCount`. Without it a `manualFiltering` or `manualPagination` grid shows the shown count alone. |

## persist

Restores table state on mount and writes it back on every change. State is split
across three keys because the groups have different lifetimes: column configuration
stays valid indefinitely, filters and pagination go stale as the data
changes, and a deep link has to travel with the page URL. Separate keys let one
group be cleared without touching the others.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `dataKey` | `TMDataGridPersistKey<TMDataGridDataSlice>`: `string \| [string, DataSlice[]]` | – | Storage key for the data group. |
| `settingsKey` | `TMDataGridPersistKey<TMDataGridSettingsSlice>`: `string \| [string, SettingsSlice[]]` | – | Storage key for the settings group. |
| `urlKey` | `TMDataGridPersistKey<TMDataGridDataSlice>`: `string \| [string, DataSlice[]]` | – | Search param for data slices kept in the URL. See [Deep links](#deep-links). |
| `urlStorage` | `TMDataGridUrlStorage`: `{ get(name): string \| null; set(name, value: string \| null): void }` | `location.search` and `history.replaceState` | Reads and writes the URL param. |
| `storageMode` | `TMDataGridStorageMode`: `"localStorage" \| "sessionStorage"` | `"localStorage"` | Storage area. `"sessionStorage"` is per tab. |
| `serialize` | `(value) => string` | `JSON.stringify` | Serializes before storing. |
| `deserialize` | `(value: string) => unknown` | `JSON.parse` | Parses a stored payload. |

Both keys are optional.

```tsx
import type { TMDataGridPersistence } from "@jielga/tmdatagrid";

// Module scope: the object is a dependency of the write subscription.
const persist = {
  dataKey: "employees.data",
  settingsKey: "employees.settings",
} satisfies TMDataGridPersistence;

const grid = useTMDataGrid({ data, columns, persist });
```

### Selecting slices

A bare key persists every slice in its group. Pass `[key, slices]` for a subset:

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

`grouping` is a settings slice because it names columns rather than values, so it
survives the data changing under it the way the column layout does. `expanded` is
a data slice for the opposite reason.

`DATA_STATE_SLICES` and `SETTINGS_STATE_SLICES` export the same values. Slice
names are typed per group, `TMDataGridDataSlice` and `TMDataGridSettingsSlice`,
so only valid names are accepted.

Restoring happens once on mount through `initialState`. Writing is a subscription
to the table store, so state changed directly through the table API is persisted
too. Only selected slices are read back, and unrecognised keys are ignored. All
storage access is guarded - if storage is unavailable, disabled or full,
persistence is skipped rather than throwing.

A payload from another version is dropped whole, not migrated. Payloads carry
the exported `PERSIST_PAYLOAD_VERSION`; anything else, including everything
written by a 0.x build, is discarded. Restored state is realigned against the
columns that exist: entries naming a column removed between deploys are
dropped.

Source: `packages/tmdatagrid/docs/persistence.md` (Behaviour).

### Deep links

`urlKey` keeps data slices in one URL search param, so a link to the page opens
the grid on the same filters. The string is the param name; a bare key takes
every data slice, a tuple a subset, as with `dataKey`.

```tsx
const persist = {
  settingsKey: "employees.settings",
  // Sorting is remembered per browser; the filters travel in the link.
  dataKey: ["employees.data", ["sorting"]],
  urlKey: ["employees", ["columnFilters", "globalFilter"]],
} satisfies TMDataGridPersistence;
```

- A slice lives in one group. A slice listed under `urlKey` is taken out of
  `dataKey`: a bare `dataKey` hands it over silently, while a `dataKey` tuple
  that names the slice explicitly is reported with `console.error` on mount.
- The param carries only the slices whose value differs from the initial state
  (`initialState` merged over the grid defaults), and only the column filters
  that are active. When nothing differs, the param is removed. A link without the param, or without a slice, opens on the
  initial state; a URL slice never falls back to storage.
- Writes use `history.replaceState`, never `pushState`. Only the grid's own
  param changes; the path, the hash, other params and `history.state` are kept.
  Two grids on one page use two keys.
- The URL payload has no version stamp, so a bookmarked link survives a
  release. The shape guards and the realignment against existing columns apply
  as for storage, and `serialize` / `deserialize` apply to the URL payload too.
- `meta.filter.url: false` on a column keeps its filter out of the param, on
  read and on write. The column's filter is then not persisted anywhere, and a
  filter on it in `initialState` still applies when a link is opened. The
  flag has no effect unless `urlKey` carries `columnFilters`.
- `urlStorage` replaces the default read and write of the param, for a router
  that owns the URL. `get` returns the param's string or `null`; `set` receives
  the string, or `null` to remove the param. `set` is only called when the
  value changed. Keep `persist` referentially stable here too: react-router
  rebuilds `setSearchParams` on every URL change, so read it through a ref.

```tsx
// react-router: let the router do the replace.
const [, setSearchParams] = useSearchParams();
const setSearchParamsRef = useRef(setSearchParams);
setSearchParamsRef.current = setSearchParams;

const persist = useMemo(
  () =>
    ({
      urlKey: ["employees", ["columnFilters"]],
      urlStorage: {
        get: (name) => new URLSearchParams(window.location.search).get(name),
        set: (name, value) =>
          setSearchParamsRef.current(
            (prev) => {
              if (value === null) prev.delete(name);
              else prev.set(name, value);
              return prev;
            },
            { replace: true },
          ),
      },
    }) satisfies TMDataGridPersistence,
  [],
);
```

Source: `packages/tmdatagrid/docs/persistence.md` (Deep links).

### Typed links

`createTMDataGridUrlState({ key, columns, slices? })` defines a grid's deep
links from the columns the grid renders, built with
`createTMDataGridColumnHelper`. A link can name only the filters, operators,
values and sorts those columns offer; anything else is a type error. The
definition gives `urlKey` for `persist`, the link as `searchParams`, `search`
or `payload`, a route `validateSearch`, and `persist(storage?)`, which keeps
the param in a router's search such as TanStack Router's.

```tsx
export const employeesUrl = createTMDataGridUrlState({ key: "employees", columns });

const persist = { urlKey: employeesUrl.urlKey } satisfies TMDataGridPersistence;
const href = `/employees?${employeesUrl.searchParams({
  filters: { department: { operator: "isAnyOf", value: ["Design"] } },
})}`;
```

Every rule, every member and the TanStack Router setup are in
[references/typed-links.md](references/typed-links.md).

## Return value

| Field | Type | Description |
| --- | --- | --- |
| `table` | `Table<TMDataGridFeatures, TData>` | The TanStack table instance. |
| `ui` | `TMDataGridUiStore`: `Store<TMDataGridUiState, TMDataGridUiActions>` | State of the filter and column panels. |
| `filters` | `TMDataGridFiltersSettings` | The `filters` option with its defaults filled in. |
| `exportOptions` | `TMDataGridExportSettings` | The `exportOptions` option with its defaults filled in. |
| `edit` | `TMDataGridEditApi` | The edit engine, inert until `editing` is set. See the `editing` skill. |
| `features` | `TMDataGridFeatureFlags` | Table-level feature switches, re-read on each render. |
| `labels` | `TMDataGridLabels` | The resolved label set, overrides merged over English. |
| `renderDetails` | `TMDataGridDetailsRenderer<TData> \| undefined` | The detail renderer, passed through for `TMDataGrid.Table` to call. |
| `renderDetailsEstHeight` | `number` | The estimate, resolved to its default when the option was not set. |
| `overscan` | `number` | The overscan, resolved to its default when the option was not set. |
| `resetSettings` | `() => void` | Puts the settings state back to a clean first visit. |
| `scrollToRow` | `({ rowId, align? }) => boolean` | Scrolls a row into view through the virtualizer. `false` when the row is not in the current view. |

`table` is `TMDataGridTable<TData>`, TanStack's core `Table` type. It has no
`getState()` (that method does not exist in TanStack Table v9) and `table.state`
is not part of the type; state lives in `table.store`.

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
well; call it inside a selector, as above. `getTMDataGridPaginationApi(table)`
is a snapshot too; wrap it in `useSelector` or use the `state` the Footer's
`renderPagination` slot receives.

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

The last two move the cell cursor and the selected rectangle under
`cellSelection`; DOM focus follows `focusedCell` and scrolls its row into view.

`startColumnDrag` / `endColumnDrag` are called by the header cells while a
column is being dragged, and `ui.state.draggedColumnId` holds the column being
moved - browsers keep `dataTransfer` unreadable until the drop.

`openColumnFilter(grid, columnId)` combines the two steps the column menu uses:
add an empty filter row for the column if none exists, then open the panel on
it, or focus the column's header control under `filters.inHeader`.

## Common mistakes

### Reading store state during render

`grid.table.store.state` is a plain read - it does not subscribe the component.
A bare read is stale in any component that does not call `useTMDataGrid`
itself, and under the React Compiler also in the one that does; `useSelector`
subscribes either way. The same holds for every table and column getter called
outside a selector.

```tsx
// Wrong - never re-renders when the selection changes.
const count = Object.keys(grid.table.store.state.rowSelection).length;
// Wrong - a getter outside a selector is a snapshot.
const grouped = grid.table.getColumn("department")!.getIsGrouped();
// Wrong - `getState()` does not exist in TanStack Table v9.
const sorting = grid.table.getState().sorting;

// Right.
const count = useSelector(
  grid.table.store,
  (state) => Object.keys(state.rowSelection).length,
);
const grouped = useSelector(grid.table.store, (state) =>
  state.grouping.includes("department"),
);
const sorting = useSelector(grid.table.store, (state) => state.sorting);
```

### persist object built during render

The object is a dependency of the write subscription. A fresh literal on every
render tears down and re-establishes the subscription each time. Define it at
module scope, or `useMemo` it if the keys depend on props.

### Unnamespaced storage keys

Storage keys are not namespaced automatically. Where several users can share a
browser profile, one user's column layout and filters are restored for the next.
Include a tenant or user identifier in the key.

### Unstable data reference

A new array identity on each render re-runs the row model. `data={rows ?? []}`
allocates a fresh `[]` every render when `rows` is undefined - hoist the empty
array to a module-scope constant or `useMemo` the expression. Under `editing`
the cost is higher: every new `data` identity drops the open drafts of the rows
it no longer contains, so a transient `[]` while refetching discards every
draft.
