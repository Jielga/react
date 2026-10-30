# Sorting

On by default. Click a header to sort it, click again to reverse, click a third
time to clear. The column menu has the same three actions.

```tsx
const grid = useTMDataGrid({ data, columns });
```

```demo
file: columns/Sorting.tsx
hint: Click a header to sort, Shift+click a second to append - the badge beside the arrow is its priority.
```

## Sorting by more than one column

Shift+click a second header to **add** it to the sort rather than replace it.
While more than one column sorts, each sorted header shows its priority - 1, 2,
… - beside the arrow, so the order they are applied in is visible.

A plain click still replaces the whole sort, and the menu's Sort items do the
same.

This is TanStack's own `isMultiSortEvent`, so `enableMultiSort`,
`maxMultiSortColCount` and a custom `isMultiSortEvent` all pass straight
through:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  maxMultiSortColCount: 3,
  // Ctrl rather than Shift, say.
  isMultiSortEvent: (event) => event.ctrlKey,
});
```

## Turning it off

`enableSorting: false` on the table removes click-to-sort, the indicator and
the menu items everywhere; on a column it removes them for that column alone.

```tsx
columnHelper.accessor("avatar", { header: "", enableSorting: false });
```

A column whose menu has no remaining items renders no menu button and does not
handle right-click, so the browser's own menu opens instead.

## Where the state lives

Sorting writes TanStack's `sorting` state, an array of `{ id, desc }` in
priority order. Seed it, control it, or read it like any other slice:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  initialState: { sorting: [{ id: "lastName", desc: false }] },
});
```

It is a **data** slice: it names a column and a direction over the data itself,
so a [persisted](/docs/use-tm-data-grid#persist) grid comes back sorted the way
it was left, under `dataKey`. For a server that does the sorting, see
[Server-side data](/docs/server-side).

Grouping runs first, so a grouped grid sorts rows within each group and orders
the groups by their aggregated value. See
[Grouping](/docs/grouping#sorting-a-grouped-grid).

## Custom comparators

`sortFn` on the column takes any of TanStack's registered names, or a function
of two rows and the column id. It is `sortFn` in v9, not v8's `sortingFn`.

```tsx
columnHelper.accessor("priority", {
  header: "Priority",
  sortFn: (rowA, rowB) =>
    RANK[rowA.original.priority] - RANK[rowB.original.priority],
});
```

## Hold the order while editing

By default, the grid sorts on every change, so an edited row moves to its new place as soon as the edit lands, and can leave the view.
Set `sortMode: "frozen"` to sort once, when the sort is applied, and keep that order through edits, refetches and filter changes:

```tsx
const grid = useTMDataGrid({ data, columns, getRowId, sortMode: "frozen" });
```

```demo
file: columns/FrozenSort.tsx
hint: Sorted by Salary. Edit a salary so the row should move, then click ↻ beside the sort arrow.
```

Once a sorted value has changed, each sorted header shows a ↻ button.
The following sort again on the current values:

- the ↻ button on a sorted header
- Sort again in a sorted column's menu
- `sortAgain()` from the hook
- a new sort: a header click, a Sort item in the menu, or `setSorting` with a different sort
- a grouping change

`setSorting` with the sort that is already set keeps the held order; call `sortAgain()` instead.
`sortStale` is `true` while the held order differs from a fresh sort, for a control of your own:

```tsx
<Button disabled={!grid.sortStale} onClick={grid.sortAgain}>
  Sort again
</Button>
```

Rows are held by id, so set `getRowId` to the record's id.
A row the held order has not seen yet, added or new in `data`, goes after the row it follows in a fresh sort and is then held there.
A row hidden by a filter keeps its place and returns to it.
Under grouping, the groups keep their order as well as the rows inside them.
`sortMode` has no effect under `manualSorting`.

## The header menu

The menu opens from the ⋮ button on the header, or from a right-click anywhere
on it. The items are the same either way; a right-click opens it at the
pointer.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableSorting` | Table option | `boolean` | `true` | Also a column option. `false` removes indicator, menu items and click-to-sort. |
| `enableMultiSort` | Table option | `boolean` | `true` | Whether Shift+click appends instead of replacing. |
| `maxMultiSortColCount` | Table option | `number` | `Infinity` | How many columns may sort at once. |
| `isMultiSortEvent` | Table option | `(event) => boolean` | Shift held | What counts as "append to the sort". |
| `sortFn` | Column option | name \| `(rowA, rowB, columnId) => number` | `"auto"` | The comparator for one column. v9's name for v8's `sortingFn`. |
| `initialState.sorting` | Table option | `Array<{ id, desc }>` | `[]` | Sort at mount. A settings slice, so it persists. |
| `manualSorting` | Table option | `boolean` | `false` | The server sorts; the grid stops. |
| `sortMode` | Table option | `"live" \| "frozen"` | `"live"` | Controls when the order follows the values. `"frozen"` holds the order until the user sorts again. No effect under `manualSorting`. |
| `TMDataGridSortMode` | Type | `"live" \| "frozen"` | – | The type of `sortMode`. |
| `sortStale` | Hook return | `boolean` | `false` | Whether the held order differs from a fresh sort. Always `false` under `"live"`. |
| `sortAgain` | Hook return | `() => void` | – | Sorts again on the current values, with the same sort. Does nothing under `"live"`. |
