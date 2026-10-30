---
name: server-side
description: >
  Drive TMDataGrid from a server with TanStack manual modes - manualPagination,
  manualSorting, manualFiltering, rowCount, controlled state and onXChange
  callbacks. Covers the loading and totalRowCount meta fields, forwarding the
  plain-JSON columnFilters model to an API with activeColumnFilters, mapping
  filters, sorting and the page index onto an endpoint's own query language
  (field table, operator table, the three value shapes, meta.filter.operators
  for an endpoint that answers only some operators, keying the fetch on the
  request, paging against a page envelope), the first-page reset on a query
  change, persistence interaction, and row selection across pages. Load when the
  grid is backed by a paginated API rather than a local array, or when
  translating grid filters into server-side queries.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.7.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/server-side.md'
  - 'Jielga/react:packages/tmdatagrid/docs/server-query.md'
  - 'Jielga/react:packages/tmdatagrid/src/useTMDataGrid.tsx'
---

# TMDataGrid - Server-side data

The grid reads rows through `getPaginatedRowModel()` and totals through
`getRowCount()` and `getPageCount()`, all of which respect TanStack's manual
modes. A server-driven grid therefore needs only the standard `manual*`
configuration - no grid-specific options. `manualPagination: true` also
switches the grid's pagination flag on, so `TMDataGrid.Footer` renders its
pager without `enablePagination`. Declare `pageCount: -1` when the total is
unknown; the next button then stays enabled.

## Setup

```tsx
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";

const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
const [sorting, setSorting] = useState([]);
const [columnFilters, setColumnFilters] = useState([]);

const { data, isFetching } = useQuery({
  queryKey: ["employees", pagination, sorting, columnFilters],
  queryFn: () => fetchEmployees({ pagination, sorting, columnFilters }),
  placeholderData: keepPreviousData,
});

const grid = useTMDataGrid({
  columns,
  data: data?.rows ?? [],
  getRowId: (row) => String(row.id),

  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  rowCount: data?.total ?? 0,

  state: { pagination, sorting, columnFilters },
  onPaginationChange: setPagination,
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,

  meta: { loading: isFetching, totalRowCount: data?.totalUnfiltered },
});
```

## Differences from client-side data

| Concern | Client-side | Server-side |
| --- | --- | --- |
| Rendered rows | The current page, sliced locally | The rows returned by the server |
| Footer total | Pre-paginated row count | `options.rowCount` |
| `SummaryCount` total | Pre-filtered row count | `meta.totalRowCount`; the count alone without it |
| Loading state | Not applicable | `meta.loading` |

Column menus, the filter panel and the column manager behave identically in both
modes.

## The page index

Under `manualPagination` the grid resets `pageIndex` to 0 whenever the query
changes - a column filter, the quick search or the sort - so the next request
never asks for page 8 of a result set that now has three. The reset lands in
the same event as the change, so one request goes out. Pass the plain setters
as the change callbacks; do not pair them with a page reset of your own.

`resetPageOnQueryChange: false` switches it off. TanStack's
`autoResetPageIndex` is a different rule: it defaults to `!manualPagination`
and fires on a change to `data`, which server-side is the response landing.

## Column options

`meta.options: "faceted"` reads the distinct values in `data`, which
server-side is one page of them - the dropdown then offers whatever was on the
page the user is looking at. Declare the set as a list or a function instead.
The grid warns once per column when a faceted column resolves under
`manualFiltering` or `manualPagination`.

## Sending filters

Filter values are plain JSON, so `columnFilters` forwards without transformation:

```json
[
  { "id": "lastName", "value": { "operator": "contains", "value": "holm" } },
  { "id": "age", "value": { "operator": "greaterThan", "value": "30" } }
]
```

Translate at the API boundary. `activeColumnFilters` hands back the entries
that narrow anything, typed - `ColumnFiltersState` types `value` as `unknown`,
and an entry whose value is still empty matches all rows:

```ts
import { activeColumnFilters } from "@jielga/tmdatagrid";

const active = activeColumnFilters(columnFilters);
// [{ id: "lastName", value: { operator: "contains", value: "holm" } }]
```

It takes the `columnFilters` array, or the table where the grid owns the slice.
`isFilterActive(value)` is the single-value test it is built on. Only the
grid's own `{ operator, value }` shape is read: an entry holding some other
value - a custom filter control writing raw values - is dropped.

Debounce requests. The filter value input updates on every keystroke.

## Mapping onto the endpoint's query language

An API takes a request body of its own: its own field names, its own operator
set, its own status codes, and pages counted from 1. The layer between the
grid's state and that body is one function over two lookup tables, plus one
function on the way back:

- **A field table** keyed by column id, giving the API field and the cast from
  the string every filter control writes to the type the field holds
  (`Number`, an enum code). A column missing from the table is one the API
  cannot query: the mapping drops the filter rather than sending a field the
  endpoint would reject.
- **An operator table** from `TMDataGridFilterOperator` to the API's operators.
  Several grid operators collapse onto one - a date `before` and a number
  `lessThan` are both `lt` once the value is cast. Declare it as a `Record`, not
  a `Partial`, so an operator added by a later grid version fails the build
  here rather than reaching the server unmapped.
- **`toRow`** from the API's record to the grid's row type.

```ts
const QUERY_FIELDS: Record<string, { field: string; cast: (raw: string) => string | number }> = {
  id: { field: "orderRef", cast: Number },
  amount: { field: "totalAmount", cast: Number },
  status: { field: "status", cast: (raw) => STATUS_CODES[raw] ?? raw },
};

const PREDICATE_OPS: Record<TMDataGridFilterOperator, PredicateOp> = {
  contains: "like",
  between: "range",
  before: "lt",
  lessThan: "lt",
  isAnyOf: "in",
  isEmpty: "isNull",
  // ...one line for every remaining operator.
};
```

### The three value shapes

`TMDataGridFilterValue` is `{ operator, value }`, and the operator decides what
`value` holds. Branch on all four cases, in this order:

| Operator | `value` | Sent as |
| --- | --- | --- |
| `isEmpty`, `isNotEmpty` | Not used | `{ field, op }` |
| `isAnyOf`, `isNoneOf` | `ReadonlyArray<string>` | `{ field, op, values }` |
| `between` | `[min, max]`, either end possibly `""` | `{ field, op, from?, to? }` |
| Everything else | `string` | `{ field, op, value }` |

An empty end of a `between` pair leaves that side open: an absent bound, not an
empty string. Run `activeColumnFilters` over the slice first so a half-typed
filter is not sent as a predicate that narrows the result to nothing.

### An endpoint that answers only some operators

Most endpoints do not have every operator the grid has - `like` and `eq` but no
prefix match is common. Do not offer what you would have to drop.
`meta.filter.operators` narrows the column to the operators the query can
express, and the mapping table is declared over exactly that list, so one
cannot be offered without a mapping or mapped without being offered:

```ts
const TEXT_OPERATORS = [
  "contains",
  "equals",
  "isEmpty",
  "isNotEmpty",
] as const satisfies readonly TMDataGridFilterOperator[];

const TEXT_OPS: Record<(typeof TEXT_OPERATORS)[number], PredicateOp> = {
  contains: "like",
  equals: "eq",
  isEmpty: "isNull",
  isNotEmpty: "isNotNull",
};

columnHelper.accessor("customer", {
  header: "Customer",
  meta: { filter: { operators: TEXT_OPERATORS } },
});
```

A fresh filter opens on `meta.filter.defaultOperator` when set, else on the
type's default when the list holds it, else on the first entry. The lookup at
the boundary still returns `undefined` for an unmapped operator: a filter
restored by `persist` from before the list was narrowed can carry one.

### Keying the fetch on the request

Serialize the request with `JSON.stringify` inside `useMemo` over
`columnFilters`, `sorting` and `pagination`, and key the fetch effect (or the
TanStack Query `queryKey`) on that string. Opening the panel and adding an
empty row moves `columnFilters` but leaves the request unchanged, so nothing is
sent. The effect owes the server a debounce (the value input updates on every
keystroke) and a cancel (a `cancelled` flag in the cleanup, or an
`AbortController` on a real `fetch`).

### Paging against a page envelope

| The API's | The grid's | Written as |
| --- | --- | --- |
| `page.number`, counted from 1 | `pagination.pageIndex`, counted from 0 | `number: pageIndex + 1` |
| `page.totalItems`, the matched count | `rowCount` | `rowCount: page?.totalItems ?? 0` |
| `page.totalPages` | `state.pageCount`, derived from `rowCount / pageSize` | Nothing; the grid computes it |

Forward `totalPages` only when the server pages by something other than the
size the grid asked for. `pageCount: -1` when the total is unknown. Show the
page number through the Footer's `renderPagination` slot with
`<Controls.PageSize /><Controls.PageNumber /><Controls.Pager />`.
`meta.totalRowCount` is the unfiltered total, which no filtered response
carries: take it from a separate count call.

## Persistence

`persist` works unchanged. `dataKey` restores filters, sorting and pagination
before the first request, so reloading repeats the query the user last ran.

If the same state is also held in your own `useState`, initialise it from the
same source or let the grid own it. Do not maintain both independently.

## Row selection

Selection is keyed by `getRowId`, so ids must be stable across pages. Under
`manualPagination`, rows selected on an earlier page stay in `rowSelection` even
though they are no longer mounted. Read the state, not the row models:

```ts
import { useSelector } from "@tanstack/react-store";

const selectedIds = useSelector(grid.table.store, (state) =>
  Object.keys(state.rowSelection),
);
```

## Common mistakes

### Omitting rowCount under manualPagination

Without `rowCount` the table derives the total from the rows it was handed -
one page - so `getPageCount()` returns 1. The footer shows "1–25 of 25" and the
next-page button is disabled, with no error. Pass the server total.

### Filters sent without activeColumnFilters

An empty filter value stays in `columnFilters` while the user is still typing.
Forwarded verbatim it becomes `operator: "contains", value: ""` at the API,
which most backends translate into a real predicate. Map over
`activeColumnFilters(columnFilters)` instead of over the slice.

### SummaryCount without meta.totalRowCount

Without it there is no denominator to show: the pre-filtered row count is the
current page, so the grid renders the matched count alone rather than a
plausible-looking wrong total. Pass the unfiltered total as
`meta.totalRowCount` to get the "42 / 5000" form back.

### Offering operators the endpoint cannot answer

The panel offers every operator of the column's type, and a mapping that drops
`startsWith` leaves the user with a filter that silently does nothing. Declare
`meta.filter.operators` on the column with the operators the endpoint answers,
and type the operator table over that same list.

### Unstable getRowId across pages

Defaulting to the row index means row 0 of page 2 shares an id with row 0 of
page 1, so paging silently transfers the selection to different records. Always
set `getRowId` from a stable primary key when paginating on the server.

### Duplicating grid state in local state

Holding `pagination` in `useState` *and* letting `persist.dataKey` restore it
gives two sources of truth: the grid restores the stored page while `useState`
starts at 0, and the first query runs for the wrong page. Initialise the local
state from the same store, or drop `pagination` from the persisted slices.
