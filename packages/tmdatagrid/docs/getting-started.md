# Getting started

A React data grid built on TanStack Table v9 and Mantine. Always virtualized,
with resizable, reorderable, sortable, filterable, hideable and pinnable
columns.

`useTMDataGrid` creates the table, `TMDataGrid` provides it through context, and
the parts you render inside read what they need from that context.

## Installation

```bash
npm install @jielga/tmdatagrid
```

Peer dependencies: `react` and `react-dom` (19.1 or later), `@mantine/core`,
`@tanstack/react-table` (v9), `@tanstack/react-store`, `@tanstack/store`,
`@tanstack/react-virtual` and `@tabler/icons-react`. Editing adds
`@tanstack/react-form`.

The grid must be rendered inside a Mantine `MantineProvider`.

```tsx
import "@jielga/tmdatagrid/styles.css";
```

Import it once. A layered stylesheet is also published; see
[Styling](/docs/styling#the-stylesheet).

> **TanStack Table v9 is still in beta.** The grid is built against
> `^9.0.0-beta.21` and uses its feature-registry API, which beta releases may
> change without a major bump. Pin `@tanstack/react-table` and
> `@tanstack/table-core` to an exact version if you need reproducible installs.

## Your first grid

```demo
file: getting-started/Minimal.tsx
extraSources: data/employees.ts
```

Rows are virtualized by default.

```tsx
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";

type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  department: string;
  salary: number;
};

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name" }),
  columnHelper.accessor("lastName", { header: "Last name" }),
  columnHelper.accessor("department", { header: "Department" }),
  columnHelper.accessor("salary", {
    header: "Salary",
    meta: { type: "number", align: "right" },
  }),
]);

export function Employees({ data }: { data: Employee[] }) {
  const grid = useTMDataGrid({
    data,
    columns,
    getRowId: (row) => String(row.id),
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
```

Define `columns` at module scope. A new array on every render rebuilds the
column model and resets the user's column widths and order.

Give the grid a bounded height: `style={{ flex: 1, minHeight: 0 }}` inside a
flex parent, or a fixed height. See [Layout](/docs/styling#layout).

## Adding a toolbar and footer

```tsx
<TMDataGrid {...grid}>
  <TMDataGrid.Toolbar>
    <TMDataGrid.SummaryCount />
    <TMDataGrid.Menu>
      <TMDataGrid.Menu.Columns />
    </TMDataGrid.Menu>
  </TMDataGrid.Toolbar>
  <TMDataGrid.Table />
  <TMDataGrid.Footer pageSizeOptions={[10, 25, 50]} />
</TMDataGrid>
```

```demo
file: getting-started/ToolbarAndFooter.tsx
```

`Toolbar` and `Footer` are ordinary composition. See
[Grid anatomy](/docs/anatomy) for what each part is, and
[Toolbar](/docs/toolbar) for adding your own buttons among them.

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
  and `minSize` defaults to `80`. See
  [Visibility, pinning, ordering and size](/docs/column-layout#sizing).
- **Defaults the grid changes** - `aggregationFn` is cleared, so grouping does
  not sum anything on its own; `groupedColumnMode` is `"remove"`;
  `autoResetExpanded` and `autoResetPageIndex` are off; `globalFilterFn` is the
  fuzzy matcher. The full list is on
  [useTMDataGrid](/docs/use-tm-data-grid#options).
- **Filters are envelopes** - `columnFilters` holds `{ operator, value }`, and
  a column's own `filterFn` receives that envelope. See
  [Filtering](/docs/filtering#custom-matching).
- **Interface the page already owns** - `enableGlobalFilter: false`, or no
  `TMDataGrid.Search`, for the search; `enableColumnFilters: false`, or
  `filters: { surface: "none" }` to keep filtering without the grid's panel.
  See [Filtering](/docs/filtering#turning-it-off).
- **Page reset** - `resetPageOnQueryChange` (default `true`) returns to the
  first page when a filter, the search, the sorting or the grouping changes
  through the table. A data source re-filtered outside table state does not
  trigger it; call `table.setPageIndex(0)` yourself, or use `manualFiltering`.
  See [Server-side data](/docs/server-side).
- **State reads** - there is no `table.getState()`; read slices with
  `useSelector(table.store, ...)`. See
  [useTMDataGrid](/docs/use-tm-data-grid#reading-state).
- **Tests** - the grid publishes `data-dg-part`, `data-row-id` and
  `data-column-id`, and no `data-testid`. See [Testing](/docs/testing).

## Where to go next

- **[Defining columns](/docs/columns)** - accessors, `meta.type`, and what each
  type configures.
- **[Grid anatomy](/docs/anatomy)** - the hook's return value, and every
  component you can render.
- **[Editing](/docs/editing)** - three modes, from single cells to a whole row.
- **[Server-side data](/docs/server-side)** - when the server does the work.
- **[The playground](/playground)** - every feature at once, behind switches.
