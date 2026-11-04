# Row selection

`selectionMode` sets how the user picks rows.
By default, it is `"checkbox"`:

```tsx
const grid = useTMDataGrid({ data, columns });                        // "checkbox"
const rows = useTMDataGrid({ data, columns, selectionMode: "row" });
const master = useTMDataGrid({ data, columns, selectionMode: "highlight" });
```

```demo
file: rows/SelectionModes.tsx
```

## The four modes

| Mode | The user | Use it for |
| ---- | -------- | ---------- |
| `"checkbox"` | ticks a checkbox on each row | an action on many rows, such as delete |
| `"row"` | clicks rows, with Ctrl/Cmd and Shift to add more | the same, without a checkbox column |
| `"highlight"` | clicks one row | showing that row's details beside the grid |
| `"checkboxAndHighlight"` | ticks checkboxes, and clicks one row | both at once |

`"checkbox"` and `"row"` select rows, `"highlight"` highlights one row, and `"checkboxAndHighlight"` does both.
Selected rows and the highlighted row are separate:

- the selected rows - any number of rows, read with `getSelectedRowModel()`; see [Acting on a selection](#acting-on-a-selection)
- the highlighted row - at most one row, read with `highlightedRowId`; see [The highlighted row](#the-highlighted-row)

`"row"` and `"highlight"` both give the clicked row a background, but only `"row"` selects it.

A row click under `"row"` follows the usual desktop-list rules:

- a plain click replaces the selection with this row
- Ctrl/Cmd + click adds this row to the selection, or removes it
- Shift + click selects the range from the anchor row to this row
- Ctrl/Cmd + Shift + click adds that range to the selection

The anchor row is the row of the last plain or Ctrl/Cmd click.

Under `"row"`, `"checkboxAndHighlight"` and `"highlight"`, rows are focusable.
Space or Enter on a focused row adds it to the selection or removes it under `"row"`, and highlights it under the other two.
With cell selection on, the keys work on cells instead; see [With cell selection](#with-cell-selection).

## With cell selection

With [`cellSelection`](/docs/cell-selection) on, the focus moves between cells, not rows, and rows are not focusable.
The keyboard selects rows from the focused cell:

- Space adds the cell's row to the selection or removes it, in every mode that selects rows, `"checkbox"` included
- Shift + Space adds the range from the anchor row to the cell's row
- under `"highlight"`, Space highlights the cell's row

A click on a cell moves the cell cursor and also does the row click of the `selectionMode`.
Under `cellSelection: "range"` and `selectionMode: "row"`, a Shift + click extends both the cell rectangle and the row selection.

## Which rows can be selected

`enableRowSelection: false` turns the selection off: the checkbox column is removed, and a row click does not select.
Under `"checkboxAndHighlight"`, the highlight still works.

Set `enableRowSelection` to a function to decide per row:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  enableRowSelection: (row) => row.original.active,
});
```

- a row the function turns down has a disabled checkbox, and the header checkbox does not select it
- unticking the header checkbox clears every row the filters show, also a turned-down row selected through `initialState` or `setRowSelection`

`enableMultiRowSelection: false` allows one selected row at a time.
Selecting a row clears the previous one, and the select-all checkbox and the group-row checkboxes are removed.

## Acting on a selection

Read the selection through the table store with TanStack Store's [`useSelector`](https://tanstack.com/store/latest/docs/framework/react/reference), not with a direct method call.
A direct call does not re-render on a change in a component that does not call `useTMDataGrid`, and under the React Compiler also in the one that does:

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

## The highlighted row

Under `"checkboxAndHighlight"` and `"highlight"`, a row click highlights the row.
A second click on the highlighted row keeps it highlighted.
The highlight is not part of the selection, so under `"checkboxAndHighlight"` the user can tick rows for a bulk action and click a row to show its details.

Read the highlighted row from the grid's `ui` store, and clear it with `setHighlightedRow(null)`:

```tsx
const highlightedRowId = useSelector(grid.ui, (state) => state.highlightedRowId);

<Button onClick={() => grid.ui.actions.setHighlightedRow(null)}>Close</Button>
```

```demo
file: rows/HighlightedRow.tsx
hint: Click a row, then Close.
```

The following options control the highlighted row:

- `defaultHighlightedRowId` - sets the row highlighted at mount; it is read once
- `onHighlightedRowChange` - called when the highlighted row changes, by a click or by `setHighlightedRow`, and not at mount

To open the highlighted row from a link, keep its id in the route:

```tsx
const { id } = useParams();
const grid = useTMDataGrid({
  data,
  columns,
  selectionMode: "highlight",
  defaultHighlightedRowId: id ?? null,
  onHighlightedRowChange: (rowId) =>
    navigate(rowId ? `/employees/${rowId}` : "/employees"),
});
```

Note that `defaultHighlightedRowId` is read once, so a route change after mount, such as the Back button, does not move the highlight.
Call `setHighlightedRow` for that.

The grid keeps the highlighted row when the row is filtered out, paged away or removed from `data`, as TanStack keeps `rowSelection`.
The row is highlighted again when it comes back.

For a panel that opens under the row, not beside the grid, see [Row details](/docs/row-details).
A grid can use both.

## Selected row background

By default, selected rows take a background under `"row"`, and not under `"checkbox"` and `"checkboxAndHighlight"`.
Set `showSelectedBackground` to change that:

```tsx
const grid = useTMDataGrid({ data, columns, showSelectedBackground: true });
```

The colour of a selected row is `--dg-row-selected-bg`, and the colour of the highlighted row is `--dg-row-highlight-bg`.
Set them on the grid element:

```tsx
<TMDataGrid
  {...grid}
  style={{
    "--dg-row-selected-bg": "var(--mantine-color-teal-light)",
    "--dg-row-highlight-bg": "var(--mantine-color-teal-light-hover)",
  }}
/>
```

Each row element carries these attributes:

- `data-selected` - the row is selected
- `data-selected-bg` - the row is selected and takes the background
- `data-highlighted` - the row is highlighted

[Custom styling](/docs/row-styling) can use any of them.

## Group rows

A group row's checkbox selects every record under it, at any depth, also records inside collapsed sub-groups.
It shows a tick when all of them are selected, and a dash when only some are.
Only the records are written to `rowSelection`, never the group row.
See [Grouping](/docs/grouping#selection).

## Custom selection surface

`resolveRowSelectionClick` applies the desktop-list click rules to rows you render yourself, such as a [card view](/docs/card-view).
It returns the next selection and the next anchor row:

```tsx
import { getDisplayedRows, resolveRowSelectionClick } from "@jielga/tmdatagrid";

function onCardClick(event: React.MouseEvent, rowId: string) {
  const { selection, anchorRowId } = resolveRowSelectionClick({
    rows: getDisplayedRows(grid.table, grid.features),
    rowId,
    anchorRowId: grid.ui.state.selectionAnchorRowId,
    modifiers: { toggle: event.ctrlKey || event.metaKey, extend: event.shiftKey },
    selection: grid.table.store.state.rowSelection,
    canReplaceSelection: true,
  });
  grid.table.setRowSelection(selection);
  grid.ui.actions.setSelectionAnchor(anchorRowId);
}
```

Set `canReplaceSelection` to `false` for a checkbox, so a click on it never clears the other rows.
[`getDisplayedRows`](/docs/anatomy#which-rows-it-renders) returns the rows in the order a Shift + click range uses.

## Reference

### Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `selectionMode` | `"checkbox" \| "row" \| "checkboxAndHighlight" \| "highlight"` | `"checkbox"` | Sets what a row click changes, and whether the checkbox column is shown. |
| `showSelectedBackground` | `boolean` | `true` under `"row"`, otherwise `false` | Determines whether selected rows take the `--dg-row-selected-bg` background. |
| `defaultHighlightedRowId` | `string \| null` | `null` | Sets the row highlighted at mount. Read once. |
| `onHighlightedRowChange` | `(rowId: string \| null) => void` | – | Called when the highlighted row changes, by a click or by `setHighlightedRow`. `null` when cleared. |

### TanStack options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `enableRowSelection` | `boolean \| (row) => boolean` | `true` | If `false`, turns the selection off. A function decides per row. |
| `enableMultiRowSelection` | `boolean \| (row) => boolean` | `true` | If `false`, allows one selected row at a time and removes the select-all and group-row checkboxes. |

Every other TanStack row selection option passes through unchanged; see [`TableOptions_RowSelection`](https://tanstack.com/table/v9/docs/reference/index/interfaces/TableOptions_RowSelection).

### Exports

| Name | Signature | Description |
| --- | --- | --- |
| `SELECT_COLUMN_ID` | `"__select__"` | Id of the generated checkbox column. |
| `getSelectableRowIds` | `(row) => string[]` | Returns the ids one click on `row` selects: the row itself, or every selectable record under a group row. |
| `resolveRowSelectionClick` | `(args: ResolveRowSelectionClickArgs) => ResolvedRowSelection` | Returns the next selection and anchor row for one click. See [Custom selection surface](#custom-selection-surface). |

### Types

| Name | Definition |
| --- | --- |
| `TMDataGridSelectionMode` | `"checkbox" \| "row" \| "checkboxAndHighlight" \| "highlight"` |
| `TMDataGridRowClickModifiers` | `{ toggle: boolean; extend: boolean }` - `toggle` is Ctrl/Cmd, `extend` is Shift |
| `ResolveRowSelectionClickArgs` | `{ rows, rowId, anchorRowId, modifiers, selection, canReplaceSelection }` |
| `ResolvedRowSelection` | `{ selection: RowSelectionState; anchorRowId: string \| null }` |

### UI state

| Name | Type | Description |
| --- | --- | --- |
| `highlightedRowId` | `string \| null` | The highlighted row. Read with `useSelector(grid.ui, ...)`. |
| `setHighlightedRow` | `(rowId: string \| null) => void` | Highlights a row, or clears the highlight with `null`. On `grid.ui.actions`. |
| `selectionAnchorRowId` | `string \| null` | The row a Shift + click range starts from. |
| `setSelectionAnchor` | `(rowId: string \| null) => void` | Sets the anchor row. On `grid.ui.actions`. |

### CSS variables

| Name | Default | Applies to |
| --- | --- | --- |
| `--dg-row-selected-bg` | `var(--mantine-primary-color-light)` | Selected rows, when `showSelectedBackground` is on. |
| `--dg-row-highlight-bg` | `var(--mantine-primary-color-light-hover)` | The highlighted row. |

### Data attributes

| Name | Set on |
| --- | --- |
| `data-selected` | Every selected row. |
| `data-selected-bg` | Selected rows that take the background. |
| `data-highlighted` | The highlighted row. |
