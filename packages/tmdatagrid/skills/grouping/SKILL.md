---
name: grouping
description: >
  Group TMDataGrid rows into a tree, and total them. Covers enableGrouping,
  initialState.grouping, the generated GROUP_COLUMN_ID tree lane, why a grouped
  column leaves the grid and how groupedColumnMode keeps it, aggregationFn and
  aggregatedCell with the registered names (sum, mean, count, uniqueCount,
  extent, …), why the grid clears TanStack's "auto" default, group-row
  selection, why group rows are not data rows, why grouping suspends the pager
  and isPagingActive, manualGrouping for server-side trees, and the summary row
  through a column footer with aggregateColumn. Load when grouping rows,
  aggregating a column, adding totals along the bottom edge, or when the pager
  greys out.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.4.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/grouping.md'
  - 'Jielga/react:packages/tmdatagrid/docs/summary-row.md'
  - 'Jielga/react:packages/tmdatagrid/src/core/grouping.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/summary.ts'
---

# TMDataGrid - Grouping and totals

Two independent things: grouping folds the rows into a tree and totals each
category, and the summary row totals everything along the bottom edge.

## Grouping

On by default, and nothing changes until a column is grouped, which users do
from **Group by …** in any column menu. To open already grouped, seed the
state:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  initialState: { grouping: ["department"] },
});
```

Grouping a column **removes it**, since its values have moved into the tree
lane, and a generated Group column (`GROUP_COLUMN_ID`) appears at the front, pinned
beside the checkbox lane. Each group row shows its value, its record count and a
chevron. Grouping a second column nests.

Because a grouped column is no longer in the grid, **Ungroup** lives on the tree
column's menu, one item per grouped column. `groupedColumnMode: "reorder"`
(TanStack's own default) keeps grouped columns in the grid, moved to the front,
instead of removing them.

## Aggregation

Off by default. A group row leaves every cell blank except the tree lane. Give a
column an `aggregationFn` and its group cells fill in.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  aggregationFn: "sum",
  aggregatedCell: (info) => <strong>{sek(Number(info.getValue()))}</strong>,
  meta: { type: "number", align: "right" },
});
```

`"sum"`, `"min"`, `"max"`, `"extent"`, `"mean"`, `"median"`, `"unique"`,
`"uniqueCount"`, `"count"` and `"auto"` are registered, and a function is
accepted too.

TanStack's grouping feature defaults every column to `aggregationFn: "auto"`.
**The grid clears that default**, so grouping does not silently start summing
numeric columns. Setting `"auto"` yourself restores it.

Grouping runs before sorting, so sorting sorts the rows *inside* each group and
orders the groups by their aggregated value. A column with no aggregation has no
value on a group row, so sorting on it reorders rows within each group and
leaves the groups where they are.

## Group rows are not data rows

A group row is built on its first child's record, so passing it to a callback
would pass a row that looks real but is the wrong one. Group rows therefore:

- do not fire `onRowClick` or the cell handlers
- cannot be highlighted, pinned, or given a details panel
- never edit
- are still handed to `rowStyle` and `rowClassName`, with that child's record
  as `original`, so guard a callback reading `original` with
  `row.getIsGrouped()` and colour the group rows with `--dg-row-group-bg`
- carry `data-grouped="true"` and `data-depth`, with `--dg-row-group-bg`
  behind them. `data-grouped` is present only on group rows, so
  `[data-grouped]` and `[data-grouped="true"]` are equivalent

A group row's checkbox selects every record under it at any depth, including
records inside collapsed sub-groups, showing a tick once all are selected and a
dash while only some are. Only the records reach `rowSelection`; a group row is
never in it, so `getSelectedRowModel()` and `onRowSelectionChange` do not depend
on how the tree is arranged. Under `enableMultiRowSelection: false` group rows carry
no checkbox.

`getGroupDataRows(row)` returns every record under a group row, at any depth.

## Grouping suspends pagination

**Grouping and the built-in pager do not work together, and grouping wins.** As
soon as a column is grouped the grid renders the whole tree and relies on
virtualization. `TMDataGrid.Footer` greys its pager out and replaces the range
with `Grouped · all N rows`. Ungroup and paging resumes where it left off.

This is deliberate. A page can only count one kind of thing, and once the rows
are a tree neither option works: counting every row splits a group across a page
boundary, and counting top-level rows redefines "rows per page" as groups per
page. Rendering the whole tree is the grid's default mode in any case, so only
the pager is lost.

`isPagingActive(table, features)` is exported so a custom pager can grey itself
out the same way. There is no option to keep the built-in pager active while
grouped, and `manualGrouping` does not change that: the pager greys out whenever
`grouping` is non-empty. To have both, page on the server with
`manualPagination` and `manualGrouping`, and render the pager through the
Footer's `renderPagination` slot, ignoring `isPagingActive`.

## The summary row

There is no flag. Give a column a `footer` and the row appears. It exists
whenever at least one visible column defines one.

```tsx
import { aggregateColumn } from "@jielga/tmdatagrid";

columnHelper.accessor("salary", {
  header: "Salary",
  footer: ({ table }) =>
    sek(Number(aggregateColumn({ table, columnId: "salary" }))),
});
```

`footer` is TanStack's own column option, rendered the way the header is.
`aggregateColumn({ table, columnId, fn })` computes over every **filtered** row,
all pages, following the filters live, through the registered aggregation
functions, with `fn` defaulting to `"sum"`.

```tsx
aggregateColumn({ table, columnId: "age", fn: "mean" });
aggregateColumn({ table, columnId: "location", fn: "uniqueCount" });
```

It follows the filters deliberately. A total that does not change as the user
narrows the grid is misleading. Its only argument is `table`, so a toolbar
readout or any other component holding the table reads the same total without a
`footer`.

Pinned columns keep their lanes in the summary row, the generated lanes define
no `footer` so their cells stay blank, and the row is sticky at
`--dg-summary-height`.

## Common mistakes

### CRITICAL Expecting group rows to total automatically

Grouping alone leaves every cell blank on a group row, because the grid clears
TanStack's `aggregationFn: "auto"` default. Nothing errors; the tree just looks
empty.

Wrong:

```tsx
columnHelper.accessor("salary", { header: "Salary" });
```

Correct:

```tsx
columnHelper.accessor("salary", { header: "Salary", aggregationFn: "sum" });
```

Source: `packages/tmdatagrid/docs/grouping.md` (Aggregation).

### HIGH Looking for the grouped column in the grid

`groupedColumnMode` defaults to `"remove"`, so grouping by Department takes the
Department column out, since its values are in the tree lane. Code that reads
that column's cells, or a test that queries its header, stops finding it as soon
as a user groups.

Correct, when the column must stay:

```tsx
useTMDataGrid({ data, columns, groupedColumnMode: "reorder" });
```

Source: `packages/tmdatagrid/docs/grouping.md` (What grouping does to the grid).

### HIGH Combining the pager with grouping

`enablePagination: true` and a grouped column cannot both apply. The pager greys
out instead of paging the tree, so a footer count wired to `getPageCount()`
reports a number nobody can navigate to. Read
`isPagingActive(table, features)` before trusting the pager state.

Source: `packages/tmdatagrid/docs/grouping.md` (Grouping and pagination).

### HIGH Handing a group row to a row callback

Group rows do not fire `onRowClick` or the cell handlers, and cannot be pinned,
expanded or edited. Their `row.original` is an arbitrary child's record, so a
bulk action built from `row.original` on the tree lane acts on one record
instead of the group. `rowStyle` and `rowClassName` are the callbacks group
rows do reach, so one reading `row.original` colours the group by whichever
child came first.

Correct:

```tsx
import { getGroupDataRows } from "@jielga/tmdatagrid";

const records = getGroupDataRows(groupRow).map((row) => row.original);

<TMDataGrid.Table<Employee>
  rowStyle={(row) =>
    !row.getIsGrouped() && row.original.status === "Terminated"
      ? { "--row-bg": "color-mix(in srgb, var(--mantine-color-red-6) 12%, transparent)" }
      : undefined
  }
/>;
```

Source: `packages/tmdatagrid/docs/grouping.md` (Group rows).

### MEDIUM Totalling the page instead of the data

`aggregateColumn` deliberately runs over every filtered row, all pages. Summing
`table.getRowModel().rows` instead totals only what is currently paged in, and
under virtualization not even that: only the mounted rows.

Source: `packages/tmdatagrid/docs/summary-row.md` (Totalling a column).

### MEDIUM Grouping a server-paged grid

`manualPagination: true` turns grouping off, because the client holds one page
and would build groups out of an arbitrary slice. Group on the server and
declare it.

Correct:

```tsx
useTMDataGrid({
  data: page.rows,
  columns,
  manualPagination: true,
  manualGrouping: true,
  enableGrouping: true,
});
```

The built-in pager still greys out while `grouping` is set, so such a grid
renders its pager through `TMDataGrid.Footer`'s `renderPagination` slot and
ignores `state.isPagingActive`.

Source: `packages/tmdatagrid/docs/grouping.md` (Server-side grids).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableGrouping` | Table option | `boolean` | `true`; `false` under `manualPagination` | Group by and Ungroup menu items, and the tree lane. Also a column option. |
| `groupedColumnMode` | Table option | `"reorder" \| "remove" \| false` | `"remove"` | Whether a grouped column leaves the grid or moves to the front. |
| `manualGrouping` | Table option | `boolean` | `false` | The rows arrive grouped. Required to group a server-paged grid. |
| `initialState.grouping` | Table option | `string[]` | `[]` | Column ids grouped at mount. A settings slice, so it persists. |
| `aggregationFn` | Column option | `TMDataGridAggregationName \| fn` | – | How a column fills in its group cells. Unset leaves them blank. |
| `aggregatedCell` | Column option | `(ctx) => ReactNode` | `cell` over the aggregate when `aggregationFn` is set, else blank | Renders a group row's value differently from a data row's. |
| `footer` | Column option | `(ctx) => ReactNode` | – | Renders this column's summary cell. Defining one adds the row. |
| `aggregateColumn` | Export | `({ table, columnId, fn }) => unknown` | `fn: "sum"` | Aggregates over every filtered row, all pages. |
| `TMDataGridAggregationName` | Export | type | – | The registered function names. |
| `GROUP_COLUMN_ID` | Export | `"__group__"` | – | Id of the generated tree column. |
| `formatGroupValue` | Export | `(value, blankLabel?, { type?, options?, labels? }?) => string` | – | How the tree lane writes a group's value: `blankLabel` for an empty value, an option's label for a value with an option, `labels.booleanTrue` / `booleanFalse` for a boolean, and `toLocaleDateString()` for a `Date`. |
| `getGroupDataRows` | Export | `(row) => Row[]` | – | Every record under a group row, at any depth. |
| `isPagingActive` | Export | `(table, features) => boolean` | – | Whether the pager is slicing anything. `false` while grouped. |
| `--dg-row-group-bg` | CSS variable | colour | Themed | Group row background. |
| `--dg-summary-height` | CSS variable | length | From `size` | Height of the summary row. |
| `data-grouped` · `data-depth` | Data attributes | – | – | `"true"` on group rows (absent on the rest), and the nesting level on every row. |

See also: the `rows` skill for selection and the details lane, and the `data`
skill for the pager grouping suspends.
