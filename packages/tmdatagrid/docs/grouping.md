# Grouping

Grouping collapses the rows into a tree: one row per distinct value, with the
records that share it folded underneath.

It is on by default. Nothing changes until a column is grouped, which users do
from **Group by …** in any column menu.

```tsx
const grid = useTMDataGrid({ data, columns });
```

To open already grouped, seed the state:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  initialState: { grouping: ["department"] },
});
```

```demo
file: rows/Grouping.tsx
hint: “Group by …” lives in every column menu. Group by Location as well and the tree nests.
```

## Grouping is not hierarchical data

The tree here is built from column values. It is not the same thing as data
that is already a tree, which in TanStack is `getSubRows`.

`getSubRows` is TanStack's own option and the grid passes it through: the
nested rows reach the row model, render with `data-depth`, and count in the
[summary row](/docs/summary-row) alongside their parents. What the grid does
not add is any UI for them. There is no expander control on a parent row, and
`expanded` is the state [row details](/docs/row-details) uses, so a grid with
`renderDetails` set opens a panel where you would want children. Drive the
expansion from your own control and your own `expanded` state, or flatten the
data before it reaches the grid.

## What grouping does to the grid

Grouping a column **removes it**, since its values have moved into the tree
lane, and a generated **Group** column appears at the front, pinned beside the
checkbox lane. Each group row shows its value, how many records are under it,
and a chevron. Group again from a second column's menu to nest.

Because a grouped column is no longer in the grid, **Ungroup** lives on the
tree column's menu, one item per grouped column. **Expand all groups** and
**Collapse all groups** are in every column menu while a grouping is active.

To keep a grouped column in the grid instead of removing it, pass
`groupedColumnMode: "reorder"`, which is TanStack's own default and moves
grouped columns to the front. Note that the kept column's data cells render as
TanStack's grouped-cell placeholder - blank - with the value only on group
rows, so it repeats what the tree lane already shows and cannot be typed into.
To set the grouped field on a new row, seed it through `edit.addRow(values)` -
see [Editing](/docs/adding-rows#adding-rows).

## Aggregation

Off by default. A group row leaves every cell blank except the tree lane. Give
a column an `aggregationFn` and its group cells fill in.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  aggregationFn: "sum",
  meta: { type: "number", align: "right" },
});
```

`"sum"`, `"min"`, `"max"`, `"extent"`, `"mean"`, `"median"`, `"unique"`,
`"uniqueCount"` and `"count"` are registered, as is `"auto"` - which picks
`sum` for numbers and `extent` for dates. A function is accepted too, with
TanStack's signature `(columnId, leafRows, childRows)`; `leafRows` are the
group's data rows, each record on `row.original`. Pass
`aggregatedCell` to render the group row's value differently from the data
rows.

> TanStack's grouping feature defaults every column to `aggregationFn: "auto"`.
> The grid clears that default so grouping does not silently start summing
> numeric columns. Setting `aggregationFn: "auto"` yourself restores it.

For a total across the whole grid rather than per group, give the column a
`footer` instead. See [Summary row](/docs/summary-row).

### Sorting a grouped grid

Grouping runs before sorting, so sorting sorts the rows *inside* each group and
orders the groups by their aggregated value. A column with no aggregation has
no value on a group row, so sorting on it reorders the rows within each group
but leaves the groups where they are.

## Selection

A group row's checkbox selects every record under it, at any depth, including
records inside collapsed sub-groups. It shows a tick once all of them are
selected and a dash while only some are.

Only the records are written to `rowSelection`. A group row is never in it, so
`getSelectedRowModel()` and `onRowSelectionChange` do not depend on how the tree
is arranged.

Under `enableMultiRowSelection: false` group rows carry no checkbox.

## Group rows

A group row is built on its first child's record rather than on one of its own,
so it does not fire `onRowClick`, cannot be highlighted, cannot be
[pinned](/docs/row-pinning) and has no details panel.

`rowStyle` and `rowClassName` are the exception: they are called for group rows too, with that same child's record as `original`.
Guard a callback that reads `original` with `row.getIsGrouped()`, and set `--dg-row-group-bg` to colour the group rows themselves.

`data-grouped` is present, with the value `"true"`, only on group rows, so
`[data-grouped]` and `[data-grouped="true"]` are equivalent. `data-depth`
carries the nesting level, and `--dg-row-group-bg` sets a group row's
background.

## Grouping and pagination

While a column is grouped the grid renders the whole tree and relies on
virtualization. `TMDataGrid.Footer` greys its pager out and replaces the range
with `Grouped · all N rows`. Ungroup and paging resumes where it left off.

There is no option to keep the built-in pager active while grouped, and
`manualGrouping` does not change that: the pager greys out whenever `grouping`
is non-empty. To page a grouped grid, group and page on the server with
`manualPagination` and `manualGrouping`, and render the pager through
`renderPagination`, ignoring `isPagingActive`.

`isPagingActive(table, features)` is exported, so a custom pager can grey itself
out the same way:

```tsx
<TMDataGrid.Footer
  renderPagination={({ state, actions }) => (
    <MyPager {...state} {...actions} disabled={!state.isPagingActive} />
  )}
/>
```

## Server-side grids

`manualPagination: true` turns grouping off: the client holds one page, and
grouping it would build groups out of an arbitrary slice. A grid that groups
server-side can set `enableGrouping: true` alongside `manualGrouping: true`. See
[Server-side data](/docs/server-side).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableGrouping` | Table option | `boolean` | `true`; `false` under `manualPagination` | Group by and Ungroup menu items, and the tree lane. Also a column option. |
| `groupedColumnMode` | Table option | `"reorder" \| "remove" \| false` | `"remove"` | Whether a grouped column leaves the grid or moves to the front. |
| `manualGrouping` | Table option | `boolean` | `false` | The rows arrive grouped. Required to group a server-paged grid. |
| `initialState.grouping` | Table option | `string[]` | `[]` | Column ids to group on at mount. A settings slice, so it persists. |
| `aggregationFn` | Column option | `TMDataGridAggregationName \| fn` | – | How a column fills in its group cells. Unset leaves them blank. |
| `aggregatedCell` | Column option | `(ctx) => ReactNode` | `cell` over the aggregate when `aggregationFn` is set, else blank | Renders a group row's value differently from a data row's. |
| `GROUP_COLUMN_ID` | Export | `"__group__"` | – | Id of the generated tree column. |
| `formatGroupValue` | Export | `(value, blankLabel?, { type?, options?, labels? }?) => string` | – | How the tree lane writes a group's value: `blankLabel` for an empty value, an option's label for a value with an option, `labels.booleanTrue` / `booleanFalse` for a boolean, and `toLocaleDateString()` for a `Date`. |
| `getGroupDataRows` | Export | `(row) => Row[]` | – | Every record under a group row, at any depth. |
| `isPagingActive` | Export | `(table, features) => boolean` | – | Whether the pager is slicing anything. `false` while grouped. |
| `--dg-row-group-bg` | CSS variable | colour | Themed | Group row background. |
| `data-grouped` | Data attribute | `"true"` | – | `"true"` on group rows. Absent on the rest. |
| `data-depth` | Data attribute | `number` | – | Nesting level, on every row. |
