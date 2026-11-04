# A card view

The same rows as a grid, rendered as cards.
`useTMDataGrid` and `TMDataGrid` stay; `TMDataGrid.Table` is replaced by a virtualized list of Mantine `Card`s.
Search, filters, sorting, column visibility and row selection all write the same table state the grid would.

```demo
file: recipes/CardView.tsx
hint: Search, sort by Salary, or hide Location in the menu - every card follows. 5 000 rows, a few dozen cards mounted.
height: 640
```

## Keep the root, replace the Table

`TMDataGrid` provides the grid through context and renders no rows of its own.
Every part except `TMDataGrid.Table` works without the Table, so the toolbar stays as it is:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  filters: { surface: "none" },
});

<TMDataGrid {...grid}>
  <TMDataGrid.Toolbar>
    <TMDataGrid.Search />
    <TMDataGrid.SummaryCount />
    <TMDataGrid.Menu>
      <TMDataGrid.Menu.Columns />
    </TMDataGrid.Menu>
  </TMDataGrid.Toolbar>
  <TMDataGrid.FilterPanel layout="stacked" />
  <CardList table={grid.table} />
</TMDataGrid>;
```

The following belong to `TMDataGrid.Table` and are not available without it:

- the header, with click-to-sort, resizing, dragging and the column menus
- the filter popup and sidebar - set `filters.surface` to `"none"` and place [TMDataGrid.FilterPanel](/docs/filtering#tmdatagridfilterpanel) yourself
- row details, row pinning, cell selection and editing in cells
- `scrollToRow`, which returns `false` while no Table is mounted

The demo replaces the header's sorting with a `Select` that calls `table.setSorting`.

## Read the rows

[`getDisplayedRows`](/docs/anatomy#which-rows-it-renders) returns the rows the Table would render: filtered, sorted, and the current page when paging is on.
Call it inside `useSelector(table.store, …)` with a shallow compare:

```tsx
const rows = useSelector(table.store, () => getDisplayedRows(table, features), {
  compare: shallow,
});
```

The table identity never changes, so the React Compiler caches a bare call and the list stops following filters and sorting.
The shallow compare re-renders the list only when the rows change.

## Virtualize lines of cards

The virtualizer works on lines, not cards: one virtual item is one line of `perLine` cards, and `perLine` follows the width of the scroll container.

```tsx
const perLine = Math.max(1, Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP)));

const virtualizer = useVirtualizer({
  count: Math.ceil(rows.length / perLine),
  getScrollElement: () => scrollRef.current,
  estimateSize: () => CARD_HEIGHT + GAP,
});
```

Each line is a CSS grid of `perLine` columns, positioned at the virtual item's `start`.
The cards have a fixed height, so `estimateSize` is exact and no line has to be measured.

## Reuse the column definitions

A card renders its fields from `row.getVisibleCells()`, through the column's own `cell` renderer:

```tsx
const cells = useSelector(table.store, () => row.getVisibleCells());

cells.map((cell) => (
  <Group key={cell.id} justify="space-between">
    <Text c="dimmed">{getColumnLabel(cell.column)}</Text>
    {flexRender(cell.column.columnDef.cell, cell.getContext())}
  </Group>
));
```

- `getColumnLabel` returns the column's `meta.label` or `header`
- the `cell` renderer is the one the grid uses, so the salary and the status badge look the same in both views
- hiding a column with `TMDataGrid.Menu.Columns` removes its line from every card

Filter out generated columns with `isGeneratedColumn(cell.column.id)`; the checkbox column is in `getVisibleCells()` while row selection is on.

## Select a card

Subscribe each card to its own selection, so selecting one card re-renders that card only:

```tsx
const selected = useSelector(table.store, (state) => state.rowSelection[row.id] === true);

<Checkbox checked={selected} onChange={() => row.toggleSelected()} />;
```
