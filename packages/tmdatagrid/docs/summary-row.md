# Summary row

A sticky row along the bottom edge holding totals for the whole grid: a count,
a sum, or any other single number per column. It is independent of
[grouping](/docs/grouping), which totals each category instead of everything.

There is no flag. Give a column a `footer` and the row appears. The row exists
whenever at least one visible column defines one.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  footer: ({ table }) =>
    sek(Number(aggregateColumn({ table, columnId: "salary" }))),
});
```

```demo
file: rows/SummaryRow.tsx
```

`footer` is TanStack's own column option, rendered the way the header is: each
cell renders that column's renderer with the header context. It can render
anything: a static label, a count, or its own calculation.

## Totalling a column

`aggregateColumn({ table, columnId, fn })` computes over every **filtered** row
(all pages, following the filters live) through the registered aggregation
functions. `fn` defaults to `"sum"`.

Every data row counts once.
Grouping builds its group rows from this model rather than into it, so a grouped grid totals its records and not its records plus their subtotals.
A tree built with `getSubRows` counts parents and children alike.

It totals `data`, so under [`editing.draft`](/docs/editing) a committed edit is not in the total until `edit.saveDrafts()` sends it and the new `data` arrives.
An edited cell shows its draft and the summary row does not follow it.
The same holds for a group row's `aggregatedCell`: no group row has a form, so aggregates read the committed values throughout.

```tsx
aggregateColumn({ table, columnId: "salary" });                 // sum
aggregateColumn({ table, columnId: "age", fn: "mean" });        // average
aggregateColumn({ table, columnId: "location", fn: "uniqueCount" });
```

It takes `table`, so the same total can be read anywhere the table is in
reach - a toolbar readout as much as a `footer`:

```tsx
const { table } = useTMDataGrid({ data, columns });

<TMDataGrid.Toolbar>
  <Text size="xs">
    Payroll {sek(Number(aggregateColumn({ table, columnId: "salary" })))}
  </Text>
</TMDataGrid.Toolbar>;
```

## Layout

Pinned columns keep their lanes in the summary row, and the row sits under the
pinned-lane gradients in the stacking order. The generated lanes - checkbox,
tree, details, row numbers - define no `footer`, so their summary cells stay
blank.

The row is sticky, so it stays put while the body scrolls, and its height is
`--dg-summary-height`.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `footer` | Column option | `(ctx) => ReactNode` | – | Renders this column's summary cell. Defining one on any column adds the row. |
| `aggregateColumn` | Export | `({ table, columnId, fn }) => unknown` | `fn: "sum"` | Aggregates a column over every filtered row, all pages. |
| `TMDataGridAggregationName` | Export | type | – | The registered function names - `sum`, `mean`, `count`, `uniqueCount`, … |
| `--dg-summary-height` | CSS variable | length | From `size` | Height of the summary row. |
