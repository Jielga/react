# Editing

`@tanstack/react-form` becomes a peer dependency once editing is used.

Editing is turned on with the `editing` option.
Two settings inside it work independently:

- `mode` - what counts as a commit: leaving the cell, confirming the cell, or saving the row
- `draft` - where a commit goes: to your `onCommit` callback at once, or into the grid's [draft store](/docs/draft-store) until the user presses Save

The grid never modifies `data`.
You apply each commit in your callback, and the new values arrive back through `data`.

A row is in one of three places:

| Place | What it holds | Enters by | Leaves by |
| --- | --- | --- | --- |
| **data** | Your rows, the only source of truth | - | - |
| **form state** | A row being edited, in its own TanStack Form | `edit.begin`, `edit.addRow` | `edit.commit`, `edit.cancel` |
| **draft store** | Rows that passed their commit, held as values inside the grid until Save | `edit.commit` under `draft: true` | `edit.saveDrafts`, `edit.cancel` |

A row is **open** while it is in form state, and **committed** once it is in the draft store.
Without `draft: true` a commit goes straight to `onCommit` and the form is dropped, so the draft store stays empty.

## Set up editing

The smallest setup is cell mode with an `onCommit` that applies each change:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "cell",
    onCommit: async ({ rowId, value, changes }) => {
      // changes is a list of descriptors, not a patch object
      await api.patch(rowId, Object.fromEntries(changes.map((c) => [c.field, c.next])));
    },
  },
});
```

`onCommit` receives `{ rowId, value, original, changes, source }`:

- `value` - the whole row as edited
- `original` - the row as editing began
- `changes` - the per-field diff, `Array<{ columnId, field, previous, next }>`, one entry in cell mode
- `source` - the `mode` the commit came from

`editing` requires `getRowId`: drafts are keyed by row id, and the index fallback would name a different record after a sort.
`onSaveDrafts` is accepted only under `draft: true`.
Both are compile errors, not options that silently do nothing.

The `editing` object can be written inline.
Its callbacks are read through a ref on every render, so its identity does not matter.

In a sorted grid, an edited row moves to its new place as soon as the edit lands.
To keep it in place until the user sorts again, set `sortMode: "frozen"`; see [Sorting](/docs/sorting#hold-the-order-while-editing).

Editing turns on cell selection: `cellSelection` defaults to `"single"` while `editing` is set.

## Modes

`editing.mode` sets what counts as a commit and which controls trigger it.
All three modes use the same engine and the same forms.

| Mode            | Commit                                     | Cancel            | Controls                 |
| --------------- | ------------------------------------------ | ----------------- | ------------------------ |
| `"cell"`        | Enter, Tab or leaving the cell             | Escape            | none                     |
| `"cellConfirm"` | ✓ or Enter; Tab walks input, ✓, ✕ and then leaves, keeping the draft | ✕ or Escape       | ✓ / ✕ beside the input   |
| `"row"`         | ✓ in the edit lane, or Enter               | ✕, or Escape      | generated edit lane      |

An entry row from `edit.addRow()` is row-shaped in every mode: every editable cell opens at once, Tab walks them, and Enter, or the lane's ✓, commits it.

```demo
file: editing/CellEditing.tsx
hint: Double-click a cell, or press Enter or F2, or start typing on it.
height: 440
```

### Opening an editor

An editor opens on double-click, or, with the cell cursor on the cell, on Enter, F2 or typing, where the first character replaces the value as in a spreadsheet.
The grid places the caret in the opened cell, so a `meta.edit.editor` receives focus without handling it itself.
A row added with `edit.addRow()` opens the same way, with the caret in its first editable cell.

Delete or Backspace clears the value and commits it without opening an editor.
The commit is validated: a column rule that rejects the empty value refuses the clear and marks the cell.
Under `draft: true` the cleared value goes into the draft store with the rest.

A commit that fails validation keeps the editor open and marked invalid, with the message in its tooltip, until the value is fixed or Escape drops the edit.

### Row editing

The pencil in the edit lane opens every cell of the row at once, and ✓ commits them as one commit.
Double-clicking a cell opens the whole row, with the caret in the clicked cell.
Cross-field rules belong in this mode, because the whole row is validated together.
Opening a second row leaves the first one open, and each row's ✓ and ✕ act on that row alone.

```demo
file: editing/RowEditing.tsx
hint: Put a Sales row over 60 000 kr and Save reports why it is rejected.
height: 440
```

## Edit lane

The edit lane is the generated column at the end of every row, with the id `EDIT_COLUMN_ID`.
The grid adds it under `mode: "row"`, under `draft: true`, or when `onRowDelete` is set.
What it shows depends on the row's state:

| Row state | Icon | Actions |
| --- | --- | --- |
| Open | - | The mode's controls: ✓ ("Save row") commits the row, ✕ ("Cancel edit") cancels the edit |
| Committed edit | Pencil | Revert drops the row's draft |
| Committed new row | Plus | Pencil reopens it, ✕ removes it |
| Marked for deletion | Trash | Restore removes the mark |

A committed row is never offered ✓ again; `TMDataGrid.DraftActions` sends it.
A committed row also hides the trash: revert first, then delete.
The trash shows when a deletion has somewhere to go: `onRowDelete` is set, or under `draft: true`, `onSaveDrafts` is.

If validation blocks a row, its icon turns red and the tooltip shows the message; this covers the open row's ✓ and an entry row's ✓ alike.
A pathless issue from `rowValidators` has no cell to land on, so that tooltip is where its message shows.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or `meta.edit.field` for a column built on `accessorFn`.
Dot paths reach into nested records: `accessorKey: "address.city"` edits `values.address.city`, and issues from a nested schema map to the right column.

| Gate | Effect |
| --- | --- |
| `editing.columns: string[]` | Only the named columns edit |
| `meta.edit.enabled: false` | The column never edits |
| `meta.edit.enabled: (row) => boolean` | Per row, per column |
| `editing.isRowEditable: (row) => boolean` | The whole row, in every mode |

Group rows and the generated lanes never edit.

`editing.columns` lists the column ids that take edits.
By default, every column that maps to a data path is editable.

```tsx
editing: { mode: "cell", columns: ["targetPct", "note"] }
```

It gates before `meta.edit`, never past it: a column left out takes no edits whatever its own meta says, and a listed column still answers to its `meta.edit.enabled`.
The same list decides which cells an entry row opens.

`edit.isColumnEditable(column)` answers the column's half of the question on its own, for a toolbar or a menu with no row in hand: the column maps to a field, `editing.columns` lists it when that is set, and `meta.edit.enabled` is not `false`.
A per-row `enabled` predicate is the row's half, and `edit.canEditCell(row, column)` asks both.

```demo
file: editing/EditableGating.tsx
hint: ID never edits · Salary is closed on Terminated rows · rows under 25 are closed entirely · Full name is computed but writes to Last name.
height: 440
```

## How a draft renders

Forms live outside the DOM, keyed by row id.
Scrolling an editing row away unmounts its editor; the form keeps its values, dirty state and errors, and the editor remounts over the same form when the row returns.

A cell whose row holds a draft renders the draft value through the column's own `cell` renderer, in every mode; a `"cellConfirm"` draft kept when the caret left shows what was typed, not the value in `data`.
Cell corners show the state: blue for a dirty draft, red for a validation error, and the row carries `data-dirty`.
An entry row's cells take the red corner, never the blue one.

A validation message outlives the editor that found it: the cell keeps its red corner and the lane carries the text until that field's value changes.
While an editor is open, the field's message shows in a tooltip on it, opened by focus and by hover.

Inside a `cell` renderer, `row.original` and `getValue()` are the row as shown, in every data column: the open form's values while the row is edited, the committed draft after ✓, and `data` otherwise.
A column computed from other fields follows the draft as it is typed, and a button in a cell sends the draft the user sees.
A handler with no cell context, a toolbar action or a callback that received only an id, reaches the same row with `edit.getRowValues(rowId)`.

```demo
file: editing/ActionCell.tsx
hint: Double-click a row, change the salary, press Use: the button gets the draft, and data is untouched until Save.
height: 320
```

## Styling pending rows

Rows publish what they hold, for styling and for tests:

| Attribute | On | Means |
| --- | --- | --- |
| `data-dirty` | Body row, cell | Values typed in, committed or not |
| `data-draft` | Body row, entry row | Committed into the draft store, waiting for Save |
| `data-deleted` | Body row | Marked for deletion |
| `data-new` | Body row, entry row | An entered row, committed (body) or not (entry block) |

A row attribute is present, with the value `"true"`, only on the rows it applies to, so `[data-draft]` and `[data-draft="true"]` match the same rows.
A cell's `data-dirty` is present only while the cell is dirty.

The grid styles none of them beyond the corners, the strike-through and the new-row tint.
To highlight every row pending a save, and to let the user toggle it, use `rowStyle` on the Table:

```tsx
<TMDataGrid.Table
  rowStyle={(row) =>
    showPending && grid.edit.state.committedRowIds.includes(row.id)
      ? { "--row-bg": "color-mix(in srgb, var(--mantine-color-yellow-6) 15%, transparent)" }
      : undefined
  }
/>
```

`rowClassName` takes a class instead.
For CSS alone, target the attribute: `[data-dg-part="row"][data-draft="true"]`.

## The edit API

The built-in controls do everything through `edit`, which is public.

| Member | Does |
| --- | --- |
| `edit.begin({ rowId, columnId })` | Opens a row into form state. On a committed row, takes it back out of the draft store |
| `edit.commit(rowId)` | Submits one row: into the draft store under `draft: true`, to `onCommit` otherwise. Resolves `false` if validation blocked it |
| `edit.commitAll()` | Submits every open row. Resolves `{ ok, committed, open }` - the rows that committed and the rows still open; `ok` is `false` when one stayed open |
| `edit.saveDrafts()` | Sends the draft store. Open rows are left alone. Resolves `{ ok, saved, kept, reopened }` - the ids that left the store, stayed in it for the next save, or reopened with an error; `ok` is `false` when anything was kept or reopened |
| `edit.cancel(rowId)` / `edit.cancelAll()` | Drops drafts - form state and the draft store alike |
| `edit.setCellValue(rowId, columnId, value)` | Writes one cell and commits the row, with no editor. Resolves `false` if the cell takes no edit, or validation refused the value |
| `edit.setRowValues(rowId, values)` | The same for several cells of one row, in one commit. All or nothing |
| `edit.clearCell(rowId, columnId)` | Writes the type's empty value and commits it - what Delete does |
| `edit.addRow(values?)` | Opens one entry row, seeded over `newRowDefaults` |
| `edit.addRows(rows, options?)` | Opens a batch; `{ commit: true }` submits the rows too - one publish for the lot under `draft: true`. Resolves `{ ok, committed, open }` |
| `edit.deleteRow(rowId)` | Deletes a row, or marks it deleted under `draft: true`. Idempotent; discards an entry row; ignores an unknown id |
| `edit.deleteRows(rowIds)` | `deleteRow` over a list in one call - safe to feed a selection as it stands |
| `edit.restoreRow(rowId)` | Removes a row's deletion mark - what the lane's Restore calls |
| `edit.canEditCell(row, column)` | Whether a cell may open an editor: the column takes edits and the row does too |
| `edit.canEditRow(row)` | Whether a row takes edits at all - what shows the edit lane's pencil |
| `edit.isColumnEditable(column)` | Whether a column takes edits at all, with no row in hand |
| `edit.getForm(rowId)` | The open row's live `FormApi`; `undefined` for a committed row |
| `edit.getRowValues(rowId)` | The row as shown: its draft where one is held, else the `data` value. `undefined` for an unknown row |
| `edit.getRows()` | Every row as shown - drafts overlaid, entry rows appended, deletion-marked rows included and flagged `deleted` |
| `edit.store` | Open rows, committed rows, active cell, dirty and error projections, draft values, the committed values the table shows (`committedValues`), entry rows, deletion marks, and `isSaving` |

`commit`, `commitAll`, `saveDrafts`, `setCellValue`, `setRowValues`, `clearCell` and `addRows` return promises.
Await each call before starting the next when driving edits in a loop.

`getForm` returns the open row's own `FormApi`.
Render it in a drawer or side panel and it shares values, dirty state and errors with the inline cells.
A committed row has no form, so `getForm` returns `undefined` for it; call `begin` first, which reopens the row with a form seeded from the committed values.

`getRowValues` and `getRows` read what the grid shows rather than what `data` holds: an open form's values, a committed draft, or the `data` value when neither exists.
`getRows` walks the core row model, so it is unfiltered and never contains group rows, and it filters nothing out: a row marked deleted comes back flagged `deleted`, an entry row flagged `isNew` under its temp id.
The order is the core row model's, committed new rows ahead of the `data` rows, and then the entry rows the table does not hold: the ones still being typed into, and the committed ones under `newRowsSticky`.

```tsx
const selected = grid.table
  .getSelectedRowModel()
  .rows.flatMap((row) => grid.edit.getRowValues(row.id) ?? []);

const surviving = grid.edit.getRows().filter((row) => !row.deleted);
```

For the inverse, a `@tanstack/react-form` form _around_ the grid holding the row array, see [A query builder form](/docs/query-builder).

### Bulk actions

`edit.setCellValue(rowId, columnId, value)` writes one cell and commits its row without an editor ever opening, for a toolbar action or a bulk fill.
The row need not be mounted, so a selected row inside a collapsed group takes the write like any other.

```tsx
for (const row of grid.table.getSelectedRowModel().rows) {
  await grid.edit.setCellValue(row.id, "targetPct", equalWeight(row.original));
}
```

Under `draft: true` each row is committed into the draft store like a typed edit: the whole batch saves at once through `edit.saveDrafts()`, carries the same markers, and is reverted row by row from the edit lane.

`edit.setRowValues(rowId, values)` does the same for several cells of one row in a single commit: one `onCommit` call and one draft entry rather than one per column.
Keys are column ids, and it is all or nothing: if any named cell takes no edit, nothing is written and it resolves `false`.

```tsx
await grid.edit.setRowValues(row.id, { status: "Closed", closedOn: today() });
```

Both resolve `false` when the cell takes no edit - no such row or column, `editing.columns` excludes it, `meta.edit.enabled` is off, or the row is not editable - and when validation refuses the value, which leaves the row open carrying its errors.
`value` is the stored value: no editor runs, so `meta.edit.mapValue` does not run either, while `meta.edit.validate` does.

## Reference

| Name                          | Kind           | Type                                             | Default           | What it does                                                                                     |
| ----------------------------- | -------------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------ |
| `editing`                     | Option         | `TMDataGridEditingOptions`                       | –                 | Turns editing on. One object holding both axes and every editing callback.                       |
| `editing.mode`                | Member         | `"cell" \| "cellConfirm" \| "row"`               | –                 | Picks what counts as a commit and which controls trigger it.                                     |
| `TMDataGridEditMode` | Type | `"cell" \| "cellConfirm" \| "row"` | – | The type of `editing.mode`. |
| `editing.draft`               | Member         | `boolean`                                        | `false`           | Holds commits in the draft store for `edit.saveDrafts()` instead of sending them out.             |
| `getRowId`                    | Table option   | `(row) => string`                                | –                 | Required once `editing` is set. Drafts are keyed by it.                                          |
| `editing.columns`             | Member         | `ReadonlyArray<string>`                          | Every mapped column | The column ids that take edits. Gates before `meta.edit`, never past it.                       |
| `editing.isRowEditable`       | Member         | `(row) => boolean`                               | –                 | Closes a whole row to editing.                                                                   |
| `editing.rowValidators`       | Member         | TanStack Form validators                         | –                 | Form-level rules for the whole editing row. See [Editors](/docs/editors).                        |
| `editing.tableValidators`     | Member         | `TMDataGridTableValidators`                      | –                 | Cross-row rules, handed the collection with every draft overlaid. See [Editors](/docs/editors#cross-row-rules). |
| `editing.onCommit`            | Callback       | `({ rowId, value, original, changes, source }) => void \| Promise` | – | Applies one row's change. Reject to keep the draft.                                              |
| `TMDataGridEditCommitArgs` · `TMDataGridEditChange` | Types | – | – | What `onCommit` receives, and one entry of its `changes`. |
| `meta.edit.enabled`           | Column meta    | `boolean \| (row) => boolean`                    | `true`            | Whether a column's cells edit.                                                                   |
| `meta.edit.field`             | Column meta    | `string`                                         | The `accessorKey` | The data path an edit writes to.                                                                 |
| `meta.edit.mapValue`          | Column meta    | `({ value, previous, row, column }) => unknown`  | –                 | Maps each value an editor writes. See [Editors](/docs/editors#mapping-the-value-as-it-is-typed). |
| `EDIT_COLUMN_ID`              | Export         | `"__edit__"`                                     | –                 | Id of the generated edit lane.                                                                   |
| `clearedValueForType`         | Export         | `(type) => unknown`                              | –                 | What Delete writes for each column type.                                                         |
| `TMDataGridEditState<TData>` · `TMDataGridEditRowProjection<TData>` | Types | – | – | The value of `edit.state` and `edit.store`, and one open row's entry in its `rows`. `TData` defaults to `TMDataGridRowData`. |
| `TMDataGridEditRowSnapshot` | Type | `{ rowId, value, isNew, deleted }` | – | One row of `edit.getRows()`. |
| `data-dirty`                  | Data attribute | –                                                | –                 | On a body row holding a dirty draft.                                                             |
| `data-draft`                  | Data attribute | –                                                | –                 | On a body row or entry row committed into the draft store, waiting for a save.                   |
