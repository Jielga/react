# A query builder form

A search form holds dates, a title filter and a list of extra conditions. The
conditions are rows, so the condition builder is a grid, wrapped as a form
field: rows come in through `value`, and approved changes go back out through
`onChange`.

```demo
file: recipes/QueryBuilderForm.tsx
hint: Add a condition and pick Status - the value editor becomes a select. Delete every condition, or repeat one, and Search says why it will not.
height: 560
```

The form holds the array; the grid holds the row being edited. The grid never
mutates `data`, so the form's state is only ever what the user has approved.

## Wrapping the grid as a field

The grid is wrapped once, as an ordinary controlled component:

```tsx
function ConditionsGrid({ value, onChange }: {
  value: Array<QueryCondition>;
  onChange: (next: Array<QueryCondition>) => void;
}) {
  const grid = useTMDataGrid({
    data: value,
    columns,
    getRowId: (row) => String(row.id),
    editing: {
      mode: "row",
      rowValidators,
      onCommit: ({ rowId, value: row }) =>
        onChange(value.map((c) => (String(c.id) === rowId ? row : c))),
      onRowAdd: ({ value: row }) =>
        onChange([...value, { ...row, id: Math.min(0, ...value.map((c) => c.id)) - 1 }]),
      onRowDelete: ({ rowId }) =>
        onChange(value.filter((c) => String(c.id) !== rowId)),
      newRowDefaults: () => ({ id: 0, field: "title", operator: "contains", value: "" }),
    },
  });
  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<QueryCondition> />
    </TMDataGrid>
  );
}
```

And handed to the form as a field:

```tsx
<form.Field
  name="conditions"
  validators={{
    onChange: ({ value }) =>
      value.length === 0 ? "Add at least one condition" : undefined,
  }}
>
  {(field) => (
    <ConditionsGrid value={field.state.value} onChange={field.handleChange} />
  )}
</form.Field>
```

`field.handleChange` is the `onChange`: it writes the array into the form and
runs the field's validators. `onChange` carries the whole next array rather than
a diff.

- **Map by row id, never by index.** A sort or a delete moves the index; the
  draft is keyed by the id.
- **`data` identity stays stable.** `field.state.value` changes identity only
  when a row is written, which is what `data` requires.
  See [useTMDataGrid](/docs/use-tm-data-grid).
- **New rows count down from `-1`.** `Math.min(0, ...ids) - 1`, so an emptied
  grid starts at `-1` rather than `-Infinity` and existing negative ids keep
  descending. The grid's `tempId` never leaves the grid: the id you assign in
  `editing.onRowAdd` is the one the form sees.

## Where validation belongs

A rule that can be decided from one row belongs to the grid. A rule that needs
the other rows, or the collection as a whole, belongs to the form.

| Rule | Owner | Written as |
| --- | --- | --- |
| "The condition needs a value" | Grid | `editing.rowValidators.onSubmit` |
| "A date, for a date field" | Grid | `meta.edit.editor` per column |
| "At least one condition" | Form | the `conditions` field's `onChange` validator |
| "No two conditions repeat a field and operator" | Form | the same place |

A row's form is seeded with that row's values only, so it cannot see the array,
and the grid's `edit.store` publishes field names but not values, so the form
cannot see a draft.

## Editors that follow the row

In a `[field, operator, value]` builder the value cell means something
different on every row. `meta.edit.editor` receives the row's live form, so one
component can switch on the *draft* field rather than the committed one, and
picking a new field resets its dependents:

```tsx
const FieldEditor: TMDataGridEditorComponent = ({ field, form, size }) => (
  <Select
    size={size}
    data={[...FIELDS]}
    value={String(field.state.value)}
    onChange={(next) => {
      if (next === null) return;
      field.handleChange(next);
      form.setFieldValue("operator", OPERATORS[next as QueryField][0]);
      form.setFieldValue("value", "");
    }}
  />
);
```

The operator and value editors read the sibling with TanStack Store's
[`useSelector`](https://tanstack.com/store/latest/docs/framework/react/reference):
`useSelector(form.store, (state) => state.values.field)`, so switching Field
mid-edit switches them immediately. See
[Editors and validation](/docs/editors) for the editor's full API.

## Which mode

`editing.mode: "row"`. A condition is approved as a unit: the pencil opens the
whole row, Save commits it, and `editing.onCommit` hands the form one finished
condition. The form's rules run at that point.

**Not `draft: true`.** A draft store holds every commit inside the grid and
calls nothing until `edit.saveDrafts()`, so the form's array goes stale the
moment typing starts: "at least one condition" counts rows the user may have
marked for deletion, a duplicate sitting in a draft passes unseen, and the
form's submit saves an array missing every pending edit.

To use the store anyway, invert where the save happens: `grid.edit.saveDrafts()`
becomes the only way rows reach the form, and the form's submit is gated on the
grid holding no draft -
`useSelector(grid.edit.store, (s) => s.openRowIds.length === 0)`.

## Submitting

The form submits only while the grid holds no draft.

```tsx
const hasOpenDraft = useSelector(grid.edit.store, (s) => s.openRowIds.length > 0);

<Button type="submit" disabled={!canSubmit || hasOpenDraft}>
  {hasOpenDraft ? "Finish the open condition" : "Search"}
</Button>
```

The alternative is to flush instead of block.
`await grid.edit.commitAll()` before `form.handleSubmit()` submits every open row through the normal `editing.onCommit` path, in every mode; with `draft: true` follow it with `grid.edit.saveDrafts()`.
Both resolve `ok: false` when a row stayed open or was reopened with an error, so submit the form only on `ok`:

```tsx
const committed = await grid.edit.commitAll();
const saved = committed.ok ? await grid.edit.saveDrafts() : undefined;
if (saved?.ok) await form.handleSubmit();
```

Two constraints apply to a native `<form>` around a grid:

- The grid's buttons cannot submit it. Mantine buttons default to
  `type="button"`, so only your own `type="submit"` button submits.
- Enter inside a cell editor commits the cell, not the form. The editor
  prevents the default, so implicit form submission never fires.

## Reference

The pieces this recipe composes:

| Piece | Documented on |
| --- | --- |
| `data`, `getRowId`, `editing.mode`, `editing.onCommit`, `editing.onRowAdd`, `editing.onRowDelete`, `editing.newRowDefaults`, `edit.store` | [Editing](/docs/editing) |
| `editing.rowValidators`, `meta.edit.editor`, the editor contract | [Editors and validation](/docs/editors) |
| `useForm`, `form.Field`, field validators | TanStack Form's own docs |
