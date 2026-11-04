# A portfolio rebalancer

A holdings book where one column is a decision and the rest are consequences.
The user edits **Target**; the grid recomputes drift and the trade to place, totals each sector, and refuses an edit that would allocate more than the whole book.

```demo
file: recipes/PortfolioRebalancer.tsx
hint: Type 40 into a Target cell - the commit is refused with the total it would have produced.
height: 620
```

## Deriving the rows

`accessorFn` is handed one row, so a column whose value depends on the other rows - a weight as a share of the portfolio - cannot be written as one.
Derive the whole collection once and hand the grid the finished shape:

```tsx
const positions = useMemo(() => {
  const valued = holdings.map((h) => ({ ...h, marketValue: h.price * h.shares }));
  const total = valued.reduce((sum, h) => sum + h.marketValue, 0);

  return valued.map((h) => ({
    ...h,
    currentPct: (h.marketValue / total) * 100,
    drift: h.targetPct - (h.marketValue / total) * 100,
  }));
}, [holdings]);
```

`editing.onCommit` writes back to `holdings`, the source array, and the derived rows arrive through `data` on the next render.
Under `editing.mode: "cell"` with no draft store, every dependent column follows the keystroke that committed.

## Gating the one editable column

`editing.columns` lists what takes edits. Everything else is market data and stays read-only whatever its own meta says.

```tsx
editing: {
  mode: "cell",
  columns: ["targetPct"],
  onCommit: ({ rowId, value }) => save(rowId, value.targetPct),
}
```

## The rule that needs the other rows

A target weight is only valid against the rest of the book, so the rule is `editing.tableValidators`, not `meta.edit.validate`.
`rows` is the collection as it would stand if the commit landed, so the committing row's drafted value is already in it.

```tsx
tableValidators: {
  onSubmit: ({ rows }) => {
    const total = rows.reduce((sum, r) => sum + Number(r.value.targetPct ?? 0), 0);

    return total > 100.005
      ? { fields: { targetPct: `Targets would total ${pct(total)}` } }
      : undefined;
  },
}
```

The bound on a single cell - between 0 and 100 - stays on the column as [`meta.edit.validate`](/docs/editors), because it needs nothing but the value.

## Totals in two places

Sector totals come from `aggregationFn` on each column; the portfolio total comes from a `footer` and [`aggregateColumn`](/docs/summary-row), which follows the filters.

```tsx
columnHelper.accessor("marketValue", {
  aggregationFn: "sum",
  footer: ({ table }) =>
    money.format(Number(aggregateColumn({ table, columnId: "marketValue" }))),
});
```

Summing `targetPct` is meaningful only because the values are shares of one whole: a footer reading `100.0%` says the book is fully allocated.

## Reading drift

Drift is signed, so the cell renders a tint whose strength follows the size of the miss and whose colour follows its direction.
Rows more than three points out take `--row-bg` as well, which composes under hover and selection instead of replacing them.

```tsx
<TMDataGrid.Table<Position>
  rowStyle={(row) =>
    !row.getIsGrouped() && Math.abs(row.original.drift) >= 3
      ? { "--row-bg": "color-mix(in srgb, var(--mantine-color-yellow-6) 10%, transparent)" }
      : undefined
  }
/>
```

A group row is handed to `rowStyle` too, and its `original` is an arbitrary child's record, so the callback guards with `row.getIsGrouped()`.
[Row styling](/docs/row-styling) covers the rest of the vocabulary.
