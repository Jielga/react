---
name: appearance
description: >
  Theme, size, compose and translate a TMDataGrid. Covers the size scale (xs to
  xl) and what it drives, every --dg-* CSS variable for metrics, colours and the
  stacking ladder, the two stylesheets styles.css and styles.layer.css and why
  only one may be imported, the bounded-height layout rule with minHeight 0,
  toolbar composition through children and TMDataGrid.Spacer, Mantine BoxProps
  (mb, px, hiddenFrom) and withBottomBorder on the toolbar, writing a toolbar
  button with useTMDataGridContext, hiding it the way the built-ins do with
  getGridCapabilities and getColumnCapabilities, why capabilities take a
  features argument under the React Compiler, and localization through the
  labels option, TMDATAGRID_LABELS_EN, TMDATAGRID_LABELS_SV, mergeLabels and
  grid.labels. Load when styling or theming the grid, choosing a density,
  building a toolbar, adding a button beside the built-in ones, filling the grid
  menu (TMDataGrid.Menu, the column chooser as menu items), or translating the
  interface.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.6.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/styling.md'
  - 'Jielga/react:packages/tmdatagrid/docs/toolbar.md'
  - 'Jielga/react:packages/tmdatagrid/docs/menu.md'
  - 'Jielga/react:packages/tmdatagrid/docs/localization.md'
  - 'Jielga/react:packages/tmdatagrid/src/core/capabilities.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/labels.ts'
---

# TMDataGrid - Appearance, toolbar and labels

Everything set on the grid element or composed around it: the size scale, the
CSS variables, the toolbar, and the strings.

## Size

`size` drives row height, header height, font size and cell padding together,
and selects the size of every Mantine control the grid renders.

| `size` | Row height | Header height | Font size | Cell padding |
| --- | --- | --- | --- | --- |
| `xs` | 34px | 32px | `xs` | 6px |
| `sm` | 42px | 38px | `sm` | 8px |
| `md` (default) | 52px | 44px | `sm` | 10px |
| `lg` | 62px | 52px | `md` | 14px |
| `xl` | 72px | 60px | `lg` | 18px |

Row height is also required by the virtualizer **as a number**, so it cannot be
defined in CSS alone. For a height outside the scale, set `meta.rowHeight`
rather than the variable. `SIZE_ROW_HEIGHT` is the exported source of these
values.

## CSS variables

`style` accepts custom properties and `className` reaches the same element from
a stylesheet. Both are per instance, so a grid can be themed without a
provider.

```tsx
<TMDataGrid
  {...grid}
  size="sm"
  style={{ "--dg-row-selected-bg": "var(--mantine-color-blue-0)" }}
/>
```

**Metrics:** `--dg-row-height`, `--dg-header-height`, `--dg-summary-height`,
`--dg-entry-height`, `--dg-font-size`, `--dg-padding`. All default from `size`.
`--dg-header-font-size` defaults to `--dg-font-size`; set it to give the header
a text size of its own.
The generated lanes are excluded from padding: they are fixed 36px tracks that
centre their control.

**Colours:** `--row-bg` (one row's own background; set this, never
`background`), `--dg-row-selected-bg`, `--dg-row-highlight-bg`,
`--dg-row-striped-bg`, `--dg-row-group-bg`, `--dg-match-highlight-bg`,
`--dg-header-shadow-color`.

**Layout internals:** `--dg-sticky-edge-range` (`20px`), the `--dg-edge-*`
markers the grid sets on cell-range borders, and the `--dg-z-*` stacking order.
Change those only to place something of your own between two layers.

One stylesheet import, once, anywhere:

```tsx
import "@jielga/tmdatagrid/styles.css";
```

`@jielga/tmdatagrid/styles.layer.css` is the same stylesheet wrapped in a
`@layer`, for an application that orders its own layers. Import **one** of the
two, never both.

## Layout

The grid fills the box you give it and scrolls inside it. It does not size
itself to its content, because a virtualized grid has no content height to
measure.

```tsx
<div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
  <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
    <TMDataGrid.Table />
  </TMDataGrid>
</div>
```

`minHeight: 0` is required: a flex item's default `min-height: auto` will not
shrink below its content, so without it the grid grows past the viewport instead
of scrolling.

## Toolbar

The toolbar is a flex row. There is no slots API and no `actions` prop: your
buttons sit beside the built-in ones because they are all children of the same
element, and `TMDataGrid.Spacer` pushes what follows to the right.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Search />
  <TMDataGrid.Spacer />
  <TMDataGrid.LoadingIndicator />
  <ExportButton />
  <TMDataGrid.FilterButton />
  <TMDataGrid.Menu>
    <TMDataGrid.Menu.Columns />
  </TMDataGrid.Menu>
</TMDataGrid.Toolbar>
```

Each built-in renders nothing when its feature is off, so a read-only grid needs
no conditionals: `FilterButton` under `enableColumnFilters: false` renders
nothing at all.

`TMDataGrid.Toolbar` and `TMDataGrid.Spacer` take Mantine's `BoxProps` - the
style props (`mb`, `px`, `h`, `hiddenFrom`), `className`, `style` and `mod` -
set on the element itself. `withBottomBorder` on the toolbar draws a 1px line in
the theme's default border colour under it, the same line the header draws;
default `false`. `TMDataGrid.Footer`, `FilterPanel`, `FilterPills` and
`ColumnsPanel` take the same `BoxProps` on top of their own props.

```tsx
<TMDataGrid.Toolbar withBottomBorder px="sm" mb="xs">
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer hiddenFrom="sm" />
  <TMDataGrid.FilterButton />
</TMDataGrid.Toolbar>
```

### The grid menu

`TMDataGrid.Menu` is the burger: a Mantine `Menu` whose children are the
dropdown, so your own `Menu.Item`s sit beside the built-in items. It takes
Mantine `MenuProps` (defaults `position="bottom-end"`, `shadow="md"`,
`width={260}`, `withinPortal`), `icon` and `label` (default `labels.menuButton`).

```tsx
import { Menu } from "@mantine/core";

<TMDataGrid.Menu>
  <Menu.Item onClick={exportReport}>Export report</Menu.Item>
  <Menu.Divider />
  <Menu.Label>Columns</Menu.Label>
  <TMDataGrid.Menu.Columns />
</TMDataGrid.Menu>
```

`TMDataGrid.Menu.Columns` is the column chooser as menu items: `Menu.Search`,
one checkbox item per hideable column, show/hide all and reset layout;
it renders nothing when no column can be hidden. Its pieces
`TMDataGrid.Menu.ColumnToggles` (`search` narrows the list),
`.ShowHideAll` and `.ResetLayout` are exported for menus that want only some of
them. Every piece needs a Mantine `Menu` around it and reads the grid from
context, so it works in any Mantine menu rendered inside `TMDataGrid`, and in a
`Menu.Sub` (pass `searchable={false}` there: `Menu.Search` registers on the
root menu and switches off its type-ahead and arrow keys).

The menu always renders, since it cannot see what its children render; a menu
holding only `Menu.Columns` should be hidden with `canHideAny` under
`enableHiding: false`. `TMDataGrid.ColumnsPanel` is the same chooser as plain
controls, for a Popover, a Drawer or an inline layout.

A button of your own reads the grid from context, which returns
`{ table, ui, features, labels, controlSize, resetSettings }`:

```tsx
import {
  exportGrid,
  getGridCapabilities,
  useTMDataGridContext,
} from "@jielga/tmdatagrid";

function ExportButton() {
  const { table, features, controlSize } = useTMDataGridContext();
  const { canFilterAny } = getGridCapabilities(table, features);

  if (!canFilterAny) return null;

  return (
    <Button size={controlSize} onClick={() => void exportGrid({ table })}>
      Export
    </Button>
  );
}
```

`getGridCapabilities(table, features)` returns `canSortAny`, `canFilterAny`,
`canHideAny`, `canPinAny`, `canReorderAny`, `canGroupAny`, `canSelectRows`,
`canPaginate` and `canSearch`. `getColumnCapabilities(column, features)` returns
the same for one column as `canSort`, `canFilter`, `canHide`, `canPin`,
`canResize`, `canReorder` and `canGroup`.

### Why `features` is a second argument

`features` comes back from `useTMDataGrid` and is re-derived from the options
object on every render. It is required **in addition to** TanStack's `getCanX()`
methods because it is what makes the result reactive. `column.getCanSort()` is a
method call on a column object whose identity survives an options change, so
under the React Compiler that call is memoized and a grid whose `enableSorting`
changed to `false` would carry on rendering sort indicators. `features` supplies
a value that changes; `getCanX()` still decides the outcome.

The same rule applies elsewhere in your application: read state through
`useSelector(table.store, …)` and options through `features`, rather than
calling methods on a long-lived object.

## Labels

Every string the grid renders, and every `aria-label`, comes from one labels
object. English by default, and `labels` takes **any subset**, merged over the
defaults.

```tsx
import { TMDATAGRID_LABELS_SV } from "@jielga/tmdatagrid";

const grid = useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
```

Labels that carry a value are functions, so each language can place the value
where its grammar requires:

```tsx
const labels = {
  groupBy: (column) => `Gruppera efter ${column}`,
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
} satisfies TMDataGridLabelsOverride;
```

`TMDataGridLabels` is the full dictionary type, so a missing key in a new
translation is a compile error. The resolved dictionary comes back as
`grid.labels` and from `useTMDataGridContext().labels`, so a component of your
own uses the same strings as the built-in parts. Every key, with its English
default and where the grid shows it, is in
[references/labels.md](references/labels.md).

## Common mistakes

### CRITICAL Importing both stylesheets

`styles.css` and `styles.layer.css` are the same rules, one wrapped in a
`@layer`. Importing both means the unlayered copy wins every cascade contest,
so an application that ordered its layers to put the grid underneath its own
overrides silently gets the opposite.

Source: `packages/tmdatagrid/docs/styling.md` (The stylesheet).

### CRITICAL A grid with no bounded height

The grid does not size itself to its content, so inside a flex parent without
`minHeight: 0` it grows past the viewport and the page scrolls instead of the
body. Rows render, so nothing looks broken until the list is long.

Wrong:

```tsx
<TMDataGrid {...grid} style={{ flex: 1 }} />
```

Correct:

```tsx
<TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }} />
```

Source: `packages/tmdatagrid/docs/styling.md` (Layout).

### HIGH Setting `--dg-row-height` to change density

The virtualizer needs the row height as a number, and takes it from
`meta.rowHeight` or `size`, not from the variable. Setting the variable alone
leaves the measurement and the render disagreeing, so rows overlap or gaps open
as you scroll.

Correct:

```tsx
useTMDataGrid({ data, columns, meta: { rowHeight: 64 } });
```

Source: `packages/tmdatagrid/docs/styling.md` (The size scale).

### HIGH A capability check without `features`

`getGridCapabilities` and `getColumnCapabilities` both take `features` as a
second argument because it is the value that changes. Calling
`column.getCanSort()` directly in a custom header or toolbar button memoizes
against the column identity under the React Compiler, and the control keeps
rendering after its option was switched off.

Wrong:

```tsx
if (!column.getCanSort()) return null;
```

Correct:

```tsx
const { canSort } = getColumnCapabilities(column, features);
if (!canSort) return null;
```

Source: `packages/tmdatagrid/docs/toolbar.md` (Reading options reactively).

### MEDIUM An inline `labels` object

The grid re-renders when the labels object changes identity, and an inline
literal is a new object on every render. Define it at module scope, or memoize
it.

Wrong:

```tsx
useTMDataGrid({ data, columns, labels: { noResults: "Inga träffar" } });
```

Correct:

```tsx
const labels = { noResults: "Inga träffar" } satisfies TMDataGridLabelsOverride;

useTMDataGrid({ data, columns, labels });
```

Source: `packages/tmdatagrid/docs/localization.md` (Keep the object stable).

### MEDIUM Conditionally rendering built-in toolbar parts

Each built-in already renders nothing when its feature is off. Wrapping them in
your own checks duplicates the capability logic, and the two drift apart the
first time an option changes.

Source: `packages/tmdatagrid/docs/toolbar.md` (The built-in parts).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `size` | Prop | `MantineSize` | `"md"` | The whole density scale. |
| `className` · `style` · `id` | Props | – | – | Set on the root element. `style` takes the `--dg-*` variables. |
| `meta.rowHeight` | Option | `number` | From `size` | A row height outside the scale. |
| `SIZE_ROW_HEIGHT` | Export | `Record<MantineSize, number>` | – | The row heights the scale table lists. |
| `SIZE_CONTROL_SIZE` | Export | `Record<MantineSize, MantineSize>` | – | Which control size each grid size uses. |
| `DEFAULT_TMDATAGRID_SIZE` | Export | `"md"` | – | The default size. |
| `TMDataGrid.Toolbar` · `Spacer` | Components | `children`, `withBottomBorder`, Mantine `BoxProps` | `withBottomBorder: false` | The flex row, and the push-right. Style props set on the element. |
| `useTMDataGridContext` | Hook | `() => TMDataGridContextValue` | – | `{ table, ui, features, labels, controlSize, resetSettings }`. |
| `getGridCapabilities` | Export | `(table, features) => TMDataGridCapabilities` | – | What this grid can do, reactively. |
| `getColumnCapabilities` | Export | `(column, features) => TMDataGridColumnCapabilities` | – | The same for one column. |
| `readFeatureFlags` | Export | `(options) => TMDataGridFeatureFlags` | – | Derives the flags from an options object. |
| `labels` | Option | `TMDataGridLabelsOverride` | English | Any subset, merged over the defaults. Keep it stable. |
| `grid.labels` | Hook return | `TMDataGridLabels` | – | The resolved dictionary. |
| `TMDATAGRID_LABELS_EN` · `TMDATAGRID_LABELS_SV` | Exports | `TMDataGridLabels` | – | The English base, and a complete Swedish dictionary. |
| `TMDataGridLabels` · `TMDataGridLabelsOverride` | Exports | types | – | The full dictionary, and a partial one. |
| `mergeLabels` | Export | `(override?: TMDataGridLabelsOverride) => TMDataGridLabels` | – | Folds a partial override over the English defaults. Returns `TMDATAGRID_LABELS_EN` itself without an argument. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | Per-instance override of the filtered-empty message. |

The CSS layer name `tmdatagrid` in `styles.layer.css` is public API and never
changes.

See also: the `rows` skill for `--row-bg` and per-row styling, and
`getting-started` for the component catalog.
