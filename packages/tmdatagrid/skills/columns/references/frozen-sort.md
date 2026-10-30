# Frozen sort

Reference for the `columns` skill.

By default, the grid sorts on every change, so an edited row moves to its new place as soon as the edit lands.
Set `sortMode: "frozen"` (type `TMDataGridSortMode`, `"live" | "frozen"`, default `"live"`) to sort once, when the sort is applied, and hold that order through edits, refetches and filter changes:

```tsx
const grid = useTMDataGrid({ data, columns, getRowId, sortMode: "frozen" });

// A control of your own: `sortStale` is true while the held order differs
// from a fresh sort.
<Button disabled={!grid.sortStale} onClick={grid.sortAgain}>
  Sort again
</Button>;
```

- Once a sorted value has changed, each sorted header shows a ↻ button (`data-dg-part="sort-again"`), and a sorted column's menu has Sort again; both call `sortAgain()`.
- A new sort (header click, menu item, `setSorting` with a different sort) and a grouping change also take the order again.
- `setSorting` with the sort that is already set keeps the held order; call `sortAgain()` instead.
- Rows are held by id, so set `getRowId` to the record's id.
- A row the held order has not seen yet, added or new in `data`, goes after the row it follows in a fresh sort and is then held there. A row hidden by a filter keeps its place and returns to it.
- Under grouping, the groups keep their order as well as the rows inside them.
- No effect under `manualSorting`; the server owns the order.
- Labels: `sortAgain` (menu item, button name) and `sortStale` (button tooltip).
