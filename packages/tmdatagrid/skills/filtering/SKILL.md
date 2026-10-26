---
name: filtering
description: >
  Narrow the rows a TMDataGrid shows. Covers the shared tmDataGrid filter
  function and its {operator, value} model, the eighteen operators and which
  meta.type offers each, meta.filter.operators to offer a column only a subset
  of them, meta.filter.defaultOperator, meta.filter.url for deep links,
  isFilterActive and the half-typed filter, the filters option and its surfaces
  (popup, sidebar, none, plus inHeader for header filters),
  TMDataGrid.FilterPanel and its layout prop, TMDataGrid.FilterButton,
  TMDataGrid.FilterPills with its api prop, openColumnFilter, replacing a value
  control with DgRangeSliderFilter / DgDateRangeFilter / DgAutocompleteFilter /
  DgTriStateFilter or a meta.filter.control component, per-column filterFn, and
  the quick search: TMDataGrid.Search, quickSearchMode fuzzy or contains,
  fuzzyGlobalFilterFn, enableMatchHighlighting and enableGlobalFilter. Load when
  adding filters, choosing operators, building a filter control, showing active
  filters outside the grid, or wiring a search box.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.5.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/filtering.md'
  - 'Jielga/react:packages/tmdatagrid/docs/quick-search.md'
  - 'Jielga/react:packages/tmdatagrid/src/core/filterOperators.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/quickSearch.ts'
---

# TMDataGrid - Filtering

Two independent narrowings: per-column filters built from an operator and a
value, and one quick-search box across every column. Both write standard
TanStack state, so a `manualFiltering` grid forwards either to a server.

## How a filter is stored

All columns share one filter function. The operator lives **in the value**
rather than being selected through `filterFn`:

```ts
type TMDataGridFilterValue = {
  operator: TMDataGridFilterOperator;
  value: string | ReadonlyArray<string>;
};
```

The model is therefore plain JSON: dates as ISO `YYYY-MM-DD`, booleans as
`"true"` / `"false"`, and an array only under `isAnyOf` / `isNoneOf` (the set the
cell is tested against) and `between` (a `[min, max]` pair, an empty string
leaving that end open).

A filter with an empty value **stays in state** so the panel keeps its row while
the user types. The built-in matcher lets every row through, and the filter
does not set the header indicator and produces no pill.
`isFilterActive(value)` tells whether a value narrows anything.
`activeColumnFilters(columnFilters | table)` returns the active entries, typed,
and drops entries in any other value shape. An entry in `columnFilters` is not
necessarily active.

## Operators

`meta.type` selects which operators a column offers.

| Column type | Operators |
| --- | --- |
| `string` | `contains`, `equals`, `notEquals`, `startsWith`, `endsWith` |
| `number` | `equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `between` |
| `date` | `equals`, `notEquals`, `before`, `after`, `onOrBefore`, `onOrAfter`, `between` |
| `boolean` | `equals`, `notEquals` |
| `select`, `multiSelect` | `isAnyOf`, `isNoneOf` |

Every type also offers `isEmpty` and `isNotEmpty`, which ignore the value input.

String comparisons are case-insensitive. Date comparisons are by calendar day,
so `equals` on a `date` column matches the same day. On a `multiSelect`
column, whose cells hold arrays, `isAnyOf` is an intersection test and `isNoneOf`
its complement. `between` is inclusive at both ends.

`meta.filter.defaultOperator` sets which one a fresh filter opens on, and must be
one of the operators that type offers:

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  meta: { type: "number", filter: { defaultOperator: "between" } },
});
```

`meta.filter.operators` narrows the list a column offers to a subset of its
type's - for a column whose backend answers only some operators, so the user is
never offered one the query cannot express. The panel dropdown and the header
funnel show only those, in the type's order. An operator the type does not
offer is ignored; a list that leaves nothing falls back to the type's full set.
Without `defaultOperator`, a fresh filter opens on the type's default when it is
offered, else on the first offered operator.

```tsx
columnHelper.accessor("customer", {
  header: "Customer",
  meta: { filter: { operators: ["contains", "equals", "isEmpty", "isNotEmpty"] } },
});
```

`getColumnOperators(column)` returns the resolved list and
`getColumnDefaultOperator(column)` the operator a fresh filter opens on. The
`server-side` skill shows the list typed together with the API mapping table.

`meta.filter.url` determines whether the column's filter goes into the URL
search param when `persist.urlKey` carries `columnFilters`. By default it does.
Set it to `false` for a filter that should not travel in a shared link; the
filter is then not persisted anywhere. The `options` skill covers `urlKey`.

```tsx
columnHelper.accessor("owner", {
  header: "Owner",
  meta: { filter: { url: false } },
});
```

## The filters option

`filters` on `useTMDataGrid` picks the surface. It is read field by field, so an
inline object literal needs no `useMemo`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `surface` | `"popup" \| "sidebar" \| "none"` | `"popup"` | What `TMDataGrid.Table` renders and `FilterButton` toggles. |
| `sidebarSide` | `"left" \| "right"` | `"right"` | Which side the sidebar sits on. Ignored by the other surfaces. |
| `sidebarWidth` | `string` | `"280px"` | Sidebar width, any CSS length. Ignored by the other surfaces. |
| `defaultOpen` | `boolean` | `true` under `"sidebar"`, else `false` | Whether the surface starts open. Read once, at mount. Under `"none"`, the starting value of `ui.state.filterPanelOpen`. |
| `inHeader` | `boolean` | `false` | A second header row of per-column controls. Independent of `surface`. |

`surface` and `inHeader` are separate choices: `{ surface: "none", inHeader: true }`
is header filters alone, `{ inHeader: true }` keeps the popup as well.

```tsx
useTMDataGrid({ data, columns, filters: { surface: "sidebar", inHeader: true } });
```

**Popup** - the default. Floats over the first body rows. A pointerdown
outside, Escape, and emptying it (the last row removed, or **Clear all**) all
close it; `FilterButton` is exempt from the click-away so it stays a toggle.

**Sidebar** - the same panel beside the rows, inside the grid frame and under
the toolbar. The rows give up the width rather than being covered, a click in
the table does not dismiss it, and clearing the filters leaves it standing.
Escape closes it. It starts open, being a layout choice; its rows are
`layout="stacked"`, since the default 280px cannot fit the column, operator and
value fields side by side.

**Header filters** - `inHeader: true` adds a header row of value controls, one
per filterable column, on the same column tracks as everything else. The
column and operator dropdowns are not there: the column is the one the cell
sits over, and the operator is a funnel button beside the input, tinted when
the operator is not the type's default. The column menu's Filter item and the funnel indicator both come off,
having nothing left to reveal; the filtered column's tinted title stays. A
narrow column clips its control - give it a `minSize`.

Clearing a header control removes the column's `columnFilters` entry rather
than leaving an empty one, unless the user also picked a non-default operator,
which is kept. Panel rows still keep their empty filters.

`FilterButton` still toggles whatever `surface` names. `openColumnFilter` does
not: under `inHeader` it always focuses the header control and leaves the
surface closed.

**None** - `surface: "none"` renders no panel and no `FilterButton`, so a
hand-placed `TMDataGrid.FilterPanel` is the only one. Read
`ui.state.filterPanelOpen` if it belongs behind a control of your own.

## TMDataGrid.FilterPanel

The panel of filter rows - one column / operator / value triple per filter, over "Add filter" and "Clear all".
A plain block with no title, no close button and no open state: it renders wherever it is mounted, and the popup and sidebar surfaces are wrappers around it.
It must be inside `<TMDataGrid>` (it reads the grid from context) and it only reads and writes `columnFilters`, so it works unchanged under `manualFiltering`.
Closing a surface only hides it; the filters stay.
**Clear all** drops every filter, half-typed ones included.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `layout` | `"row" \| "stacked"` | `"row"` | `"row"` is side by side and wants about 550px; `"stacked"` fills a narrow host. Passed to every value control as its `layout`. |

```tsx
<Drawer opened={open} onClose={close}>
  <TMDataGrid.FilterPanel layout="stacked" />
</Drawer>
```

## TMDataGrid.FilterButton

The toolbar button that toggles the filter surface, tinted with the count of active filters.
Opening an empty panel seeds a filter row on the first filterable column; with filters already in state it opens on those.
Renders nothing when no column can be filtered, and nothing under `surface: "none"`.
No props.

## TMDataGrid.FilterPills

One pill per **active** filter, `First name: Sofia ✕`, where the ✕ clears it and a click on the label calls `openColumnFilter`.
The label spells the operator out unless it is the type's default: `Age is greater than 30`, but `First name: Sofia`.
A value with an option reads as the option's label, and a boolean value as `labels.booleanTrue` or `labels.booleanFalse`.
It takes the grid as an `api` prop instead of reading context, so it renders anywhere on the page.

```tsx
import { TMDataGridFilterPills } from "@jielga/tmdatagrid";

<TMDataGridFilterPills api={grid} onPillClick={(columnId) => focus(columnId)} />;
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `api` | `TMDataGridApi<TData>` | - | The object returned by `useTMDataGrid`. |
| `size` | `MantineSize` | `"sm"` | Pill size. |
| `showClearAll` | `boolean` | `true` | "Clear all", shown once two filters are active. |
| `onPillClick` | `(columnId: string) => void` | - | Replaces the default click behaviour. |
| `className` | `string` | - | Added to the wrapper class. |

## openColumnFilter

`openColumnFilter(api, columnId)` seeds an empty filter if the column has none, then opens the surface on that column's panel row.
Under `inHeader` it instead scrolls the column's header control into view and focuses it, leaving the surface closed.
It is what a pill's label and the column menu's Filter item both call.

## Replacing the value control

The built-in control follows the type and operator. Four alternatives ship as
named exports:

| Export | For | Renders |
| --- | --- | --- |
| `DgRangeSliderFilter` | `number` | Range slider seeded from the data's min/max, writing the `between` pair |
| `DgDateRangeFilter` | `date` | A From/To pair of native date inputs |
| `DgAutocompleteFilter` | `string` | Free text with faceted values as suggestions |
| `DgTriStateFilter` | `boolean` | All / Yes / No segments, All clearing the filter |

```tsx
meta: {
  type: "number",
  filter: { control: DgRangeSliderFilter, defaultOperator: "between" },
}
```

Pair the range-shaped ones with `defaultOperator: "between"` so the filter
opens on them. For an operator they do not cover, every built-in falls back to
`TMDataGridFilterValueInput`, which is exported so custom controls can fall back
the same way.

`meta.filter.control` is a **component**, rendered as JSX, so hooks may be used
inside. It handles the value only: it reads `operator` to shape itself and
writes the bare value through `onChange`, and the grid stores the
`{ operator, value }` pair around it. The column and operator dropdowns remain
the panel's. Worked example: `references/custom-filters.md` (A value control of
your own).

`args.options` arrives pre-resolved for a column that declares `meta.options` or
is select-shaped. `args.table` is available to a control that needs more than
that.

## Writing filters from your own interface

The grid's controls write plain TanStack state, so a control of your own does
the same: `column.setFilterValue({ operator, value })` or
`table.setColumnFilters([...])` with an envelope, and the matcher, the pills,
the header indicator and `activeColumnFilters` all read it.
`setFilterValue(undefined)` removes the entry; an empty envelope stays in state
and matches every row. `getColumnOperators(column)`,
`getColumnDefaultOperator(column)` and `emptyValueForOperator(operator)` build
a valid envelope. To keep the grid's panel and place it yourself, set
`filters: { surface: "none" }` and render `TMDataGrid.FilterPanel`. To drop
only the column menu's Filter item, pass `renderColumnMenuItems` to
`TMDataGrid.Table` and leave out the item keyed `"filter"`. To replace every
filter control, set `enableColumnFilters: false` and write the envelope
yourself; filters in state still apply. Worked examples:
`references/custom-filters.md`.

## Custom matching

To give a column its own *matching* instead of its own control, set `filterFn`
on the column definition. A column `filterFn` **replaces the shared matcher**
for that column, so its third argument is the stored `{ operator, value }`
envelope, not the unwrapped value. Type it as `TMDataGridFilterFn<TData>` and
delegate to `tmDataGridFilterFn(row, columnId, filter)` for the operators it
does not handle; `matchesFilter(cellValue, filter)` applies the built-in
matching to a derived value, and `filterValueShape(operator)` tells whether
`value` is a string, a `ReadonlyArray<string>` (`isAnyOf` / `isNoneOf`) or a
`[min, max]` pair (`between`). A column `filterFn` is also called with
half-typed envelopes, which the built-in matcher treats as matching every row,
so return `true` for `!isFilterActive(filter)` first. The column's controls do
not change and keep reading the envelope. A filter function named by string
also receives the envelope and does not unwrap it, so TanStack's built-ins such
as `"includesString"` do not work as a column `filterFn`. Write custom matching
as a function. Worked example: `references/custom-filters.md`.

## Quick search

`TMDataGrid.Search` is a debounced input writing TanStack's `globalFilter`.
There is no option to turn it on: render the component, or do not.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.Search placeholder="Search employees" debounce={0} />
</TMDataGrid.Toolbar>
```

Matching is **fuzzy by default**: typos and skipped characters still match, and
while the search is the only thing narrowing the grid (no sort, no grouping) the
rows are ordered by match quality, best first. That ordering is derived and
never written into `sorting`: no column takes `aria-sort`, nothing is written to
the persisted slices, and the next sort click replaces it.

`quickSearchMode: "contains"` restores plain substring matching. An explicit
`globalFilterFn` overrides both, and switches the rank ordering off with it.
`fuzzyGlobalFilterFn` is exported for a custom input over the same matching.

`enableMatchHighlighting: true` marks the matched part of a cell's text, under
the quick search or a `contains` / `startsWith` / `endsWith` column filter. What
is marked is the contiguous, case-insensitive occurrence, so a fuzzy typo-match
with no contiguous occurrence is not highlighted. It applies to
**default-rendered cells only**: a column with its own `cell` renderer is
excluded.

## Turning it off

`enableColumnFilters: false` removes the Filter item from the column menu, the
`FilterButton`, the header filter row and the panel's column list, and disables
the panel's "Add filter" button. It does **not** clear `columnFilters`: an entry already in
state, or one written with `setFilterValue`, still narrows the rows, still shows
as a pill and still sets the header indicator. Call `table.resetColumnFilters()`
when switching the interface off. Under `filters.surface: "sidebar"`, set
`surface: "none"` as well, as the sidebar does not follow the switch.
`TMDataGrid.Menu` has no filter items, so the switch changes nothing there.

`enableColumnFilter: false` on a column removes that column's menu item, its
entry in the panel's column list and its header control - the header cell
stays, empty. `enableGlobalFilter: false` removes the search input, or on a
column removes its participation in the search. The generated lanes are already
excluded.

## Common mistakes

### CRITICAL Treating presence in `columnFilters` as an active filter

A half-typed filter stays in state deliberately, so the panel keeps its row
while the user types. Counting entries reports filters that narrow nothing, and
forwarding them to a server sends `{ operator: "contains", value: "" }` as a
real constraint.

Wrong:

```tsx
const activeCount = columnFilters.length;
```

Correct:

```tsx
import { activeColumnFilters } from "@jielga/tmdatagrid";

// The entries that narrow anything, with `value` typed rather than `unknown`.
const active = activeColumnFilters(columnFilters);
```

Source: `packages/tmdatagrid/docs/filtering.md` (How a filter is stored).

### HIGH Assuming `value` is always a string

`value` is a `[min, max]` pair under `between` and an array under `isAnyOf` /
`isNoneOf`. Code written against the single-string case compiles against the
union and fails at runtime on the first range filter.

Correct:

```tsx
import {
  operatorTakesArrayValue,
  operatorTakesRangeValue,
} from "@jielga/tmdatagrid";

if (operatorTakesRangeValue(operator)) {
  const [min, max] = value as ReadonlyArray<string>;
}
```

Source: `packages/tmdatagrid/src/core/filterOperators.ts`.

### HIGH A numeric column with no `meta.type`

`getColumnType` defaults to `"string"`, so a numeric column that omits
`meta: { type: "number" }` offers only the string operators. `greaterThan` and
`between` never appear in the panel, and comparisons run as text, where `"9"`
sorts above `"10"`.

Source: `packages/tmdatagrid/docs/filtering.md` (Operators).

### HIGH A filter control defined inside the component

`meta.filter.control` is rendered as JSX, so its identity is its component type.
An inline arrow is a new type every render, which remounts the control and loses
what was being typed into it.

Correct:

```tsx
// Module scope, referenced by name.
const StatusFilter: TMDataGridFilterControlComponent = (args) => { /* … */ };

meta: { filter: { control: StatusFilter } }
```

Source: `packages/tmdatagrid/docs/filtering.md` (Writing your own).

### MEDIUM Writing the whole filter from a custom control

A control handles the value only: `onChange` takes the bare value, and the grid
stores `{ operator, value }` around it. Passing an object writes a filter whose
`value` is itself an object, which no operator can match against.

Wrong:

```tsx
onChange({ operator: "isAnyOf", value: picked });
```

Correct:

```tsx
onChange(picked);
```

Source: `packages/tmdatagrid/docs/filtering.md` (Writing your own).

### MEDIUM Expecting match highlighting in a custom cell

The grid reproduces the default value-to-string render with marks added, and
does not modify a custom renderer's output. A column with a `cell` renderer
shows no marks whatever `enableMatchHighlighting` is set to. Equality operators
highlight nothing either.

Source: `packages/tmdatagrid/docs/quick-search.md` (Match highlighting).

### MEDIUM Expecting fuzzy ranking to survive a sort

The rank ordering applies only while the search is the sole narrowing. Any sort
or grouping replaces it. The ordering is derived and never written into
`sorting`, so there is nothing to clear afterwards.

Source: `packages/tmdatagrid/docs/quick-search.md` (Fuzzy by default).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableColumnFilters` | Table option | `boolean` | `true` | `false` removes the menu item, the button, the header row and the panel's column list, and disables the panel's "Add filter" button. Filters already in state still apply. |
| `enableColumnFilter` | Column option | `boolean` | `true` | `false` takes one column out of filtering. |
| `meta.type` | Column meta | `TMDataGridColumnType` | `"string"` | Selects the operators and the value control. |
| `meta.filter.operators` | Column meta | `readonly TMDataGridFilterOperator[]` | The type's list | The operators this column offers, a subset of its type's. |
| `meta.filter.defaultOperator` | Column meta | `TMDataGridFilterOperator` | The type's default, else the first offered | The operator a fresh filter opens on. |
| `meta.filter.control` | Column meta | `TMDataGridFilterControlComponent` | By type and operator | Replaces the value control. Module scope. |
| `filterFn` | Column option | `TMDataGridFilterFn<TData>` or name | `"tmDataGrid"` | Custom matching for one column. Receives the `{ operator, value }` envelope. |
| `TMDataGridFilterFn<TData>` | Type | `(row, columnId, filter: TMDataGridFilterValue, addMeta?) => boolean` | – | The signature of a column's own `filterFn`. |
| `tmDataGridFilterFn` | Export | `(row, columnId, filterValue: unknown) => boolean`, assignable to `TMDataGridFilterFn<TData>` | – | The shared matcher, for a custom `filterFn` to delegate to. |
| `matchesFilter` | Export | `(cellValue, filter: TMDataGridFilterValue) => boolean` | – | The built-in matching applied to one value. |
| `quickSearchMode` | Option | `TMDataGridQuickSearchMode`: `"fuzzy" \| "contains"` | `"fuzzy"` | How the quick search matches. |
| `enableMatchHighlighting` | Option | `boolean` | `false` | Mark matched text in default-rendered cells. |
| `enableGlobalFilter` | Table option | `boolean` | `true` | Also a column option. Removes the input, or one column's participation. |
| `globalFilterFn` | Table option | filter fn or name | `"tmDataGridFuzzy"`; `"includesString"` under `quickSearchMode: "contains"` | Overrides the matching, and the ranking with it. |
| `TMDataGrid.FilterPanel` | Component | `layout: "row" \| "stacked"`, Mantine `BoxProps` | `"row"` | The panel of filter rows, as a plain block. Style props set on it. |
| `TMDataGridFilterPanelProps` · `TMDataGridFilterPanelLayout` | Types | – · `"row" \| "stacked"` | – | The props of `TMDataGrid.FilterPanel`, and the type of its `layout`. For wrapping the panel in a component of your own. |
| `filters` | Table option | `TMDataGridFiltersOptions` | `{ surface: "popup" }` | Which surface holds the filter controls. |
| `TMDataGridFiltersSettings` | Type | `Required<TMDataGridFiltersOptions>` | – | The `filters` option with its defaults filled in, as `api.filters`. |
| `TMDataGridFilterSurface` · `TMDataGridFilterSidebarSide` | Types | `"popup" \| "sidebar" \| "none"` · `"left" \| "right"` | – | The types of `filters.surface` and `filters.sidebarSide`. |
| `TMDataGridFilterControlArgs.layout` | Type | `TMDataGridFilterControlLayout` | – | How much room a value control has, and whether it names itself. |
| `TMDataGridFilterControlLayout` | Type | `"row" \| "stacked" \| "header"` | – | The type of `layout` on `TMDataGridFilterControlArgs`. `"header"` is the cell of the `inHeader` row. |
| `filterValueShape` | Export | `(operator) => TMDataGridFilterValueShape` | – | Which shape an operator's value takes. |
| `TMDataGridFilterValueShape` | Type | `"scalar" \| "set" \| "range"` | – | What `filterValueShape` returns. |
| `TMDataGrid.FilterButton` | Component | – | – | Toolbar button opening the panel, with an active count. |
| `TMDataGrid.FilterPills` | Component | `api`, `size`, `showClearAll`, `onPillClick`, Mantine `BoxProps` | – | Active filters as removable pills, renderable anywhere. Style props set on the wrapper. |
| `TMDataGrid.Search` | Component | `placeholder`, `debounce` (`250`), `w` (`220`) | – | The debounced quick-search input. |
| `openColumnFilter` | Export | `(api, columnId) => void` | – | Opens the panel on a column. |
| `isFilterActive` | Export | `(value) => boolean` | – | Whether a filter value narrows anything. |
| `activeColumnFilters` | Export | `(columnFilters \| table) => Array<TMDataGridColumnFilter>` | – | The filters in the grid's own value shape that narrow anything, typed. |
| `TMDataGridColumnFilter` | Type | `{ id, value }` | – | One entry of `columnFilters`, with `value` typed as `TMDataGridFilterValue`. |
| `getOperatorsForType` | Export | `(type) => operators` | – | The operator list a type offers. |
| `getColumnOperators` · `getColumnDefaultOperator` | Exports | `(column) => operators` · `(column) => operator` | – | One column's list after `meta.filter.operators`, and the operator a fresh filter on it opens on. |
| `FILTER_OPERATOR_LABELS` | Export | record | – | The label shown for each operator. |
| `formatFilterLabel` | Export | `({ label, type, filter, operatorLabels?, options?, labels? }) => string` | – | The one-line description used on the pills. `operatorLabels` names the operators, `options` gives a value its option's label, and `labels` gives a boolean its `booleanTrue` / `booleanFalse`; each defaults to English or to the value itself. |
| `emptyValueForOperator` · `operatorNeedsValue` · `operatorTakesArrayValue` · `operatorTakesRangeValue` | Exports | – | – | What shape of value an operator expects. |
| `TMDataGridFilterValueInput` | Export | component | – | The default value control, for falling back to. |
| `DgRangeSliderFilter` · `DgDateRangeFilter` · `DgAutocompleteFilter` · `DgTriStateFilter` | Exports | components | – | The four ready-made controls. |
| `fuzzyGlobalFilterFn` | Export | filter fn | – | The default matcher, for a custom input. |
| `--dg-match-highlight-bg` | CSS variable | colour | Themed yellow | The mark colour. |

See also: the `columns` skill for `meta.type` and `meta.options`, and the
`server-side` skill for forwarding `columnFilters` to an API.
