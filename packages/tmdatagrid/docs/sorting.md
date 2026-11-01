# Sorting

On by default. Click a header to sort it, click again to reverse, click a third
time to clear. The first click sorts text ascending and other values, such as
numbers and dates, descending; `sortDescFirst` changes that. The column menu
has the same three actions.

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

`sortMode: "frozen"` requires `getRowId`, and leaving it out is a compile error, because rows are held by id.
With the index fallback, a refetch that returns the records in another order would give each held place to a different record.

```demo
file: columns/FrozenSort.tsx
hint: Double-click a salary and enter a low one - the row stays. Click ↻ beside the sort arrow to sort again, or switch to live to compare.
```

When the rows are no longer in sorted order, each sorted header shows a ↻ button.
A changed value that leaves the order as it was shows nothing.
The following take the order again from the current values:

- the ↻ button on a sorted header
- Sort again in the column menu, which a sorted column always has
- a sort item in the column menu, also the direction that is already set
- a header click, which moves the column to the next step of its sort cycle
- `setSorting` with a different sort
- a grouping change
- `sortAgain()` from the hook

Each one applies the whole sort again, every column of a multi-sort included.
`setSorting` with the sort that is already set keeps the held order; call `sortAgain()` instead.
`sortAgain()` keeps the page index, while a new sort goes back to the first page.
Switching `sortMode` to `"frozen"` takes the order at that moment.

### Your own Sort again control

`sortStale` is `true` while the held order differs from a fresh sort.
`sortStale` and `sortAgain` are on the hook's return value and on [`useTMDataGridContext`](/docs/components#usetmdatagridcontext), so a toolbar control can read them:

```tsx
function SortAgainButton() {
  const { sortStale, sortAgain } = useTMDataGridContext();
  return (
    <Button size="xs" disabled={!sortStale} onClick={sortAgain}>
      Sort again
    </Button>
  );
}

<TMDataGrid {...grid}>
  <TMDataGrid.Toolbar>
    <SortAgainButton />
  </TMDataGrid.Toolbar>
  <TMDataGrid.Table />
</TMDataGrid>;
```

The header button and the menu item show under `"frozen"` whether or not you add a control of your own.
`sortStale` covers every row, so a row on another page, inside a collapsed group or pinned can make it `true`; sorting again then changes nothing in view.
`features.frozenSort` is `true` while `sortMode` is `"frozen"` and `manualSorting` is off, for a control that should hide otherwise.

### Editing

The order never changes while a value is being typed, under either mode.
The ↻ button commits an open cell editor first, and `sortAgain()` waits for any commit that is still running, so the new order can show a render after the call.
It sorts on what `data` holds once `onCommit` resolves.
To have the re-sort see an edit, update `data` before `onCommit` resolves, for example with an optimistic update.

### Which rows keep their place

- A row the held order has not seen goes after the row it follows in a fresh sort, and is then held there.
  This covers a row added or new in `data`, and a row that was filtered out when the order was taken.
- A row hidden by a filter or the quick search keeps its place and returns to it.
- A row keeps its place only while it is in `data`.
  Under `manualFiltering` or `manualPagination`, a row the server leaves out of `data` loses its place, and comes back as a new row.
- Under grouping, the groups keep their order as well as the rows inside them.
  A row whose grouped value changes moves to its new group, where it is placed as a new row.

### Server-side sorting

`sortMode` has no effect under `manualSorting`, and `sortStale` stays `false`: the grid shows the rows in the order the server returns them.
An edited row moves there when the app refetches.
To keep it in place, update the edited record in the data you already hold instead of refetching, and refetch when the user sorts.
See [Server-side data](/docs/server-side).

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
| `initialState.sorting` | Table option | `Array<{ id, desc }>` | `[]` | Sort at mount. A data slice, so it persists under `dataKey`. |
| `sortDescFirst` | Table option | `boolean` | `false` for text, `true` for other values | Also a column option. Whether the first click sorts descending. |
| `manualSorting` | Table option | `boolean` | `false` | The server sorts; the grid stops. |
| `sortMode` | Table option | `"live" \| "frozen"` | `"live"` | Controls when the order follows the values. `"frozen"` holds the order until the user sorts again, and requires `getRowId`. No effect under `manualSorting`. |
| `TMDataGridSortMode` | Type | `"live" \| "frozen"` | – | The type of `sortMode`. |
| `sortStale` | Hook return | `boolean` | `false` | Whether the held order differs from a fresh sort of every row. Always `false` under `"live"` and under `manualSorting`. |
| `sortAgain` | Hook return | `() => void` | – | Sorts again on the current values, with the same sort. Waits for running commits and keeps the page index. Does nothing under `"live"`. |
