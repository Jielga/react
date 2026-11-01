# Frozen sort

Reference for the `columns` skill.

By default, the grid sorts on every change, so an edited row moves to its new place as soon as the edit lands, and can leave the view.
Set `sortMode: "frozen"` (type `TMDataGridSortMode`, `"live" | "frozen"`, default `"live"`) to sort once, when the sort is applied, and hold that order through edits, refetches and filter changes:

```tsx
const grid = useTMDataGrid({ data, columns, getRowId, sortMode: "frozen" });
```

`sortMode: "frozen"` requires `getRowId`, and leaving it out is a compile error: rows are held by id, and with the index fallback a refetch that returns the records in another order would give each held place to a different record.

## When the order is taken again

When the rows are no longer in sorted order, each sorted header shows a ↻ button (`data-dg-part="sort-again"`).
A changed value that leaves the order as it was shows nothing.
The following take the order again from the current values:

- the ↻ button on a sorted header
- Sort again in the column menu, which a sorted column always has under `"frozen"`
- a sort item in the column menu, also the direction that is already set
- a header click, which moves the column to the next step of its sort cycle
- `setSorting` with a different sort
- a grouping change
- `sortAgain()` from the hook

Each one applies the whole sort again, every column of a multi-sort included.
`setSorting` with the sort that is already set keeps the held order; call `sortAgain()` instead.
`sortAgain()` keeps the page index, while a new sort goes back to the first page.
Switching `sortMode` to `"frozen"` takes the order at that moment.

## A control of your own

`sortStale` is `true` while the held order differs from a fresh sort.
`sortStale` and `sortAgain` are on the hook's return value and on `useTMDataGridContext()`, so a toolbar control can read them:

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

## Editing

The order never changes while a value is being typed, under either mode.
The ↻ button commits an open cell editor first, and `sortAgain()` waits for any commit that is still running, so the new order can show a render after the call.
It sorts on what `data` holds once `onCommit` resolves.
To have the re-sort see an edit, update `data` before `onCommit` resolves, for example with an optimistic update.

## Which rows keep their place

- A row the held order has not seen goes after the row it follows in a fresh sort, and is then held there.
  This covers a row added or new in `data`, and a row that was filtered out when the order was taken.
- A row hidden by a filter or the quick search keeps its place and returns to it.
- A row keeps its place only while it is in `data`.
  Under `manualFiltering` or `manualPagination`, a row the server leaves out of `data` loses its place, and comes back as a new row.
- Under grouping, the groups keep their order as well as the rows inside them.
  A row whose grouped value changes moves to its new group, where it is placed as a new row.

## Server-side sorting

`sortMode` has no effect under `manualSorting`, and `sortStale` stays `false`: the grid shows the rows in the order the server returns them.
An edited row moves there when the app refetches.
To keep it in place, update the edited record in the data you already hold instead of refetching, and refetch when the user sorts.

## Labels and parts

- Labels: `sortAgain` (menu item, button name) and `sortAgainHint` (button tooltip).
- Part: `sort-again`, keyed by `data-column-id`, always visible while present, with no hover needed.
