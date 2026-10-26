# Editing API

Reference for the `editing` skill. Everything editing owns, in one table per
kind.

## Hook options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `editing` | `TMDataGridEditingOptions` | off | The editing namespace. Setting it turns editing on. |
| `editing.mode` | `"cell" \| "cellConfirm" \| "row"` | – | What counts as a commit, and which controls trigger it. |
| `editing.draft` | `boolean` | `false` | Where a commit goes. On, it is held in the grid's draft store until `edit.saveDrafts()`. |
| `getRowId` | `(row) => string` | – | A TanStack table option, required once `editing` is set. Drafts are keyed by it. |
| `editing.columns` | `ReadonlyArray<string>` | every column mapping to a data path | The column ids that take edits. Gates before `meta.edit`, never past it: a column left out takes no edits whatever its meta says, and a listed column still answers to its `meta.edit.enabled`. Also decides which cells an entry row opens. |
| `editing.isRowEditable` | `(row) => boolean` | – | Closes a whole row to editing, in every mode. |
| `editing.rowValidators` | `TMDataGridRowValidators` | – | Form-level validation. Cross-field rules live here. |
| `editing.tableValidators` | `TMDataGridTableValidators` | – | Cross-row rules, handed the collection with every draft overlaid. |
| `editing.newRowDefaults` | `TData \| (() => TData)` | – | Seeds the entry row's form. A function is called per added row. |
| `editing.newRowsSticky` | `boolean` | `false` | `draft: true` only. Keeps committed entry rows in the sticky entry block, out of the body's sort and out of the row count, until the save. Off, a committed entry row becomes a body row. |
| `cellSelection` | `"none" \| "single" \| "range"` | `"single"` while `editing` is set | Editing turns the cell cursor on; set it explicitly to override. |

Passing any other member of `editing` without `mode` is a compile error, and
`onSaveDrafts` and `newRowsSticky` exist only in the `draft: true` branch of
the type.

## Callbacks

| Name | Argument | What it does |
| --- | --- | --- |
| `editing.onCommit` | `{ rowId, value, original, changes, source }` | Applies one row's change. Reject to keep the draft and show the error. |
| `editing.onSaveDrafts` | `{ updated, created, deleted }` | `draft: true` only. One call for the whole draft store. May return a `TMDataGridSaveDraftsResponse` naming the ids that failed; they stay in the draft store. Each of its buckets is a `TMDataGridSaveOutcomes`: `boolean \| Record<string, boolean>`, where `false` keeps an entry's draft and an id the map does not name counts as saved. Without it, `saveDrafts` loops `editing.onCommit`, `editing.onRowAdd` and `editing.onRowDelete`. |
| `editing.onRowAdd` | `{ tempId, value }` | Commits an entry row. Mint the real id here. |
| `editing.onRowDelete` | `{ rowId, row }` | Deletes a row. Shows the trash; under `draft: true`, `onSaveDrafts` shows it too. |

`changes` entries are `{ columnId, field, previous, next }`; `field` is the data
path, which may be dotted.

## Column meta

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `meta.type` | `TMDataGridColumnType` | `"string"` | Picks the built-in editor, and the filter operators. |
| `meta.options` | `TMDataGridOptionsSource` | – | Choices for `select` / `multiSelect`, shared with the filter panel. Array, `"faceted"`, or a function. |
| `meta.edit.enabled` | `boolean \| ((row) => boolean)` | editable where a field maps | Whether this column's cells edit. |
| `meta.edit.field` | `string` | The `accessorKey` | The data path an edit writes to. The only way an `accessorFn` column edits. |
| `meta.edit.editor` | `TMDataGridEditorComponent` | By `meta.type` | Replaces the cell editor. Define at module scope. |
| `meta.edit.validate` | `TMDataGridFieldValidate` | – | Field-level validation. A bare schema means `onChange`. |

## The `edit` engine

`grid.edit`, type `TMDataGridEditApi`.

| Member | Signature | Notes |
| --- | --- | --- |
| `begin` | `({ rowId, columnId }) => void` | Row mode opens the entire row either way. `columnId` selects which cell takes the caret; `null` (the pencil) uses its first editable one. On a committed row it reopens it, taking it back out of the draft store. |
| `commit` | `(rowId) => Promise<boolean>` | The OK gesture: submits the row's form. `false` keeps it open with its errors, and the message outlives the editor that found it. Under `draft: true` a pass commits the row into the draft store - no consumer callback runs until `saveDrafts`. Column rules run whether or not an editor is mounted. |
| `commitAll` | `() => Promise<TMDataGridCommitAllResult>` | Submits every open row. Rows that fail stay open. Resolves `{ ok, committed, open }`: every row open at the call is in exactly one list, and `ok` is `false` when one stayed open. |
| `saveDrafts` | `() => Promise<TMDataGridSaveDraftsResult>` | Sends the draft store, re-running `editing.tableValidators` only; a committed row that fails is reopened with its errors. Open rows are left alone and stay open. Resolves `{ ok, saved, kept, reopened }` over row ids and temp ids, all kinds mixed: `saved` left the draft store, `kept` is still in it for the next save (reported failed by `onSaveDrafts`, sent when it threw, or a deletion whose per-row `onRowDelete` threw), `reopened` is open again with an error (a table rule, or a throwing per-row `onCommit` / `onRowAdd`). `ok` is `false` when anything was kept or reopened. A call during a save joins it and resolves the same result. |
| `cancel` | `(rowId) => void` | Drops one draft. |
| `cancelAll` | `() => void` | Drops every draft. |
| `deactivate` | `() => void` | Closes the editor without touching the draft, as blur does under `"cellConfirm"`. |
| `clearCell` | `(rowId, columnId) => Promise<boolean>` | What Delete does: writes the type's empty value and commits. |
| `setCellValue` | `(rowId, columnId, value) => Promise<boolean>` | Writes one cell and commits the row, with no editor - toolbar actions and bulk fills. The row need not be mounted; a row inside a collapsed group takes the write. `value` is the stored value, so `meta.edit.mapValue` does not run and `meta.edit.validate` does. Under `draft: true` the row is committed into the draft store like any hand-made edit. `false` when the cell takes no edit, or when validation refused the value and left the row open with its errors. |
| `setRowValues` | `(rowId, values) => Promise<boolean>` | `setCellValue` for several cells of one row in a single commit - one consumer call and one draft entry. Keys are column ids. All or nothing: if any named cell takes no edit, nothing is written and it resolves `false`. |
| `addRow` | `(values?) => string` | Opens an entry row, returns its `tempId`. `values` overrides `editing.newRowDefaults` key by key for that row; with no argument the row is `newRowDefaults` alone. |
| `addRows` | `(rows, options?: TMDataGridAddRowsOptions) => Promise<TMDataGridAddRowsResult>` | Opens a batch in one write, each row seeded as `addRow` seeds. `{ commit: true }` submits each as it lands - valid rows commit, invalid ones stay open with their errors. Resolves `{ ok, committed, open }`; `ok` is `false` when a row stayed open. |
| `deleteRow` | `(rowId) => void` | `editing.onRowDelete`, or a deletion mark under `draft: true`. Idempotent: a second call leaves the row marked; `restoreRow` is the undo. |
| `canEditCell` | `(row, column) => boolean` | The check the built-in controls use. Both halves: the column's and the row's. |
| `canEditRow` | `(row) => boolean` | The pencil's gate. |
| `isColumnEditable` | `(column) => boolean` | The column's half alone, with no row in hand: it maps to a field, `editing.columns` lists it when that is set, and `meta.edit.enabled` is not `false`. |
| `canDeleteRows` | `() => boolean` | Whether the delete control should be shown. |
| `getForm` | `(rowId) => TMDataGridRowEditForm \| undefined` | The open row's live `FormApi`; `undefined` for a committed row. |
| `getRowValues` | `(rowId) => TData \| undefined` | The row as shown: the open form's values, else the committed draft, else the `data` value. `undefined` for an unknown row. |
| `getRows` | `() => ReadonlyArray<TMDataGridEditRowSnapshot>` | Every row as shown, from the core row model: drafts overlaid, entry rows appended, deletion-marked rows included and flagged `deleted`. |
| `state` | `TMDataGridEditState` | Snapshot, for reads outside React. |
| `store` | `Store<TMDataGridEditState>` | For `useSelector`. |

`TMDataGridEditState`:

```ts
type TMDataGridEditState = {
  // The cell the last open gesture named - where the caret goes.
  active: { rowId: string; columnId: string | null } | null;
  // Every row the grid holds work for: open rows and committed rows. A row
  // is *open* when it is in here and not in `committedRowIds`.
  openRowIds: ReadonlyArray<string>;
  // One `TMDataGridEditRowProjection` per row in `openRowIds`.
  rows: Record<
    string,
    {
      dirtyFields: ReadonlyArray<string>;
      errorFields: ReadonlyArray<string>;
      hasRowError: boolean;
      isSubmitting: boolean;
      // The row as drafted, reference-stable while no value changes.
      values: TMDataGridRowData;
    }
  >;
  // The draft store's edit slice: existing rows that passed their commit,
  // held as values for `saveDrafts`. Empty without `editing.draft`.
  committedRowIds: ReadonlyArray<string>;
  // What a committed row *is* to the table: the draft store's values per row,
  // snapshotted at each commit and kept across a reopen, so the row holds its
  // place until it commits again or is dropped. The grid feeds these to the
  // table in place of the consumer's records.
  committedValues: Readonly<Record<string, TMDataGridRowData>>;
  // `committed` is "in the store, awaiting the save". Without `editing.draft`
  // a commit adds through `onRowAdd`, so it stays `false`.
  newRows: ReadonlyArray<{ tempId: string; committed: boolean }>;
  deletedRowIds: ReadonlyArray<string>;
  // `true` while `saveDrafts` is in flight.
  isSaving: boolean;
};
```

## Components and exports

| Name | Kind | What it is |
| --- | --- | --- |
| `TMDataGrid.DraftActions` | Component | Save with the draft-store count, Discard, and a note counting the rows still open. Any mode; renders nothing while editing is off. Takes `renderActions` over `{ state, actions, Controls }` - `state.openRowIds` and `actions.scrollToFirstOpenRow(align?)` reach the rows left open. |
| `TMDataGridDraftActions` | Export | The same component, for use outside the namespace. |
| `EDIT_COLUMN_ID` | Export | `"__edit__"`, the generated edit lane's id. |
| `clearedValueForType` | Export | `(type) => unknown` - what Delete writes per column type. |
| `hasPendingEdits` | Export | `(state) => boolean` - unsaved work: an open row with a changed value, any entry row, the draft store, or a save in flight. `useSelector(grid.edit.store, hasPendingEdits)` for a navigation blocker; do not use `openRowIds.length`, which also counts committed rows and rows that are only open. |
| `getEditFieldName` | Export | `(column) => string` - the data path a column's edits write to. |
| `normalizeFieldValidate` | Export | `(validate) => validators` - a bare schema into Form's shape. |
| `TMDataGridStringEditor` … `TMDataGridMultiSelectEditor` | Exports | The six built-in editors, for wrapping. |

Types: `TMDataGridEditMode`, `TMDataGridEditApi`, `TMDataGridEditState`,
`TMDataGridEditCommitArgs`, `TMDataGridSaveDraftsArgs`,
`TMDataGridEditChange`, `TMDataGridEditorArgs`, `TMDataGridEditorComponent`,
`TMDataGridEditField`, `TMDataGridEditRowProjection`, `TMDataGridFieldValidate`,
`TMDataGridRowValidators`, `TMDataGridRowEditForm`, `TMDataGridRowAddArgs`,
`TMDataGridRowDeleteArgs`, `TMDataGridEditingOptions`,
`TMDataGridSaveOutcomes`, `TMDataGridAddRowsOptions`,
`TMDataGridEditValueMapArgs`, `TMDataGridEditCommitMapArgs`,
`TMDataGridTableValidateArgs`.

## The edit lane

Generated, pinned right, id `EDIT_COLUMN_ID`. It appears when any of these
holds:

- `editing.mode: "row"` - the lane is Save and Cancel's home
- `editing.draft` - the lane is the change indicator and the per-row revert,
  and `editing.onSaveDrafts` is not required for it
- `editing.onRowDelete` is set - the trash can has somewhere to report to

`"cell"` and `"cellConfirm"` have no lane unless `editing.draft` or
`editing.onRowDelete` asks for one.

The trash itself shows when the deletion has somewhere to report to:
`onRowDelete` is set, or under `draft: true`, `onSaveDrafts` is - a deletion
mark is part of the save.

What the lane holds follows the row's state, one axis each. An open row shows
the mode's own controls, `save-row` and `cancel-row`. A committed row shows
`row-state` instead, whose `data-state` is `new`, `edited` or `deleted`,
together with `revert-row` on an edited row, `restore-row` on one marked for
deletion, and `edit-row` plus `discard-new-row` on an entered new row - never a
save, which the engine would only commit again. A committed row hides `delete-row`.
Every control carries a tooltip from the labels, `revertRow`, `rowStateNew`,
`rowStateEdited` and `rowStateDeleted` among them.

## Styling and test hooks

| Name | Kind | What it is |
| --- | --- | --- |
| `--dg-entry-height` | CSS variable | Height of the sticky entry block. From `size`. |
| `--dg-row-new-bg` | CSS variable | Background of a committed new row, in the body or the entry block. A green tint. |
| `data-deleted` | Row attribute | On a row marked for deletion under `draft: true`. |
| `data-dirty` | Row attribute | On a body row holding a dirty draft. Also on the cell whose field is dirty. |
| `data-new` | Row attribute | On a body row that is a committed new row, and on an entry row. |
| `data-committed` | Entry row attribute | On an entry row once it is committed, awaiting the save. Seen only under `editing.newRowsSticky`. |
| `data-dg-part="editor-input"` | Part | The control inside an editing cell. |
| `data-dg-part="save-row"` / `"cancel-row"` | Parts | The edit lane's buttons on an open row, with `data-row-id`. |
| `data-dg-part="row-state"` | Part | The draft store's change marker, with `data-row-id` and `data-state` of `new`, `edited` or `deleted`. |
| `data-dg-part="revert-row"` / `"restore-row"` | Parts | Drops a row's draft, and undoes a deletion mark, with `data-row-id`. |
| `data-dg-part="edit-row"` / `"delete-row"` | Parts | The idle lane's pencil and trash, with `data-row-id`. `edit-row` also reopens an entered new row. |
| `data-dg-part="confirm-new-row"` / `"discard-new-row"` | Parts | An entry row's ✓ and ✕, with `data-row-id`. |
| `data-dg-part="save-all"` / `"discard-all"` | Parts | `DraftActions`. |

See the `testing` skill for how to compose these into selectors.
