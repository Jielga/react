# Row selection

Picking rows out of the grid, and reading back what was picked. The grid
separates two things: a set of rows for a bulk action, and a single highlighted
row. `selectionMode` sets which of them a click drives, and defaults to
`"checkbox"`.

```tsx
const grid = useTMDataGrid({ data, columns });                        // "checkbox"
const rows = useTMDataGrid({ data, columns, selectionMode: "row" });
const master = useTMDataGrid({ data, columns, selectionMode: "highlight" });
```

```demo
file: rows/SelectionModes.tsx
```

## The four modes

`selectionMode` sets what selecting looks like and what a bare row click does.
A bare click either toggles the selection or moves the highlight, never both.

| Mode | Checkbox column | Row click |
| ---- | --------------- | --------- |
| `"checkbox"` | yes, multi-select | nothing |
| `"row"` | no | selects, with the usual modifiers |
| `"checkboxAndHighlight"` | yes, multi-select | highlights one row |
| `"highlight"` | no | highlights one row - no selection at all |

The first two write to TanStack's `rowSelection`, so `getSelectedRowModel()`
and `onRowSelectionChange` behave the same either way.

Under `"row"` the click follows the usual desktop-list conventions: a plain
click replaces the selection with this row, Ctrl/Cmd toggles it and leaves the
rest, Shift selects the range from the anchor, Ctrl+Shift adds that range. Rows are
focusable in this mode, and Space or Enter toggles the focused row.

`enableRowSelection: false` removes the checkbox column and row-click
selection in any mode. It has no effect under `"highlight"`, which selects
nothing.

As a predicate, `enableRowSelection` decides row by row:

- a row it turns down has a disabled checkbox, and the header checkbox does not tick it
- unticking the header checkbox clears every row the filters show, including a turned-down row ticked through `initialState` or `setRowSelection`

## The highlighted row

The highlighted row is state of its own rather than a slice of `rowSelection`,
so `"checkboxAndHighlight"` runs both at once: tick rows for a bulk action,
click one to open its detail panel beside the grid.

`defaultHighlightedRowId` seeds it and `onHighlightedRowChange` follows it,
typically into a route for a master–detail view:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  selectionMode: "highlight",
  onHighlightedRowChange: (rowId) =>
    navigate({ to: "/employees/$id", params: { id: rowId ?? "" } }),
});
```

For a panel that opens under the row instead of beside the grid, see
[Row details](/docs/row-details). A grid can use both.

## Acting on a selection

Read the selection through the table store with TanStack Store's
[`useSelector`](https://tanstack.com/store/latest/docs/framework/react/reference), rather
than by calling a method directly. A bare read is stale in any component that
does not call `useTMDataGrid` itself, and under the React Compiler also in the
one that does; `useSelector` subscribes either way.

```tsx
const selected = useSelector(
  grid.table.store,
  () => grid.table.getSelectedRowModel().rows,
);
```

```demo
file: rows/SelectionState.tsx
hint: Tick a few rows - the toolbar turns into a bulk-action bar and back.
```

## Highlighting selected rows

`showSelectedBackground` follows the mode: on for `"row"`, off for
`"checkbox"`. Set it explicitly for checkboxes and a background, or for row
selection with no background change.

```tsx
const grid = useTMDataGrid({ data, columns, showSelectedBackground: true });
```

The colour is `--dg-row-selected-bg`, which defaults to
`--mantine-primary-color-light`. Change it on the grid element rather than
touching the flag:

```tsx
<TMDataGrid
  {...grid}
  style={{ "--dg-row-selected-bg": "color-mix(in srgb, var(--mantine-color-blue-6) 12%, transparent)" }}
/>
```

Rows carry `data-selected` whenever they are selected, `data-selected-bg` when
they also take the background, and `data-highlighted` on the highlighted row.
[Custom styling](/docs/row-styling) can key off any of them.

## Group rows

A group row's checkbox selects every record under it, at any depth, including
records inside collapsed sub-groups. It shows a tick once all of them are
selected and a dash while only some are. Only the records are written to
`rowSelection`. See [Grouping](/docs/grouping#selection).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `selectionMode` | Option | `"checkbox" \| "row" \| "checkboxAndHighlight" \| "highlight"` | `"checkbox"` | What selecting looks like and what a row click does. |
| `TMDataGridSelectionMode` | Type | – | – | The type of `selectionMode`. |
| `enableRowSelection` | Table option | `boolean \| (row) => boolean` | `true` | `false` removes the checkbox column and row-click selection. |
| `enableMultiRowSelection` | Table option | `boolean` | `true` | `false` limits the selection to one row and drops group checkboxes. |
| `showSelectedBackground` | Option | `boolean` | Follows the mode | Whether selected rows take a background tint. |
| `defaultHighlightedRowId` | Option | `string \| null` | `null` | Row highlighted at mount. |
| `onHighlightedRowChange` | Callback | `(rowId: string \| null) => void` | – | Fires when the highlight moves. |
| `SELECT_COLUMN_ID` | Export | `"__select__"` | – | Id of the generated checkbox column. |
| `getSelectableRowIds` | Export | `(table) => string[]` | – | Ids the header checkbox would select. |
| `resolveRowSelectionClick` | Export | `(args) => ResolvedRowSelection` | – | The desktop-list click rules, for a custom surface. |
| `ResolveRowSelectionClickArgs` · `TMDataGridRowClickModifiers` | Types | – | – | What `resolveRowSelectionClick` takes, and its `modifiers`: `{ toggle, extend }`. |
| `--dg-row-selected-bg` | CSS variable | colour | `--mantine-primary-color-light` | Selected row background. |
| `--dg-row-highlight-bg` | CSS variable | colour | Themed | Highlighted row background. |
| `data-selected` | Data attribute | – | – | On every selected row. |
| `data-selected-bg` | Data attribute | – | – | On selected rows that also take the background. |
| `data-highlighted` | Data attribute | – | – | On the highlighted row. |
