---
"@jielga/tmdatagrid": minor
---

- `createTMDataGridUrlState({ key, columns, slices })` builds typed deep links from the grid's columns: a filter, operator, value or sort the columns do not offer is a type error.
  It gives `urlKey`, the link as `searchParams`, `search` or `payload`, a route `validateSearch`, and `persist(storage)` for a router that keeps objects in its search, such as TanStack Router.
- Columns from `createTMDataGridColumnHelper` carry their id, `meta.type`, value type, operators and filter, sort and URL switches in their type, as `TMDataGridColumnInfo`. Runtime column objects are unchanged.
