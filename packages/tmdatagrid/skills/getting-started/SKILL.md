---
name: getting-started
description: >
  Set up TMDataGrid, a compound React data grid built on TanStack Table v9 and
  Mantine. Covers useTMDataGrid, the TMDataGrid root, context, the component
  catalog (Table, Footer, Toolbar, Spacer, SummaryCount, Search,
  LoadingIndicator, DraftActions, FilterButton, Menu, FilterPanel, FilterPills,
  ColumnsPanel) with their props types, the size scale, the bounded-height
  layout requirement, and rendering rows without TMDataGrid.Table through
  getDisplayedRows (a card view). Load when adding a grid, choosing which parts
  to render, replacing the Table with a renderer of your own, or when rows do
  not appear.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.1.4'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/getting-started.md'
  - 'Jielga/react:packages/tmdatagrid/docs/anatomy.md'
  - 'Jielga/react:packages/tmdatagrid/docs/components.md'
  - 'Jielga/react:packages/tmdatagrid/docs/card-view.md'
  - 'Jielga/react:packages/tmdatagrid/src/components/TMDataGrid.tsx'
  - 'Jielga/react:packages/tmdatagrid/src/core/sizes.ts'
---

# TMDataGrid - Getting started

`useTMDataGrid` creates the table, `TMDataGrid` provides it through context, and
the parts rendered inside read what they need from that context. Only the parts
you render exist, and only the features you enable have state: pagination is
opt-in via `enablePagination` - by default every row renders, virtualized.

## Install

```sh
npm install @jielga/tmdatagrid
```

Peer dependencies: `react` and `react-dom` (19.1+), `@mantine/core`,
`@tanstack/react-table` (v9), `@tanstack/react-store`, `@tanstack/store`,
`@tanstack/react-virtual`, `@tabler/icons-react`.

Import both stylesheets once, Mantine's first, and render inside a
`MantineProvider`:

```ts
import "@mantine/core/styles.css";
import "@jielga/tmdatagrid/styles.css";
```

## Setup

```tsx
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";

type Employee = { id: number; firstName: string; age: number };

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", { header: "ID", meta: { type: "number" } }),
  columnHelper.accessor("firstName", { header: "First name" }),
  columnHelper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right" },
  }),
]);

export function Employees({ data }: { data: Employee[] }) {
  const grid = useTMDataGrid({
    data,
    columns,
    getRowId: (row) => String(row.id),
    enablePagination: true,
  });

  return (
    <TMDataGrid {...grid} size="md" style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}
```

Spread the hook result (`{...grid}`) rather than assigning `table`, `ui` and
`features` individually.

## Defaults

| Behaviour | Notes |
| --- | --- |
| Virtualized rows | Always enabled, not configurable. Only rows in view are mounted. |
| Resizable columns | Drag the divider on a header's trailing edge. |
| Reorderable columns | Drag a header sideways, or use the column menu. |
| Sorting | Click a header, or use the column menu. |
| Column menu | On hover: sort, filter, pin, move, hide, manage columns. |
| Filter panel | Column, operator and value rows. |
| Column manager | Search, toggle, show/hide all, reset. |
| Row selection | Checkbox column pinned to the left, or click-to-select rows with `selectionMode: "row"`. See the `rows` skill. |
| Pagination | Off by default: all rows render, virtualized. Opt in with `enablePagination: true`. |
| Sizing | `size="xs"` to `size="xl"` scales rows, type and controls. |

Each is bound to a capability check - disabling the standard table or column
option also removes its interface, and empty menus and inactive buttons are
never rendered. Column ordering (`enableColumnOrdering`) and pagination
(`enablePagination`) are the two switches the grid defines itself, because
TanStack ships state and APIs for both but no `enable` option.

## Which skill covers what

| Need to | Load |
| --- | --- |
| Define columns, size, hide, pin, reorder, sort them | `columns` |
| Filter, or add a search box | `filtering` |
| Select rows, react to clicks, colour rows, details, pin rows | `rows` |
| Move a cell cursor, select ranges, copy, export CSV | `cell-selection` |
| Make cells editable | `editing` |
| Group rows, aggregate, add a summary row | `grouping` |
| Page, tune scrolling, handle empty and loading states | `data` |
| Back the grid with a server | `server-side` |
| Configure the hook, or persist state | `options` |
| Theme, size, compose the toolbar, translate | `appearance` |
| Write tests against a grid | `testing` |
| Upgrade code written against a 2.0 beta | `migrating-to-2` |

## Layout

`TMDataGrid` renders a flex column with `overflow: hidden`. It needs a bounded
height, either `style={{ flex: 1, minHeight: 0 }}` inside a flex parent or a
fixed height. The table area then fills the remaining space.

Columns are fluid by default: each track is `minmax(minSize, flex fr)`. A column
takes a fixed pixel width once resized or pinned.

## Components

All read the grid from context and must be rendered inside `TMDataGrid`, except
`TMDataGrid.FilterPills`, which takes the grid as an `api` prop and can live
anywhere on the page. Order and presence are up to you - the root is a plain
flex column.

| Component | Props | Notes |
| --- | --- | --- |
| `TMDataGrid` | `table`, `ui`, `features`, `size`, `className`, `style` | Root. Provides context. `style` also takes CSS variables: `--dg-row-selected-bg`, `--dg-row-height`, `--dg-header-height`, `--dg-font-size`, `--dg-padding`. |
| `TMDataGrid.Table` | `onRowClick(row)`, `renderRowContextMenu`, `renderColumnMenuItems`, `rowContextMenuProps` | Header, virtualized body, and whichever filter surface the `filters` option asks for. `onRowClick` runs in addition to selection under `selectionMode: "row"`. |
| `TMDataGrid.Footer` | `pageSizeOptions` (default `[10, 25, 50, 100]`, keep the array stable), `renderPagination` slot | Rows-per-page select, range and previous/next buttons. Renders nothing unless pagination is enabled. |
| `TMDataGrid.Toolbar` | `children` | Flex row above the grid. |
| `TMDataGrid.Spacer` | - | Pushes later toolbar items right. |
| `TMDataGrid.SummaryCount` | `children` | Visible rows out of total. |
| `TMDataGrid.Search` | `placeholder`, `debounce` (default `250`), `w` (default `220`) | Quick search over every column, debounced into `globalFilter`. Renders nothing under `enableGlobalFilter: false`. Also exported as `TMDataGridSearch`. |
| `TMDataGrid.LoadingIndicator` | - | Small spinner while `meta.loading` is `true` and rows stay on screen. |
| `TMDataGrid.DraftActions` | `renderActions` | Save with the pending count, and Discard. Renders nothing while editing is off - see the `editing` skill. |
| `TMDataGrid.FilterButton` | - | Toggles the filter surface, seeding a filter row on the first filterable column. Renders nothing if no column is filterable, or under `filters.surface: "none"`. |
| `TMDataGrid.Menu` | `children`, `icon`, `label`, Mantine `MenuProps` | The burger and its dropdown: your own `Menu.Item`s, and `TMDataGrid.Menu.Columns`, the column chooser as menu items (renders nothing if no column is hideable). See the `appearance` skill. |
| `TMDataGrid.FilterPanel` | `layout` (`"row"` \| `"stacked"`, default `"row"`) | Filter rows over "Add filter" / "Clear all", as a plain block. Rendered by `.Table` inside the popup and the sidebar; place it yourself under `filters.surface: "none"`. See the `filtering` skill. |
| `TMDataGrid.ColumnsPanel` | - | The column chooser as plain controls, for a Popover or a Drawer. |
| `TMDataGrid.FilterPills` | `api`, `size` (default `"sm"`), `showClearAll` (default `true`), `onPillClick(columnId)`, `className` | One pill per active filter, ✕ to clear it. Takes the api as a prop, so it can be rendered outside the grid. Also exported as `TMDataGridFilterPills`. |

Each component's props type is exported, for wrapping a part in a component of
your own:

| Component | Props type |
| --- | --- |
| `TMDataGrid` | `TMDataGridProps<TData>`: the fields of `TMDataGridApi<TData>`, plus `children`, `size`, `className`, `style`, `id` and `data-testid` |
| `TMDataGrid.Table` | `TMDataGridTableProps<TData>` |
| `TMDataGrid.Toolbar` | `TMDataGridToolbarProps`: `children`, `withBottomBorder` (default `false`), Mantine `BoxProps` |
| `TMDataGrid.Search` · `TMDataGridSearch` | `TMDataGridSearchProps` |
| `TMDataGrid.Footer` | `TMDataGridFooterProps` |
| `TMDataGrid.Menu` | `TMDataGridMenuProps`: `children`, `icon`, `label`, Mantine `MenuProps` |
| `TMDataGrid.Menu.Columns` | `TMDataGridMenuColumnsProps`: `searchable` |
| `TMDataGrid.Menu.Export` · `.ExportSelected` | `TMDataGridMenuExportProps`: per-item `exportOptions` overrides, `columns` (which also takes `"custom"`), `label` |
| `TMDataGrid.ColumnsPanel` | `TMDataGridColumnsPanelProps`: `searchable`, Mantine `BoxProps` |
| `TMDataGrid.FilterPanel` | `TMDataGridFilterPanelProps`: `layout`, Mantine `BoxProps` |
| `TMDataGrid.FilterPills` · `TMDataGridFilterPills` | `TMDataGridFilterPillsProps<TData>` |
| `TMDataGrid.DraftActions` · `TMDataGridDraftActions` | `TMDataGridDraftActionsProps`: `renderActions` |

`renderActions` on `TMDataGrid.DraftActions` receives
`TMDataGridDraftActionsSlotArgs`, `{ state, actions, Controls }`, typed
`TMDataGridDraftActionsState`, `TMDataGridDraftActionsActions` and
`TMDataGridDraftActionsControls`. The fields are in the `editing` skill.

Pass the row type so `onRowClick` stays typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

`renderRowContextMenu` fills the dropdown of a Mantine `Menu` that the grid
opens at the pointer on a right-click (or a long press). The grid renders the
`Menu`, positions it, and closes it on Escape, an outside click, a body scroll
or an item pick, so the render prop supplies only the contents:

```tsx
<TMDataGrid.Table<Employee>
  renderRowContextMenu={({ table, row, cell, close }) => (
    <>
      <Menu.Label>{row.original.firstName}</Menu.Label>
      <Menu.Item onClick={() => open(row.original.id)}>Open</Menu.Item>
      <Menu.Item
        onClick={() =>
          navigator.clipboard.writeText(String(cell?.getValue() ?? ""))
        }
      >
        Copy cell value
      </Menu.Item>
    </>
  )}
/>
```

`cell` is the one that was right-clicked, `table` is for actions that read the
selection, and `close` is for dropdown content that is not a `Menu.Item` (those
close themselves). Return `null` to leave a row without a menu. It is called
during render, and only for the open row, so it must stay pure: put the work in
the item handlers. Right-clicking does not change the selection or the
highlight; the row carries `data-context-menu` while its menu is open. Pass
`rowContextMenuProps` for `width`, `shadow`, `position` and the rest.

`TMDataGrid.Footer` reads totals from `table.getRowCount()`, which prefers
`options.rowCount`. `TMDataGrid.SummaryCount` uses `meta.totalRowCount` when
provided, otherwise the pre-filtered row count.

The Footer's `renderPagination` slot replaces the built-in pager, and hands
over the pieces of it - `state`, `actions`, and `Controls` as the built-in
parts:

```tsx
<TMDataGrid.Footer
  renderPagination={({ state, actions, Controls }) => (
    <>
      <Controls.PageSize />
      <Pagination
        total={state.pageCount}
        value={state.pageIndex + 1}
        onChange={(page) => actions.setPageIndex(page - 1)}
      />
    </>
  )}
/>
```

`state` carries `pageIndex`, `pageSize`, `pageCount`, `rowCount`,
`canPreviousPage`, `canNextPage`, `from`, `to` and `isPagingActive`; `actions`
carries `setPageIndex`, `setPageSize`, `previousPage`, `nextPage`, `firstPage`
and `lastPage`. Outside the Footer,
`getTMDataGridPaginationApi(grid.table)` returns the same `{ state, actions }`.
See the `data` skill.

## size

Standard Mantine scale. Controls row height, header height, font size and cell
padding, and selects the size of the Mantine controls the grid renders.

| `size` | Row height | Header height | Font size | Cell padding |
| --- | --- | --- | --- | --- |
| `xs` | 34px | 32px | `xs` | 6px |
| `sm` | 42px | 38px | `sm` | 8px |
| `md` | 52px | 44px | `sm` | 10px |
| `lg` | 62px | 52px | `md` | 14px |
| `xl` | 72px | 60px | `lg` | 18px |

The virtualizer needs row height as a number, so it cannot come from CSS alone.
`SIZE_ROW_HEIGHT` is the exported source of these values and the stylesheet
mirrors them. Set `meta.rowHeight` for a height outside the scale.

## Render rows without TMDataGrid.Table

To show the rows as something other than a table - cards, a list - keep
`useTMDataGrid` and `<TMDataGrid>`, and replace `TMDataGrid.Table` with a
renderer of your own. `TMDataGrid` renders no rows itself, and every other part
works without the Table, so the toolbar stays. Search, filters, sorting, column
visibility and row selection write the same table state the grid would.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  // The popup and the sidebar belong to TMDataGrid.Table.
  filters: { surface: "none" },
});

<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
  <TMDataGrid.Toolbar>
    <TMDataGrid.Search />
    <TMDataGrid.SummaryCount />
    <TMDataGrid.Menu>
      <TMDataGrid.Menu.Columns />
    </TMDataGrid.Menu>
  </TMDataGrid.Toolbar>
  <TMDataGrid.FilterPanel layout="stacked" />
  <CardList table={grid.table} features={grid.features} />
</TMDataGrid>;
```

Read the rows with `getDisplayedRows(table, features)`: the rows the Table
would render, in render order - filtered, sorted, the current page when paging
is active, pinned rows left out. Call it inside a selector with a shallow
compare:

```tsx
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import { getDisplayedRows } from "@jielga/tmdatagrid";

const rows = useSelector(table.store, () => getDisplayedRows(table, features), {
  compare: shallow,
});
```

The table identity never changes, so the React Compiler caches a bare
`getDisplayedRows(table, features)` call and the list stops following filters
and sorting. The shallow compare re-renders the list only when the rows change.
Read `row.getVisibleCells()` the same way, inside
`useSelector(table.store, () => row.getVisibleCells())`, and skip the generated
columns with `isGeneratedColumn(cell.column.id)` - the checkbox column is among
the visible cells while row selection is on. Render each value through the
column's own renderer: `flexRender(cell.column.columnDef.cell, cell.getContext())`.

The following belong to `TMDataGrid.Table` and are not available without it:

- the header, with click-to-sort, resizing, dragging and the column menus -
  sort from a control of your own with `table.setSorting`
- the filter popup and sidebar - set `filters: { surface: "none" }` and place
  `TMDataGrid.FilterPanel` yourself
- row details, row pinning, cell selection and editing in cells
- `scrollToRow`, which returns `false` while no Table is mounted

Virtualize the list yourself, for example with `useVirtualizer` from
`@tanstack/react-virtual`.

Source: `packages/tmdatagrid/docs/card-view.md`,
`packages/tmdatagrid/docs/anatomy.md` (Which rows it renders), and the demo
`apps/docs/src/examples/demos/recipes/CardView.tsx`.

## Helpers

| Export | Description |
| --- | --- |
| `useTMDataGridContext()` | The enclosing grid context. Throws outside `TMDataGrid`. |
| `openColumnFilter(api, columnId)` | Adds an empty filter for a column and opens the panel. |
| `getColumnLabel(column)` | `meta.label`, a string header, or the column id. |
| `getColumnType(column)` | `meta.type`, defaulting to `"string"`. |
| `formatFilterLabel({ label, type, filter })` | The one-line filter description used on the pills. |
| `moveColumn({ table, columnId, targetId, side })` | Moves a column next to another. See the `columns` skill. |
| `moveColumnByStep({ table, columnId, direction })` | Moves a column one position within its region. |
| `SELECT_COLUMN_ID` | Id of the generated checkbox column. |

## Coming from TanStack Table

`useTMDataGrid` takes TanStack's `TableOptions`, so a page built on
`useReactTable` keeps its `data`, `columns`, `state` and `onXChange` callbacks.
Go through these differences:

- **`getRowId`** - return the entity id. The index default points at another
  record after a sort or a refetch, which breaks selection, expansion and
  editing. Required once `editing` is set.
- **Stable `data` and `columns`** - define `columns` outside the component and
  keep `data` referentially stable; a fresh `[]` for the empty case belongs in
  a module-scope constant. Under `editing`, a transient `[]` drops every open
  draft.
- **Sizing** - columns are fluid, `minmax(minSize, flex fr)`. `size` applies
  only to a column pinned at mount, `maxSize` only to resizing and autosizing,
  and `minSize` defaults to `80`. See the `columns` skill.
- **Defaults the grid changes** - `aggregationFn` is cleared, so grouping does
  not sum anything on its own; `groupedColumnMode` is `"remove"`;
  `autoResetExpanded` and `autoResetPageIndex` are off; `globalFilterFn` is the
  fuzzy matcher. The full list is in the
  `options` skill.
- **Filters are envelopes** - `columnFilters` holds `{ operator, value }`, and
  a column's own `filterFn` receives that envelope. See the `filtering` skill.
- **Interface the page already owns** - `enableGlobalFilter: false`, or no
  `TMDataGrid.Search`, for the search; `enableColumnFilters: false`, or
  `filters: { surface: "none" }` to keep filtering without the grid's panel.
- **Page reset** - `resetPageOnQueryChange` (default `true`) returns to the
  first page when a filter, the search, the sorting or the grouping changes
  through the table. A data source re-filtered outside table state does not
  trigger it; call `table.setPageIndex(0)` yourself, or use `manualFiltering`.
- **State reads** - there is no `table.getState()`; read slices with
  `useSelector(table.store, ...)`. See the `options` skill.
- **Tests** - the grid publishes `data-dg-part`, `data-row-id` and
  `data-column-id`, and no `data-testid`. See the `testing` skill.

## Common mistakes

### Columns or data defined during render

A new array on every render rebuilds the table's column model. Define `columns`
at module scope; keep `data` stable with `useMemo`.

```tsx
// Wrong - rebuilds the column model every render.
export function Employees({ data }: { data: Employee[] }) {
  const columns = columnHelper.columns([...]);
  const grid = useTMDataGrid({ data, columns });
}
```

### Root with no bounded height

The root is `overflow: hidden`. Without `flex: 1; minHeight: 0` in a flex parent
or an explicit height, the table area collapses and no rows are visible - there
is no error.

### Assigning the hook result field by field

`<TMDataGrid table={grid.table}>` omits `ui` and `features`. Panels stop opening
and feature toggles stop being reactive. Spread instead: `<TMDataGrid {...grid}>`.

### Expecting Footer to enable pagination

Rendering `TMDataGrid.Footer` does not switch pagination on - the option does.
With pagination off (the default) the Footer renders nothing and every row is
rendered, virtualized. Set `enablePagination: true` (or `manualPagination:
true` for server paging) to page the data and show the pager.
