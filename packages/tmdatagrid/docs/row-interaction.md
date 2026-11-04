# Clicks and context menus

Handling clicks in the body: a row click, a cell click, a double-click, and a
right-click for a menu.

Every handler here **composes** with what the click already does. Setting
`onRowClick` does not replace selection or the highlight; both still happen,
and your handler runs as well.

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

Pass the row type, as above, and `row.original` is typed.

```demo
file: rows/ClickAndContextMenu.tsx
hint: Click, double-click and right-click anywhere in the body.
```

## The click handlers

| Prop | Argument | Notes |
| --- | --- | --- |
| `onRowClick` | `row` | Rows show a pointer cursor and the [hover tint](/docs/row-styling#hover) when set. |
| `onCellClick` | `{ cell, row, column, event }` | The cell cursor still moves. |
| `onCellDoubleClick` | same | A double-click that opens an editor still does. |
| `onCellContextMenu` | same | `renderRowContextMenu` and the cell-selection menu still open. |

None of the four fires on a group row: a group row is built on its first
child's record rather than on one of its own.

## Context menus

Right-clicking a row opens a Mantine `Menu` at the pointer. The grid renders the
`Menu` and its `Menu.Dropdown`, opens it at the cursor, and closes it on Escape,
on an outside click, on a body scroll, and after an item is picked. The render
prop supplies only the contents, so anything valid in a dropdown works:
`Menu.Item`, `Menu.Label`, `Menu.Divider`, `Menu.Sub`, or your own components.

```tsx
<TMDataGrid.Table<Employee>
  renderRowContextMenu={({ row, cell }) => (
    <>
      <Menu.Label>{row.original.firstName}</Menu.Label>
      <Menu.Item onClick={() => open(row.original.id)}>Open</Menu.Item>
      <Menu.Item
        onClick={() =>
          navigator.clipboard.writeText(String(cell?.getValue() ?? ""))
        }
      >
        Copy cell value
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item color="red" onClick={() => remove(row.original.id)}>
        Delete
      </Menu.Item>
    </>
  )}
/>
```

| Argument | Type | Description |
| --- | --- | --- |
| `table` | `Table<TMDataGridFeatures, TData>` | For actions that read wider state, such as `getSelectedRowModel()`. |
| `row` | `Row<TMDataGridFeatures, TData>` | The right-clicked row. |
| `cell` | `Cell<…> \| null` | The cell under the pointer, so a per-cell action such as "copy value" is possible. `null` only if a custom cell renderer stopped the event. |
| `close` | `() => void` | Closes the menu. `Menu.Item` already closes on click, so this is for content that is not a menu item. |

The render prop is called **during render**, and only for the row whose menu is
open. Keep it a pure function of its arguments and do the work in the item
handlers.

Return `null` to leave a row without a menu. The browser's own context menu
stays suppressed over the grid either way:

```tsx
renderRowContextMenu={({ row }) => (row.original.locked ? null : <Menu.Item>Edit</Menu.Item>)}
```

### The right-clicked row

A right-click does not select or highlight the row. The grid marks it with
`data-context-menu` while its menu is open, which gives it the hover background.
An action that should apply to a multi-selection can read the selection off
`table` and fall back to the clicked row:

```tsx
renderRowContextMenu={({ table, row }) => {
  const selected = table.getSelectedRowModel().rows;
  const targets = selected.some((r) => r.id === row.id) ? selected : [row];
  return <Menu.Item onClick={() => archive(targets)}>Archive {targets.length}</Menu.Item>;
}}
```

### Taking the whole menu

Under `cellSelection: "range"` a right-click inside the selection opens the
copy and export items too. By default they appear above a divider and yours
below, which is what happens when the render prop does not use `internalItems`.
See [Cell selection](/docs/cell-selection#copy-and-export).

`internalItems` holds those built-in items. **Using it takes over the
composition**: the menu becomes exactly what you return, in the order you
return it.

```tsx
renderRowContextMenu={({ row, internalItems }) => (
  <>
    <Menu.Item onClick={() => open(row.id)}>Open</Menu.Item>
    <Menu.Divider />
    {internalItems}
  </>
)}
```

Accept `internalItems` without rendering it to drop the built-in items
entirely.

### Menu options

`rowContextMenuProps` is passed to the Mantine `Menu` unchanged, apart from its
open state:

```tsx
<TMDataGrid.Table<Employee>
  renderRowContextMenu={items}
  rowContextMenuProps={{ width: 260, shadow: "lg", position: "right-start" }}
/>
```

On touch devices a long press (500 ms) opens the same menu. Mantine sets
`user-select: none` on the element it attaches a context menu to, so body cell
text is not selectable with the mouse in a grid that has one.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `onRowClick` | Table prop | `(row) => void` | – | Row click. Adds a pointer cursor. |
| `onCellClick` | Table prop | `(args) => void` | – | Cell click. Receives `{ cell, row, column, event }`. |
| `onCellDoubleClick` | Table prop | `(args) => void` | – | Cell double-click. |
| `onCellContextMenu` | Table prop | `(args) => void` | – | Cell right-click. |
| `renderRowContextMenu` | Table prop | `({ table, row, cell, close, internalItems }) => ReactNode` | – | Contents of the row's context menu. `null` for no menu. |
| `TMDataGridRowContextMenuArgs` | Type | `{ table, row, cell, close, internalItems }` | – | What `renderRowContextMenu` receives. |
| `renderColumnMenuItems` | Table prop | `TMDataGridColumnMenuItemsRenderer` | – | Sets the column menu's contents. An empty list removes the menu button. See [Column header menu](/docs/column-menu). |
| `rowContextMenuProps` | Table prop | `MenuProps` | – | Passed to the Mantine `Menu`. |
| `TMDataGridCellEventArgs` | Export | type | – | The argument the three cell handlers receive. |
| `data-context-menu` | Data attribute | – | – | On the row whose menu is open. |
