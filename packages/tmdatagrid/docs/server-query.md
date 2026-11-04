# A server-backed search

The grid's state is filters, sorting and a page index.
An API takes a request body of its own: its own field names, its own operator set, its own status codes, and pages counted from 1.
This recipe is the layer between the two, and the grid state that goes into it is shown as the request that comes out.

```demo
file: recipes/ServerQuery.tsx
hint: Filter Amount or City and watch the request body under the grid change, then the result set follow it.
extraSources: data/orderSearchApi.ts
height: 700
```

The grid does no filtering, sorting or paging here.
See [Server-side data](/docs/server-side) for the `manual*` options themselves; this page is about what to send them.

## What the endpoint takes

The demo's API is deliberately not grid-shaped:

```ts
type OrderSearchRequest = {
  filter: { and: Array<Predicate> };
  orderBy: Array<{ field: string; direction: "ASC" | "DESC" }>;
  page: { number: number; size: number };
};

type Predicate =
  | { field: string; op: "in" | "notIn"; values: Array<string | number> }
  | { field: string; op: "range"; from?: string | number; to?: string | number }
  | { field: string; op: "isNull" | "isNotNull" }
  // …and the scalar form, for every remaining operator:
  | { field: string; op: "eq" | "like" | "lt" | "gte"; value: string | number };
```

The response is a page envelope, not an array:

```ts
type OrderSearchResponse = {
  items: Array<OrderRecord>;
  page: { number: number; size: number; totalPages: number; totalItems: number };
};
```

Forwarding `columnFilters` unchanged, as [Server-side data](/docs/server-side#sending-filters) describes, works when you own the endpoint.
When you do not, the translation has to live somewhere, and one module that both directions pass through is easier to keep correct than a translation spread across the fetch, the columns and the cells.

## Two tables, three functions

The whole layer is `toSearchRequest` over two lookup tables, plus `toRow` on the way back.

`QUERY_FIELDS` maps a column id onto an API field, together with the cast from what the filter control writes to what the field holds.
Every filter control writes strings; `totalAmount` is a number and `status` an enum, so neither end is the right place for the conversion.

```ts
const QUERY_FIELDS: Record<string, { field: string; cast: (raw: string) => string | number }> = {
  id: { field: "orderRef", cast: Number },
  amount: { field: "totalAmount", cast: Number },
  status: { field: "status", cast: (raw) => STATUS_CODES[raw] ?? raw },
};
```

A column missing from the table is one the API cannot query.
`toPredicate` returns `undefined` for it and the filter is dropped, rather than a field the endpoint would reject being sent.

`PREDICATE_OPS` maps the grid's operators onto the endpoint's.
Declare it as a `Record` over `TMDataGridFilterOperator` and not a `Partial`: an operator added by a later version of the grid then fails the build here, where it can be answered, instead of arriving at the server unmapped.

```ts
const PREDICATE_OPS: Record<TMDataGridFilterOperator, PredicateOp> = {
  contains: "like",
  between: "range",
  before: "lt",
  lessThan: "lt",
  isAnyOf: "in",
  isEmpty: "isNull",
  // …and one line for every remaining operator.
};
```

Several grid operators collapse onto one API operator.
A date `before` and a number `lessThan` are both `lt` once the value has been cast.

## Offering only what the endpoint answers

The demo's endpoint answers every operator the grid has, which is the exception.
An endpoint that has `like` and `eq` but no prefix match should not offer `startsWith` in the panel, because the only honest thing to do with it there is drop it, and a filter that silently does nothing looks like a bug.
`meta.filter.operators` narrows a column to the operators the query can express, and the mapping table is then declared over exactly that list:

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

One list feeds both the column and the type of the table, so an operator cannot be offered without a mapping, or mapped without being offered.
A fresh filter on the column opens on `meta.filter.defaultOperator` when that is set, else on the type's default when the list holds it - `contains` here - else on the list's first entry.

The lookup at the boundary still returns `undefined` for an operator it has no entry for.
A filter restored by `persist` from before the list was narrowed can carry one, and dropping it is the same rule as dropping a column the API cannot query.

## The three value shapes

`TMDataGridFilterValue` is `{ operator, value }`, and the operator decides what `value` holds.
A mapping function has to branch on all four cases, in this order:

| Operator | `value` | Sent as |
| --- | --- | --- |
| `isEmpty`, `isNotEmpty` | Not used | `{ field, op }` |
| `isAnyOf`, `isNoneOf` | `ReadonlyArray<string>` | `{ field, op, values }` |
| `between` | `[min, max]`, either end possibly `""` | `{ field, op, from?, to? }` |
| Everything else | `string` | `{ field, op, value }` |

An empty end of a `between` pair leaves that side of the interval open, so it becomes an absent bound rather than an empty string.

## What not to send

A filter whose value is still empty stays in the grid's state so the panel keeps its row while the user types.
It matches every row, so sending it as a predicate would narrow the result set to nothing.
`activeColumnFilters` is the test, applied across the slice: it hands back the entries that narrow the grid, with their values typed as `TMDataGridFilterValue` rather than as `unknown`.

```ts
activeColumnFilters(state.columnFilters)
  .map((filter) => toPredicate(filter.id, filter.value))
  .filter((predicate): predicate is Predicate => predicate !== undefined);
```

## Keying the fetch on the request

The request is JSON, so the JSON is both what you send and what the fetch can key on:

```tsx
const requestJson = useMemo(
  () => JSON.stringify(toSearchRequest({ columnFilters, sorting, pagination }), null, 2),
  [columnFilters, sorting, pagination],
);

const request = useMemo(() => JSON.parse(requestJson) as OrderSearchRequest, [requestJson]);
```

`request` then changes identity only when the query changes.
Opening the filter panel and adding an empty row moves `columnFilters` and leaves the request alone, so no request is sent.
With TanStack Query, the same string is the `queryKey`.

Two things the effect owes the server:

- **Debounce.** The filter value input updates on every keystroke, so a request per keystroke is what you get without it.
- **Cancel.** A response that arrived after the query moved on is not this query's. A `cancelled` flag in the cleanup is enough; an `AbortController` on a real `fetch` is better.

```tsx
useEffect(() => {
  let cancelled = false;
  setLoading(true);

  const timer = setTimeout(() => {
    void searchOrders(request).then((response) => {
      if (cancelled) return;
      setRows(response.items.map(toRow));
      setPage(response.page);
      setLoading(false);
    });
  }, 300);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [request]);
```

## Paging against a page envelope

Three numbers, in three places:

| The API's | The grid's | Written as |
| --- | --- | --- |
| `page.number`, counted from 1 | `pagination.pageIndex`, counted from 0 | `number: pageIndex + 1` |
| `page.totalItems`, the matched count | `rowCount` | `rowCount: page?.totalItems ?? 0` |
| `page.totalPages` | `state.pageCount`, derived from `rowCount / pageSize` | Nothing; the grid computes it |

`pageCount` follows from `rowCount`, so a response's `totalPages` needs forwarding only when the server pages by something other than the size the grid asked for.
Set `pageCount: -1` when the total is unknown, as an endpoint returning a cursor rather than a count leaves it.

The footer shows the page number through the `renderPagination` slot, keeping the built-in page-size select and pager on either side of it:

```tsx
<TMDataGrid.Footer
  renderPagination={({ Controls }) => (
    <>
      <Controls.PageSize />
      <Controls.PageNumber />
      <Controls.Pager />
    </>
  )}
/>
```

A filter or a sort changes what page 3 means, and under `manualPagination` the grid takes itself back to page 1 when it does - see [the page index](/docs/server-side#the-page-index).
The change callbacks are therefore the plain setters.

`meta.totalRowCount` is the unfiltered total, which no filtered response carries.
Take it from a separate count call, or from the one the page was opened with.
Without it, `SummaryCount` shows the matched count alone rather than comparing it against the rows of one page.

## What the client no longer knows

Holding one page costs the grid the two things it derives from holding all of them.

**Faceted options.** `meta.options: "faceted"` reads the distinct values present in `data`, which is now one page of them.
The grid warns once per column about it.
A select column declares its own set instead:

```tsx
columnHelper.accessor("city", {
  meta: { type: "select", options: CITIES },
});
```

**Rows off the page.** Row selection is keyed by `getRowId`, so ids selected on an earlier page stay in `rowSelection` while their rows are unmounted.
Read the state rather than the row models, as [Server-side data](/docs/server-side#row-selection) describes.

## Reference

The pieces this recipe composes:

| Piece | Documented on |
| --- | --- |
| `manualFiltering`, `manualSorting`, `manualPagination`, `rowCount`, `meta.loading`, `meta.totalRowCount` | [Server-side data](/docs/server-side) |
| `TMDataGridFilterValue`, `TMDataGridFilterOperator`, `activeColumnFilters`, `meta.filter.operators`, `meta.filter.defaultOperator` | [Filtering](/docs/filtering) |
| `meta.options` | [Defining columns](/docs/columns) |
| `Footer` `renderPagination`, `Controls.PageSize`, `Controls.PageNumber`, `Controls.Pager` | [Pagination](/docs/pagination) |
