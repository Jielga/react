# Grid menu

`TMDataGrid.Menu` is the burger button at the end of the toolbar and the Mantine `Menu` it opens.
Its children are the dropdown: Mantine `Menu.Item`s of your own, and the built-in items under `TMDataGrid.Menu.*`.

```tsx
import { Menu } from "@mantine/core";

<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer />
  <TMDataGrid.FilterButton />
  <TMDataGrid.Menu>
    <TMDataGrid.Menu.Export />
    <Menu.Item onClick={saveView}>Save view</Menu.Item>
    <Menu.Divider />
    <Menu.Label>Columns</Menu.Label>
    <TMDataGrid.Menu.Columns />
  </TMDataGrid.Menu>
</TMDataGrid.Toolbar>
```

```demo
file: customization/GridMenu.tsx
hint: The burger holds the app's own items above the column chooser.
```

A custom item reads the grid from context, the same way a [toolbar button](/docs/toolbar#buttons-of-your-own) does.
`TMDataGrid.Menu.Export` and `TMDataGrid.Menu.ExportSelected` are the built-in export items; their props and formats are on [Export](/docs/export).
Mantine's `Menu.Divider`, `Menu.Label` and `Menu.Sub` work as they do in any Mantine menu; the grid wraps nothing of Mantine's.

`TMDataGrid.Menu` always renders: it cannot see whether its children render anything.
A menu holding only `TMDataGrid.Menu.Columns` on a grid with `enableHiding: false` opens empty, so hide it with the same check the built-in buttons use:

```tsx
const { table, features } = useTMDataGridContext();
const { canHideAny } = getGridCapabilities(table, features);

{canHideAny && (
  <TMDataGrid.Menu>
    <TMDataGrid.Menu.Columns />
  </TMDataGrid.Menu>
)}
```

## The column chooser as menu items

`TMDataGrid.Menu.Columns` is the whole chooser: one checkbox item per column that can be hidden, a search box once there are six of them, **Show/Hide All** and **Reset layout**.
When the grid has [saved views](/docs/saved-views), they follow under Reset layout; `views={false}` leaves them out.
It renders nothing when no column can be hidden.
The pieces it is made of are exported for menus that want only some of them.

| Component | Renders |
| --- | --- |
| `TMDataGrid.Menu.Columns` | `Menu.Search`, the toggles, a divider, show/hide all and reset layout, then the saved views when the grid has them. By default the search box shows from six columns; `searchable` shows it always and `searchable={false}` never. |
| `TMDataGrid.Menu.ColumnToggles` | One item per hideable column, with a checkbox that shows both states. `search` narrows the list to the labels containing it. |
| `TMDataGrid.Menu.ShowHideAll` | One checkbox item over the same list. An indeterminate box marks a partial state, and a click then shows all. |
| `TMDataGrid.Menu.ResetLayout` | One item calling `resetSettings()`: visibility, order, pinning, widths and grouping. |
| `TMDataGrid.Menu.Views` | The saved views and their actions. See [Saved views](/docs/saved-views#tmdatagridmenuviews). |

Each of them needs a Mantine `Menu` around it and reads the grid from context, so they work in any Mantine menu rendered inside `TMDataGrid`, not only in the burger:

```tsx
<Menu width={260} withinPortal>
  <Menu.Target>
    <Button size="compact-xs" variant="subtle">
      View
    </Button>
  </Menu.Target>
  <Menu.Dropdown>
    <Menu.Item onClick={() => setDensity("compact")}>Compact rows</Menu.Item>
    <Menu.Divider />
    <TMDataGrid.Menu.ColumnToggles />
    <Menu.Divider />
    <TMDataGrid.Menu.ShowHideAll />
    <TMDataGrid.Menu.ResetLayout />
  </Menu.Dropdown>
</Menu>
```

### As a submenu

Every column header's menu has **Manage columns**, a `Menu.Sub` holding `TMDataGrid.Menu.Columns`.
The same composition works in a menu of your own:

```tsx
<Menu.Sub>
  <Menu.Sub.Target>
    <Menu.Sub.Item>Manage columns</Menu.Sub.Item>
  </Menu.Sub.Target>
  <Menu.Sub.Dropdown>
    <TMDataGrid.Menu.Columns searchable={false} />
  </Menu.Sub.Dropdown>
</Menu.Sub>
```

`searchable` is for a block at the top level of a dropdown.
`Menu.Search` registers on the root menu, which switches off type-ahead and the arrow keys of every dropdown of that menu, so a search box inside a submenu breaks the keyboard behaviour of the menu around it.
ArrowDown from the search box moves to the first listed column, whatever sits above the block.

### The panel instead

`TMDataGrid.ColumnsPanel` is the same chooser as plain controls, for a host that is not a menu: a Popover, a Drawer, or a settings page.

```tsx
const [opened, setOpened] = useState(false);

<Popover opened={opened} onChange={setOpened} withinPortal trapFocus>
  <Popover.Target>
    <ActionIcon aria-label="Columns" onClick={() => setOpened((open) => !open)}>
      <IconColumns3 size={18} />
    </ActionIcon>
  </Popover.Target>
  <Popover.Dropdown p={0}>
    <TMDataGrid.ColumnsPanel />
  </Popover.Dropdown>
</Popover>
```

## Labels

`labels.menuButton` is the burger's tooltip and `aria-label`.
The chooser uses the panel's strings: `columnsSearchPlaceholder`, `columnsNoMatch`, `columnsShowHideAll` and `columnsReset`.
See [Localization](/docs/localization).

## Testing

The burger is `data-dg-part="menu-button"`.
The items publish the same parts as the panel: `columns-search`, `columns-toggle` with `data-column-id`, `columns-toggle-all` and `columns-reset`, so a test written against the panel reads the same on the menu.
The export items are `menu-export` and `menu-export-selected`.
See [Testing](/docs/testing).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `TMDataGrid.Menu` | Component | Mantine `MenuProps` without `children`, plus `children`, `icon`, `label` | `position="bottom-end"`, `shadow="md"`, `width={260}`, `withinPortal` | The burger and its dropdown. `icon` replaces the burger; `label` is the tooltip and `aria-label`, default `labels.menuButton`. |
| `TMDataGrid.Menu.Columns` | Component | `searchable?: boolean \| "auto"`, `views?: boolean` | `"auto"`, `true` | The whole column chooser as menu items. `"auto"` shows the search box from six columns. `views` lists the [saved views](/docs/saved-views) under Reset layout. Renders nothing when no column can be hidden. |
| `TMDataGrid.Menu.ColumnToggles` | Component | `search?: string` | – | One checkbox item per hideable column. |
| `TMDataGrid.Menu.ShowHideAll` | Component | – | – | One checkbox item over every hideable column. |
| `TMDataGrid.Menu.ResetLayout` | Component | – | – | Calls `resetSettings()`. |
| `TMDataGrid.Menu.Export` · `.ExportSelected` | Components | `TMDataGridExportOptions` | – | The export items. Props on [Export](/docs/export). |
| `TMDataGrid.ColumnsPanel` | Component | – | – | The chooser as plain controls, for a host that is not a menu. |
| `labels.menuButton` | Option | `string` | `"Menu"` | The burger's tooltip and `aria-label`. |
| `TMDataGridMenuProps` · `TMDataGridMenuColumnsProps` · `TMDataGridMenuExportProps` | Export | types | – | The prop types. |
