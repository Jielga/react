# Editors and validation

Reference for the `editing` skill. Which control a cell opens, and what stops a
bad value being committed. Both follow from the column.

## The built-in editors

`meta.type` picks one, `meta.options` feeds the two select editors from the same
declaration the filter panel reads.

| `meta.type` | Editor | Writes | Export |
| --- | --- | --- | --- |
| `"string"` (default) | Text input | `string` | `TMDataGridStringEditor` |
| `"number"` | Number input | `number`, or `null` while the cell is empty or the text is not yet a number | `TMDataGridNumberEditor` |
| `"boolean"` | Checkbox | `boolean` | `TMDataGridBooleanEditor` |
| `"date"` | Native `<input type="date">` | A `Date`, or the ISO `"YYYY-MM-DD"` string; `null` when cleared | `TMDataGridDateEditor` |
| `"select"` | Searchable select, commits on pick under `"cell"` | `string \| null` | `TMDataGridSelectEditor` |
| `"multiSelect"` | Multi-select, same source | `string[]` | `TMDataGridMultiSelectEditor` |

**Writes** is the value the editor puts into the draft: what `meta.edit.mapValue` is handed, what `meta.edit.validate` checks, and what a commit carries in `value` and in `changes[].next`.

The number editor writes `null` rather than `NaN` while the text does not parse, so a half-typed number leaves the field empty instead of committing a number no rule can describe.
The date editor picks between its two types once, when it opens, from what the cell held: a `Date` cell keeps receiving `Date`s and a string cell keeps receiving `"YYYY-MM-DD"` strings, so clearing and retyping cannot flip the type.
A validator for a date column has to accept whichever of the two that column's data holds.

```tsx
columnHelper.accessor("department", {
  header: "Department",
  meta: { type: "select", options: ["Engineering", "Sales", "Support"] },
});
```

`meta.options` takes a static array, `"faceted"` (the distinct values present in
the data), or a function of the table, column and row.

## The editor API

`meta.edit.editor` fills the same slot as the built-ins. It is a **component**,
rendered as JSX, so hooks may be used inside it.

```ts
type TMDataGridEditorArgs = {
  field: TMDataGridEditField; // the live TanStack Form field
  form: TMDataGridRowEditForm; // the row's form, for sibling fields
  cell: Cell;
  row: Row;
  column: Column;
  table: TMDataGridTable;
  commit: () => Promise<boolean>; // what Enter would do
  cancel: () => void; // what Escape would do
  size: TMDataGridSize;
  seedText?: string; // set when typing opened the editor
};
```

The grid places the caret itself, once per open gesture: it focuses
`data-dg-part="editor-input"` when the editor publishes it, and the first
focusable element inside the editor otherwise. So a custom editor gets the caret
without asking for focus - set `editor-input` only to name which of several
inputs should take it.

Bind any control to `field` exactly as inside any TanStack Form:
`field.state.value`, `field.state.meta.errors`, `field.handleChange`,
`field.handleBlur`.

The message itself is the host's: it shows in a tooltip on the editor, opened
by focus and by hover, for a custom editor as much as a built-in one. What an
editor binds is the invalid state - the built-ins pass a boolean to the input's
`error` prop for the border alone, and an editor that binds nothing looks
unchanged while the commit is refused.

```tsx
import { Slider } from "@mantine/core";
import type { TMDataGridEditorComponent } from "@jielga/tmdatagrid";

// Module scope. A new identity per render remounts the editor mid-edit.
const SalaryEditor: TMDataGridEditorComponent = ({ field, commit, cancel }) => (
  <Slider
    value={Number(field.state.value ?? 0)}
    min={0}
    max={100_000}
    step={1_000}
    onChange={(next) => field.handleChange(next)}
    onChangeEnd={() => void commit()}
    onKeyDown={(event) => {
      if (event.key === "Escape") cancel();
    }}
  />
);

columnHelper.accessor("salary", {
  header: "Salary",
  meta: { type: "number", edit: { editor: SalaryEditor } },
});
```

## Extending a built-in

The built-ins take `TMDataGridEditorArgs` and `inputProps` as their props. To
change the Mantine control a built-in renders, render it from a
`meta.edit.editor`, pass `args` through whole, and add props with `inputProps`.
Extend a built-in rather than copying its source: keeping the caret in place
while `mapValue` rewrites the value, select-all on focus, the invalid border,
the translated accessible name and `data-dg-part="editor-input"` all come with
it. The props type requires every field of `TMDataGridEditorArgs`, so spread
`{...args}`; never spread or rebuild `field` itself.

```tsx
import { Text } from "@mantine/core";
import { IconBarcode } from "@tabler/icons-react";
import {
  TMDataGridNumberEditor,
  TMDataGridSelectEditor,
  TMDataGridStringEditor,
  type TMDataGridEditorComponent,
} from "@jielga/tmdatagrid";

// Module scope. A new identity per render remounts the editor mid-edit.
const SkuEditor: TMDataGridEditorComponent = (args) => (
  <TMDataGridStringEditor
    {...args}
    inputProps={{ leftSection: <IconBarcode size={14} /> }}
  />
);

const PriceEditor: TMDataGridEditorComponent = (args) => (
  <TMDataGridNumberEditor
    {...args}
    inputProps={{ allowNegative: false, rightSection: <Text size="xs">kr</Text> }}
  />
);

// The dropdown renders in a portal, as Mantine's default.
const CategoryEditor: TMDataGridEditorComponent = (args) => (
  <TMDataGridSelectEditor {...args} inputProps={{ comboboxProps: { shadow: "md" } }} />
);
```

| Editor | Mantine control | Set by the grid, left out of `inputProps` |
| --- | --- | --- |
| `TMDataGridStringEditor` | `TextInput` | `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridNumberEditor` | `NumberInput` | `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridBooleanEditor` | `Checkbox` | `checked`, `defaultChecked`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridDateEditor` | `TextInput` | `type`, `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridSelectEditor` | `Select` | `data`, `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |
| `TMDataGridMultiSelectEditor` | `MultiSelect` | `data`, `value`, `defaultValue`, `onChange`, `error`, `size`, `aria-label` |

- `inputProps` also takes `data-*` attributes; `data-dg-part` stays
  `"editor-input"`, because the grid sets it after the spread.
- `onFocus` and `onBlur` run after the grid's own: select-all on focus in the
  string and number editors, `field.handleBlur()` (touched, `onBlur`
  validators) in every editor.
- `onBlur` runs only when focus leaves the editor, such as a click outside it.
  Enter, Tab, Escape and a committing select pick close the editor before the
  focus moves, so it does not run. Code for "the edit ended" belongs in
  `editing.onCommit` or `meta.edit.mapCommitValue`.
- `ref` receives the input element; the grid's own ref stays attached.
- The select editors' dropdowns render in a portal (Mantine's default), so
  the grid's scroll area does not clip them, and a pick is not a click
  outside the editor. `comboboxProps={{ withinPortal: false }}` puts the
  dropdown back inside the cell, where a short grid or a low row clips it.
- A consumer `onKeyDown` must not stop the propagation of Enter, Tab or Escape:
  the grid handles them on an ancestor.
- `label` and `description` make the editor taller than the cell;
  `aria-labelledby` replaces the grid's translated accessible name.
- `onChange` is the grid's; to rewrite the value as it is typed, use
  `meta.edit.mapValue`.
- The grid's defaults can be overridden: `w="100%"` (not on the checkbox),
  `hideControls` on the number editor, `searchable` on the select editors.
- The select editors read options from `meta.options` only; `data` is not
  accepted.
- The props types are exported: `TMDataGridStringEditorProps`,
  `TMDataGridNumberEditorProps`, `TMDataGridBooleanEditorProps`,
  `TMDataGridDateEditorProps`, `TMDataGridSelectEditorProps`,
  `TMDataGridMultiSelectEditorProps`.

To place content beside the control instead of inside it, render the built-in
inside your own layout:

```tsx
import { Group, Text } from "@mantine/core";
import {
  TMDataGridNumberEditor,
  TMDataGridSelectEditor,
  TMDataGridStringEditor,
  type TMDataGridEditorComponent,
} from "@jielga/tmdatagrid";

// Decorate one.
const SalaryEditor: TMDataGridEditorComponent = (args) => (
  <Group gap={4} wrap="nowrap" w="100%">
    <TMDataGridNumberEditor {...args} />
    <Text size="xs" c="dimmed">
      kr
    </Text>
  </Group>
);

// Or choose between them per row.
const DepartmentEditor: TMDataGridEditorComponent = (args) =>
  args.row.original.status === "Terminated" ? (
    <TMDataGridStringEditor {...args} />
  ) : (
    <TMDataGridSelectEditor {...args} />
  );
```

Pass `args` through whole. `field` is a live TanStack Form `FieldApi`, not a
plain object, so spreading or rebuilding it loses the binding its methods rely
on.

## Mapping the value

`meta.edit.mapValue` maps every value an editor writes, before it reaches the
draft. It runs per write, which for a text input is per keystroke and for a
select is per pick.

```tsx
meta: {
  edit: {
    // Uppercase as it is typed.
    mapValue: ({ value }) =>
      typeof value === "string" ? value.toUpperCase() : value,
  },
}

meta: {
  edit: {
    // Depends on the record being edited; `previous` is the value the field
    // held before this write.
    mapValue: ({ value, previous, row }) =>
      row.original.country === "SE" ? normalise(value) : previous,
  },
}
```

The map receives `TMDataGridEditValueMapArgs`: `{ value, previous, row, column, table }`.
Unlike `meta.edit.enabled`, its `row` is `Row<TMDataGridFeatures, TMDataGridRowData>`
with or without the column helper.

The grid applies it in the editor host, around the field every editor writes
through, so it covers the six built-ins, a custom `meta.edit.editor`, and the
type-to-edit seed character.

Left unmapped on purpose:

- The value an editor opens with. Mapping it would rewrite stored data nobody
  edited, mark a pristine row dirty and swallow the select-all.
- `edit.clearCell()`, the Delete key: it writes the type's empty value through
  the form, so there is no input to map.
- `edit.setCellValue()` and `edit.setRowValues()`: they write through the form
  too, and the caller passes the stored value itself. `meta.edit.validate` still
  runs on the commit.
- An editor calling `field.setValue`. `handleChange` is the mapped path.

The built-in string and number editors restore the caret after a mapped write,
shifted by the length the map changed, because React reassigning `input.value`
otherwise drops the caret at the end of the field. A custom editor rendering its
own input has to do the same: record `selectionStart` on change, restore it in a
layout effect.

## Mapping the value at commit

`meta.edit.mapCommitValue` maps a field once, as its row commits, where `mapValue` runs on every write.
Use it for a rule the user must be free to break while typing: trimming a string, because with `mapValue` a trailing space could never be typed.

```tsx
meta: {
  edit: {
    mapCommitValue: ({ value }) =>
      typeof value === "string" ? value.trim() : value,
  },
}
```

- It runs before the submit validators, so `"   "` trimmed to `""` fails a required rule.
- The result is written back into the form: the draft store, `changes` and `onCommit` hold the mapped value, and so does an editor still open after the commit (row mode, or a refused commit).
  Trimming in `onCommit` or on the server instead leaves the grid's own state untrimmed.
- It maps only the fields the user changed.
  A row being added maps every editable field.
- A field written by `edit.setCellValue()`, `edit.setRowValues()`, `edit.clearCell()` or the Delete key is not mapped; the other fields the user changed in that row still are.
  The rows of `edit.addRows({ commit: true })` are not mapped at all.
- The map receives `TMDataGridEditCommitMapArgs`: `{ value, previous, row, column, table }`.
  `previous` is the value when editing began; `row` is `undefined` for a row being added.

## Field validation

`meta.edit.validate` takes TanStack Form's field-validator vocabulary. A bare schema
(Zod, or any Standard Schema, or a plain function) means `{ onChange: it }`; the
object form takes every trigger Form defines.

```tsx
import { z } from "zod";

// Bare schema: validates on change.
meta: { edit: { validate: z.string().min(2, "At least two characters") } }

// Object form: pick the trigger.
meta: { edit: { validate: { onBlur: z.string().email("Not an email address") } } }

// A plain function works too. `value` is typed `never`, so annotate the parameter.
meta: {
  edit: {
    validate: ({ value }: { value: unknown }) =>
      typeof value === "number" && value > 0 ? undefined : "Must be positive",
  },
}
```

`normalizeFieldValidate(validate)` is exported for consumers building their own
column factories: it turns a bare schema into Form's validator shape.

## Row validation

`editing.rowValidators` is form-level, and where cross-field rules live.

```tsx
const grid = useTMDataGrid({
  data: employees,
  columns,
  getRowId: (row) => String(row.id),
  editing: {
    mode: "row",
    rowValidators: {
      onSubmit: z
        .object({ salary: z.number().positive(), status: z.string() })
        .refine((row) => row.status !== "Terminated" || row.salary === 0, {
          message: "A terminated employee has no salary",
        }),
    },
    onCommit,
  },
});
```

Issues with a path land on the matching column's cell; pathless issues land on
the row, where the message shows in the edit lane's tooltip on the open
row's ✓. A nested schema's issues follow the
same rule, so a `address.city` issue lands on the column whose `editField` is
`"address.city"`.

Cross-field rules need a mode that commits the whole row at once. Under `"cell"`
each cell commits alone, so the rule is evaluated against the other column's
unedited value and cannot pass. Use `"row"`.

## Cross-row rules

`editing.tableValidators` holds the rules that need the other rows. Its
`onSubmit` / `onSubmitAsync` receive `TMDataGridTableValidateArgs`,
`{ value, rowId, isNew, rows }`:
`value` is the committing row as drafted, and `rows` is
`Array<{ rowId, value }>` - the collection as it would stand if the commit
landed, with every draft overlaid, entry rows appended and deletion-marked
rows removed. `rows` is unfiltered and never contains group rows.

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
row-level message, `{ form, fields }` lands pathed issues on the committing
row's cells. `onSubmit` runs first, and its failure stands without
`onSubmitAsync` running. Errors land on the committing row only.

The rules run at every commit - typed, ✓, `edit.setCellValue`, an entry
row's - after the row's own validators, and again for every committed row during
`saveDrafts`, the only rules that run there: a committed row that a later edit
invalidated is reopened with its errors, and the save reports it in `reopened`.

## Derived columns and a table-wide rule

A column whose value depends on the other rows - a weight as a share of the
total - cannot be an `accessorFn`, which is handed one row. Derive the whole
collection with `useMemo` and pass the finished rows as `data`;
`editing.onCommit` writes back to the source array, and the derived rows arrive
on the next render. Under `mode: "cell"` with no draft store, every dependent
column follows the commit.

```tsx
const positions = useMemo(() => {
  const valued = holdings.map((h) => ({ ...h, marketValue: h.price * h.shares }));
  const total = valued.reduce((sum, h) => sum + h.marketValue, 0);
  return valued.map((h) => ({
    ...h,
    currentPct: (h.marketValue / total) * 100,
    drift: h.targetPct - (h.marketValue / total) * 100,
  }));
}, [holdings]);
```

A rule over the whole collection, such as targets that may not total more than
100%, is a `tableValidators` rule, while a bound on one cell (between 0 and 100)
stays on `meta.edit.validate`. `editing.columns` keeps every other column
read-only:

```tsx
editing: {
  mode: "cell",
  // Only the target weight takes edits; everything else is market data.
  columns: ["targetPct"],
  onCommit: ({ rowId, value }) =>
    setHoldings((previous) =>
      previous.map((h) => (h.id === rowId ? { ...h, targetPct: value.targetPct } : h)),
    ),
  tableValidators: {
    // `rows` already holds the committing row's drafted value.
    onSubmit: ({ rows }) => {
      const total = rows.reduce((sum, r) => sum + Number(r.value.targetPct ?? 0), 0);
      return total > 100.005
        ? { fields: { targetPct: `Targets would total ${pct(total)}` } }
        : undefined;
    },
  },
}
```

Source: `packages/tmdatagrid/docs/portfolio-rebalancer.md`, and the demo
`apps/docs/src/examples/demos/recipes/PortfolioRebalancer.tsx`.

## Server-side errors

`editing.rowValidators.onSubmitAsync` returns TanStack Form's `{ form, fields }`
shape, so an API's field errors land on the right cells without translation.

```tsx
rowValidators: {
  onSubmitAsync: async ({ value }) => {
    const response = await api.validateEmployee(value);
    if (response.ok) return undefined;
    return {
      form: response.message,
      fields: response.fieldErrors, // { salary: "Above the band ceiling" }
    };
  },
},
```

A commit blocked by validation keeps the editor open, invalid, with the message
in its tooltip. A rejected `editing.onCommit` keeps the draft too, with the
error on the row.

## Where the state shows

| Marker | Means |
| --- | --- |
| The cell's own value | A held draft is displayed: the cell renders the draft value through the column's `cell` renderer, in every mode |
| Blue cell corner | The field is dirty against its original value |
| Red cell corner | The field carries a validation error |
| Field error message | In a tooltip on the open editor, shown while the input has focus and on hover |
| Row error text | A pathless rule failed, or a commit was rejected. In the lane's tooltip, on the open row's ✓ |
| `data-dirty` on the row | The row holds a dirty draft |

The same information is readable from `edit.store`: `rows[rowId].dirtyFields`,
`rows[rowId].errorFields`, `rows[rowId].errorMessages` (`{ field, message }`
pairs), `rows[rowId].hasRowError`, `rows[rowId].isSubmitting`, and
`rows[rowId].values` for the draft itself. The pathless message's text is not
in the store; read it from `edit.getForm(rowId)?.state.errors` on the open
row that carries it.
