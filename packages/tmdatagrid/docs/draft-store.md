# Draft store

The draft store holds committed rows inside the grid until the user presses Save.
It is turned on with `editing.draft`; see [Editing](/docs/editing) for the modes and the rest of the `editing` option.

`draft: true` changes where a commit goes, and nothing else.
Instead of reaching `onCommit`, the row is committed into the grid's draft store, where it waits for `edit.saveDrafts()`.
The mode still decides what counts as a commit: `{ mode: "row", draft: true }` commits a whole row from the lane's ✓, and `{ mode: "cell", draft: true }` commits a row as the caret leaves the cell.

`draft: true` requires `getRowId`.
The usual setup adds `onSaveDrafts`, which receives the whole store in one call when the user presses Save, and `TMDataGrid.DraftActions` in the toolbar, which renders Save and Discard:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "row",
    draft: true,
    onSaveDrafts: async ({ updated, created, deleted }) => {
      await api.saveBatch({ updated, created, deleted });
    },
  },
});

<TMDataGrid {...grid}>
  <TMDataGrid.Toolbar>
    <TMDataGrid.DraftActions />
  </TMDataGrid.Toolbar>
  <TMDataGrid.Table />
</TMDataGrid>;
```

In this demo:

- ✓ commits the row into the draft store, and the Backend panel logs nothing
- Save sends the whole store as one `onSaveDrafts` call
- with "Reject Sales rows" on, the backend refuses those rows and they keep their drafts
- "Go to open row" scrolls to a row left open

```demo
file: editing/DraftEditing.tsx
hint: Double-click a row, ✓ commits it, Save sends the store.
height: 440
```

## Saving the store

`edit.saveDrafts()` sends the draft store and leaves open rows alone.
With `onSaveDrafts` set, it makes one call with the whole store, `onSaveDrafts({ updated, created, deleted })`:

- `updated` - one entry per committed edit, in the shape `onCommit` receives: `{ rowId, value, original, changes, source }`
- `created` - one `{ tempId, value }` per committed new row
- `deleted` - the ids of the rows marked for deletion

Without `onSaveDrafts`, `saveDrafts` makes one call per row instead: `onCommit` for each edit, `onRowAdd` for each new row and `onRowDelete` for each deletion.
`draft: true` without `onSaveDrafts` is therefore valid.

`changes` is a list of descriptors, not a patch object; spreading it into a row compiles and writes nothing.
To build a patch:

```tsx
const patch = Object.fromEntries(entry.changes.map((c) => [c.field, c.next]));
```

Before the rows are sent, `editing.tableValidators` run once more over every committed row.
Column rules and `rowValidators` ran at commit on the same values, so they do not run again.
A row the table rules reject is reopened with its errors and left out of the save.
On the per-row path, a row whose `onCommit` or `onRowAdd` rejects is reopened the same way.

`saveDrafts()` resolves a `TMDataGridSaveDraftsResult`, `{ ok, saved, kept, reopened }`.
Every id the save took from the draft store is in exactly one list: row ids for edits and deletions, temp ids for new rows, all kinds mixed.

- `saved` - left the draft store; the consumer accepted it
- `kept` - still in the draft store, still committed, and sent again by the next save; see [Saving part of the store](#saving-part-of-the-store)
- `reopened` - out of the draft store and open again with an error: a table rule rejected it, or on the per-row path its `onCommit` or `onRowAdd` rejected
- `ok` - `true` when `kept` and `reopened` are both empty

On the per-row path a deletion always leaves the store, so it is reported in `saved`.
An empty store resolves `{ ok: true, saved: [], kept: [], reopened: [] }` without calling the consumer.
A call made while a save is in flight joins that save and resolves the same result.

```tsx
const result = await grid.edit.saveDrafts();
if (!result.ok) notify(`${result.reopened.length} rows need attention`);
```

`TMDataGrid.DraftActions` renders the whole-grid controls: Save with the count of rows in the store, Discard, and a note counting the rows still open.
Save is disabled while the store is empty, however much is being typed, and shows a loading state while the save is in flight.
The toolbar is declarative: include the component yourself when the grid runs a draft store, or call `edit.saveDrafts()` from a control of your own.
Without `draft: true` there is nothing to save and Save stays disabled.

## Saving part of the store

`onSaveDrafts` decides how much of the store is cleared by what it returns:

| Returned | Effect |
| --- | --- |
| nothing | Everything saved. The store is cleared. |
| a rejected promise, or a throw | Nothing saved. Every draft is kept. |
| `{ updated, created, deleted }` | The ids reported `false` are kept; the rest are cleared. |

Each key takes `false` for the whole bucket, or a map from id to result.
An id the map does not name counts as saved.

```tsx
onSaveDrafts: async ({ updated, created, deleted }) => {
  const failed = await api.saveBatch({ updated, created, deleted });
  return { updated: Object.fromEntries(failed.map((id) => [id, false])) };
};
```

A kept row stays committed rather than reopening, so the next `saveDrafts()` retries it with the values it already holds.
`saveDrafts()` reports every id `onSaveDrafts` returned as failed in `kept`, and every id it was sent when it threw, with `ok: false`.
Without `onSaveDrafts`, a deletion whose `onRowDelete` throws keeps its mark and is reported in `kept` the same way.
A kept row carries the same markers as every other draft and nothing more; see [Styling pending rows](/docs/editing#styling-pending-rows).

## Rows left open

A row left open is neither lost nor sent.
It keeps everything typed into it, stays open across a save, and joins the next save once it is committed.
`edit.commitAll()` submits every open row at once; rows that fail validation stay open with their errors.
It resolves a `TMDataGridCommitAllResult`, `{ ok, committed, open }`: every row that was open at the call is in exactly one of the two lists, and `ok` is `true` when `open` is empty.
"Commit everything, then save" is `commitAll()` followed by `saveDrafts()`:

```tsx
const { ok, open } = await grid.edit.commitAll();
if (ok) await grid.edit.saveDrafts();
else grid.scrollToRow({ rowId: open[0]! });
```

The note beside Save counts the open rows.
On a long grid the open row may be far from the viewport, and because the grid is [virtualized](/docs/scrolling) it may have no element to scroll to.
`actions.scrollToFirstOpenRow(align?)` scrolls to the first open row in display order and returns whether it could be reached.

`renderActions` replaces the built-in pair and receives its pieces:

- `state` - `draftCount`, `openCount`, `openRowIds`, `isSubmitting` and `isSaving`
- `actions` - `save`, `commitAll`, `discard`, `scrollToRow` and `scrollToFirstOpenRow`
- `Controls` - `Save`, `Discard` and `OpenRowsNote`, the built-in pieces

The full list is on [Components](/docs/components#tmdatagriddraftactions).

```tsx
<TMDataGrid.DraftActions
  renderActions={({ state, actions, Controls }) => (
    <Group>
      {state.draftCount > 0 && <Badge>{state.draftCount} ready</Badge>}
      <Button
        disabled={state.openCount === 0}
        onClick={() => {
          actions.scrollToFirstOpenRow("center");
        }}
      >
        Go to open row
      </Button>
      <Controls.OpenRowsNote />
      <Controls.Save />
      <Controls.Discard />
    </Group>
  )}
/>
```

`state.openRowIds` lists the open rows in the order the grid opened them, for a control the grid does not offer, such as a list or a next-open-row cycle.
`scrollToFirstOpenRow` takes "first" in display order, so the two need not name the same row.
An entered row appears as its `tempId`; entry rows are always on screen in the entry block, so the scroll returns `true` without moving.

## Unsaved changes

`hasPendingEdits(state)` returns `true` while the grid holds anything that has not been saved:

- an open row with a value that differs from its original
- an entry row, open or committed
- a committed row or a deletion mark in the draft store
- a save in flight (`isSaving`)

A row that is only opened, or whose values were changed back to the original, does not count.
After a save, a row the save kept, or a row reopened with an error, still counts.

The function is a selector over the edit state.
With `useSelector`, the component re-renders only when the result changes:

```tsx
import { useSelector } from "@tanstack/react-store";
import { hasPendingEdits } from "@jielga/tmdatagrid";

const hasUnsaved = useSelector(grid.edit.store, hasPendingEdits);

useEffect(() => {
  if (!hasUnsaved) return;
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  return () => {
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}, [hasUnsaved]);
```

A router's navigation blocker can pass `hasUnsaved` in the same way, or call `hasPendingEdits(grid.edit.state)` when navigation starts.
It works in every edit mode.
Without `draft: true` the draft store stays empty, so only open rows count.

## How a committed row behaves

A committed row holds no form: its values are data in the draft store.
To the table it is a row like any other, and everything that reads a row reads the draft:

- sorting, filtering, quick search and grouping
- `aggregatedCell`, `footer` and the faceted filter options
- export, row selection, the row numbers and counts
- `edit.getRows()` and `editing.tableValidators`
- the row callbacks `onRowClick`, `renderRowContextMenu`, `renderDetails`, `isRowEditable`, `meta.edit.enabled`, `rowClassName`, `rowStyle` and `enableRowPinning`, which receive a row whose `original` is the committed draft; an entered row is a record under its temp id, with no server id

`data` itself is never modified, and `getRowCount()` with a `rowCount` you set does not grow.
Only top-level rows are overlaid; children reached through `getSubRows` keep their `data` values.
A committed row that stops matching a filter or the quick search leaves the view, and Save still counts it.

Reopening a committed row, through `begin` or a write with `setCellValue`, `setRowValues` or `clearCell`, builds a fresh form seeded from the committed values and takes the row out of the store until it commits again.
The row keeps its place in the sort until it commits again or is cancelled.

A commit moves nothing else: the page stays, and open details panels and groups stay open.
TanStack's `autoResetPageIndex` and `autoResetExpanded` fire on any change to the `data` array, which under `draft: true` is every commit, so the grid switches both off and resets the page on a query change itself; see `resetPageOnQueryChange`.

A refetch that no longer returns a row drops that row's draft, its open editor and its deletion mark.
Under `manualPagination` or `manualFiltering` a row missing from `data` is on another page, not gone, so its draft is kept until Save.

## Reference

| Name                          | Kind           | Type                                             | Default           | What it does                                                                                     |
| ----------------------------- | -------------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| `editing.onSaveDrafts`        | Callback       | `({ updated, created, deleted }) => void \| Result \| Promise` | –  | `draft: true` only. One call for the whole draft store. See [Saving part of the store](#saving-part-of-the-store). |
| `TMDataGridSaveDraftsArgs` | Type | `{ updated, created, deleted }` | – | What `onSaveDrafts` receives. |
| `TMDataGridSaveDraftsResponse` | Type | `{ updated?, created?, deleted? }` | – | What `onSaveDrafts` may return to save part of the store. See [Saving part of the store](#saving-part-of-the-store). |
| `TMDataGridSaveOutcomes` | Type | `boolean \| Record<string, boolean>` | – | One bucket of what `onSaveDrafts` returns. `false` keeps an entry's draft; an id the map does not name counts as saved. |
| `TMDataGrid.DraftActions`      | Component      | –                                                | –                 | Save and Discard for pending edits.                                                              |
| `DraftActions` `renderActions` | Slot           | `({ state, actions, Controls }) => ReactNode`    | Built-in pair     | Replaces the buttons, and hands over their pieces. See [Components](/docs/components#tmdatagriddraftactions). |
| `actions.scrollToFirstOpenRow` | Slot action    | `(align?) => boolean`                            | `align: "auto"`   | Scrolls to the first open row in display order. `false` when none could be reached.              |
| `hasPendingEdits`             | Export         | `(state) => boolean`                             | –                 | Whether the grid holds unsaved work. See [Unsaved changes](#unsaved-changes).                     |
