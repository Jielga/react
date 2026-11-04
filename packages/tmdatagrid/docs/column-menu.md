# Column header menu

The menu on every column header.
It opens from the header's menu button and from a right-click on the header.

```demo
file: columns/ColumnMenuItems.tsx
hint: The ID column has no menu; every other menu ends with Column statistics.
```

## Items

The menu shows each group only when the column supports it:

| Item | Shown when |
| --- | --- |
| Sort ascending · Sort descending | The column can sort. See [Sorting](/docs/sorting) |
| Filter | The column can filter and `filters.inHeader` is off. See [Filtering](/docs/filtering) |
| Group by · Ungroup | The column can group. See [Grouping](/docs/grouping) |
| Expand all groups · Collapse all groups | Grouping is active |
| Pin to left · Pin to right · Unpin | The column can pin. Unpin only on a pinned column. See [Column layout](/docs/column-layout#pinning) |
| Move left · Move right | The column can be reordered and has a neighbour in its region. See [Column layout](/docs/column-layout#ordering) |
| Autosize column | The column can resize. See [Column layout](/docs/column-layout#autosizing) |
| Hide column | The column can hide |
| Manage columns | Any column can hide |

A divider separates the groups.
Each option that turns a feature off also removes its items; the full list is in [What each switch removes](/docs/use-tm-data-grid#what-each-switch-removes).
A column whose menu would be empty has no menu button.
Group headers and the generated columns (checkbox, details, edit, row number) have no menu.
The item texts come from `labels`; see [Localization](/docs/localization).

## Change the items

`renderColumnMenuItems` on `TMDataGrid.Table` sets the contents of every column's menu.
It receives the items the grid would render and returns the list to render:

```tsx
<TMDataGrid.Table<Employee>
  renderColumnMenuItems={({ column, internalItems }) => [
    ...internalItems,
    <Menu.Divider key="stats-divider" />,
    <Menu.Item key="stats" onClick={() => showStats(column.id)}>
      Column statistics
    </Menu.Item>,
  ]}
/>
```

- `internalItems` - the built-in items in order, dividers included
- return `internalItems` unchanged to keep the default menu
- add items around it to extend the menu
- return other items to replace it
- return `[]` to remove the menu button

The function runs for every column that has a menu; branch on `column.id` for a per-column menu.
A trailing divider is dropped.
Give every item a `key`.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `renderColumnMenuItems` | Table prop | `TMDataGridColumnMenuItemsRenderer` | – | Sets the column menu's contents. An empty list removes the menu button. |
| `TMDataGridColumnMenuItemsRenderer` | Type | `(args: TMDataGridColumnMenuItemsArgs) => ReactNode[]` | – | The function `renderColumnMenuItems` takes. |
| `TMDataGridColumnMenuItemsArgs` | Type | `{ column, table, internalItems }` | – | What the function receives. |
