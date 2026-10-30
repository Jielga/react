# Toolbar

The toolbar is a flex row. Your own buttons are children of it, beside the
built-in ones; there is no slots API and no `actions` prop.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer />
  <TMDataGrid.LoadingIndicator />
  <Button size="xs" variant="light" onClick={exportAll}>
    Export
  </Button>
  <TMDataGrid.FilterButton />
  <TMDataGrid.Menu>
    <TMDataGrid.Menu.Columns />
  </TMDataGrid.Menu>
</TMDataGrid.Toolbar>
```

`TMDataGrid.Spacer` pushes everything after it to the right.
`TMDataGrid.Menu` is the burger; it holds the column chooser here, and anything else you put in it.
See [Grid menu](/docs/menu).

```demo
file: customization/ToolbarComposition.tsx
extraSources: data/employeeColumns.tsx
```

Only the parts you render exist. A grid with no `Toolbar` has no toolbar; a
toolbar with only `Search` has only a search box.

## Style props

`TMDataGrid.Toolbar` and `TMDataGrid.Spacer` take Mantine's `BoxProps`: the style props (`mb`, `px`, `h`, `hiddenFrom`, …), `className`, `style` and `mod`, set on the element itself.
`withBottomBorder` draws a 1px line under the toolbar in the theme's default border colour, the same line the header draws under itself.
It defaults to `false`.

```tsx
<TMDataGrid.Toolbar withBottomBorder px="sm">
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer hiddenFrom="sm" />
  <TMDataGrid.FilterButton />
</TMDataGrid.Toolbar>
```

`TMDataGrid.Footer`, `TMDataGrid.FilterPanel`, `TMDataGrid.FilterPills` and `TMDataGrid.ColumnsPanel` take the same `BoxProps`; see [Components](/docs/components).

## The built-in parts

| Component | Shows |
| --- | --- |
| `TMDataGrid.Search` | The [quick search](/docs/quick-search) input |
| `TMDataGrid.FilterButton` | Opens the [filter panel](/docs/filtering), with the active count |
| `TMDataGrid.Menu` | The burger: a [menu](/docs/menu) you fill; `TMDataGrid.Menu.Columns` is the column chooser as items |
| `TMDataGrid.ViewsMenu` | The [saved views](/docs/saved-views) behind a button of their own |
| `TMDataGrid.SummaryCount` | Visible rows out of total, or the count alone where there is no total to compare it against |
| `TMDataGrid.LoadingIndicator` | A spinner while `meta.loading` |
| `TMDataGrid.Spacer` | Pushes what follows to the right |
| `TMDataGridDraftActions` | Save and Discard for the [draft store](/docs/draft-store) |

Each renders nothing when its feature is off, so a read-only grid needs no
conditionals in the toolbar: `FilterButton` under `enableColumnFilters: false`
renders nothing at all.
`TMDataGrid.Menu` is the exception, since it cannot see what its children render; see [Grid menu](/docs/menu).

## Buttons of your own

A button that acts on the grid reads it from context:

```tsx
import { useTMDataGridContext } from "@jielga/tmdatagrid";

function ClearFiltersButton() {
  const { table } = useTMDataGridContext();
  return (
    <Button size="xs" onClick={() => table.resetColumnFilters()}>
      Clear filters
    </Button>
  );
}
```

Anything rendered inside `TMDataGrid` can call it. It returns
`{ table, ui, features, filters, exportOptions, labels, controlSize, resetSettings }`.

An export button uses `useTMDataGridExport`, which hands back the export as click handlers:

```tsx
import { useTMDataGridExport } from "@jielga/tmdatagrid";

function ExportButton() {
  const { exportAll } = useTMDataGridExport();
  return (
    <Button size="xs" onClick={() => void exportAll()}>
      Export
    </Button>
  );
}
```

It writes every filtered row, whatever the cell selection is or whether cell selection is on at all.
The format, the file name and the selected-rows variant are on [Export](/docs/export).

### Hide a button when its feature is off

The built-in parts disappear when their feature is off. Your own can use the
same checks instead of re-deriving them:

```tsx
import { getGridCapabilities, useTMDataGridContext } from "@jielga/tmdatagrid";

function ExportButton() {
  const { table, features } = useTMDataGridContext();
  const { canFilterAny } = getGridCapabilities(table, features);

  if (!canFilterAny) return null;
  // …
}
```

| Field | True when |
| --- | --- |
| `canSortAny` | At least one leaf column can be sorted |
| `canFilterAny` | At least one leaf column can be filtered |
| `canHideAny` | At least one leaf column can be hidden |
| `canPinAny` | At least one leaf column can be pinned |
| `canReorderAny` | At least one leaf column can be moved |
| `canGroupAny` | At least one leaf column can be grouped on |
| `canSelectRows` | `enableRowSelection` is not `false` and the mode is not `"highlight"` |
| `canPaginate` | Paging is configured. See [`isPagingActive`](/docs/pagination#grouping) for whether it is slicing anything |
| `canSearch` | At least one leaf column takes part in the quick search |

`getColumnCapabilities(column, features)` returns the same for one column, as
`canSort`, `canFilter`, `canHide`, `canPin`, `canResize`, `canReorder` and
`canGroup`.

### Reading options reactively

`features` is re-derived from the options object on every render, and both
capability helpers take it alongside the table or column. A bare
`column.getCanSort()` is memoized against a column identity that survives an
options change, so a grid whose `enableSorting` turned `false` would keep
rendering sort indicators; `features` is the value that changes.

Read state through TanStack Store's
[`useSelector(table.store, …)`](https://tanstack.com/store/latest/docs/framework/react/reference)
and options through `features`, rather than calling methods on a long-lived
object.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `TMDataGrid.Toolbar` | Component | `children`, `withBottomBorder`, Mantine `BoxProps` | `withBottomBorder: false` | The flex row above the grid. Style props set on the row. |
| `TMDataGrid.Spacer` | Component | Mantine `BoxProps` | – | Pushes what follows to the right. |
| `TMDataGrid.FilterButton` | Component | – | – | Opens the filter panel, with an active count. |
| `TMDataGrid.Menu` | Component | `children` | – | The burger and its dropdown. See [Grid menu](/docs/menu). |
| `useTMDataGridContext` | Hook | `() => TMDataGridContextValue` | – | `{ table, ui, features, labels, controlSize, resetSettings }`. |
| `getGridCapabilities` | Export | `(table, features) => TMDataGridCapabilities` | – | What this grid can do. Reactive to option changes. |
| `getColumnCapabilities` | Export | `(column, features) => TMDataGridColumnCapabilities` | – | The same for one column. |
| `readFeatureFlags` | Export | `(options) => TMDataGridFeatureFlags` | – | Derives the flags from an options object. |
