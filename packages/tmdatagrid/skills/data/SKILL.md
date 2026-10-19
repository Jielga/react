---
name: data
description: >
  How a TMDataGrid presents the rows it has: pagination, virtualization, and
  having nothing to show. Covers the three pagination modes (off,
  enablePagination, manualPagination), the Footer's renderPagination slot over {
  state, actions, Controls }, getTMDataGridPaginationApi, isPagingActive versus
  canPaginate, always-on virtualization with overscan and meta.rowHeight,
  scrollToRow, the edge callbacks onScrollToBottom / onScrollToRight and why
  onReachEnd is better for loading more, the header and pinned-lane depth
  shadows, and the five empty states in precedence order with meta.loading,
  renderEmptyState, hasActiveFilters, TMDataGrid.LoadingIndicator and
  TMDataGrid.SummaryCount, and export: TMDataGrid.Menu.Export and
  Menu.ExportSelected, useTMDataGridExport, exportGrid, exportOptions, the
  csvExcel / csv / tsv / json formats, meta.exportValue and meta.enableExport.
  Load when adding a pager, tuning scrolling, scrolling to a row, deciding what
  an empty grid should say, or exporting rows to Excel or CSV.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.1.4'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/pagination.md'
  - 'Jielga/react:packages/tmdatagrid/docs/scrolling.md'
  - 'Jielga/react:packages/tmdatagrid/docs/loading-and-empty.md'
  - 'Jielga/react:packages/tmdatagrid/docs/export.md'
  - 'Jielga/react:packages/tmdatagrid/src/components/TMDataGridFooter.tsx'
  - 'Jielga/react:packages/tmdatagrid/src/core/pagination.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/export.ts'
---

# TMDataGrid - Pagination, scrolling and empty states

## Pagination

**Off by default.** The grid renders every filtered and sorted row and relies on
virtualization, which handles any row count. Paging is not needed for
performance. Three modes:

```tsx
// 1. None (default). TMDataGrid.Footer renders nothing.
const grid = useTMDataGrid({ data, columns });

// 2. Client. The table pages, the Footer renders its pager.
const grid = useTMDataGrid({ data, columns, enablePagination: true });

// 3. Manual. The server pages; manualPagination implies enablePagination.
const grid = useTMDataGrid({
  data: page.rows,
  columns,
  manualPagination: true,
  rowCount: page.total,
  state: { pagination },
  onPaginationChange: setPagination,
});
```

Initial page size is 25, through `initialState.pagination`. `enablePagination`
is defined by the grid rather than by TanStack.

The Footer renders a rows-per-page select, the range (`1–25 of 300`, from
`table.getRowCount()`) and previous and next buttons; there are no numbered page
buttons. The select offers `pageSizeOptions`, by default `[10, 25, 50, 100]`,
with the current size folded in when it is not in the list. Pass a module-scope
array: the select is memoized on it, and an inline literal remounts it on every
render.

`TMDataGrid.Footer` takes a `renderPagination` slot handed three things: the
`state` the pager shows, the `actions` it can take, and `Controls`, the built-in
pieces, already wired.

```tsx
<TMDataGrid.Footer
  renderPagination={({ state, actions, Controls }) => (
    <Group>
      <Controls.PageSize />
      <Button onClick={actions.previousPage} disabled={!state.canPreviousPage}>
        Back
      </Button>
      <Text>
        {state.pageIndex + 1} / {state.pageCount}
      </Text>
      <Controls.Pager />
    </Group>
  )}
/>
```

`Controls.PageSize`, `Controls.Range` and `Controls.Pager` are what the default
footer renders, in that order, so a custom layout can keep the parts it wants
instead of rebuilding them. They behave as in the default footer, including
greying out while paging is suspended. `Controls.PageNumber` renders
"Page 3 of 200", the label a server-paged grid usually shows in place of the
row range. It is not in the default footer; add it through the slot.

`state` carries `pageIndex`, `pageSize`, `pageCount`, `rowCount`,
`canPreviousPage`, `canNextPage`, `from`, `to` and `isPagingActive`. `actions`
carries `setPageIndex`, `setPageSize`, `previousPage`, `nextPage`, `firstPage`
and `lastPage`. Outside the Footer,
`getTMDataGridPaginationApi(table, isPagingActive(table, grid.features))`
returns the same `{ state, actions }`. Without the second argument
`state.isPagingActive` is `true`, also while the rows are grouped. `Controls`
is bound to the grid context, so those components work only inside the slot.

Grouping suspends the pager: the built-in controls grey out and the range
becomes `Grouped · all N rows`. The default footer also carries
`data-paging-suspended` on its bar and shows `labels.pagingSuspendedHint` as a
tooltip; a footer with `renderPagination` has neither. There is no option to
keep the built-in pager active while grouped. `isPagingActive(table, features)`
is the live state, whether the pager is slicing anything right now, while
`getGridCapabilities(...).canPaginate` is the configuration. The two differ
while a grouping is active.

## Scrolling

Virtualization is **always on**. There is no flag and no threshold: only the
rows within the viewport plus a small overscan are mounted.

`overscan` (default `6`) is the only setting: raise it if a fast scroll flashes
blank rows, lower it when rows are expensive. Row height comes from
`meta.rowHeight`, or from `size` when that is not set, and rows are **fixed
height**, so the virtualizer's estimate is exact and the scrollbar does not
drift. Row details are the exception: a row showing a panel is measured after it
mounts.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  overscan: 12,
  meta: { rowHeight: 64 },
});

grid.scrollToRow({ rowId: "42", align: "center" });
```

`scrollToRow` exists because the target row may not be mounted, and
`element.scrollIntoView()` cannot find an element that is not rendered. `align`
is `"start"`, `"center"`, `"end"` or `"auto"`. It answers whether the row could
be reached: `false` when it is filtered out, on another page or an id matching
no row, and a pinned row answers `true` without scrolling.

The hook reaches the virtualizer through `scrollerRef`, which
`TMDataGrid.Table` fills in. That is internal wiring, not an API - spread the
whole grid object onto `<TMDataGrid>` or nothing scrolls.

`TMDataGrid.Table` reports arrivals at each edge - `onScrollToTop`,
`onScrollToBottom`, `onScrollToLeft`, `onScrollToRight` - firing **once** on
arrival rather than on every scroll event. For loading more rows use
`onReachEnd` (the `server-side` skill) instead: it fires a number of rows before
the bottom, and latches per row count so a pending fetch is not requested twice.

Two depth cues run as scroll-driven CSS animations, with no scroll listener and
no React render. A shadow appears under the sticky header once rows scroll
beneath it. A band appears beside a pinned lane while it covers content.

## Empty states

There are five ways to have nothing to show, and an empty body shows exactly one
of them, in this order:

1. **Loading** - `meta.loading` is true: a centred loader. A grid that is
   fetching never reports itself as empty.
2. **Entry rows** - an open entry row from `edit.addRow()`: the entry block
   only, with no message beside the form.
3. **`renderEmptyState`** - your node, centred where the message would be.
4. **Filtered-empty** - a column filter is active (`isFilterActive`) or the
   quick search is not blank: `labels.noResults`, since clearing the filter
   will bring rows back.
5. **Truly-empty** - no column filter is active and the quick search is blank:
   `labels.noRows`.

"Empty" means no displayed row and no pinned row. States 4 and 5 are decided by
the filter state alone, so an empty `data` array shows `noResults` while a
filter is active. A half-typed filter, such as
`{ operator: "contains", value: "" }`, is not active, so it does not count.

The loader is the only "no data yet" signal, so set `meta.loading` during the
first fetch too; without it the empty message shows until the rows arrive.
`renderEmptyState` is called only once `meta.loading` is not `true`: during a
refetch that returns no rows the loader mounts when `loading` turns `true`,
`renderEmptyState` mounts when it turns `false`, and unmounts again on the next
refetch.

`renderEmptyState` replaces the last two with one render prop, and
`hasActiveFilters` says which it is standing in for:

```tsx
<TMDataGrid.Table<Employee>
  renderEmptyState={({ hasActiveFilters, table }) =>
    hasActiveFilters ? (
      <Button variant="light" onClick={() => table.resetColumnFilters()}>
        Clear filters
      </Button>
    ) : (
      <Button onClick={openCreateModal}>Add the first employee</Button>
    )
  }
/>
```

The body's loading state only appears while the grid is **empty**. A
server-driven grid refetching with rows still on screen keeps showing them.
`TMDataGrid.LoadingIndicator` covers that case: a small spinner while
`meta.loading` is true. `TMDataGrid.SummaryCount` shows visible rows out of
total. The total is `meta.totalRowCount` when provided, otherwise the
pre-filtered count on a client-side grid; a server-driven grid
(`manualFiltering` or `manualPagination`) without `meta.totalRowCount` shows the
visible count alone, with no total.

## Export

Every filtered and sorted row across every page, or the selected rows, as a
file. The built-in entry points are menu items; a button of your own uses the
hook.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  exportOptions: { format: csvFormat(), fileName: "employees" },
});

<TMDataGrid.Menu>
  <TMDataGrid.Menu.Export />
  <TMDataGrid.Menu.ExportSelected />
</TMDataGrid.Menu>
```

```tsx
function ExportButton() {
  const { exportAll, exportSelected, selectedCount, canExportSelected } =
    useTMDataGridExport();
  return <Button onClick={() => void exportAll()}>Export</Button>;
}
```

What is written:

- **Columns** - the data columns in render order. Never the generated lanes,
  never a column with `meta.enableExport: false`.
- **Rows** - every row after filtering and sorting. A grouped grid writes the
  records under every group, never the group rows.
- **Values** - each cell's **value** rather than what it renders.
  `meta.exportValue: ({ value, row, column }) => unknown` substitutes one.

`columns` on `exportOptions`, the items and the functions is `"visible"` (the
default), `"all"` (hidden columns too) or a list of ids. `columns="custom"` on a
menu item opens a picker instead: every exportable column, the visible ones
ticked, Export and Cancel. The picker is driven by `ui.state.exportPicker` and
`ui.actions.openExportPicker`. `TMDataGrid.Menu.ExportSelected` counts and
writes the ticked rows of the current view, in grid order; it renders nothing
when row selection is off.

Formats, each a `TMDataGridExportFormat` from a factory:

| Factory | Writes |
| --- | --- |
| `csvExcelFormat()` (default) | BOM, `sep=;` line, CRLF, `;` fields, `,` decimal - opens straight into columns in Excel. `separator`, `decimalComma` for another locale. |
| `csvFormat()` | RFC 4180: `,` fields, `.` decimal, BOM, no `sep=` line - for Google Sheets, Numbers and tooling. |
| `tsvFormat()` | Tab-separated, the clipboard shape as a file. |
| `jsonFormat()` | One object per row keyed by column label, numbers as numbers, dates as ISO strings. |
| `xlsxFormat()` | Excel workbook, from the separate `@jielga/tmdatagrid-xlsx` package. |

The text formats guard against formula injection by default: a value starting
with `=`, `+`, `-` or `@` that is not a number is prefixed with `'`.
`escapeFormulas: false` on the format turns that off.

`exportGrid({ table, rows: "all" | "selected" | rows, options })` is the same
export for code outside a component; `buildExportData` is the step before the
file. A format of your own is `{ id, extension, mimeType, write(data, { includeHeaders }) }`
returning a string, a `Blob`, or a promise of either.

Source: `packages/tmdatagrid/docs/export.md`.

## Common mistakes

### CRITICAL Turning pagination on to make a large grid fast

Virtualization is already unconditional, so paging a 200 000-row grid changes
nothing about rendering cost. It only changes how users navigate. Enable it when
they should move page by page, not for performance.

Source: `packages/tmdatagrid/docs/pagination.md`, `packages/tmdatagrid/docs/scrolling.md`.

### CRITICAL A variable row height

The virtualizer needs one number, and rows are fixed height so the scrollbar
stays accurate. Styling a taller row through CSS leaves the measurement and the
render disagreeing: rows overlap or gaps open as you scroll, and the effect
depends on scroll position, so it appears intermittent.

Wrong:

```css
[data-dg-part="row"] { height: 64px; }
```

Correct:

```tsx
useTMDataGrid({ data, columns, meta: { rowHeight: 64 } });
```

Source: `packages/tmdatagrid/docs/scrolling.md` (Row height).

### HIGH `scrollIntoView` on a row that is not mounted

Only the viewport's rows exist in the DOM, so a query for row 4 000 returns
nothing and the call silently does nothing.

Correct:

```tsx
grid.scrollToRow({ rowId: "4000", align: "center" });
```

`scrollToRow` returns `false` when the row is not in the current view (filtered
out, on another page, or an id matching no row) and nothing scrolled.

Source: `packages/tmdatagrid/docs/scrolling.md` (Scrolling to a row).

### HIGH Loading more rows from `onScrollToBottom`

It fires at the very bottom, so the user waits at the end of the list for the
fetch. `onReachEnd` fires a number of rows earlier and latches per row count, so
a pending fetch is not requested twice.

Source: `packages/tmdatagrid/docs/scrolling.md` (Edge callbacks).

### HIGH `SummaryCount` without a total under manual pagination

The client holds one page, so a server-driven grid has no total of its own.
Without `meta.totalRowCount`, `SummaryCount` shows the visible count alone, with
no total, over a table of thousands.

Correct:

```tsx
useTMDataGrid({
  data: page.rows,
  columns,
  manualPagination: true,
  rowCount: page.total,
  meta: { totalRowCount: page.total },
});
```

Source: `packages/tmdatagrid/docs/loading-and-empty.md` (Counting what is there).

### MEDIUM Rendering an empty message while data is loading

The order exists so a fetching grid never reports itself as empty. A hand-rolled
`data.length === 0 ? <Empty /> : <Grid />` outside the grid flashes "No rows to
show" on every load.

Correct:

```tsx
useTMDataGrid({ data, columns, meta: { loading: isFetching } });
```

Source: `packages/tmdatagrid/docs/loading-and-empty.md` (Precedence).

### MEDIUM Trusting the pager while grouped

`getPageCount()` still returns a number, but the pager is greyed out and the
grid is rendering the whole tree. A custom pager must read
`isPagingActive(table, features)` rather than the page count.

Source: `packages/tmdatagrid/docs/pagination.md` (Grouping).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enablePagination` | Option | `boolean` | `false` | Client-side paging and the Footer's pager. Grid-defined. |
| `manualPagination` | Table option | `boolean` | `false` | The server pages. Implies `enablePagination`. |
| `rowCount` | Table option | `number` | – | The true total, required under `manualPagination`. |
| `initialState.pagination` | Table option | `{ pageIndex, pageSize }` | `{ pageIndex: 0, pageSize: 25 }` | Where paging starts. A `data` slice, so it persists. |
| `onPaginationChange` | Table option | `OnChangeFn` | – | Controls the pagination state. |
| `TMDataGrid.Footer` | Component | `pageSizeOptions`, `renderPagination`, Mantine `BoxProps` | `pageSizeOptions`: `[10, 25, 50, 100]` | The footer bar. Renders nothing when paging is off. Style props set on the bar. |
| `TMDataGridFooterProps` | Type | – | – | The props of `TMDataGrid.Footer`. |
| `Footer` `renderPagination` | Slot | `(args: TMDataGridPaginationSlotArgs) => ReactNode` | Built-in pager | Replaces the pager, and hands over its pieces. |
| `TMDataGridPaginationSlotArgs` | Type | `TMDataGridPaginationApi & { Controls }` | – | What `renderPagination` receives: `{ state, actions, Controls }`. |
| `getTMDataGridPaginationApi` | Export | `(table, isPaging?) => TMDataGridPaginationApi` | `isPaging`: `true` | The pager API, outside the Footer. Pass `isPagingActive(table, features)` as `isPaging`. |
| `TMDataGridPaginationApi` | Type | `{ state, actions }` | – | What `getTMDataGridPaginationApi` returns. |
| `TMDataGridPaginationState` · `TMDataGridPaginationActions` · `TMDataGridPaginationControls` | Exports | types | – | The three parts of the slot argument. |
| `isPagingActive` | Export | `(table, features) => boolean` | – | Whether the pager is slicing anything right now. |
| `overscan` | Option | `number` | `6` | Rows kept mounted beyond each edge of the viewport. |
| `meta.rowHeight` | Option | `number` | `52` at the default `md` size; see the `size` scale in the `appearance` skill | Row height in pixels. The virtualizer needs a number. |
| `scrollToRow` | Hook return | `({ rowId, align? }) => boolean` | `align: "auto"` | Scrolls a row into view, mounted or not. |
| `TMDataGridScrollToRowArgs` | Export | `{ rowId, align? }` | – | What `scrollToRow` takes. |
| `onScrollToTop` · `onScrollToBottom` · `onScrollToLeft` · `onScrollToRight` | Table props | `() => void` | – | Fire once on arriving at that edge. |
| `TMDataGridScrollAlign` | Export | `"start" \| "center" \| "end" \| "auto"` | – | The `align` argument. |
| `meta.loading` | Option | `boolean` | `false` | A fetch is in flight. While `true` and the view is empty, the loader replaces every empty message and `renderEmptyState` is not called. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | The filtered-empty message, without a render prop. |
| `meta.totalRowCount` | Option | `number` | Pre-filtered count; none on a server-driven grid | The total `SummaryCount` reports. |
| `renderEmptyState` | Table prop | `({ hasActiveFilters, table }) => ReactNode` | – | Replaces both built-in empty messages. `hasActiveFilters` is `true` when a column filter is active (`isFilterActive`) or the quick search is not blank. |
| `TMDataGrid.LoadingIndicator` | Component | – | – | Spinner while `meta.loading`, for when the body has rows. |
| `TMDataGrid.SummaryCount` | Component | `children` replaces the text | – | Visible rows out of total. |
| `--dg-header-shadow-color` | CSS variable | colour | Themed | The shadow under the sticky header. |
| `--dg-sticky-edge-range` | CSS variable | length | `20px` | How far the pinned-lane band takes to fade in. |
| `exportOptions` | Option | `TMDataGridExportOptions` | `csvExcelFormat()`, `"export"`, headers on, `"visible"` columns | Format, file name and header row for every export of the grid. |
| `meta.enableExport` | Column meta | `boolean` | `true` | `false` leaves the column out of every export and of Ctrl+C. |
| `meta.exportValue` | Column meta | `TMDataGridExportValueGetter`: `({ value, row, column }) => unknown` | – | The value written in place of `row.getValue`. |
| `TMDataGrid.Menu.Export` · `TMDataGrid.Menu.ExportSelected` | Components | `TMDataGridMenuExportProps` | – | Menu items: every filtered row, and the selected rows. `columns="custom"` opens the picker. |
| `ui.state.exportPicker` | UI state | `TMDataGridExportPickerRequest \| null` | `null` | The column picker while open: `{ rows, options }`. |
| `getExportableColumns` | Export | `(table) => Array<Column>` | – | Every column an export could take, hidden ones included. The list the picker shows. |
| `useTMDataGridExport` | Hook | `(overrides?) => TMDataGridExportApi` | – | `exportAll`, `exportSelected`, `selectedCount`, `canExportSelected`. |
| `exportGrid` | Export | `(args: ExportGridArgs) => Promise<void>` | – | Downloads the grid from outside a component. `ExportGridArgs` is `{ table, rows?, options? }`. |
| `buildExportData` | Export | `(args: BuildExportDataArgs) => TMDataGridExportData` | – | The columns, labels and values a format writes. `BuildExportDataArgs` is `{ table, rows?, columns?, bounds? }`. |
| `TMDataGridExportRows` · `TMDataGridExportColumns` | Types | `"all" \| "selected" \| rows` · `"visible" \| "all" \| ReadonlyArray<string>` | `"all"` · `"visible"` | Which rows and which columns an export takes. |
| `writeExportFile` | Export | `(data, settings) => Promise<void>` | – | Writes export data in a format and downloads it. |
| `downloadFile` | Export | `({ fileName, content, mimeType }) => void` | – | Downloads a string or a `Blob`. |
| `csvExcelFormat` · `csvFormat` · `tsvFormat` · `jsonFormat` | Exports | `(options?) => TMDataGridExportFormat` | – | The built-in formats. |
| `TMDataGridCsvFormatOptions` · `TMDataGridTsvFormatOptions` · `TMDataGridJsonFormatOptions` | Types | – | – | The options of `csvExcelFormat` and `csvFormat`, of `tsvFormat`, and of `jsonFormat`. |
| `TMDataGridExportWriteOptions` | Type | `{ includeHeaders }` | – | The second argument of a format's `write`. |
| `guardFormula` · `formatExportValue` | Exports | `(text) => string` · – | – | The formula guard and the text rule, for a format of your own. |
| `resolveExportOptions` | Export | `(...overrides) => TMDataGridExportSettings` | – | The defaults with overrides folded over, `undefined` fields skipped. |
| `countSelectedExportRows` | Export | `(table) => number` | – | How many rows `"selected"` would write. |
| `DEFAULT_EXPORT_OPTIONS` | Constant | `TMDataGridExportSettings` | – | The defaults `exportOptions` merges over. |
| `TMDataGridExportSettings` | Type | `Required<TMDataGridExportOptions>` | – | Export options with every field set. |

See also: the `server-side` skill for `manualPagination` and `onReachEnd`, and
the `grouping` skill for why the pager suspends.
