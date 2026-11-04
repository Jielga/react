# Editing - common mistakes

The failure modes that compile, raise no warning, and lose a user's typing.
Severity is how much data or trust the mistake costs.

## CRITICAL Expecting the grid to write into `data`

The grid holds no copy of the rows. Without `editing.onCommit` an edit commits,
the draft clears, and the cell reverts to the value in `data`.

Wrong:

```tsx
useTMDataGrid({
  data: employees,
  columns,
  getRowId,
  editing: { mode: "cell" },
});
```

Correct: wire `editing.onCommit` to apply the change where the data lives, as
in the skill's Setup section.

Source: `packages/tmdatagrid/docs/editing.md`, `packages/tmdatagrid/src/core/editEngine.ts`.

## CRITICAL `getRowId` built from the row index

`getRowId` accepts any string, so an index-based id compiles. Drafts are keyed
by it, so after a sort or a filter the draft is applied to whichever record now
sits at that index.

Wrong:

```tsx
getRowId: (row, index) => String(index),
```

Correct:

```tsx
getRowId: (row) => String(row.id),
```

Source: `packages/tmdatagrid/src/useTMDataGrid.tsx` (`TMDataGridEditingCallbacks`).

## HIGH A cell editor defined inside the component

`meta.edit.editor` is rendered as JSX, so its identity is its component type. An
inline arrow function is a new type on every render, which unmounts the open
editor and discards what was being typed.

Wrong:

```tsx
meta: { edit: { editor: ({ field }) => <Slider value={field.state.value} /> } },
```

Correct:

```tsx
// Module scope, referenced by name.
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit }) => (
  <Slider
    value={Number(field.state.value ?? 0)}
    onChange={(next) => field.handleChange(next)}
    onChangeEnd={() => void commit()}
  />
);

meta: { edit: { editor: SalaryEditor } },
```

Source: `packages/tmdatagrid/docs/editors.md`, `packages/tmdatagrid/src/core/editEngine.ts`.

## HIGH A cross-field rule under `editing.mode: "cell"`

Under `"cell"` each cell commits on its own, so a rule spanning two columns
cannot be satisfied by either one: the first cell edited is rejected against the
other column's old value, and the row cannot be saved.

Correct: `editing.rowValidators` needs `mode: "row"`, which validates the
whole row in one commit.

Source: `packages/tmdatagrid/docs/editors.md` (Validation).

## HIGH An `accessorFn` column that never opens an editor

Editability follows the data path, not the column. A column built on an accessor
function has no `accessorKey`, so it maps to nothing and stays read-only while
every other column edits. No warning is raised.

Wrong:

```tsx
columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
  id: "fullName",
  header: "Full name",
});
```

Correct:

```tsx
columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
  id: "fullName",
  header: "Full name",
  meta: { label: "Full name", edit: { field: "lastName" } },
});
```

Source: `packages/tmdatagrid/docs/editing.md` (Which cells edit).

## HIGH Swallowing the error in `editing.onCommit`

The draft is dropped when `editing.onCommit` resolves. A `try/catch` that logs
the failure resolves it, so a save that failed on the server clears the editor
and the grid shows the old value as though nothing happened.

Wrong:

```tsx
onCommit: async ({ rowId, value }) => {
  try {
    await api.put(rowId, value);
  } catch (error) {
    console.error(error);
  }
},
```

Correct: no `catch` - let the rejection propagate, and the form stays open
with the error on the row.

Source: `packages/tmdatagrid/src/useTMDataGrid.tsx` (`TMDataGridEditingCallbacks`).

## HIGH Submitting an outer form while the grid holds a draft

The outer form's array contains only committed rows. Under any mode a mid-edit
row is invisible to it, and under `draft: true` every edit is until
`saveDrafts()`,
so a form submit saves stale rows and collection rules skip pending values.

Correct:

```tsx
const hasOpenDraft = useSelector(grid.edit.store, (s) => s.openRowIds.length > 0);

<Button type="submit" disabled={!canSubmit || hasOpenDraft}>Save</Button>
// or commit and flush instead of blocking:
const committed = await grid.edit.commitAll();
const flushed = committed.ok ? await grid.edit.saveDrafts() : undefined;
if (flushed?.ok) await form.handleSubmit();
```

Both results are objects, so test `.ok`: `if (await grid.edit.saveDrafts())` is always true.

Source: `packages/tmdatagrid/docs/query-builder.md` (Which mode, Submitting).

## HIGH A bulk write built from `begin`, `getForm` and `commit`

`edit.setCellValue(rowId, columnId, value)` writes one cell and commits its row, so a fill over the selection is one call per row.
Reaching instead for `begin`, then `getForm(rowId)?.setFieldValue(...)`, then `commit` looks equivalent and is not: under `editing.mode: "cell"`, `begin` defers behind a pending commit whenever another row is open, so `getForm(rowId)` returns `undefined` immediately after it and the optional chain writes nothing.
The `commit` that follows finds no form and resolves `true`, reporting a write that never happened.

Wrong:

```tsx
for (const row of grid.table.getSelectedRowModel().rows) {
  grid.edit.begin({ rowId: row.id, columnId: "targetPct" });
  grid.edit.getForm(row.id)?.setFieldValue("targetPct", next(row.original));
  await grid.edit.commit(row.id);
}
```

Correct:

```tsx
for (const row of grid.table.getSelectedRowModel().rows) {
  await grid.edit.setCellValue(row.id, "targetPct", next(row.original));
}

// Several cells of one row: one commit, one draft entry.
await grid.edit.setRowValues(rowId, { status: "Closed", closedOn: today() });
```

Both write the stored value through the row's form, so `meta.edit.mapValue` does not run - no editor is involved - while `meta.edit.validate` does, at the commit.
A refused value leaves the row open carrying its errors and the call resolves `false`, so read the result rather than assuming the fill landed.

Source: `packages/tmdatagrid/src/core/editEngine.ts` (`begin`, `writeFields`).

## MEDIUM Reading an open row's values off `row.original` outside a cell

Inside a `cell` renderer, `row.original` and `getValue()` are the row as
shown: the open form's values while the row is edited, the committed draft
after ✓, and `data` otherwise - a computed column follows the draft as it is
typed, and a button in a cell sends the draft the user sees. Outside it, the
row callbacks (`onRowClick`, `renderRowContextMenu`, `rowClassName`) and any
code holding a row id see `data`, or the committed draft, and never an open
form's values.

Correct: reach the row as shown by id:

```tsx
const shown = grid.edit.getRowValues(row.id) ?? row.original;
```

Source: `packages/tmdatagrid/docs/editing.md` (How a draft renders).

## MEDIUM Reading a commit's result as the saved value

`edit.commit(rowId)` resolves a `boolean`: `false` when validation or a rejected commit kept the row open.
`edit.commitAll()` resolves `{ ok, committed, open }`, and `edit.saveDrafts()` resolves `{ ok, saved, kept, reopened }`.
Each id is in exactly one list, and `ok` is `false` when any row stayed open, was kept in the draft store, or was reopened with an error.
Ignoring the result reports a save that did not happen, and testing the object itself is always true.

Wrong:

```tsx
if (await grid.edit.saveDrafts()) notifications.show({ message: "Saved" });
```

Correct:

```tsx
const { ok, kept, reopened } = await grid.edit.saveDrafts();
notifications.show({
  message: ok
    ? "Saved"
    : `${kept.length} rows not saved, ${reopened.length} rows need attention`,
});
```

Source: `packages/tmdatagrid/src/core/editEngine.ts` (`TMDataGridEditApi`).

## MEDIUM Expecting `editing.onRowDelete` to fire under a draft store

Without `editing.draft`, `edit.deleteRow` calls `editing.onRowDelete` at once.
Under `draft: true` it only toggles a deletion mark, so nothing is removed until
`saveDrafts`: the ids arrive as `deleted` in `editing.onSaveDrafts`, or, with
no such callback, in the per-row `editing.onRowDelete` loop. A confirmation
placed inside `editing.onRowDelete` therefore guards the save, not the trash.

Source: `packages/tmdatagrid/docs/adding-rows.md`.

## MEDIUM A custom editor that binds no invalid state

The message is the host's: it shows in a tooltip on the editor whatever the
editor is. The invalid styling is the editor's own, and one that binds nothing
keeps its normal border while the commit is refused, so the only marks on
screen are the tooltip and `data-invalid` on the cell.

Wrong:

```tsx
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit }) => (
  <Slider value={field.state.value} onChange={field.handleChange} onChangeEnd={() => void commit()} />
);
```

Correct:

```tsx
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit }) => {
  const hasError = field.state.meta.errors.length > 0;
  return (
    <Slider
      value={field.state.value}
      onChange={field.handleChange}
      onChangeEnd={() => void commit()}
      error={hasError}
    />
  );
};
```

Source: `packages/tmdatagrid/docs/editors.md` (Writing your own).
