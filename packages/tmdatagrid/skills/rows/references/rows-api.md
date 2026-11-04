# Rows API

Reference for the `rows` skill.

## Selection

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `selectionMode` | Option | `TMDataGridSelectionMode`: `"checkbox" \| "row" \| "checkboxAndHighlight" \| "highlight"` | `"checkbox"` | What selecting looks like and what a row click does. |
| `enableRowSelection` | Table option | `boolean \| ((row) => boolean)` | `true` | `false` removes the checkbox column and row-click selection. |
| `enableMultiRowSelection` | Table option | `boolean` | `true` | `false` limits the selection to one row and drops group checkboxes. |
| `showSelectedBackground` | Option | `boolean` | Follows the mode | Whether selected rows take a background tint. |
| `defaultHighlightedRowId` | Option | `string \| null` | `null` | Row highlighted at mount. |
| `onHighlightedRowChange` | Callback | `(rowId: string \| null) => void` | – | Fires when the highlight moves. |
| `SELECT_COLUMN_ID` | Export | `"__select__"` | – | Id of the generated checkbox column. |
| `getSelectableRowIds` | Export | `(table) => string[]` | – | Ids the header checkbox would select. |
| `resolveRowSelectionClick` | Export | `(args: ResolveRowSelectionClickArgs) => ResolvedRowSelection` | – | The desktop-list click rules, for a custom surface. |
| `ResolveRowSelectionClickArgs` · `TMDataGridRowClickModifiers` | Types | `{ rows, rowId, anchorRowId, modifiers, selection }` · `{ toggle, extend }` | – | What `resolveRowSelectionClick` takes, and its `modifiers`. |
| `getDisplayedRows` | Export | `(table) => Row[]` | – | The rows currently on screen, paging respected. |
| `isPagingActive` | Export | `(table) => boolean` | – | Whether a pager is in play. |

The highlight lives on the ui store, not in `rowSelection`:
`useSelector(grid.ui, (state) => state.highlightedRowId)`.

## Clicks and context menus

All are props of `TMDataGrid.Table`, not hook options.

| Name | Type | What it does |
| --- | --- | --- |
| `onRowClick` | `(row) => void` | Row click. Adds a pointer cursor. |
| `onCellClick` | `(args) => void` | Cell click. `args` is `TMDataGridCellEventArgs`. |
| `onCellDoubleClick` | `(args) => void` | Cell double-click. |
| `onCellContextMenu` | `(args) => void` | Cell right-click. |
| `renderRowContextMenu` | `TMDataGridRowContextMenuRenderer`: `(args: TMDataGridRowContextMenuArgs) => ReactNode` | Contents of the row's context menu. `null` for no menu. Reading `internalItems` hands the composition over. |
| `renderColumnMenuItems` | `TMDataGridColumnMenuItemsRenderer`: `(args: TMDataGridColumnMenuItemsArgs) => ReactNode[]` | Contents of a column's menu. An empty list removes the button. |
| `rowContextMenuProps` | `MenuProps` | Passed to the Mantine `Menu` unchanged, apart from its open state. |

`TMDataGridCellEventArgs` is `{ cell, row, column, event }`.
`TMDataGridRowContextMenuArgs` is `{ table, row, cell, close, internalItems }`,
and `TMDataGridColumnMenuItemsArgs` is `{ column, table, internalItems }`. The context-menu
slot's `cell` is `null` only when a custom cell renderer stopped the
event. One `Menu` serves the whole body rather than one per row: a closed
Mantine `Popover` still runs its hooks on every render, and the virtualized body
re-renders on every scroll frame.

On touch devices a long press (500 ms) opens the same menu. Mantine sets
`user-select: none` on the element it attaches a context menu to, so body cell
text is not selectable with the mouse in a grid that has one.

## Styling

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `rowStyle` | Table prop | `TMDataGridRowStyle \| ((row) => TMDataGridRowStyle)` | – | Inline style for a body row. |
| `rowClassName` | Table prop | `string \| ((row) => string \| undefined)` | – | Class added after the grid's own. |
| `striped` | Table prop | `boolean` | `false` | Every second row takes `--dg-row-striped-bg`. |
| `TMDataGridRowStyle` | Export | type | – | `CSSProperties` or an object of `--*` custom properties. |
| `--row-bg` | CSS variable | colour | – | The row's own background, composed under hover, selection and range. |
| `--dg-row-striped-bg` | CSS variable | colour | Themed | The stripe colour. |
| `--dg-row-selected-bg` | CSS variable | colour | `--mantine-primary-color-light` | Selected row background. |
| `--dg-row-highlight-bg` | CSS variable | colour | Themed | Highlighted row background. |
| `--dg-row-height` | CSS variable | length | From `size` | Row height. `meta.rowHeight` is the supported way to change it. |

Row data attributes:

| Attribute | On |
| --- | --- |
| `data-selected` | Selected rows |
| `data-selected-bg` | Selected rows that also take the background |
| `data-highlighted` | The highlighted row |
| `data-grouped` | Group rows |
| `data-depth` | Every row - the nesting level |
| `data-context-menu` | The row whose context menu is open |
| `data-deleted` | Rows marked for deletion under draft editing |
| `data-row-id` | Every row - its id |

## Details

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `renderDetails` | Option | `TMDataGridDetailsRenderer`: `(args: TMDataGridDetailsArgs) => ReactNode` | – | Contents of the panel. Setting it adds the lane. `TMDataGridDetailsArgs` is `{ row, table }`. |
| `renderDetailsEstHeight` | Option | `number` | `160` | Height the virtualizer assumes for an unmeasured panel. |
| `detailsColumnPosition` | Option | `"left" \| "right"` | `"left"` | Which edge the lane is pinned to. `"right"` places it after every column, inside the edit lane. |
| `initialState.expanded` | Table option | `ExpandedState` | `{}` | Rows open at mount. A `data` slice, so it persists. |
| `autoResetExpanded` | Table option | `boolean` | `false` | `true` closes the panels when the `data` array changes. Off by default, so a draft commit keeps them open. |
| `DETAILS_COLUMN_ID` | Export | `"__details__"` | – | Id of the generated chevron column. |
| `resolveExpandAll` | Export | `(args) => ExpandedState` | – | Expand or collapse every group, or every panel, but not both. |
| `areAllRowsExpanded` | Export | `(args) => boolean` | – | Whether every row of one target is open. |
| `TMDataGridExpandAllArgs` · `TMDataGridExpandTarget` | Types | `{ rows, expanded, target }` · `"groups" \| "details"` | – | What `areAllRowsExpanded` takes (`resolveExpandAll` also takes `expand`), and its `target`. |
| `data-dg-part="details"` | Data attribute | – | – | The panel element, carrying the row's `data-row-id`. |

One `expanded` state opens two unrelated things - a group row into its children,
a data row into its panel. The controls stay apart: the details header only
opens panels, "Expand all groups" only unfolds the tree.
`table.toggleAllRowsExpanded()` is the one that does not distinguish them, which
is what `resolveExpandAll({ rows, expanded, target, expand })` exists to avoid:

```tsx
table.setExpanded(
  resolveExpandAll({
    rows: table.getPrePaginatedRowModel().flatRows,
    expanded: table.store.state.expanded,
    target: "details",
    expand: true,
  }),
);
```

## Pinning and numbering

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableRowPinning` | Table option | `boolean \| ((row) => boolean)` | `false` | Whether rows can be pinned. |
| `initialState.rowPinning` | Table option | `{ top: string[], bottom: string[] }` | empty | Rows pinned at mount. Not persisted. |
| `enableRowNumbers` | Option | `boolean` | `false` | Adds the row-number gutter, outermost left. |
| `row.pin` | Row method | `("top" \| "bottom" \| false) => void` | – | Pins or unpins one row. |
| `row.getIsPinned` | Row method | `() => "top" \| "bottom" \| false` | – | Where a row is pinned. |
| `row.getCanPin` | Row method | `() => boolean` | – | Whether this row may pin. |
| `ROW_NUMBER_COLUMN_ID` | Export | `"__rowNumber__"` | – | Id of the generated number gutter. |

Lane order, left to right: row number, checkbox, tree, details, your columns,
edit. Under `detailsColumnPosition: "right"`, details sits between your columns
and edit.
