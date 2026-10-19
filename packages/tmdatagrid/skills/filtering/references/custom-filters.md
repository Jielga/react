# Custom filters

Worked examples for the three ways to take over part of TMDataGrid's filtering: a value control of your own, writing the filter state from an interface of your own, and matching a column with a function of your own.
All three keep the `{ operator, value }` envelope, so the panel, the pills, the header indicator and `activeColumnFilters` keep working.

## A value control of your own

`meta.filter.control` is a component that handles the value only: it reads `operator` to shape itself and writes the bare value through `onChange`.

```tsx
import type { TMDataGridFilterControlComponent } from "@jielga/tmdatagrid";

// Module scope: a new identity per render remounts the control mid-typing.
const StatusFilter: TMDataGridFilterControlComponent = ({
  operator,
  value,
  options,
  onChange,
}) => (
  <Chip.Group
    multiple
    value={Array.isArray(value) ? [...value] : []}
    onChange={onChange}
  >
    {options.map((option) => (
      <Chip key={option.value} value={option.value}>
        {option.label}
      </Chip>
    ))}
  </Chip.Group>
);

meta: { type: "select", filter: { control: StatusFilter } }
```

## Writing filters from your own interface

The grid's controls write plain TanStack state, so a control of your own does the same:

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

// Several columns at once.
grid.table.setColumnFilters([
  { id: "status", value: { operator: "equals", value: "active" } },
  { id: "salary", value: { operator: "between", value: ["40000", ""] } },
]);
```

`getColumnOperators(column)` returns the operators a column offers and `getColumnDefaultOperator(column)` the one a fresh filter opens on.
`emptyValueForOperator(operator)` returns the empty value of the right shape.

To keep the grid's panel and place it yourself, set `filters: { surface: "none" }` and render `TMDataGrid.FilterPanel` where it belongs.
To keep filtering on and drop only the column menu's Filter item, pass `renderColumnMenuItems` to `TMDataGrid.Table` and leave out the item keyed `"filter"`.
To replace every filter control, set `enableColumnFilters: false` and write the envelope yourself; filters in state still apply.

## Custom matching

A column `filterFn` replaces the shared matcher for that column, so its third argument is the stored envelope, not the unwrapped value.
Type it as `TMDataGridFilterFn<TData>` and delegate to `tmDataGridFilterFn` for the operators it does not handle itself.
A column `filterFn` is also called with half-typed envelopes, which the built-in matcher treats as matching every row, so return `true` for `!isFilterActive(filter)` first:

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

`filter.value` is a string under the scalar operators, a `ReadonlyArray<string>` under `isAnyOf` / `isNoneOf` and a `[min, max]` pair under `between`; `filterValueShape(operator)` tells which.
`matchesFilter(cellValue, filter)` applies the built-in matching to a value derived by the function itself:

```ts
import { isFilterActive, matchesFilter, type TMDataGridFilterFn } from "@jielga/tmdatagrid";

// Matches the filter against the owner's full name instead of the stored id.
const matchesOwner: TMDataGridFilterFn<Task> = (row, _columnId, filter) => {
  if (!isFilterActive(filter)) return true;
  return matchesFilter(ownerName(row.original.ownerId), filter);
};
```

The column's filter controls do not change: the operators still come from `meta.type` and `meta.filter.operators`, and the panel, the pills and the header indicator keep reading the envelope.
A filter function named by string also receives the envelope and does not unwrap it, so TanStack's built-ins such as `"includesString"` do not work as a column `filterFn`.
Write custom matching as a function.
