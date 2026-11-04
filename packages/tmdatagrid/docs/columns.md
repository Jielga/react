# Defining columns

A column declares where its value comes from, what kind of value it is, and how
to render it. Which filter operators it offers, which editor it opens and how
it sorts all follow from `meta.type`.

## The column helper

`createTMDataGridColumnHelper<TData>()` returns a TanStack column helper bound
to the grid's feature set, so that `meta` and `filterFn` are correctly typed.
The `meta.options` and `meta.edit.enabled` callbacks receive rows typed as
`TData`, so `row.original` needs no cast.

```tsx
const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => formatSek(info.getValue()),
  }),
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "fullName",
    header: "Full name",
    meta: { label: "Full name" },
  }),
]);
```

**Define columns at module scope.** A new array on every render rebuilds the
table's column model and discards the user's column widths and order.

```demo
file: getting-started/ColumnDefinitions.tsx
```

An accessor may be a key of the row or a function over it. A function needs an
explicit `id`, and a `meta.label` for the name shown in menus and the columns
panel.

A dotted `accessorKey` reads a nested field, and the column id it derives
replaces the dots: `accessorKey: "address.city"` makes column id
`address_city`, while the edit path stays `"address.city"`. Anything that
addresses the column by id - `initialState`, `editing.columns`, `moveColumn`,
a test selector - takes the underscore form; the dotted form silently matches
nothing.

Each column the helper returns also carries, in its type only, its id,
`meta.type`, value type, `meta.filter.operators`, and its `enableColumnFilter`,
`enableSorting` and `meta.filter.url` switches.
[Typed links](/docs/persistence#typed-links) read them, so a link into the grid
can name only the filters and sorts its columns offer.
Only literal values count: `enableSorting: isAdmin` reads as not sortable.

### Columns derived from the other rows

`accessorFn` is handed one row, so a value that depends on the rest - a share
of a total, a rank, a running total - cannot be an accessor. Derive the
collection once and hand the grid the finished shape; the column is then a
plain `accessorKey`:

```tsx
const rows = useMemo(() => {
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);

  return holdings.map((holding) => ({
    ...holding,
    pctOfTotal: (holding.value / total) * 100,
  }));
}, [holdings]);

columnHelper.accessor("pctOfTotal", {
  header: "Share",
  meta: { type: "number", align: "right" },
  cell: (info) => `${info.getValue().toFixed(1)}%`,
});
```

[A portfolio rebalancer](/docs/portfolio-rebalancer) works one through, from
the derived rows to a validator that reads them all.

## meta

`meta` carries what a TanStack column definition has no field for. What the
column is sits at the top level; what the filter panel and the edit engine do
with it sits in the `filter` and `edit` namespaces.
Its type is `TMDataGridColumnMeta`.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | String header, or column id | Name used in menus and the column manager. Required when `header` is a component. |
| `type` | `"string" \| "number" \| "boolean" \| "date" \| "select" \| "multiSelect"` | `"string"` | What the values are. Selects the filter operators, the filter control and the cell editor. |
| `options` | `TMDataGridOptionsSource` | - | The choices of a `select` / `multiSelect` column. See [Options](#options). |
| `flex` | `number` | `1` | Share of the remaining width. |
| `align` | `"left" \| "right" \| "center"` | `"left"` | Alignment, applied to both header and cells. |
| `colSpan` | `number \| ({ row, table }) => number` | `1` | Columns the cell covers on a row, counting itself. See [Spanning columns](#spanning-columns). |
| `autoSize` | `boolean` | `false` | Fit the column to its content once, on the render its first cells appear in. |
| `enableOrdering` | `boolean` | `true` | `false` keeps the column where it is. |
| `filter` | `TMDataGridColumnFilterOptions` | - | How this column filters. See [meta.filter](#metafilter). |
| `edit` | `TMDataGridColumnEditOptions` | - | How this column is edited. See [meta.edit](#metaedit). |

### meta.filter

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultOperator` | `TMDataGridFilterOperator` | The type's default | The operator a fresh filter starts with. See [Filtering](/docs/filtering#operators). |
| `control` | `TMDataGridFilterControlComponent` | By type and operator | Replaces the filter panel's value control. See [Filtering](/docs/filtering#replacing-the-value-control). |
| `url` | `boolean` | `true` | Keeps the column's filter out of a `persist.urlKey` link when `false`. See [Deep links](/docs/persistence#deep-links). |

```tsx
meta: {
  type: "number",
  filter: { defaultOperator: "between", control: DgRangeSliderFilter },
}
```

### meta.edit

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean \| (row) => boolean` | `true` | Whether cells in this column may be edited. See [Editing](/docs/editing#which-cells-edit). |
| `field` | `string` | The `accessorKey` | The data path an edit writes to, for a column built on `accessorFn`. |
| `editor` | `TMDataGridEditorComponent` | By `type` | Replaces the cell editor. See [Editors](/docs/editors#writing-your-own). |
| `validate` | `TMDataGridFieldValidate` | - | Per-cell validation. See [Validation](/docs/editors#validation). |
| `mapValue` | `TMDataGridEditValueMap` | - | Maps each value an editor writes. See [Mapping the value](/docs/editors#mapping-the-value-as-it-is-typed). |
| `mapCommitValue` | `TMDataGridEditCommitMap` | - | Maps each changed field once, as its row commits. See [Mapping the value at commit](/docs/editors#mapping-the-value-at-commit). |

```tsx
meta: {
  type: "string",
  edit: {
    enabled: (row) => row.original.status !== "Terminated",
    validate: z.string().min(2, "At least two characters"),
    mapValue: ({ value }) =>
      typeof value === "string" ? value.toUpperCase() : value,
  },
}
```

Omit both namespaces to get the defaults: any column mapping to a data path is
editable once `editing` is set, and every column filters by its type.

## Column types

`meta.type` declares what a column's values are. The filter panel offers that
type's operators and renders a matching value control: a date input for `date`,
a Yes/No dropdown for `boolean`, a multi-select of the column's options for
`select` and `multiSelect`. With editing on, the same declaration picks the
editor.

Dates may be `Date` instances or ISO `YYYY-MM-DD` strings in the data; the
comparison is by calendar day either way, and filter values always travel as ISO
strings. The date control is the native `<input type="date">`; `@mantine/dates`
is not used.

A column whose value is none of the six types - an object such as a
`{ from, to }` range - renders through its own `cell`, but sorting, the filter
panel and quick search operate on the raw value. Set `enableSorting`,
`enableColumnFilter` and `enableGlobalFilter` to `false` on such a column.

### Options

`select` and `multiSelect` columns declare their choices once, in `meta.options`,
and every consumer of them (the filter panel, the cell editor) reads the same
source:

```tsx
// A fixed set, strings or full options:
meta: {
  type: "select",
  options: [
    "Pending",
    { value: "Paid", label: "Paid in full", color: "green" },
  ],
}

// The distinct values present in the data (low-cardinality columns):
meta: { type: "select", options: "faceted" }

// Computed. `row` is set when a cell editor asks and absent for the filter
// panel, so row-dependent options can branch on it:
meta: {
  type: "select",
  options: ({ row }) => (row ? citiesFor(row.original.country) : allCities),
}
```

`resolveColumnOptions({ table, column, row? })` normalises all three forms and is
exported for custom controls; `optionsToComboboxData` turns the result into what
Mantine's `Select` and `MultiSelect` take, `group` fields included.

A select column that declares no options still filters: the panel falls back to
the faceted values. Mantine's dropdowns are not virtualized, so use the function
form for very large sets.

## Spanning columns

`meta.colSpan` makes a column's cell cover the columns to its right.
A cell spanning `n` is one cell `n` columns wide, with one background and one
border, and the `n - 1` cells it covers do not render on that row.
A function decides per row:

```tsx
columnHelper.accessor("name", {
  header: "Name",
  meta: {
    colSpan: ({ row }) => (row.getIsExpanded() ? Infinity : 1),
  },
});
```

```demo
file: columns/SpanningCells.tsx
hint: Open a row with its chevron - its name takes the rest of the row, and the panel opens below.
```

- The span is counted over the displayed columns. Hiding or moving a column
  changes what a span covers, so `Infinity` - "to the last of my columns" - is
  usually safer than a count.
- A span stops at the last of your columns. It never covers the checkbox,
  tree, details or edit lane.
- A span stops at the edge of its pinned block.
- A column covered by a span ignores its own `colSpan` on that row.
- Group rows ignore `colSpan`, and so does a row open in
  [row edit mode](/docs/editing), where every column holds an editor.
- Sorting, filtering, copy and export still see every column. Autosize leaves
  a spanning cell out of its column's measurement, and a column whose every
  mounted cell spans fits its header.
- Under [cell selection](/docs/cell-selection) the spanning cell is one cell:
  the arrow keys step over it, and a move onto a column it covers lands on it.
  It is addressed by its first column: a range holds it when it holds that
  column, and a range over only the columns it covers leaves it out. Copy and
  export take every column of the range either way. When the column the focus
  is on becomes covered, the focus moves to the spanning cell.
- Under [cell editing](/docs/editing) a covered column has no cell to open,
  and Tab from the spanning cell's editor moves past the columns it covers.
  A row keeps its cells while an editor is open in a column a span would
  cover, and the span lands when the edit ends.

A cell renderer that reads `row.getIsExpanded()`, as the demo's does, has to
subscribe to the store - see
[Opening a row from elsewhere](/docs/row-details#opening-a-row-from-elsewhere).

The cell carries `aria-colspan` and `data-col-span` with the number of columns
it covers.

## Header groups

`columnHelper.group` nests columns under a shared header. The group is a header
row, not a column - the leaves keep all the behaviour. `columns` takes another
`columnHelper.columns` call, not a bare array:

```tsx
columnHelper.group({
  id: "person",
  header: "Person",
  columns: columnHelper.columns([
    columnHelper.accessor("firstName", { header: "First" }),
    columnHelper.accessor("lastName", { header: "Last" }),
  ]),
});
```

```demo
file: getting-started/HeaderGroups.tsx
hint: Sort, filter and resize the leaves; the group header follows them.
```

Columns inside a group cannot be reordered, regardless of `meta.enableOrdering`:
`columnOrder` sequences leaf columns, so moving one would leave the group header
spanning columns that no longer belong to it.

## Per-column feature switches

Standard TanStack column options. Each removes the corresponding interface for
that column alone.

| Option | Effect when `false` |
| --- | --- |
| `enableSorting` | No sort indicator and no sort menu items. See [Sorting](/docs/sorting). |
| `enableColumnFilter` | No filter menu item, and no entry in the panel's column list. |
| `enableHiding` | No hide menu item, and no checkbox in the column manager. |
| `enablePinning` | No pin menu items. |
| `enableResizing` | The divider stays as a separator but cannot be dragged. |
| `meta.enableOrdering` | No header dragging and no move menu items. |

Sizing, pinning, ordering and visibility are covered on
[Visibility, pinning, ordering and size](/docs/column-layout).

## The generated columns

Five lanes the grid adds when a feature needs them. All are **system lanes**:
pinned, with no column menu, never exported and never listed in the columns
panel. Four of them are fixed width with no resize handle; the tree lane can be
resized, and it is shown only while a grouping is active.

| Id | Appears when | Where |
| --- | --- | --- |
| `ROW_NUMBER_COLUMN_ID` | `enableRowNumbers` | Outermost left, before everything. See [Row pinning and numbering](/docs/row-pinning#numbering-rows). |
| `SELECT_COLUMN_ID` | A checkbox selection mode | First, pinned left. See [Row selection](/docs/row-selection). |
| `GROUP_COLUMN_ID` | A column is grouped | Front, beside the checkbox lane. See [Grouping](/docs/grouping). |
| `DETAILS_COLUMN_ID` | `renderDetails` is set | Left, after checkbox and tree. See [Row details](/docs/row-details). |
| `EDIT_COLUMN_ID` | `editing.mode: "row"`, `editing.draft`, or `editing.onRowDelete` | Appended, pinned right, and stays outside anything the user pins right. See [Editing](/docs/editing). |

The checkbox lane cannot be moved: it anchors the left pinned region, and no
column can be placed in front of it.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `createTMDataGridColumnHelper` | Export | `<TData>() => TMDataGridColumnHelper<TData>` | – | A TanStack column helper typed against the grid's features, with `meta` callbacks typed against `TData`. |
| `TMDataGridColumnHelper` | Type | – | – | The helper's type. |
| `TMDataGridColumnMeta` | Type | – | – | The type of `meta`. Typed against the row when the column is declared with `createTMDataGridColumnHelper`. |
| `TMDataGridRowData` | Type | `Record<string, unknown>` | – | The row type where none is given: the default `TData` of the column meta types, and the rows `useTMDataGridContext` returns. |
| `meta.label` | Column meta | `string` | Header or id | Name in menus and the columns panel. |
| `meta.type` | Column meta | six types | `"string"` | What the values are; drives filters and editors. |
| `TMDataGridColumnType` | Type | – | – | The six values of `meta.type`. |
| `meta.options` | Column meta | array \| `"faceted"` \| `(args) => …` | – | The choices of an option column. |
| `TMDataGridOptionsArgs` | Type | – | – | What a `meta.options` function receives: `{ table, column, row? }`. `row` is absent when the filter panel asks. |
| `meta.align` | Column meta | `"left" \| "right" \| "center"` | `"left"` | Header and cell alignment. |
| `meta.colSpan` | Column meta | `number \| (args) => number` | `1` | Columns the cell covers on a row. See [Spanning columns](#spanning-columns). |
| `TMDataGridColSpanArgs` | Type | `{ row, table }` | – | What a `meta.colSpan` function receives. |
| `meta.filter` | Column meta | `TMDataGridColumnFilterOptions` | – | How the column filters: `operators`, `defaultOperator`, `control`, `url`. |
| `meta.edit` | Column meta | `TMDataGridColumnEditOptions` | – | How the column edits: `enabled`, `field`, `editor`, `validate`, `mapValue`. |
| `resolveColumnOptions` | Export | `({ table, column, row? }) => options` | – | Normalises all three `meta.options` forms. |
| `optionsToComboboxData` | Export | `(options) => ComboboxData` | – | Options as Mantine `Select` data. |
| `getColumnLabel` · `getColumnType` | Exports | `(column) => …` | – | How the built-in controls read a column. |
| `isControlColumn` | Export | `(columnId) => boolean` | – | Whether a column id is one of the generated control lanes: checkbox, details, edit or row number. |
| `isGeneratedColumn` | Export | `(columnId) => boolean` | – | Whether the grid generated the column - the four control lanes plus the tree column. |
| `SELECT_COLUMN_ID` · `GROUP_COLUMN_ID` · `DETAILS_COLUMN_ID` · `EDIT_COLUMN_ID` · `ROW_NUMBER_COLUMN_ID` | Exports | `string` | – | Ids of the five generated lanes. |
