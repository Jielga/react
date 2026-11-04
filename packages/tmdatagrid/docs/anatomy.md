# Grid anatomy

A grid is a tree of components inside the `TMDataGrid` wrapper. Parts are
opt-in: a grid containing only `<TMDataGrid.Table />` has no toolbar, footer or
search. Add the built-in parts you need, configure them, or add components of
your own.

`useTMDataGrid` returns the props `TMDataGrid` takes:

```tsx
const grid = useTMDataGrid({ data, columns });

<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }} size="xs">
  <TMDataGrid.Toolbar>
    <TMDataGrid.Search />
    <TMDataGrid.Spacer />
    <TMDataGrid.FilterButton />
    <TMDataGrid.Menu>
      <TMDataGrid.Menu.Columns />
    </TMDataGrid.Menu>
  </TMDataGrid.Toolbar>
  <TMDataGrid.Table />
  <TMDataGrid.Footer />
</TMDataGrid>
```

## The parts

Every component below reads the grid from context and must be rendered inside
`TMDataGrid`.

| Component                                       | What it is                                                                   | Documented on                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TMDataGrid.Table`                              | The scrollable surface: header, virtualized body, filter panel               | This page                                             |
| `TMDataGrid.Toolbar`                            | A flex row above the grid                                                    | [Toolbar](/docs/toolbar)                              |
| `TMDataGrid.Footer`                             | The pager bar below it                                                       | [Pagination](/docs/pagination)                        |
| `TMDataGrid.Search`                             | Quick search input                                                           | [Quick search](/docs/quick-search)                    |
| `TMDataGrid.FilterButton` · `.FilterPanel`      | The filter UI                                                                | [Filtering](/docs/filtering)                          |
| `TMDataGrid.FilterPills`                        | Active filters as pills. Also exported as `TMDataGridFilterPills`            | [Filtering](/docs/filtering#tmdatagridfilterpills)    |
| `TMDataGrid.Menu` · `.ColumnsPanel`             | The burger menu, and the column chooser                                      | [Grid menu](/docs/menu)                               |
| `TMDataGrid.Spacer`                             | Pushes following toolbar items right                                         | [Toolbar](/docs/toolbar)                              |
| `TMDataGrid.LoadingIndicator` · `.SummaryCount` | Fetch spinner, and the row count                                             | [Loading and empty states](/docs/loading-and-empty)   |
| `TMDataGrid.DraftActions`                        | Save and Discard for pending edits. Also exported as `TMDataGridDraftActions` | [Editing](/docs/draft-store)                |

`FilterPills` is the exception: it takes the grid as an `api` prop and can be
rendered outside `TMDataGrid`, since an active-filter strip often sits above
the grid it describes.

The parts that can be rendered outside the grid are exported under both
spellings - `TMDataGrid.FilterPills` and `TMDataGridFilterPills` are the same
component, and so are the `Search` and `DraftActions` pairs. Every other part
is reached only through the `TMDataGrid` object.

## `TMDataGrid.Table`

The scrollable surface: the header, the virtualized body and the filter panel.
Pass the row type so the handlers are typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

Its props, and those of `TMDataGrid` itself, are listed once, on
[Components and hooks](/docs/components#tmdatagridtable). This page says what
each part is and which page documents it; that page says what every prop does.

Set `aria-label` on any page holding more than one grid: it is what a screen
reader announces on entry, and what `getByRole("grid", { name })` matches.

### Which rows it renders

With pagination off (the default) rows come from
`getPrePaginatedRowModel()`: every filtered and sorted row, virtualized. With
pagination on they come from `getPaginatedRowModel()`, so a
[`manualPagination`](/docs/server-side) grid renders exactly the page the server
returned.
While a column is grouped, paging is suspended and the body holds the group rows and the leaves of open groups.
Rows [pinned](/docs/row-pinning) to an edge render in their own blocks, outside the body's list.

`getDisplayedRows(table, features)` returns the rows the body renders, in render order: the current page when paging is active, every filtered and sorted row otherwise, with pinned rows left out.
Use it for a renderer of your own, or for the rows that a cell range's `bounds` count into - see [Cell selection](/docs/cell-selection#export-the-range-from-your-own-code).
In a component, call it inside a selector with a shallow compare, so the rows follow sorting, filtering and paging:

```tsx
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";

const { table, features } = useTMDataGridContext();
const rows = useSelector(table.store, () => getDisplayedRows(table, features), {
  compare: shallow,
});
```

## What the hook returns

`useTMDataGrid` returns the table instance, the UI store, the edit engine, the
resolved labels and the feature flags, along with `resetSettings`,
`scrollToRow` and the details options it passes through to the Table. The
[complete list, with types](/docs/components#usetmdatagrid), is on Components
and hooks; the [options it takes](/docs/use-tm-data-grid) are their own page.

Read state through TanStack Store's
[`useSelector(table.store, …)`](https://tanstack.com/store/latest/docs/framework/react/reference)
rather than calling methods on `table`. The table identity is stable across
renders, so the React Compiler caches a bare method call and the component
stops updating.

## Reference

| Name                                                                                 | Kind      | Type                           | Default | What it does                                         |
| ------------------------------------------------------------------------------------ | --------- | ------------------------------ | ------- | ---------------------------------------------------- |
| `useTMDataGrid`                                                                      | Hook      | `(options) => TMDataGridApi`   | –       | Creates the grid's table, UI state and edit engine.  |
| `TMDataGrid`                                                                         | Component | –                              | –       | The root element. Provides the grid through context. |
| `TMDataGrid.Table`                                                                   | Component | –                              | –       | Header, virtualized body and filter panel.           |
| `data-testid`                                                                        | Prop      | `string`                       | –       | Names the grid for tests.                            |
| `aria-label` · `aria-labelledby`                                                     | Props     | `string`                       | –       | The grid's accessible name.                          |
| `useTMDataGridContext`                                                               | Hook      | `() => TMDataGridContextValue` | –       | The grid, from inside any child.                     |
| `getDisplayedRows`                                                                   | Export    | `(table, features) => Array<Row>` | –    | The rows the body renders: the current page when paging is active, pinned rows left out. |
| `TMDataGridApi` · `TMDataGridTable` · `TMDataGridUiStore` · `TMDataGridFeatureFlags` | Exports   | types                          | –       | The hook's result and its parts.                     |
