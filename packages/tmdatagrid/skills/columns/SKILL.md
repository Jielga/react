---
name: columns
description: >
  Define and arrange TMDataGrid columns. Covers createTMDataGridColumnHelper,
  every column meta field (label, type, options, flex, align, colSpan, autoSize,
  enableOrdering, and the meta.filter and meta.edit namespaces holding
  operators, defaultOperator, control, url, enabled, field, editor, validate and
  mapValue), the six column types, fluid minmax sizing versus fixed width with
  minSize / maxSize / size, autosizing and autosizeColumn, hiding through
  enableHiding and the columns panel, pinning and why a pinned column becomes
  fixed-width, ordering with enableColumnOrdering, meta.enableOrdering,
  moveColumn, moveColumnByStep, getStepTargetColumn and the pinned regions,
  resetSettings, sorting with multi-sort through isMultiSortEvent and a custom
  sortFn, and the generated lanes. Load when adding or changing columns,
  controlling widths, hiding, pinning, reordering or sorting them.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.3.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/columns.md'
  - 'Jielga/react:packages/tmdatagrid/docs/column-layout.md'
  - 'Jielga/react:packages/tmdatagrid/docs/sorting.md'
  - 'Jielga/react:packages/tmdatagrid/src/core/columnUtils.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/columnOrdering.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/autosize.ts'
---

# TMDataGrid - Columns

`createTMDataGridColumnHelper<TData>()` returns a TanStack column helper bound to
the grid's feature set, which is what gives `meta` and `filterFn` their correct
types.

```tsx
import { createTMDataGridColumnHelper } from "@jielga/tmdatagrid";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => formatSek(info.getValue()),
  }),
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "fullName",
    header: "Full name",
    meta: { label: "Full name" },
  }),
]);
```

Define columns at module scope. A new array on every render rebuilds the table's
column model.

A dotted `accessorKey` reads a nested field, and the column id it derives
replaces the dots: `accessorKey: "address.city"` makes column id
`address_city`, while the edit path stays `"address.city"`. Anything that
addresses the column by id - `initialState`, `editing.columns`, `moveColumn`,
a test selector - takes the underscore form.

`columnHelper.group` nests columns under a shared header; `columns` takes
another `columnHelper.columns` call, not a bare array:

```tsx
columnHelper.group({
  id: "person",
  header: "Person",
  columns: columnHelper.columns([
    columnHelper.accessor("firstName", { header: "First" }),
    columnHelper.accessor("lastName", { header: "Last" }),
  ]),
});
```

## meta

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | String header, or column id | Name used in menus and the column manager. Required when `header` is a component. |
| `type` | `TMDataGridColumnType` | `"string"` | Picks the filter operators, and the cell editor once editing is on. |
| `options` | `TMDataGridOptionsSource` | – | Choices for a `select` / `multiSelect` column: an array, `"faceted"`, or a function. One declaration feeds the filter panel and the editor. |
| `flex` | `number` | `1` | Share of the remaining width. |
| `align` | `"left" \| "right" \| "center"` | `"left"` | Applied to both header and cells. |
| `colSpan` | `number \| ({ row, table }) => number` | `1` | Columns the cell covers on a row, counting itself; the covered cells do not render there. See below. |
| `autoSize` | `boolean` | `false` | Size to the widest mounted content once, after the first rows render. |
| `enableOrdering` | `boolean` | `true` | `false` keeps the column where it is. |
| `filter` | `TMDataGridColumnFilterOptions` | – | How this column filters. See below. |
| `edit` | `TMDataGridColumnEditOptions` | – | How this column is edited. See below. |

What the column **is** stays flat; what the filter panel and the edit engine do
with it sits in their namespaces. `type` and `options` are read by both stages,
which is why they are in neither.

`meta.filter` holds `operators`, `defaultOperator`, `control` and `url`; `meta.edit`
holds `enabled`, `field`, `editor`, `validate` and `mapValue`. Their fields are
in [references/columns-api.md](references/columns-api.md).

```tsx
meta: {
  type: "number",
  filter: { defaultOperator: "between", control: DgRangeSliderFilter },
  edit: { enabled: (row) => !row.original.locked },
}
```

The type of `meta` is `TMDataGridColumnMeta<TData>`. On a column declared with
`createTMDataGridColumnHelper<TData>()`, the `row` that a `meta.options`
function and a `meta.edit.enabled` function receive is
`Row<TMDataGridFeatures, TData>`, so `row.original` needs no cast and no
annotation. A column written without the helper keeps the untyped row,
`Row<TMDataGridFeatures, TMDataGridRowData>`, where `row.original` is
`Record<string, unknown>`.

`enableOrdering` lives in `meta` because column ordering is the one feature
TanStack defines no column option for. `meta.edit` only acts once `editing` is
set: see the `editing` skill. `meta.filter` belongs to the `filtering` skill.

`colSpan` (args `TMDataGridColSpanArgs`, `{ row, table }`) is display only, never
covers a generated lane or leaves its pinned block, and is ignored on group rows,
on rows in row edit mode, and on a row whose open cell editor a span would cover.
Source: `packages/tmdatagrid/docs/columns.md` (Spanning columns).

### Column types

`meta.type` is one of `"string"`, `"number"`, `"boolean"`, `"date"`,
`"select"`, `"multiSelect"`. It decides three things at once: the operators the
filter panel offers, the control that filter row renders, and the editor a cell
opens. `select` and `multiSelect` read their choices from `meta.options`.

```tsx
columnHelper.accessor("hired", { header: "Hired", meta: { type: "date" } });
columnHelper.accessor("department", {
  header: "Department",
  meta: { type: "select", options: ["Engineering", "Sales", "Support"] },
});
```

Dates travel as ISO `YYYY-MM-DD` strings and booleans as `"true"` / `"false"`,
so the filter model stays plain JSON whatever the type.

### meta.options

`meta.options` is a list of `TMDataGridOption`s
(`{ value, label?, color?, disabled?, group? }`) or bare strings, `"faceted"`
for the distinct values in the data, or a function of `TMDataGridOptionsArgs`
(`{ table, column, row? }`). `row` is set when a cell editor asks and absent for
the filter panel:

```tsx
meta: {
  type: "select",
  options: ({ row }) => (row ? citiesFor(row.original.country) : allCities),
}
```

`resolveColumnOptions({ table, column, row? })` normalises all three forms into
`Array<TMDataGridOption>` for a custom control, and `optionsToComboboxData`
turns that list into Mantine `Select` / `MultiSelect` data. A select column with
no options still filters, on the faceted values.

Source: `packages/tmdatagrid/docs/columns.md` (Options).

## Sizing

Columns are fluid. Each track is `minmax(minSize, flex fr)`.

| Option | Effect |
| --- | --- |
| `minSize` | Minimum width, and the column's contribution to the grid minimum width. Also the floor of a resize and of a pinned width. Defaults to `80`, through `defaultColumn.minSize`. |
| `maxSize` | Ceiling of a resize, an autosize and a pinned width. Does not cap a fluid track. No default. |
| `meta.flex` | Share of the remaining width. Defaults to `1`. |
| `minSize === maxSize` | Fixed width. The column is never fluid. |
| `size` | Width of a column pinned at mount, clamped by `minSize` and `maxSize`. Ignored on a fluid column; a resize or an interactive pin stores the rendered width instead. Defaults to `150`. |

```tsx
// Fixed 64px action column that never flexes.
columnHelper.display({
  id: "actions",
  minSize: 64,
  maxSize: 64,
  cell: (info) => <RowMenu id={info.row.original.id} />,
});
```

Double-clicking a resize divider autosizes the column to its widest **mounted**
content - under virtualization the unmounted rows do not exist to be measured,
so the width fits the visible window plus overscan. The result is clamped to
`minSize`/`maxSize` and written into `columnSizing`, so it persists and a later
drag takes over. `meta.autoSize: true` runs it once after the first rows render,
unless a persisted or user-set width already covers the column, and
`autosizeColumn({ table, columnId, container })` is exported for menus and
consumer code.

## Hiding, pinning and ordering

All three write state that persists together, so a grid comes back arranged the
way it was left. `resetSettings()` from the hook clears visibility, order,
pinning, widths and grouping in one go, and the column chooser offers it as
**Reset layout**.

**Hiding** is `columnVisibility`, driven by "Hide column" in a column menu and by
the column chooser, which comes in three forms (see the `appearance` skill):

- `TMDataGrid.Menu.Columns` in the grid menu.
- **Manage columns**, a submenu of every column menu.
- `TMDataGrid.ColumnsPanel`, plain controls for a host that is not a menu.

**Pinning** is "Pin to left" / "Pin to right" in the column menu. A pinned
column also becomes fixed-width: sticky offsets are computed from `getSize()`,
which cannot resolve an `fr` value, so the grid stores the rendered width in
`columnSizing` at the moment it is pinned and nothing jumps. A column pinned
from `initialState.columnPinning` has no rendered width to store, so it takes
its `size` - TanStack's default of `150` where none is set - clamped by
`minSize` and `maxSize`.

**Ordering** is header dragging plus "Move left" / "Move right". A column can
only move **within its own pinned region** - pinning splits the grid into left,
centre and right, then `columnOrder` sequences the centre while
`columnPinning.start` and `.end` sequence the pinned lanes. Unpin a column
first to move it out of one. A neighbour that cannot move acts as a wall rather
than being stepped over, and columns inside a header group are not movable in
either direction, because `columnOrder` sequences leaf columns.

```tsx
import { moveColumn, moveColumnByStep } from "@jielga/tmdatagrid";

moveColumn({ table, columnId: "salary", targetId: "age", side: "before" });
moveColumnByStep({ table, columnId: "salary", direction: 1 });
```

Both are no-ops for a move that is not allowed, including one across regions.
`getStepTargetColumn({ table, columnId, direction })` returns the column a step
would swap with, or `null` at a region edge - what the menu items use to disable
themselves.

`columnOrder` is stored as the **complete** leaf order, hidden and pinned
columns included, so a column keeps its position when it is later shown or
unpinned. A column added to the definitions later is not in the stored order and
is appended at the end until it is moved.

## Sorting

On by default: click a header to sort, again to reverse, a third time to clear.
Shift+click a second header **adds** it to the sort, and each sorted header then
shows its priority beside the arrow. A plain click still replaces the whole
sort.

This is TanStack's own `isMultiSortEvent`, so `enableMultiSort`,
`maxMultiSortColCount` and a custom `isMultiSortEvent` pass straight through:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  maxMultiSortColCount: 3,
  isMultiSortEvent: (event) => event.ctrlKey,
  initialState: { sorting: [{ id: "lastName", desc: false }] },
});
```

`sortFn` on a column takes any registered name or a
`(rowA, rowB, columnId) => number` function. `sortFn` is v9's name for v8's
`sortingFn`. Sorting writes
TanStack's `sorting` state, an array of `{ id, desc }` in priority order. It is
a **data** slice, persisted under `dataKey`, while the column layout below is a
settings slice under `settingsKey`.

## Column-level feature options

Standard TanStack column options, each removing its interface when `false`:
`enableSorting`, `enableMultiSort`, `enableColumnFilter`, `enableHiding`,
`enablePinning`, `enableResizing` and `enableGrouping`. What each one removes is
in [references/columns-api.md](references/columns-api.md#column-level-feature-options).

`meta.enableOrdering: false` belongs to the same set. A column whose menu has no
remaining items renders no menu button and takes no right-click, so the
browser's own menu comes up there instead.

## The generated lanes

The grid prepends and appends lanes of its own, in this order: row number,
checkbox, tree, details, your columns, edit. Each appears only when its feature
asks for it. Under `detailsColumnPosition: "right"`, details sits between your
columns and edit.

| Lane | Id | Appears when |
| --- | --- | --- |
| Row number | `ROW_NUMBER_COLUMN_ID` | `enableRowNumbers: true` |
| Checkbox | `SELECT_COLUMN_ID` | Selection is on and the mode has checkboxes |
| Tree | `GROUP_COLUMN_ID` | A column is grouped |
| Details | `DETAILS_COLUMN_ID` | `renderDetails` is set; on the left by default, on the right under `detailsColumnPosition: "right"` |
| Edit | `EDIT_COLUMN_ID` | Row mode, `editing.draft`, or `editing.onRowDelete` |

They are structural: fixed width, no column menu, and they cannot be sorted,
filtered, resized, re-pinned or moved. The checkbox lane anchors the left pinned
region, so no column can be placed in front of it. `isControlColumn(columnId)`
identifies them. To locate a lane in a test, use the constant with
`data-column-id`; see the `testing` skill.

## Common mistakes

### CRITICAL Setting `size` to control width

`size` applies only to a column pinned at mount. On a fluid column it is
ignored - the track is `minmax(minSize, flex fr)` - so a column given
`size: 200` renders at whatever the flex share works out to. A resize or an
interactive pin stores the rendered width, not `size`.

Wrong:

```tsx
columnHelper.accessor("email", { header: "Email", size: 200 });
```

Correct:

```tsx
// A floor plus a share, or minSize === maxSize for a genuinely fixed column.
columnHelper.accessor("email", {
  header: "Email",
  minSize: 200,
  meta: { flex: 2 },
});
```

A column pinned at mount is fixed-width and does use `size`, so give it one.

Source: `packages/tmdatagrid/docs/column-layout.md` (Sizing).

### HIGH Pinning a column at mount without a width

A column pinned interactively keeps the width it was rendering, which the grid
writes into `columnSizing`. A column pinned from `initialState.columnPinning`
has no rendered width, so it takes `size` clamped by `minSize` / `maxSize`:
TanStack's `150` when none is set, whatever the content needs.

Wrong:

```tsx
columnHelper.accessor("name", { header: "Name" });
initialState: { columnPinning: { start: ["name"], end: [] } },
```

Correct:

```tsx
columnHelper.accessor("name", { header: "Name", size: 220 });
initialState: { columnPinning: { start: ["name"], end: [] } },
```

Source: `packages/tmdatagrid/docs/column-layout.md` (Pinning).

### HIGH Addressing a dotted column by its accessor key

A dotted `accessorKey` produces a column id with underscores, so state and
calls keyed by column id silently match nothing when given the dotted form.

Wrong:

```tsx
initialState: { columnVisibility: { "address.city": false } },
```

Correct:

```tsx
initialState: { columnVisibility: { address_city: false } },
```

The edit path is the exception: `meta.edit.field` and validation issue paths
stay dotted, because they address the data, not the column.

Source: `packages/tmdatagrid/docs/columns.md` (The column helper).

### CRITICAL A component header without `meta.label`

`getColumnLabel(column)` falls back to a *string* header, then to the column id.
When `header` is a component there is no string to fall back to, so the column
manager, the filter panel and every column menu show the raw id.

Wrong:

```tsx
columnHelper.accessor("fullName", { header: () => <Icon /> });
```

Correct:

```tsx
columnHelper.accessor("fullName", {
  header: () => <Icon />,
  meta: { label: "Full name" },
});
```

Source: `packages/tmdatagrid/src/core/columnUtils.ts`.

### HIGH A numeric column without `meta.type`

`getColumnType(column)` defaults to `"string"`, so a numeric column that omits
`meta: { type: "number" }` offers only the string operators, and comparisons run
as text - `"9"` above `"10"`. The column still sorts and filters.

Source: `packages/tmdatagrid/src/core/filterOperators.ts`.

### HIGH Expecting a move across pinned regions to work

`moveColumn` and header dragging are no-ops across regions, silently. A column
pinned left cannot be dropped in the centre until it is unpinned, and code that
assumes the move happened goes on to read an order that never changed.

Correct:

```tsx
table.getColumn("salary")?.pin(false);
moveColumn({ table, columnId: "salary", targetId: "age", side: "before" });
```

Source: `packages/tmdatagrid/docs/column-layout.md` (Regions).

### HIGH Reaching for the v8 name of a v9 option

TanStack v9 renamed the column comparator to `sortFn`. `sortingFn` is an
unknown key in v9; TypeScript does not always report it, and the column keeps
its automatic comparator, so the custom ordering never appears.

Wrong:

```tsx
columnHelper.accessor("priority", { header: "Priority", sortingFn: byRank });
```

Correct:

```tsx
columnHelper.accessor("priority", { header: "Priority", sortFn: byRank });
```

Source: `@tanstack/table-core` `rowSortingFeature.types.d.ts`, and
`packages/tmdatagrid/src/useTMDataGrid.tsx` (the registered `sortFns`).

### MEDIUM Expecting autosize to measure every row

Autosizing fits the **mounted** rows plus overscan, not every row, because
virtualization leaves the rest with no DOM to measure. A column autosized at the
top of a long list can be too narrow for a value further down.

Source: `packages/tmdatagrid/docs/column-layout.md` (Autosizing).

### MEDIUM Reordering a column inside a header group

`columnOrder` sequences leaf columns, so moving one out of its group would leave
the group header spanning columns that no longer belong to it. Grouped-header
columns are therefore immovable in both directions, whatever `meta.enableOrdering`
says.

Source: `packages/tmdatagrid/docs/column-layout.md` (Regions).

### MEDIUM Computing a cross-row value in accessorFn

`accessorFn` is handed one row, so a share of a total, a rank or a running
total has nothing to compute against. Derive the collection once and give the
grid the finished shape.

Wrong:

```tsx
columnHelper.accessor((row) => (row.value / total) * 100, { id: "pctOfTotal" });
```

Correct:

```tsx
const rows = useMemo(() => {
  const total = holdings.reduce((sum, h) => sum + h.value, 0);
  return holdings.map((h) => ({ ...h, pctOfTotal: (h.value / total) * 100 }));
}, [holdings]);

columnHelper.accessor("pctOfTotal", { header: "Share" });
```

Source: `packages/tmdatagrid/docs/columns.md` (Columns derived from the other rows).

## References

- [Columns API](references/columns-api.md) - every column option, column meta
  field, export and type belonging to defining, sizing, hiding, pinning,
  ordering and sorting columns.

See also: the `filtering` skill for operators and filter controls, the `editing`
skill for the editing meta fields, and the `grouping` skill for what grouping
does to a column.
