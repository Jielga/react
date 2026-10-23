# Typed links

Reference for the `options` skill: `createTMDataGridUrlState`, what a link
may name, the definition's members, and the TanStack Router setup.

`createTMDataGridUrlState({ key, columns, slices? })` defines a grid's deep
links from its columns. `columns` is the array the grid renders, built with
`createTMDataGridColumnHelper`; each helper column carries its id, `meta.type`,
value type, `meta.filter.operators` and its `enableColumnFilter`,
`enableSorting` and `meta.filter.url` switches in its type only
(`TMDataGridColumnInfo`, read with `TMDataGridColumnInfoOf`; the brand type is
`TMDataGridTypedColumn`).

```tsx
const columns = columnHelper.columns([
  columnHelper.accessor("department", { header: "Department", meta: { type: "select" } }),
  columnHelper.accessor("salary", { header: "Salary", meta: { type: "number" } }),
  columnHelper.accessor("email", { header: "Email", enableColumnFilter: false }),
]);

export const employeesUrl = createTMDataGridUrlState({
  key: "employees",
  columns,
  slices: ["columnFilters", "sorting"],
});

const persist = { urlKey: employeesUrl.urlKey } satisfies TMDataGridPersistence;

const href = `/employees?${employeesUrl.searchParams({
  filters: { department: { operator: "isAnyOf", value: ["Design"] } },
  sorting: [{ id: "salary", desc: true }],
})}`;
```

What a link may name (`TMDataGridUrlInput`); anything else is a type error:

- `filters` (`TMDataGridUrlFiltersInput`): only columns whose
  `enableColumnFilter` is not `false` and `meta.filter.url` is not `false`.
  With no such column, `filters` accepts no key at all.
- The operator: one the column's `meta.type` offers, narrowed by
  `meta.filter.operators`.
- The value: a `number` for a number column (`between` takes
  `[number | null, number | null]`, `null` leaving that end open); a `Date` or a
  `YYYY-MM-DD` string for a date column (`TMDataGridDateInput`; a `Date` is
  written as its local calendar day, a longer string is cut to 10 characters);
  a `boolean` for a boolean column; a `string` for a string column; an array of
  the column's own values (the element type for an array value) for `isAnyOf` /
  `isNoneOf`; no `value` for `isEmpty` / `isNotEmpty`.
- `sorting` (`TMDataGridUrlSortableId`): only columns whose `enableSorting` is
  not `false`. `desc` defaults to `false`.
- `globalFilter` and `pagination` (`{ pageIndex, pageSize }`): only when the
  definition carries those slices. `slices` defaults to every data slice.
- A column with an accessor function is named by its `id`; without an `id` it
  cannot be named. A dotted accessor key is named with underscores
  (`address_city`).
- Only literal values count: `enableSorting: isAdmin` reads as not sortable.
  Columns built without the helper offer nothing. A table-level
  `enableColumnFilters` or `enableSorting` is not seen.

The definition (`TMDataGridUrlState`):

| Member | Type | Description |
| --- | --- | --- |
| `key` | `string` | The URL search param. |
| `slices` | `TMDataGridDataSlice[]` | The data slices the param carries. Default: every data slice. |
| `urlKey` | `TMDataGridPersistKey` | For `persist.urlKey`: the key, or `[key, slices]` when `slices` is set. |
| `searchParams(input, { serialize? })` | `URLSearchParams` | The link as search params, encoded with `serialize` (default `JSON.stringify`, as the grid's default). Empty when the input sets nothing. Pass the `serialize` given to `persist`, if any. |
| `search(input)` | `{ [key]: TMDataGridUrlPayload \| undefined }` | The link as a router search object. |
| `payload(input)` | `TMDataGridUrlPayload \| undefined` | The param's value in the grid's state shape (filters as `{ id, value: { operator, value } }` with string values), or `undefined` when the input sets nothing. |
| `validateSearch(search)` | `{ [key]?: TMDataGridUrlPayload }` | A route search validator: keeps the param when it is a plain object, drops anything else. The grid checks each slice itself on read. |
| `persist(storage?)` | `{ urlKey, urlStorage? }` | Spread into `persist`. Without `storage`, only `urlKey`, and the grid uses the browser's URL. |

`persist(storage)` takes a `TMDataGridUrlSearchStorage`,
`{ get(name): unknown; set(name, value: TMDataGridUrlPayload | undefined): void }`,
for a router that keeps objects in its search and encodes them itself, such as
TanStack Router. `get` returns the param's value or `undefined` (a string value
is passed to the grid unchanged); `set` receives the payload object, or
`undefined` to remove the param. The bridge converts with JSON, so leave
`serialize` and `deserialize` at their defaults with it.

```tsx
// TanStack Router: the route validates, the grid writes through the router.
const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/employees",
  validateSearch: employeesUrl.validateSearch,
  component: EmployeesPage,
});

function EmployeesPage() {
  const router = useRouter();
  const persist = useMemo(
    () =>
      employeesUrl.persist({
        get: (name) => (router.state.location.search as Record<string, unknown>)[name],
        set: (name, value) =>
          void router.navigate({
            to: ".",
            search: (prev: Record<string, unknown>) => ({ ...prev, [name]: value }),
            replace: true,
          }),
      }),
    [router],
  );
  const grid = useTMDataGrid({ data, columns, persist });
  // ...
}

<Link
  to="/employees"
  search={employeesUrl.search({
    filters: { salary: { operator: "between", value: [40_000, 60_000] } },
  })}
/>;
```

- A route with its own search params spreads the validator:
  `validateSearch: (s) => ({ ...employeesUrl.validateSearch(s), tab: ... })`.
- With `createHashHistory()` the param sits after the `#` with the rest of the
  router's search.
- For URLs without percent escapes, give the router `parseSearch:
  parseSearchWith(parse)` from `jsurl2`, and a `stringifySearch` that encodes
  each object value with JSURL2's `stringify` and joins the pairs with
  `encodeURIComponent`. TanStack Router's own `stringifySearchWith(stringify)`
  joins them with `URLSearchParams`, which escapes JSURL2's `(`, `)`, `~` and
  `!` again. JSURL2's `parse` also reads JSON, so older links still open. The
  grid is unaffected. The full `stringifySearch` is on the
  `typed-deep-links.md` docs page.
- The grid reads its param once, on mount. A link to the route the grid is
  already on changes the URL but not the grid; link from another route, or
  remount the grid on that navigation.

Source: `packages/tmdatagrid/docs/persistence.md` (Typed links) and
`packages/tmdatagrid/docs/typed-deep-links.md`.
