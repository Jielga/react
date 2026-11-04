# Filtering

Per-column filters, built out of an operator and a value. Users add them from
the filter panel, the column headers or a column menu - `filters` decides
which. You control what each column offers through `meta.type`, and can
replace the value control when the default input is not the right one.

For one box across every column instead, see [Quick search](/docs/quick-search).

```demo
file: columns/Filtering.tsx
hint: Every column type offers its own operators - Salary opens on “between” because its meta says so.
```

## How a filter is stored

All columns share one filter function. The operator lives *in the value*
rather than being selected through `filterFn`:

```ts
type TMDataGridFilterValue = {
  operator: TMDataGridFilterOperator;
  value: string | ReadonlyArray<string>;
};
```

So the filter model is plain JSON, and can be forwarded to a server without
transformation - dates as ISO strings, booleans as `"true"` / `"false"`, and an
array only under `isAnyOf` / `isNoneOf` (the set the cell is tested against) and
`between` (a `[min, max]` pair, an empty string leaving that end open). See
[Server-side data](/docs/server-side#sending-filters).

A filter with an empty value stays in state, so a panel row survives while the
user types. (A header filter control has no row to keep alive and drops its
entry instead - see [inHeader](#inheader).) The built-in matcher lets every row through, and
the filter does not set the header's filter indicator and produces no pill. `isFilterActive(value)` tests for that
state, and `activeColumnFilters` applies it across the whole slice, handing
back the entries that narrow the grid with their values typed as
`TMDataGridFilterValue` rather than as `unknown`. Entries in any other value
shape are dropped, so a custom control's raw filter values do not come back
from it.

## Operators

`meta.type` selects which operators a column offers.

| Operator | Label | Column type |
| --- | --- | --- |
| `contains` | contains | `string` |
| `equals` | equals | `string`, `number`, `boolean`, `date` |
| `notEquals` | does not equal | `string`, `number`, `boolean`, `date` |
| `startsWith` | starts with | `string` |
| `endsWith` | ends with | `string` |
| `greaterThan` | is greater than | `number` |
| `greaterThanOrEqual` | is greater than or equal to | `number` |
| `lessThan` | is less than | `number` |
| `lessThanOrEqual` | is less than or equal to | `number` |
| `between` | is between | `number`, `date` |
| `before` | is before | `date` |
| `after` | is after | `date` |
| `onOrBefore` | is on or before | `date` |
| `onOrAfter` | is on or after | `date` |
| `isAnyOf` | is any of | `select`, `multiSelect` |
| `isNoneOf` | is none of | `select`, `multiSelect` |
| `isEmpty` | is empty | every type |
| `isNotEmpty` | is not empty | every type |

String comparisons are case-insensitive. Date comparisons are by calendar day,
so `equals` on a `date` column matches the same day. On a `multiSelect`
column, whose cells hold arrays, `isAnyOf` is an intersection test and
`isNoneOf` its complement, and an empty cell array counts as empty for
`isEmpty`. `between` is inclusive at both ends; the panel renders a From/To
pair and either end may stay empty to leave the interval open on that side.

`meta.filter.defaultOperator` sets which one a fresh filter opens on: a salary
column can start on `between` rather than `equals`. It must be one of the
operators that type offers.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  meta: { type: "number", filter: { defaultOperator: "between" } },
});
```

`meta.filter.operators` narrows the list a column offers to a subset of its type's.
The panel's operator dropdown and the header row's funnel menu then show only those, in the type's order.
An operator the type does not offer is ignored, and a list that leaves nothing falls back to the type's full set.
Without `defaultOperator`, a fresh filter opens on the type's default when it is offered and on the first offered operator otherwise.
Declare it on a column whose backend answers only some operators, so the user is never offered one the query cannot express - see [A server-backed search](/docs/server-query#offering-only-what-the-endpoint-answers).

```tsx
columnHelper.accessor("customer", {
  header: "Customer",
  meta: { filter: { operators: ["contains", "equals", "isEmpty", "isNotEmpty"] } },
});
```

`getColumnOperators(column)` returns the resolved list, and `getColumnDefaultOperator(column)` the operator a fresh filter on it opens on.

`meta.filter.url` keeps a column's filter out of a `persist.urlKey` link. See [Deep links](/docs/persistence#deep-links).

## The filters option

`filters` on `useTMDataGrid` decides where the filter controls render.

```tsx
useTMDataGrid({ data, columns, filters: { surface: "sidebar", inHeader: true } });
```

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `surface` | `"popup" \| "sidebar" \| "none"` | `"popup"` | The surface `TMDataGrid.Table` renders and `TMDataGrid.FilterButton` toggles. |
| `sidebarSide` | `"left" \| "right"` | `"right"` | Which side the sidebar sits on. Ignored by the other surfaces. |
| `sidebarWidth` | `string` | `"280px"` | Width of the sidebar, any CSS length. Ignored by the other surfaces. |
| `defaultOpen` | `boolean` | `true` under `"sidebar"`, `false` otherwise | Whether the surface starts open. Read once, at mount. Under `"none"`, the starting value of `ui.state.filterPanelOpen`. |
| `inHeader` | `boolean` | `false` | A second header row of per-column controls. Independent of `surface`. |

`surface` and `inHeader` are two separate choices, not one list: `inHeader` composes with all three surfaces.
`{ surface: "none", inHeader: true }` is header filters and nothing else; `{ inHeader: true }` keeps the popup as well, for the multi-column work a header row has no room for.

The option is read field by field, so an inline object literal needs no `useMemo` - unlike `labels` and `persist`, it does not have to be referentially stable.

### surface: "popup"

The default.
The panel floats over the first body rows, anchored under the header.
A pointerdown outside closes it, so does Escape, and so does emptying it - by removing the last filter row or by **Clear all**.
`TMDataGrid.FilterButton` is exempt from the click-away, which is what keeps it a toggle.
Closing only hides the popup; the filters stay.

### surface: "sidebar"

The same panel beside the rows, inside the grid frame and under the toolbar.
It is a column of the frame rather than a layer over it: the rows give up the width instead of being covered, a click in the table does not dismiss it, and clearing the filters leaves it standing with its **Add filter** button.
Escape closes it.
It starts open (`defaultOpen` defaults to `true` here) and renders the panel with `layout="stacked"`, because the default 280px cannot fit the column, operator and value fields side by side.

```demo
file: columns/FilterSidebar.tsx
hint: The funnel button in the toolbar closes the sidebar and gives the width back to the rows.
```

### surface: "none"

The grid renders no surface of its own and `TMDataGrid.FilterButton` renders nothing.
Use it for header filters alone, or to place the panel yourself - see [TMDataGrid.FilterPanel](#tmdatagridfilterpanel).

### inHeader

`inHeader: true` adds a second header row holding one value control per filterable column, always visible.
The row shares the column tracks and pinned lanes of the header above it, so resizing, reordering and pinning move each control with its column.

A header cell has room for a value and not much else, so the panel's column and operator dropdowns are not there: the column is the one the cell sits over, and the operator is a funnel button beside the input, tinted whenever the column is on anything but its default operator.
The control itself is the same one the panel would render, `meta.filter.control` included - it receives `layout: "header"` and drops its field label for an `aria-label`.

Two pieces of column chrome come off with header filters on: the column menu's **Filter** item and the funnel indicator on a filtered header.
Both existed only to reveal a control that is now always on screen; the filtered column's tinted title stays.

Clearing a header control removes the column's `columnFilters` entry rather than leaving an empty one behind - unless the user also picked a non-default operator, which is kept, being the part of the filter an empty control cannot show.
Panel rows still keep their empty filters; see [How a filter is stored](#how-a-filter-is-stored).

A narrow column clips its control.
Give a column that has to hold a date range or a multi-select a `minSize` wide enough for it.

`TMDataGrid.FilterButton` still toggles whatever `surface` names, and the panel it opens holds the same filters.
`openColumnFilter` does not: with `inHeader` on it always scrolls the column's header control into view and focuses it, leaving the surface closed.

```demo
file: columns/HeaderFilters.tsx
hint: Department offers its faceted values; the funnel beside an input changes that column's operator.
```

## TMDataGrid.FilterButton

The toolbar button that toggles the filter surface, tinted with the count of active filters.
Opening an empty panel seeds a filter row on the first filterable column; with filters already in state it opens on those.
It renders nothing when no column can be filtered (`enableColumnFilters: false`), and nothing under `surface: "none"`, where there is no surface to toggle.
It is part of every demo on this page.

No props.

## TMDataGrid.FilterPanel

The panel of filter rows - one column / operator / value triple per filter, over an "Add filter" / "Clear all" footer.
It is a plain block with no title, no close button and no open state: it renders wherever it is mounted, and the popup and sidebar surfaces are wrappers around it.
It must be inside `<TMDataGrid>`, since it reads the grid from context, and it only reads and writes the table's `columnFilters` state, so the same panel works unchanged under `manualFiltering`.

Pair it with `surface: "none"` so it is the only panel on the page, and drive it off `ui.state.filterPanelOpen` if it belongs behind a control of your own - `defaultOpen` sets where that state starts.

```demo
file: columns/FilterPanelPlaced.tsx
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `layout` | `"row" \| "stacked"` | `"row"` | `"row"` lays the three fields side by side and wants about 550px. `"stacked"` puts them one under the other, each filling the width, for a drawer or a narrow column. Passed to every value control as its `layout`, so a `meta.filter.control` sizes itself to the same decision. |
| Mantine `BoxProps` | | – | Style props (`p`, `w`, …), `className` and `style`, set on the panel block. |

```tsx
<Drawer opened={open} onClose={close}>
  <TMDataGrid.FilterPanel layout="stacked" />
</Drawer>
```

## TMDataGrid.FilterPills

One pill per active filter - `First name: Sofia ✕` - where the ✕ clears that filter and a click on the label sends the user to that column's control through [openColumnFilter](#opencolumnfilter).
A value with an option reads as the option's label, and a boolean value as `labels.booleanTrue` or `labels.booleanFalse`.
Half-typed filters produce no pill.
The label spells the operator out unless it is the column type's default: `Age is greater than 30`, but `First name: Sofia`.

It takes the grid as an `api` prop rather than reading context, so active filters can live in a page header, above the toolbar, or anywhere else on the page.
It is also exported as `TMDataGridFilterPills`, for a file where nothing else touches `TMDataGrid`.

```demo
file: columns/FilterPills.tsx
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `api` | `TMDataGridApi<TData>` | - | The object returned by `useTMDataGrid`. |
| `size` | `TMDataGridSize` | `"sm"` | Pill size. |
| `showClearAll` | `boolean` | `true` | "Clear all", shown once two filters are active. |
| `onPillClick` | `(columnId: string) => void` | - | Replaces the default click behaviour. |
| Mantine `BoxProps` | | - | Style props (`mb`, `hiddenFrom`, …), `className` and `style`, set on the wrapper. |

## openColumnFilter

`openColumnFilter(api, columnId)` sends the user to a column's filter control - what a pill's label and the column menu's **Filter** item both call, available for a control of your own.
It seeds an empty filter on the column if it has none yet, then opens the surface on that column's panel row.
Under `filters.inHeader` it instead scrolls the column's header control into view and focuses it, leaving the surface closed.

## Replacing the value control

The built-in control follows the type and operator: a text input for strings, a
number pair for `between`, a native date input for dates, a Yes/No dropdown for
booleans, a multi-select for option columns.

Four ready-made alternatives ship as named exports:

| Export | For | Renders |
| --- | --- | --- |
| `DgRangeSliderFilter` | `number` | A range slider seeded from the data's min/max, writing the `between` pair. |
| `DgDateRangeFilter` | `date` | A From/To pair of native date inputs, writing the `between` pair. |
| `DgAutocompleteFilter` | `string` | Free text with the faceted (or declared) values as suggestions. |
| `DgTriStateFilter` | `boolean` | All / Yes / No segments - All clears the filter. |

```tsx
meta: {
  type: "number",
  filter: { control: DgRangeSliderFilter, defaultOperator: "between" },
}
```

Pair the range-shaped ones with `defaultOperator: "between"` so the filter
opens on them. For an operator they do not cover, every built-in falls back to
`TMDataGridFilterValueInput`, the default control, which is exported so custom
controls can fall back the same way.

```demo
file: columns/BuiltInFilterControls.tsx
hint: Open the filter panel and compare each row's control with the plain input the other demos show.
```

### Writing your own

`meta.filter.control` is a **component**, rendered as JSX, so hooks may be used
inside. It receives `TMDataGridFilterControlArgs` and handles the value only:
it reads `operator` to shape itself and writes the bare value through
`onChange`, and the grid stores the `{ operator, value }` pair around it. The
column and operator dropdowns remain the panel's.

```tsx
const SalaryFilter: TMDataGridFilterControlComponent = ({
  operator,
  value,
  onChange,
}) =>
  operator === "between" ? (
    <RangeSlider /* value is the [min, max] pair */ />
  ) : (
    <NumberInput /* a single bound */ />
  );

meta: { filter: { control: SalaryFilter, defaultOperator: "between" } }
```

Define controls at module scope so their identity is stable. `args.options`
arrives pre-resolved through `resolveColumnOptions` for a column that declares
`meta.options` or is select-shaped. `args.table` is available to a control that
needs more than that.

`args.layout` says how much room the control has and whether it has to name
itself:

| `layout` | Where | The field |
| --- | --- | --- |
| `"row"` | A panel row laid out side by side | Labelled, fixed width |
| `"stacked"` | A panel row in a narrow host - the sidebar | Labelled, fills the width |
| `"header"` | One header cell, under `filters.inHeader` | No label; `aria-label` instead, fills the column |

```tsx
const SalaryFilter: TMDataGridFilterControlComponent = ({ layout, ...rest }) =>
  layout === "header" ? <NumberInput {...} /> : <RangeSlider {...} />;
```

A control that ignores `layout` still works and looks the same in every
surface, including a header cell, where the room is smallest. Every built-in
control honours it.

```demo
file: columns/CustomFilterControl.tsx
hint: Open the filter panel - Status offers chips, every other column the built-in control.
```

## Writing filters from your own interface

The grid's controls write plain TanStack state, so a control of your own does
the same. Write an envelope with `column.setFilterValue` or
`table.setColumnFilters`; the matcher, the pills, the header indicator and
`activeColumnFilters` all read it:

```tsx
import { emptyValueForOperator, type TMDataGridFilterValue } from "@jielga/tmdatagrid";

const status = grid.table.getColumn("status")!;

// A set filter, as the panel would write it.
status.setFilterValue({
  operator: "isAnyOf",
  value: ["active", "paused"],
} satisfies TMDataGridFilterValue);

// An empty envelope stays in state and matches every row.
status.setFilterValue({ operator: "isAnyOf", value: emptyValueForOperator("isAnyOf") });

// `undefined` removes the entry.
status.setFilterValue(undefined);
```

`getColumnOperators(column)` returns the operators a column offers and
`getColumnDefaultOperator(column)` the one a fresh filter opens on;
`emptyValueForOperator(operator)` returns the empty value of the right shape.

To keep the grid's panel and place it yourself, set `filters: { surface: "none" }`
and render [TMDataGrid.FilterPanel](#tmdatagridfilterpanel) where it belongs.
To keep filtering on and drop only the column menu's Filter item, pass
`renderColumnMenuItems` to `TMDataGrid.Table` and leave out the item keyed
`"filter"` (see [Column menu](/docs/column-menu)). To replace every filter
control, set `enableColumnFilters: false` and write the envelope yourself;
filters in state still apply.

## Custom matching

To give a column its own matching logic instead of its own control, set
`filterFn` on the column definition. A column `filterFn` replaces the shared
matcher for that column, so its third argument is the stored
`{ operator, value }` envelope, not the unwrapped value. Type it as
`TMDataGridFilterFn<TData>` and delegate to `tmDataGridFilterFn` for the
operators it does not handle itself. A column `filterFn` is also called with
half-typed envelopes, which the built-in matcher treats as matching every row,
so return `true` for `!isFilterActive(filter)` first:

```ts
import {
  isFilterActive,
  tmDataGridFilterFn,
  type TMDataGridFilterFn,
} from "@jielga/tmdatagrid";

// Reads "contains" as "has this tag", so "ops" matches the tag "ops" and not
// "devops"; every other operator keeps the built-in matching.
const matchesTags: TMDataGridFilterFn<Employee> = (row, columnId, filter) => {
  if (!isFilterActive(filter)) return true;
  if (filter.operator === "contains") {
    const wanted = String(filter.value).toLowerCase();
    return row.original.tags.some((tag) => tag.toLowerCase() === wanted);
  }
  return tmDataGridFilterFn(row, columnId, filter);
};

columnHelper.accessor((row) => row.tags.join(", "), {
  id: "tags",
  header: "Tags",
  filterFn: matchesTags,
  meta: { type: "string" },
});
```

`filter.value` is a string under the scalar operators, a `ReadonlyArray<string>`
under `isAnyOf` / `isNoneOf` and a `[min, max]` pair under `between`;
`filterValueShape(operator)` tells which. `matchesFilter(cellValue, filter)`
applies the built-in matching to a value derived by the function itself.

The column's filter controls do not change: the operators still come from
`meta.type` and `meta.filter.operators`, and the panel, the pills and the header
indicator keep reading the envelope. A filter function named by string also
receives the envelope and does not unwrap it, so TanStack's built-ins such as
`"includesString"` do not work as a column `filterFn`. Write custom matching as
a function.

## Turning it off

`enableColumnFilters: false` removes the Filter item from the column menu, the
`FilterButton`, the header filter row and the panel's column list, and disables
the panel's "Add filter" button. It does not clear `columnFilters`: an entry already in
state, or one written with `setFilterValue`, still narrows the rows, still shows
as a pill and still sets the header indicator. Call `table.resetColumnFilters()`
when switching the interface off. Under `filters.surface: "sidebar"`, set
`surface: "none"` as well, as the sidebar does not follow the switch.

`enableColumnFilter: false` on a column removes that column's menu item, its
entry in the panel's column list and its header control - the header cell
stays, empty.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableColumnFilters` | Table option | `boolean` | `true` | `false` removes the menu item, the button, the header row and the panel's column list, and disables the panel's "Add filter" button. Filters already in state still apply. |
| `filters.surface` | Table option | `"popup" \| "sidebar" \| "none"` | `"popup"` | Which surface the table renders. |
| `filters.sidebarSide` | Table option | `"left" \| "right"` | `"right"` | Which side the sidebar sits on. |
| `filters.sidebarWidth` | Table option | `string` | `"280px"` | Width of the sidebar. |
| `filters.defaultOpen` | Table option | `boolean` | `true` under `"sidebar"` | Whether the surface starts open. |
| `filters.inHeader` | Table option | `boolean` | `false` | A second header row of per-column controls. |
| `enableColumnFilter` | Column option | `boolean` | `true` | `false` takes one column out of filtering. |
| `meta.type` | Column meta | `"string" \| "number" \| "boolean" \| "date" \| "select" \| "multiSelect"` | `"string"` | Selects the operators and the value control. |
| `meta.filter.operators` | Column meta | `readonly TMDataGridFilterOperator[]` | The type's list | The operators this column offers, a subset of its type's. |
| `meta.filter.defaultOperator` | Column meta | `TMDataGridFilterOperator` | The type's default, else the first offered | The operator a fresh filter opens on. |
| `meta.filter.control` | Column meta | `TMDataGridFilterControlComponent` | By type and operator | Replaces the value control. |
| `meta.filter.url` | Column meta | `boolean` | `true` | Keeps the column's filter out of a `persist.urlKey` link when `false`. See [Deep links](/docs/persistence#deep-links). |
| `filterFn` | Column option | `TMDataGridFilterFn<TData>` \| name | `"tmDataGrid"` | Custom matching for one column. Receives the `{ operator, value }` envelope. |
| `TMDataGridFilterFn<TData>` | Type | `(row, columnId, filter: TMDataGridFilterValue, addMeta?) => boolean` | – | The signature of a column's own `filterFn`. |
| `tmDataGridFilterFn` | Export | `(row, columnId, filterValue: unknown) => boolean`, assignable to `TMDataGridFilterFn<TData>` | – | The shared matcher, for a custom `filterFn` to delegate to. |
| `matchesFilter` | Export | `(cellValue, filter: TMDataGridFilterValue) => boolean` | – | The built-in matching applied to one value. |
| `TMDataGrid.FilterPanel` | Component | `layout: "row" \| "stacked"` | `"row"` | The panel of filter rows, as a plain block. |
| `TMDataGrid.FilterButton` | Component | – | – | Toolbar button toggling the surface, with an active count. Seeds a filter row only when the panel is empty. |
| `TMDataGrid.FilterPills` | Component | takes `api` | – | Active filters as removable pills, renderable anywhere. |
| `TMDataGridFilterPillsProps` | Type | – | – | The props of `TMDataGrid.FilterPills`. |
| `openColumnFilter` | Export | `(api, columnId) => void` | – | Sends the user to a column's filter control, seeding an empty filter. |
| `TMDataGridFilterControlArgs` | Type | `layout: "row" \| "stacked" \| "header"` | – | What a value control is handed, `layout` saying how much room it has. |
| `TMDataGridFilterControlLayout` | Type | `"row" \| "stacked" \| "header"` | – | The type of `layout` on `TMDataGridFilterControlArgs`. |
| `isFilterActive` | Export | `(value) => boolean` | – | Whether a filter value narrows anything. |
| `activeColumnFilters` | Export | `(columnFilters \| table) => Array<{ id, value }>` | – | The filters in the grid's own value shape that narrow anything, typed. |
| `TMDataGridColumnFilter` | Type | `{ id, value }` | – | One entry of `columnFilters`, typed. What `activeColumnFilters` returns a list of. |
| `getOperatorsForType` | Export | `(type) => operators` | – | The operator list a type offers. |
| `getColumnOperators` · `getColumnDefaultOperator` | Exports | `(column) => operators` · `(column) => operator` | – | The list one column offers after `meta.filter.operators`, and the operator a fresh filter on it opens on. |
| `FILTER_OPERATOR_LABELS` | Export | record | – | The label shown for each operator. |
| `TMDataGridFilterValueInput` | Export | component | – | The default value control, for falling back to. |
| `formatFilterLabel` | Export | `({ label, type, filter, operatorLabels?, options?, labels? }) => string` | – | The one-line description used on the pills. `operatorLabels` names the operators, `options` gives a value its option's label, and `labels` gives a boolean its `booleanTrue` / `booleanFalse`; each defaults to English or to the value itself. |
| `emptyValueForOperator` · `operatorNeedsValue` · `operatorTakesArrayValue` · `operatorTakesRangeValue` · `filterValueShape` | Exports | – | – | What shape of value an operator expects. |
| `TMDataGridFilterValueShape` | Type | `"scalar" \| "set" \| "range"` | – | What `filterValueShape` returns for an operator. |
| `TMDataGridFiltersOptions` · `TMDataGridFiltersSettings` · `TMDataGridFilterSurface` · `TMDataGridFilterSidebarSide` | Types | – | – | The `filters` option, and the resolved form of it on `api.filters`. |
| `TMDataGridFilterPanelProps` · `TMDataGridFilterPanelLayout` | Types | – | – | For wrapping `TMDataGrid.FilterPanel` in a component of your own. |
| `DgRangeSliderFilter` · `DgDateRangeFilter` · `DgAutocompleteFilter` · `DgTriStateFilter` | Exports | components | – | The four ready-made controls. |
