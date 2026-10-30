# Editors and validation

Which control a cell opens when editing starts, what the value becomes on the
way in, and what prevents a bad one being committed. All three follow from the
column: `meta.type` picks the editor, and `meta.edit` holds the rest.

```demo
file: editing/EditorsAndValidation.tsx
hint: Type a single letter into String, or 5 into Number, to see validation reject it.
height: 440
```

## The built-in editors

`meta.type` picks one, and `meta.options` feeds the select editors from the same
source the filter panel reads. Neither lives under `meta.edit`.

| `meta.type` | Editor | Writes |
| --- | --- | --- |
| `string` (default) | Text input | `string` |
| `number` | Number input | `number`, or `null` while the cell is empty or the text is not yet a number |
| `boolean` | Checkbox | `boolean` |
| `date` | Native `<input type="date">` | A `Date`, or the `"YYYY-MM-DD"` string; `null` when cleared |
| `select` | Searchable select from `meta.options`. Commits on pick under `"cell"` | `string \| null` |
| `multiSelect` | Multi-select, same source | `string[]` |

**Writes** is the value the editor puts into the draft: what `meta.edit.mapValue` is handed, what `meta.edit.validate` checks, and what a commit carries in `value` and in `changes[].next`.

The number editor writes `null` rather than `NaN` while the text does not parse, so a half-typed number leaves the field empty instead of committing a number no rule can describe.
The date editor picks between its two types once, when it opens, from what the cell held: a `Date` cell keeps receiving `Date`s and a string cell keeps receiving `"YYYY-MM-DD"` strings, so clearing and retyping cannot flip the type.

## Extending a built-in editor

Each built-in editor is a named export that takes `TMDataGridEditorArgs` and `inputProps`.
To change the Mantine control a built-in renders, pass `args` through whole and add props with `inputProps`:

```tsx
import { IconBarcode } from "@tabler/icons-react";
import {
  TMDataGridStringEditor,
  type TMDataGridEditorComponent,
} from "@jielga/tmdatagrid";

const SkuEditor: TMDataGridEditorComponent = (args) => (
  <TMDataGridStringEditor
    {...args}
    inputProps={{ leftSection: <IconBarcode size={14} /> }}
  />
);

columnHelper.accessor("sku", {
  header: "SKU",
  meta: { edit: { editor: SkuEditor } },
});
```

```demo
file: editing/ExtendedEditors.tsx
hint: Double-click a cell. SKU has an icon, Price a unit and no negative numbers, Category a dropdown shadow and its own "nothing found" text.
height: 300
```

Define the editor at module scope, as for [your own editor](#writing-your-own).
Spread `args` into the built-in with `{...args}`: its props type requires every field of `TMDataGridEditorArgs`.
Do not spread or rebuild `field` itself, because it is a live TanStack Form `FieldApi` and a copy loses the binding its methods rely on.

`inputProps` takes the props of the editor's Mantine control and `data-*` attributes, except the props the grid sets itself:

| Editor | Mantine control | `inputProps` type | Set by the grid |
| --- | --- | --- | --- |
| `TMDataGridStringEditor` | `TextInput` | `TMDataGridStringEditorProps["inputProps"]` | `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridNumberEditor` | `NumberInput` | `TMDataGridNumberEditorProps["inputProps"]` | `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridBooleanEditor` | `Checkbox` | `TMDataGridBooleanEditorProps["inputProps"]` | `checked`, `defaultChecked`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridDateEditor` | `TextInput` | `TMDataGridDateEditorProps["inputProps"]` | `type`, `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridSelectEditor` | `Select` | `TMDataGridSelectEditorProps["inputProps"]` | `data`, `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridMultiSelectEditor` | `MultiSelect` | `TMDataGridMultiSelectEditorProps["inputProps"]` | `data`, `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |

The props the grid sets are left out of each type, so passing one is a type error.
`data-dg-part` is set after `inputProps`, so the input keeps `data-dg-part="editor-input"`.

- `onFocus` and `onBlur` run after the grid's own handlers.
  The string and number editors select the value on focus, and every editor calls `field.handleBlur()` on blur, which marks the field as touched and runs its `onBlur` validators.
- `onBlur` runs when focus leaves the editor, for example on a click outside it.
  It does not run when Enter, Tab or Escape closes the editor, or when a pick in the select editor commits under `"cell"`, because the editor closes before the focus moves.
  To run code when an edit ends, use `editing.onCommit`, or `meta.edit.mapCommitValue` to change the committed value.
- `ref` receives the control's input element; the grid keeps its own ref on it too.
- By default, the select editors render their dropdown in a portal, so the grid's scroll area does not clip it, and a pick in it does not count as a click outside the editor.
  With `comboboxProps={{ withinPortal: false }}` the dropdown renders inside the cell, where a short grid or a low row clips it.
- The defaults the grid sets on the control can be overridden: `w="100%"` on every editor except the checkbox, `hideControls` on the number editor, and `searchable` on the select editors.
- The select editors read their options from `meta.options` only, so `data` is not accepted.
- To change the value as it is typed, use [`meta.edit.mapValue`](#mapping-the-value-as-it-is-typed); `onChange` is the grid's.

Important: do not stop the propagation of Enter, Tab or Escape in an `onKeyDown`, as the grid handles these keys on an ancestor to commit, move and cancel.
Props that add text around the control, such as `label` and `description`, make the editor taller than the cell, and `aria-labelledby` replaces the grid's translated accessible name.

To place content beside the control instead of inside it, render the built-in inside your own layout:

```tsx
import { Group, Text } from "@mantine/core";
import {
  TMDataGridNumberEditor,
  TMDataGridSelectEditor,
  TMDataGridStringEditor,
  type TMDataGridEditorComponent,
} from "@jielga/tmdatagrid";

// Content beside the input.
const SalaryEditor: TMDataGridEditorComponent = (args) => (
  <Group gap={4} wrap="nowrap" w="100%">
    <TMDataGridNumberEditor {...args} />
    <Text size="xs" c="dimmed">
      per month
    </Text>
  </Group>
);

// A different built-in per row.
const DepartmentEditor: TMDataGridEditorComponent = (args) =>
  args.row.original.status === "Terminated" ? (
    <TMDataGridStringEditor {...args} />
  ) : (
    <TMDataGridSelectEditor {...args} />
  );
```

## Writing your own

`meta.edit.editor` fills the same slot as the built-ins. It is a **component**,
rendered as JSX, so hooks may be used inside, and it receives the live TanStack
Form `field` API. Bind any control to it as you would inside a form:

```tsx
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit }) => (
  <Slider
    value={field.state.value}
    onChange={field.handleChange}
    onChangeEnd={() => void commit()}
  />
);

meta: { edit: { editor: SalaryEditor } }
```

**Define editors at module scope.** An inline arrow function gets a new identity
on every render, which remounts the editor mid-edit and discards what was typed.

The field's validation message is shown by the host, in a tooltip on the
editor: open while the input is focused, and on hover. A custom editor gets the
same tooltip, so it renders no message of its own.

The built-in editors mark the input invalid and add no inline text, since the
message would be clipped by the width of the cell. A custom editor does the
same by binding a boolean to the control's `error` prop:

```tsx
const hasError = field.state.meta.errors.length > 0;

<Slider value={field.state.value} onChange={field.handleChange} error={hasError} />;
```

## Mapping the value as it is typed

A column can rewrite every value on its way into the draft: uppercase a code,
strip spaces out of an IBAN, clamp a number into range. `meta.edit.mapValue`
runs on each write an editor makes, which is each keystroke for a text input and
each pick for a select.

```demo
file: editing/MappedInput.tsx
hint: Type into either column. Code uppercases, Reference keeps digits only.
height: 420
```

```tsx
meta: {
  edit: {
    mapValue: ({ value }) =>
      typeof value === "string" ? value.toUpperCase() : value,
  },
}
```

What it returns is what the cell shows, what the validators check and what is
committed.

The map is applied inside the editor host, around the field every editor writes
through, so one declaration covers all six built-in editors, your own
`meta.edit.editor`, and the character that opened the editor when typing started
the edit.

Some writes are not mapped: the value the editor opens with, and the writes that go through the form rather than through an editor - `edit.clearCell()`, the Delete key, `edit.setCellValue()` and `edit.setRowValues()`.
An editor calling `field.setValue` instead of `field.handleChange` also bypasses the map.
`handleChange` is the mapped path.

The map receives the row and column as well, so it can depend on the record
being edited:

```tsx
meta: {
  edit: {
    mapValue: ({ value, row }) =>
      row.original.country === "SE" && typeof value === "string"
        ? value.replace(/ /g, "")
        : value,
  },
}
```

`previous` is the value the field held before this write, which a mask needs in
order to tell an insertion from a deletion.

### Keeping the caret

A mapped value differs from the one the input holds, so React writes the new
value into the DOM node and the browser collapses the selection to the end of
the field.

The built-in string and number editors restore the caret to where it was typed,
shifted by however much the map changed the length, so a mask that inserts or
strips characters keeps the caret beside the same text.

A custom editor rendering its own input has the same problem, and solves it the
same way: record `selectionStart` as the value is handed over, and restore it in
a layout effect once the mapped value has rendered.

## Mapping the value at commit

`meta.edit.mapCommitValue` maps a field once, as its row commits, instead of on every write.
Use it for a rule the user must be free to break while typing, such as trimming a string: with `mapValue`, a trailing space could never be typed.

```tsx
meta: {
  edit: {
    mapCommitValue: ({ value }) =>
      typeof value === "string" ? value.trim() : value,
  },
}
```

It runs before the validators of the submit, so a field that trims to `""` fails a required rule.
The result is written back into the form, so the draft, `changes` and `onCommit` all hold the mapped value.
An editor still open after the commit shows it too: in row mode, or after a commit the validators refused.
When a draft is held for `saveDrafts`, the mapped value is what the pending change shows.

It runs for the fields the user changed.
A stored value nobody edited is left as it is.
A row being added has no stored value, so every editable field of it is mapped, a field `meta.edit.enabled` keeps the user out of included.
A field written by `edit.setCellValue()`, `edit.setRowValues()`, `edit.clearCell()` or the Delete key is not mapped, because the caller passes the stored value itself; the other fields the user changed in the same row still are.
The rows of `edit.addRows({ commit: true })` are not mapped at all.

The map receives `TMDataGridEditCommitMapArgs`: `{ value, previous, row, column, table }`.
`previous` is the value the field held when editing began, and `row` is `undefined` for a row being added.
`mapValue` runs first, and its result is what `value` holds here.

## Validation

The validators are TanStack Form's own: a Standard Schema (Zod, Valibot,
ArkType) or a plain function returning an error message or nothing.

```tsx
// Per column: field-level validators. A bare schema or function means { onChange: it }.
meta: { edit: { validate: z.string().min(2, "Too short") } }

// The same rule without a schema library:
meta: {
  edit: {
    validate: ({ value }: { value: unknown }) =>
      typeof value === "string" && value.length < 2 ? "Too short" : undefined,
  },
}

// Per row: form-level validators - cross-field rules live here.
useTMDataGrid({
  editing: {
    mode: "cell",
    rowValidators: {
      onSubmit: z.object({ salary: z.number().positive() })
        .refine((r) => r.status !== "Terminated" || r.salary === 0, {
          message: "A terminated employee has no salary",
        }),
    },
  },
});
```

A plain function is typed `TMDataGridValidator`, whose `value` is `never`, so annotate the parameter - `{ value: unknown }`, or the type the column's editor writes - rather than leaving it to be inferred.

Pathed issues land on the matching cells; pathless ones on the row, where the
message shows in the edit lane's tooltip on the open row's ✓. To show a
pathless message somewhere of your own, read it from
`edit.getForm(rowId)?.state.errors` on the open row that carries it;
`edit.store` carries the flag (`hasRowError`) and the field messages
(`errorMessages`), not the row text.

A commit blocked by validation keeps the editor open, invalid, with the message
in its tooltip. A rejected `editing.onCommit` keeps the draft too, with the
error on the row. Server-side field errors can be returned natively through
`editing.rowValidators.onSubmitAsync`'s `{ form, fields }` shape.

Cross-field rules need a mode that commits the whole row at once. Under
`"cell"` each cell commits alone, so a rule spanning two columns cannot be
satisfied by either one. Use `editing.rowValidators.onSubmit` with `"row"`. See
[Editing](/docs/editing#row-editing).

A rule about the whole collection, such as "no duplicates" or "shares sum to
100", is neither a field rule nor a row rule. It takes
`editing.tableValidators` - see [Cross-row rules](#cross-row-rules).

## Cross-row rules

`editing.tableValidators` holds the rules that need the other rows: no
duplicate keys, no overlapping ranges, allocations summing to a total. Its
validators receive the committing row and `rows`, the collection as it would
stand if the commit landed - every draft overlaid, entry rows appended,
deletion-marked rows removed:

```tsx
editing: {
  mode: "cell",
  draft: true,
  tableValidators: {
    onSubmit: ({ value, rowId, rows }) =>
      rows.some((r) => r.rowId !== rowId && r.value.code === value.code)
        ? { fields: { code: "Codes must be unique" } }
        : undefined,
  },
}
```

The result is the `rowValidators` vocabulary: nothing passes, a string is a
row-level message, and `{ form, fields }` lands pathed issues on the
committing row's cells. `onSubmit` runs first, and its failure stands without
`onSubmitAsync` running.

The rules run at every commit, after the row's own validators, and again for
every committed row during `saveDrafts`, where they are the only rules that
run: column rules and `rowValidators` saw the same values at commit. A
committed row that a later edit has invalidated is reopened with its errors,
the valid rows are sent, and the save reports it in `reopened`. Errors land on the
committing row only; the row it clashes with is not marked.

`rows` is unfiltered, so a rule sees the whole collection whatever the view
shows, and it never contains group rows.

```demo
file: editing/TableValidation.tsx
hint: Give two teams the same code, or push the shares past 100, and the commit is refused. Drafts count - a clash with a pending edit is caught too.
height: 380
```

A grid inside an outer form can put collection rules in the form's own field
validator instead. See [A query builder form](/docs/query-builder).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `meta.edit.editor` | Column meta | `TMDataGridEditorComponent` | By `meta.type` | Replaces the cell editor. |
| `meta.edit.validate` | Column meta | `TMDataGridFieldValidate` | – | Field-level validation. A bare schema or function means `onChange`. |
| `meta.edit.mapValue` | Column meta | `TMDataGridEditValueMap` | – | Maps each value an editor writes, before it reaches the draft. |
| `meta.edit.mapCommitValue` | Column meta | `TMDataGridEditCommitMap` | – | Maps each changed field once, as its row commits. See [Mapping the value at commit](#mapping-the-value-at-commit). |
| `editing.rowValidators` | Option | `TMDataGridRowValidators` | – | Form-level validation, for cross-field rules. |
| `editing.tableValidators` | Option | `TMDataGridTableValidators` | – | Cross-row rules, handed the collection with every draft overlaid. See [Cross-row rules](#cross-row-rules). |
| `TMDataGridTableValidateArgs` | Export | type | – | What a table validator receives: `value`, `rowId`, `isNew`, `rows`. |
| `TMDataGridEditorArgs` | Export | type | – | What an editor component receives: `field`, `form`, `cell`, `row`, `column`, `table`, `commit`, `cancel`, `size`, `seedText`. See [Editors](/docs/components#editors). |
| `TMDataGridEditValueMapArgs` | Export | type | – | What `mapValue` receives: `value`, `previous`, `row`, `column`, `table`. |
| `TMDataGridEditCommitMapArgs` | Export | type | – | What `mapCommitValue` receives: `value`, `previous`, `row`, `column`, `table`. |
| `TMDataGridStringEditor` · `NumberEditor` · `BooleanEditor` · `DateEditor` · `SelectEditor` · `MultiSelectEditor` | Exports | components | – | The six built-in editors. See [Extending a built-in editor](#extending-a-built-in-editor). |
| `inputProps` | Built-in editor prop | The Mantine control's props and `data-*` attributes, without the props the grid sets | – | Props passed to the Mantine control of a built-in editor. |
| `TMDataGridStringEditorProps` · `NumberEditorProps` · `BooleanEditorProps` · `DateEditorProps` · `SelectEditorProps` · `MultiSelectEditorProps` | Exports | types | – | The props of each built-in editor: `TMDataGridEditorArgs` and `inputProps`. |
| `normalizeFieldValidate` | Export | `(validate) => validators` | – | Turns a bare schema into TanStack Form's validator shape. |
| `getEditFieldName` | Export | `(column) => string` | – | The data path a column's edits write to. |
