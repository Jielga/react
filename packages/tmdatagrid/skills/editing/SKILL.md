---
name: editing
description: >
  Edit cells and rows in TMDataGrid. Covers the editing option and its two axes
  (mode: cell, cellConfirm, row; draft), the required getRowId, editing.onCommit
  and editing.onSaveDrafts, why the grid never mutates data, gating with
  editing.columns, meta.edit.enabled and meta.edit.field, the built-in editors
  picked by meta.type, custom editors via meta.edit.editor, value mapping with
  meta.edit.mapValue, validation at every level - meta.edit.validate,
  cross-field editing.rowValidators, cross-row editing.tableValidators over the
  draft-overlaid collection - adding and deleting rows (edit.addRow,
  newRowDefaults, onRowAdd, onRowDelete), the edit lane, TMDataGrid.DraftActions
  and renderActions, and the edit engine (begin, commit, commitAll, saveDrafts,
  addRows, setCellValue, setRowValues, getForm, store). Load when making a grid
  editable, choosing an edit mode, wiring a save, writing a cell editor,
  validating an edit, writing cells from a toolbar action or bulk fill, or when
  cells will not open.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.2.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/editing.md'
  - 'Jielga/react:packages/tmdatagrid/docs/draft-store.md'
  - 'Jielga/react:packages/tmdatagrid/docs/adding-rows.md'
  - 'Jielga/react:packages/tmdatagrid/docs/query-builder.md'
  - 'Jielga/react:packages/tmdatagrid/docs/editors.md'
  - 'Jielga/react:packages/tmdatagrid/docs/portfolio-rebalancer.md'
  - 'Jielga/react:packages/tmdatagrid/src/core/editEngine.ts'
  - 'Jielga/react:packages/tmdatagrid/src/useTMDataGrid.tsx'
---

# TMDataGrid - Editing

The `editing` option turns editing on, and `editing.mode` picks how commits
happen. Three facts decide every wiring question below:

- **The grid never mutates `data`.** `editing.onCommit` applies the change
  wherever the data lives, and the updated rows arrive back through `data`.
- **One row, one form, while it is open.** Each row being edited gets its own
  TanStack Form, keyed by row id and living outside the DOM, so a draft
  survives scrolling, sorting and filtering. A committed row holds values, not
  a form.
- **`getRowId` is required** once `editing` is set, and it must be the record's
  own identity. Drafts are keyed by it.

`@tanstack/react-form` becomes a peer dependency once editing is used.

## Setup

```tsx
const [employees, setEmployees] = useState(initial);

const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "cell",
    // The grid writes nothing: apply the change, and the edited row arrives
    // back through `data`.
    onCommit: ({ rowId, value }) =>
      setEmployees((previous) =>
        previous.map((employee) =>
          String(employee.id) === rowId ? value : employee,
        ),
      ),
  },
});

<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
  <TMDataGrid.Table<Employee> />
</TMDataGrid>;
```

Two rules are compile errors, not options that silently do nothing: `editing`
requires `getRowId`, and `editing.onSaveDrafts` exists only under
`editing.draft: true`. A draft store _without_ `onSaveDrafts` is fine:
`saveDrafts` falls back to the per-row `editing.onCommit` loop.

## The two axes

`editing.mode` sets what counts as a commit; `editing.draft` sets where that commit goes.
They are independent, and every pair is legal.

| Mode | Commits on | Cancels on | Controls |
| --- | --- | --- | --- |
| `"cell"` | Enter, Tab, leaving the cell | Escape | none |
| `"cellConfirm"` | ✓ or Enter; Tab walks input, ✓, ✕ and then leaves, keeping the draft | ✕ or Escape | ✓ / ✕ beside the input |
| `"row"` | Save in the edit lane, or Enter | Cancel, or Escape | generated edit lane |

Leaving a cell commits it only once the value passes: a refused commit keeps the editor open, invalid, with the message in its tooltip, until the value is fixed or Escape drops it.

| `editing.draft` | Where a commit goes |
| --- | --- |
| `false` (default) | Straight out: `onCommit`, `onRowAdd`, `onRowDelete` |
| `true` | Into the grid's draft store, until `edit.saveDrafts()` sends the lot |

Which to pick: `"cell"` for spreadsheet feel; `"cellConfirm"` when a stray click must not fire a request; `"row"` when the row is the unit of the save or a rule spans two columns.
Add `draft: true` for many edits sent as one transaction - `{ mode: "row", draft: true }` commits a whole row from the lane's ✓, `{ mode: "cell", draft: true }` commits a row as the caret leaves it.

An editor opens on double-click, or with the cell cursor on the cell: Enter, F2,
or typing, where the first character replaces the value. Delete or Backspace
clears the value and commits without opening an editor; under `draft: true`
the cleared value is held with the other drafts instead. Editing implies cell
selection: `cellSelection` defaults to `"single"` while `editing` is set. The
grid places the caret in the cell that was opened, and `edit.addRow()` places it
in the new row's first editable cell, so a `meta.edit.editor` receives focus
without handling it itself.

Under `"row"` the pencil, or a double-click on any cell, which puts the caret in
the cell clicked, opens every editable cell of the row, and ✓ saves them as one
commit. Rows accumulate: opening a second row leaves the first open, and each
row's ✓ and ✕ act on that row alone.

Under `draft: true` nothing reaches a callback until `saveDrafts`.
The mode's own commit gesture puts the row in the draft store instead of sending it, Escape drops that one draft, and committed rows accumulate.
`edit.commit(rowId)` goes to the draft store too, so there is no per-row escape hatch to the consumer.
A committed row is displayed: the cell renders the draft value through the column's own `cell` renderer, with the blue corner marking it dirty and `data-dirty` on the row.
It is a row like any other to the table: sorting, filtering, quick search, grouping, aggregates, export, selection, the row counts, `edit.getRows()` and `editing.tableValidators` all read its draft values, and the row callbacks receive it with the draft as `row.original`.
A committed row that stops matching a filter leaves the view, and the Save bar still counts it.
`data` itself is never modified, and only top-level rows are overlaid - `getSubRows` children keep their `data` values.
An entry row is row-shaped in every mode - every editable cell open at once, the browser's Tab, and the lane's ✓ to enter it.

The edit lane is the change indicator and the per-row undo: an edited row shows
a pencil icon and Revert, which drops that row's draft; a new row a plus icon, a
pencil that reopens it, and ✕; a row marked for deletion a trash icon and
Restore. A row holding a dirty draft hides the trash - revert first, then
delete. A row blocked by validation turns its icon red with the message in the
tooltip.

`saveDrafts` then sends the draft store: through the per-row
`editing.onCommit` / `editing.onRowAdd` / `editing.onRowDelete` loop by default,
or through one `editing.onSaveDrafts({ updated, created, deleted })` call when
that is set. `updated` entries carry a `rowId`, `created` entries a `tempId`, `deleted` is
a list of row ids. Rows failing validation stay open either way.

`onSaveDrafts` decides how much of the store is cleared: returning nothing
saves everything, throwing saves nothing, and returning
`{ updated, created, deleted }` (a `TMDataGridSaveDraftsResponse`) saves
everything except the ids reported `false`. Each key takes `false` for the
whole bucket or a map of id to result; an unnamed id saved. A kept row stays
committed, so the next `saveDrafts()` retries it.

`saveDrafts()` resolves a `TMDataGridSaveDraftsResult`, `{ ok, saved, kept, reopened }`.
Every id the save took from the draft store is in exactly one list - row ids for edits and deletions, temp ids for new rows, all kinds mixed:

- `saved` - left the draft store; the consumer accepted it
- `kept` - still in the draft store, still committed, retried by the next save: an id `onSaveDrafts` returned as failed, every id it was sent when it threw, or, without `onSaveDrafts`, a deletion whose `onRowDelete` threw
- `reopened` - open again with an error: a table rule rejected it, or on the per-row path its `onCommit` / `onRowAdd` threw
- `ok` - `true` when `kept` and `reopened` are both empty

On the per-row path a deletion always leaves the store and is reported in `saved`.
An empty store resolves `{ ok: true, saved: [], kept: [], reopened: [] }`.
Rows still open are in no list.

Rows carry `data-dirty` (values typed in), `data-draft` (committed, waiting for
Save), `data-deleted` and `data-new` - a committed new row in the body, or an
entry row in the block. The grid paints none of them; use `rowStyle` /
`rowClassName` or the attributes to highlight what is pending.

## What a commit receives

`editing.onCommit` is handed `{ rowId, value, original, changes, source }`.
`value` is the whole edited row, for saving a record; `changes` is the per-field
diff (`columnId`, `field`, `previous`, `next`), for a PATCH, and holds one entry
in cell mode.

The engine drops the draft only when `editing.onCommit` resolves. A slow save
keeps the draft on screen with a busy marker, and a **rejection keeps the form
open** with the error on the row.

## Which cells edit

A column is editable when it maps to a data path: its `accessorKey`, or
`meta.edit.field` for a column built on `accessorFn`. Dot paths reach into nested
records, so `accessorKey: "address.city"` edits `values.address.city`.

| Gate | Effect |
| --- | --- |
| `editing.columns: ["targetPct"]` | Only the named columns edit |
| `meta.edit.enabled: false` | The column never edits |
| `meta.edit.enabled: (row) => boolean` | Per row, per column |
| `meta.edit.field: "lastName"` | The path an `accessorFn` column writes to |
| `editing.isRowEditable: (row) => boolean` | The whole row, in every mode |

Group rows and the generated lanes (checkbox, row number, details, edit) never
edit.

`editing.columns` lists the column ids that take edits; unset, the default, every column mapping to a data path is editable.
It gates before `meta.edit`, never past it: a column left out takes no edits whatever its own meta says, and a listed column still answers to its `meta.edit.enabled`.
The same list decides which cells an entry row opens.
`edit.isColumnEditable(column)` answers the column's half of the question with no row in hand, for a toolbar or a menu, and `edit.canEditCell(row, column)` asks both halves.

```tsx
// Computed column writing back to a real field, and per-row gating.
columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
  id: "fullName",
  header: "Full name",
  meta: { label: "Full name", edit: { field: "lastName" } },
});
columnHelper.accessor("salary", {
  header: "Salary",
  meta: { edit: { enabled: (row) => row.original.status !== "Terminated" } },
});
```

## Editors and validation

`meta.type` picks the editor - `"string"` (the default), `"number"`,
`"boolean"`, `"date"`, `"select"` and `"multiSelect"` - and `meta.options` feeds
the two select editors from the same declaration the filter panel reads. Each
one, with the value it writes into the draft and the export that wraps it, is in
[references/editors-and-validation.md](references/editors-and-validation.md#the-built-in-editors).

`meta.edit.editor` replaces one, `meta.edit.validate` guards the field, and
`editing.rowValidators` carries cross-field rules. The validators are TanStack
Form's own, Standard Schema included, so a Zod schema passes straight through:

```tsx
import { z } from "zod";

// Field level, on the column. A bare schema means { onChange: schema }.
meta: { edit: { validate: z.string().min(2, "At least two characters") } }

// Form level, inside `editing`. Cross-field rules, under "row".
rowValidators: {
  onSubmit: z
    .object({ salary: z.number().positive(), status: z.string() })
    .refine((row) => row.status !== "Terminated" || row.salary === 0, {
      message: "A terminated employee has no salary",
    }),
}
```

Pathed issues land on the matching cells, pathless ones on the row, and cell
corners mark both: blue for a dirty draft, red for a validation error. A
field's message shows in a tooltip on the open editor, which the host renders
for a custom editor as much as a built-in one; the plain-function form of a
validator types `value` as `never`, so annotate the parameter -
`({ value }: { value: unknown })`.

`editing.tableValidators` carries the rules that need the other rows - no
duplicate keys, no overlapping ranges, shares summing to a total. Its
`onSubmit` / `onSubmitAsync` receive `{ value, rowId, isNew, rows }`, where
`rows` is the collection as it would stand if the commit landed: every draft
overlaid, committed new rows among them, the entry rows the table does not hold
appended, deletion-marked rows removed. Each row appears once. Same result
vocabulary as `rowValidators`; errors land on the committing row. The rules
re-run per committed row during `saveDrafts`, the only validation that runs
there: a committed row a later edit invalidated is reopened with its errors
and the save reports it in `reopened`.

```tsx
tableValidators: {
  onSubmit: ({ value, rowId, rows }) =>
    rows.some((r) => r.rowId !== rowId && r.value.code === value.code)
      ? { fields: { code: "Codes must be unique" } }
      : undefined,
}
```

Columns derived from the other rows (a weight as a share of the total) plus a
table-wide rule (targets may not total more than 100%) are worked through in
[references/editors-and-validation.md](references/editors-and-validation.md),
from `packages/tmdatagrid/docs/portfolio-rebalancer.md`.

`meta.edit.mapValue` rewrites a value instead of rejecting it: uppercase a code,
strip spaces from an IBAN, clamp a number. It runs on every write an editor
makes, so a text input maps per keystroke, and what it returns is what the
validators check and what is committed.

```tsx
meta: { edit: { mapValue: ({ value }) => String(value).toUpperCase() } }
```

Detail for all three: [references/editors-and-validation.md](references/editors-and-validation.md).

## Adding and deleting rows

`edit.addRow()` opens an entry row in a sticky block under the header, seeded
from `editing.newRowDefaults`. `edit.addRow(values)` overrides that seed key by
key, so `addRow()` opens the `newRowDefaults` row and `addRow(values)` opens it
with those fields filled in - pass a whole row to duplicate it. Enter, or the
lane's ✓, commits the add through `editing.onRowAdd`; under `draft: true` it
commits the row into the draft store, validated, and
`saveDrafts` reports it in `created`. Escape, or ✕, discards the entry. An entry
row never OK'd is not part of a save - it stays open.

Under `draft: true` a committed entry row leaves the entry block and becomes a
body row with no inputs, marked `data-new` and `data-draft`, tinted with
`--dg-row-new-bg`, and sorted, filtered and counted with the rest on the values
it was entered with. `editing.newRowsSticky: true` keeps committed rows in the
entry block until the save instead, out of the body's sort and out of the row
count. Double-click, or the lane's pencil, reopens it back into the entry block;
✕ removes it. To limit how many entry rows are open at once, gate the Add
button on
`useSelector(grid.edit.store, (s) => s.newRows.some((n) => !n.committed))`.

```tsx
const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "row",
    draft: true,
    newRowDefaults: () => ({ id: 0, firstName: "", salary: 30_000 }),
    onSaveDrafts: async ({ updated, created, deleted }) => {
      await api.saveBatch({ updated, created, deleted });
    },
  },
});

<TMDataGrid.Toolbar>
  <Button onClick={() => grid.edit.addRow()}>Add row</Button>
  <Button onClick={() => grid.edit.addRow({ salary: 50_000 })}>
    Add senior
  </Button>
  <TMDataGrid.Spacer />
  <TMDataGrid.DraftActions />
</TMDataGrid.Toolbar>;
```

`edit.addRows(rows, options?)` opens a batch in one write. `{ commit: true }`
submits each row as it lands - the import case: valid rows are committed,
invalid ones stay open in the entry block with their errors, and the result
(`{ ok, committed, open }`) says which went which way; `ok` is `true` when
`open` is empty. Column rules are enforced even though the rows never had an
editor on screen, because the engine runs `meta.edit.validate` itself at
commit.

```tsx
const { ok, open } = await grid.edit.addRows(parsed, { commit: true });
if (!ok) notify(`${open.length} rows need attention`);
await grid.edit.saveDrafts();
```

`edit.deleteRow(rowId)` calls `editing.onRowDelete({ rowId, row })`
immediately, so put any confirmation inside that callback. Under `draft: true`
it toggles a mark instead: the row renders struck through and inert
(`data-deleted`), the lane shows Restore, and `saveDrafts` reports the ids in
`deleted`. You apply adds and deletes, the same as edits. The engine's `tempId`
(`__new__1`, …) does not need to become a real id.

## The built-in controls

The generated edit lane (`EDIT_COLUMN_ID`, pinned right) appears when `editing.mode` is `"row"`, when `editing.draft` is on, or when `editing.onRowDelete` is set.
Nothing else adds it.
It holds one thing per axis: the mode's own controls while a row is open - Save and Cancel under `"row"` - and, once a row is committed, the row-state marker with Revert or Restore.
A committed row never offers a save.
The trash shows when the deletion has somewhere to report to: `onRowDelete` is set, or under `draft: true`, `onSaveDrafts` is.
If validation blocks a row, its marker - or the open row's ✓ - turns red with the message in the tooltip, which is where a pathless `rowValidators` message shows.
Every control carries a tooltip from the labels.

`TMDataGrid.DraftActions` is Save with the draft-store count, Discard, and a
note counting the rows still open. Save greys out while the store is empty
however much is being typed, spins while a submit is in flight, renders nothing
while editing is off, and works under any mode, not only draft.

`renderActions` replaces the set and hands over its pieces:

```tsx
<TMDataGrid.DraftActions
  renderActions={({ state, actions, Controls }) => (
    <Group>
      {state.draftCount > 0 && <Badge>{state.draftCount}</Badge>}
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

`state` is
`{ draftCount, openCount, openRowIds, isSubmitting, isSaving }`. `actions` is
`{ save, commitAll, discard, scrollToRow, scrollToFirstOpenRow }`, and
`Controls` is `{ Save, Discard, OpenRowsNote }`.
`actions.save` and `actions.commitAll` resolve what `edit.saveDrafts()` and `edit.commitAll()` resolve.

The grid is always virtualized, so an open row far down the list has no element
to scroll to. `actions.scrollToFirstOpenRow(align?)` moves the virtualizer to
the topmost open row and answers whether it could be reached; `false` means
every open row is filtered out, on another page or collapsed in a group. An
open entry row answers `true` without scrolling - the entry block is sticky, so
it is on screen already.

The two orderings differ: `state.openRowIds` is the order the grid opened the
rows, `scrollToFirstOpenRow` is display order. `openRowIds[0]` need not be the
row it reaches.

## The engine: `edit`

`grid.edit` is public, and everything the built-in controls do goes through it:
`begin` and `commit`, `cancel` / `cancelAll`, `commitAll` / `saveDrafts`,
`setCellValue` / `setRowValues` / `clearCell`, `addRow` / `addRows` /
`deleteRow`, `getForm`, and `store` for `useSelector` (an example is under
[Submitting an outer form](#high-submitting-an-outer-form-while-the-grid-holds-a-draft)).
`commitAll()` resolves a `TMDataGridCommitAllResult`, `{ ok, committed, open }`: every row open at the call is in exactly one list, and `ok` is `true` when `open` is empty.
`commit(rowId)` alone resolves a plain boolean.
`edit.store` publishes each open or committed row's drafted values as
`rows[rowId].values`, which is what a cross-row check reads. A `cell`
renderer needs no lookup: its `row.original` is already the row as shown, and
`getRowValues(rowId)` is the same row for a handler with no cell context.
Every member with its signature, the gates, `isColumnEditable`, `deactivate`,
and the `edit.store` shape are in
[references/editing-api.md](references/editing-api.md#the-edit-engine).

`getForm` exposes an open row's form: render it in a drawer and it shares
values, dirty state and errors with the inline cells, because it is the same
`FormApi`. It is `undefined` for a committed row, which holds values and no
form; `begin` reopens the row with a form seeded from them.

`edit.setCellValue(rowId, columnId, value)` writes one cell and commits its row with no editor open, which is what a toolbar action or a bulk fill wants.
The row need not be mounted, so a selected row inside a collapsed group takes the write like any other.
`edit.setRowValues(rowId, values)` does several cells of one row in a single commit, keyed by column id, all or nothing.

```tsx
for (const row of grid.table.getSelectedRowModel().rows) {
  await grid.edit.setCellValue(row.id, "targetPct", equalWeight(row.original));
}
```

Under `draft: true` each row is committed into the draft store like any hand-made edit, with the same change markers and the same per-row revert, and the basket leaves through `saveDrafts`.
`value` is the stored value: no editor runs, so `meta.edit.mapValue` does not run either, while `meta.edit.validate` does.
Both resolve `false` when the cell takes no edit - no such row or column, `editing.columns` excludes it, `meta.edit.enabled` is off, or the row is not editable - and when validation refuses the value, which leaves the row open carrying its errors.

## Inside an outer form

A `@tanstack/react-form` form can hold the row array, with the grid as a
controlled field: `data` from `field.state.value`, and `editing.onCommit` /
`editing.onRowAdd` / `editing.onRowDelete` composing the next array into
`field.handleChange`. Use `editing.mode: "row"` so a row reaches the form on
approval, map by row id (never index), and assign negative ids to new rows.

The validation split follows from what each side can see: **a rule decidable
from one row belongs to the grid (`meta.edit.validate`,
`editing.rowValidators`), and a rule needing the other rows belongs to
`editing.tableValidators`, which is handed the collection with every draft
overlaid.** A collection rule may live in the outer form's field validator
instead, where the submit gate is the form's own; `edit.store` publishes each
row's drafted values as `rows[rowId].values` for a rule there that must count
pending values.

## Common mistakes

Each one compiles and raises no warning. The reason and the fix for every entry
are in [references/common-mistakes.md](references/common-mistakes.md).

| Severity | Mistake |
| --- | --- |
| CRITICAL | Expecting the grid to write into `data` - without `editing.onCommit` the cell reverts |
| CRITICAL | `getRowId` built from the row index - drafts follow the index, not the record |
| HIGH | A cell editor defined inside the component - a new type per render unmounts the editor |
| HIGH | A cross-field rule under `mode: "cell"` - `rowValidators` needs `"row"` |
| HIGH | An `accessorFn` column with no `meta.edit.field` - it maps to nothing and stays read-only |
| HIGH | Swallowing the error in `editing.onCommit` - a resolved catch drops the draft |
| HIGH | Submitting an outer form while the grid holds a draft - it saves stale rows |
| HIGH | A bulk write built from `begin` + `getForm` + `commit` - `getForm` can be `undefined`; `edit.setCellValue` is the write |
| MEDIUM | A computed column frozen while a row is edited - `accessorFn` reads `data`; read the draft from `edit.store`'s `rows[rowId].values` |
| MEDIUM | Reading a commit's result as the saved value - it is a `boolean` about the form |
| MEDIUM | Expecting `editing.onRowDelete` to fire under draft - the mark waits for `saveDrafts` |
| MEDIUM | A custom editor that binds no invalid state - the host shows the message in a tooltip, but the control keeps its normal border; bind a boolean to `error` |

## References

- [Editors and validation](references/editors-and-validation.md) - the editor
  API, wrapping a built-in, what `mapValue` leaves alone, field, row and
  cross-row validators, derived columns with a table-wide rule, server-side
  errors.
- [Editing API](references/editing-api.md) - every option, callback, column meta
  field, export, CSS variable and data attribute belonging to editing.
- [Common mistakes](references/common-mistakes.md) - the failure modes above,
  each with its wrong and correct form.

See also: the `columns` skill for `meta.type` and the shared `meta.options`
source, and the `testing` skill for driving editors from a test.
