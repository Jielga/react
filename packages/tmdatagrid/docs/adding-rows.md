# Adding and deleting rows

Users add rows in entry rows under the header, and delete them from the edit lane or through `edit.deleteRow`.
Under `editing.draft` both wait in the [draft store](/docs/draft-store) until Save.

## Adding rows

`edit.addRow()` opens an **entry row** in a sticky block under the header, so the row being typed into stays in view.
Its cells are ordinary editors over a form seeded from `newRowDefaults`.
A cell the row does not open, a display column or one with `meta.edit.enabled: false`, renders through the column's own `cell` renderer over the row as shown, following the form as it is typed, as it does on a body row.

- Enter, or the lane's ✓, commits the row: `onRowAdd` receives it, or under `draft: true` it goes into the draft store and `saveDrafts` reports it in `created`
- Escape, or ✕, discards it
- clicking away decides nothing; an entry row is row-shaped in every mode
- an entry row that was never committed is not part of a save and stays open

```tsx
useTMDataGrid({
  editing: {
    mode: "row",
    draft: true,
    newRowDefaults: () => ({ id: 0, name: "", hired: today() }),
    onSaveDrafts: async ({ updated, created, deleted }) => {
      await api.saveBatch({ updated, created, deleted });
    },
  },
});

<Button onClick={() => grid.edit.addRow()}>Add row</Button>;
```

Annotate the return type of `newRowDefaults`: a bare object literal widens a union field to `string`, and `(): Product => ({ ... })` keeps it checked.

`addRow(values)` overrides `newRowDefaults` key by key: `addRow()` opens the defaults, `addRow({ department: "Sales" })` opens them with `department` filled in, and passing a whole row duplicates it.
The seeded values are editable and validate like any other, and nothing reaches `onRowAdd` until the row is committed.

A grouped column has no cell on the entry row; under the default `groupedColumnMode: "remove"` it is not in the grid at all.
Seed it instead: `addRow({ region: "EMEA" })`.

```tsx
<Button onClick={() => grid.edit.addRow({ department: "Sales", active: true })}>
  Add to Sales
</Button>;

<Button onClick={() => grid.edit.addRow(selected.original)}>Duplicate</Button>;
```

To limit how many entry rows are open at once, read the entry state from `edit.store` and gate the button:

```tsx
const hasOpenEntry = useSelector(grid.edit.store, (state) =>
  state.newRows.some((newRow) => !newRow.committed),
);

<Button disabled={hasOpenEntry} onClick={() => grid.edit.addRow()}>
  Add row
</Button>;
```

### Committed new rows

Under `draft: true` a committed entry row leaves the entry block and becomes a body row: it carries `data-new` and `data-draft`, is tinted with `--dg-row-new-bg`, and is sorted, filtered and counted with the rest on the values it was entered with.
Set `newRowsSticky: true` to keep committed rows in the entry block until the save instead, out of the body's sort and out of the row count.
Double-click, or the lane's pencil, reopens the row into the entry block, which takes it out of the draft store until it is committed again; ✕ removes it.

### Importing rows

`edit.addRows(rows)` opens a batch of entry rows in one write, where a loop over `addRow` is one write per row.
Each row is seeded over `newRowDefaults` like `addRow`.
`{ commit: true }` submits the rows too: rows that validate are committed, and rows that fail stay open in the entry block with their errors.
The result, `{ ok, committed, open }`, says which went which way, so the bad rows can be reported before anything is saved.
Every added row is in exactly one list, and `ok` is `true` when `open` is empty:

```tsx
const { ok, open } = await grid.edit.addRows(parsedRows, {
  commit: true,
});
if (!ok) notify(`${open.length} rows need attention`);
await grid.edit.saveDrafts();
```

Column rules apply even though the rows never had an editor on screen: the engine runs `meta.edit.validate` at commit.
Under `draft: true` the whole import is one publish: the rows are validated together and land in the draft store in the same render that shows them, so ten thousand rows take about a second.
`saveDrafts` sends them the same way.
Without `draft: true`, `commit: true` adds each valid row through `onRowAdd`, one call per row, in the order given.

```demo
file: editing/ImportRows.tsx
hint: Import parses the pasted rows, commits the valid ones and leaves the rest open with their errors. The second button imports ten thousand generated rows, twenty of them invalid.
height: 460
```

## Deleting rows

`edit.deleteRow(rowId)` calls `onRowDelete({ rowId, row })` at once; put any confirmation in that callback.
Under `draft: true` it marks the row instead: the row renders struck through and inert with `data-deleted`, the lane shows Restore, and `saveDrafts` reports the id in `deleted`.
The mark goes straight into the draft store; there is nothing to type.
`edit.restoreRow(rowId)` removes the mark, which is what the lane's Restore calls.

`deleteRow` is idempotent: deleting a marked row leaves it marked.
On an entry row, committed or not, it discards the entry, and an unknown id is a no-op.
`edit.deleteRows(rowIds)` does the same over a list in one call, so a selection can be passed as it stands: duplicates, marked rows and stale ids included.

A marked row is read-only and not selectable until it is restored:

- `begin`, `setCellValue`, `setRowValues` and `clearCell` refuse it, and the keyboard cannot open an editor on it
- an editor open on the row when it is marked is cancelled
- its checkbox is disabled, select-all skips it, and the mark drops it from `rowSelection`
- it still sorts, filters, groups, aggregates and counts, and is left out of an export
- a committed edit stays under the mark: Restore brings the row back as edited, while Save leaves the edit out of `updated`, reports the row in `deleted` only, and forgets the edit once the deletion is saved

A row the engine takes out of the table, an entry row that is discarded or saved or a marked row once its deletion is saved, leaves `rowSelection`, `expanded` and `rowPinning` with it, so a saved deletion does not leave the select-all box indeterminate.

The grid never modifies `data`: you apply adds and deletes, and the new rows arrive back through `data`.
The engine's `tempId` (`__new__1`, …) does not need to become a real id; assign one when you create the record.

## Reference

| Name                          | Kind           | Type                                             | Default           | What it does                                                                                     |
| ----------------------------- | -------------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| `editing.newRowsSticky`       | Member         | `boolean`                                        | `false`           | `draft: true` only. Keeps committed entry rows in the sticky entry block, out of the body's sort, until the save. |
| `editing.newRowDefaults`      | Member         | `TData \| () => TData`                           | –                 | Seeds the entry row's form.                                                                      |
| `editing.onRowAdd`            | Callback       | `({ tempId, value }) => void \| Promise`         | –                 | Commits an added row.                                                                            |
| `TMDataGridRowAddArgs` | Type | `{ tempId, value }` | – | What `onRowAdd` receives, and one entry of the `created` that `onSaveDrafts` receives. |
| `editing.onRowDelete`         | Callback       | `({ rowId, row }) => void \| Promise`            | –                 | Deletes a row. Shows the trash; under `draft: true`, `onSaveDrafts` shows it too.                |
| `TMDataGridRowDeleteArgs` | Type | `{ rowId, row }` | – | What `onRowDelete` receives. |
| `TMDataGridAddRowsOptions` · `TMDataGridAddRowsResult` | Types | `{ commit? }` · `{ ok, committed, open }` | – | What `edit.addRows` takes as its options, and what it resolves. |
| `--dg-entry-height`           | CSS variable   | length                                           | From `size`       | Height of the sticky entry block.                                                                |
| `--dg-row-new-bg`             | CSS variable   | color                                            | Green tint        | Background of a committed new row, in the body or the entry block.                               |
| `data-deleted`                | Data attribute | –                                                | –                 | On a row marked for deletion under `draft: true`.                                                |
| `data-new`                    | Data attribute | –                                                | –                 | On a body row that is a committed new row, and on an entry row.                                  |
| `data-committed`              | Data attribute | –                                                | –                 | On an entry row once it is committed, awaiting the save. Seen only under `newRowsSticky`.        |
