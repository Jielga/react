# Server-side data

When the client holds one page and the server does the work, paging, sorting and
filtering all become round trips and the grid stops doing them itself.

The grid reads rows through `getPaginatedRowModel()` and totals through
`getRowCount()` and `getPageCount()`, all of which respect TanStack's manual
modes. A server-driven grid therefore requires only the standard `manual*`
configuration. `manualPagination: true` also switches the grid's pagination flag
on, so `TMDataGrid.Footer` renders its pager without `enablePagination`.

When the total is unknown, declare `pageCount: -1`: the next button stays
enabled and the `pagination` render prop receives `pageCount: -1`.

## Usage

```tsx
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

```demo
file: data/ServerSide.tsx
hint: Sorting, searching and paging are all round trips against a server with 500 ms of latency.
extraSources: data/orders.ts
```

## Differences from client-side data

| Concern | Client-side | Server-side |
| --- | --- | --- |
| Rendered rows | The current page, sliced locally | The rows returned by the server |
| Footer total | Pre-paginated row count | `options.rowCount` |
| `SummaryCount` total | Pre-filtered row count | `meta.totalRowCount`; without it, the count renders alone |
| Loading state | Not applicable | `meta.loading` |

No additional configuration is required. Column menus, the filter panel and the
column manager behave identically in both modes.

## The page index

A column filter, the quick search, a sort or a grouping changes what page 3 means.
The result set is a different one, and it may not have a page 3 at all - so the grid resets `pageIndex` to 0 whenever the query changes, on every grid.
The reset is applied in the same event as the change, so one request goes out, for the first page of the new query.

`resetPageOnQueryChange: false` switches it off.

TanStack's `autoResetPageIndex` is a different rule and does not cover this.
It fires on a change to `data` - which server-side is the response landing, after the request was sent, and under `editing.draft` every commit - so the grid switches it off everywhere and resets on the query change itself.

## Column options

`meta.options: "faceted"` reads the distinct values present in `data`, which server-side is one page of them.
The dropdown then offers whatever happened to be on the page the user is looking at, and looks correct while being wrong.
Declare the set instead, as a list or a function.
The grid warns once per column when a faceted column resolves under `manualFiltering` or `manualPagination`.

## Sending filters

Filter values are plain JSON:

```json
[
  { "id": "lastName", "value": { "operator": "contains", "value": "holm" } },
  { "id": "age", "value": { "operator": "greaterThan", "value": "30" } },
  { "id": "status", "value": { "operator": "isAnyOf", "value": ["Paid", "Pending"] } },
  { "id": "hired", "value": { "operator": "onOrAfter", "value": "2026-01-01" } }
]
```

Forward `columnFilters` unchanged and translate it at the API boundary.
`activeColumnFilters` hands back the entries that are narrowing the grid, typed:
`ColumnFiltersState` types `value` as `unknown`, and an entry whose value is
still empty matches every row.

```ts
import { activeColumnFilters } from "@jielga/tmdatagrid";

const active = activeColumnFilters(columnFilters);
// [{ id: "lastName", value: { operator: "contains", value: "holm" } }]
```

It takes the `columnFilters` array, or the table where the grid owns the slice.
`isFilterActive(value)` is the single-value test it is built on.
Only the grid's own `{ operator, value }` shape is read: an entry holding some
other value - a custom filter control writing raw values - is dropped.

Debounce requests. The filter value input updates on every keystroke.

An endpoint that answers only some operators - `contains` and `equals` but no
`startsWith` - should not have the rest offered. `meta.filter.operators` on the
column narrows the panel and the header funnel to the operators the query can
express; see [Operators](/docs/filtering#operators).

For an endpoint that speaks its own query language rather than taking the
grid's filter model, see [A server-backed search](/docs/server-query): one
mapping layer turning filters, sorting and the page index into a request body,
and the response envelope back into rows.

## Persistence

`persist` works unchanged. `dataKey` restores filters, sorting and pagination
before the first request, so reloading the page repeats the query the user last
ran.

If the same state is also held in your own `useState`, initialise it from the
same source or let the grid own it. Do not maintain both independently.

## Row selection

Row selection is keyed by `getRowId`, so ids must be stable across pages. With
`manualPagination`, rows selected on an earlier page remain in `rowSelection`
even though they are no longer mounted. Read the state rather than the row
models:

```ts
// In an event handler. In render, subscribe instead:
// useSelector(grid.table.store, (state) => Object.keys(state.rowSelection))
const selectedIds = Object.keys(grid.table.store.state.rowSelection);
```

## Infinite scroll

An alternative to the pager: keep every fetched row in `data` and load more as
the user scrolls. `onReachEnd` on `TMDataGrid.Table` fires as the scroll nears
the last row. Append the next page and the virtualizer keeps its position:

```tsx
const [rows, setRows] = useState<Order[]>([]);

const grid = useTMDataGrid({
  data: rows,
  columns,
  getRowId: (row) => String(row.id),
  meta: { loading: isFetching, totalRowCount: total },
  enableSorting: false,
  enableColumnFilters: false,
});

<TMDataGrid.Table onReachEnd={() => void fetchNextPage()} />
```

```demo
file: data/InfiniteScroll.tsx
hint: Scroll to the bottom and keep going. 100 rows arrive at a time and the scroll position holds.
extraSources: data/orders.ts
height: 460
```

Fetch page zero yourself on mount. `onReachEnd` does not fire on an empty grid.

`onReachEnd` fires once per row count, so a pending fetch is not requested again
until its rows land. `reachEndThreshold` (default 10) sets how many rows before
the end it fires. `TMDataGrid.LoadingIndicator` in the toolbar shows the fetch,
since the body keeps showing the rows it already has.

Two constraints apply:

- **Sorting and filtering must be server-side** (`manualSorting` /
  `manualFiltering`) or disabled. The client only holds a prefix of the data, so
  a client-side sort would order that prefix and present it as the whole. When a
  server-side sort or filter changes, reset the accumulated rows and start from
  page zero.
- **Not compatible with `enablePagination`.** The pager slices the same scroll
  the callback watches, so the end reached is the page's rather than the data's.
  The grid warns once if both are set.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `manualPagination` | Table option | `boolean` | `false` | The server pages. Implies `enablePagination`. |
| `manualSorting` | Table option | `boolean` | `false` | The server sorts. |
| `manualFiltering` | Table option | `boolean` | `false` | The server filters, column filters and quick search alike. |
| `manualGrouping` | Table option | `boolean` | `false` | The rows arrive grouped. See [Grouping](/docs/grouping#server-side-grids). |
| `rowCount` | Table option | `number` | – | The true total. `pageCount: -1` when it is unknown. |
| `meta.loading` | Option | `boolean` | `false` | A fetch is in flight. See [Loading and empty states](/docs/loading-and-empty). |
| `meta.totalRowCount` | Option | `number` | – | The unfiltered total, for `SummaryCount`. |
| `resetPageOnQueryChange` | Option | `boolean` | `true` | Back to page 1 when a filter, the quick search, the sort or the grouping changes. |
| `onReachEnd` | Table prop | `() => void` | – | Fires as the scroll nears the last row. Latches per row count. |
| `reachEndThreshold` | Table prop | `number` | `10` | How many rows before the end it fires. |
| `activeColumnFilters` | Export | `(columnFilters \| table) => Array<{ id, value }>` | – | The filters in the grid's own value shape that narrow anything, typed. |
| `isFilterActive` | Export | `(value) => boolean` | – | Whether one filter value narrows anything. |
