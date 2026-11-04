# Typed links with TanStack Router

Links into a grid, built from the grid's own columns and checked by both the grid's types and the router's.
The grid's URL param lives in the router's search, and the router encodes it.

```demo
file: recipes/RouterDeepLinks.tsx
hint: Go to Links and open one. Change a filter or the search, and watch the address follow.
extraSources: data/employeeLinks.tsx, data/EmployeeLinksGrid.tsx
height: 640
```

## Define the links from the columns

Build the columns with `createTMDataGridColumnHelper`, and pass the same array to `createTMDataGridUrlState`:

```tsx
export const employeesLink = createTMDataGridUrlState({
  key: "emp",
  columns: employeeLinkColumns,
  slices: ["columnFilters", "globalFilter", "sorting"],
});
```

The columns decide what a link may name.
In this demo, `location` sets `meta.filter.url: false`, so no link can filter it.
[Typed links](/docs/persistence#typed-links) lists the rules.

## Validate the route's search

Pass the definition's `validateSearch` to the route that renders the grid:

```tsx
const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/employees",
  validateSearch: employeesLink.validateSearch,
  component: EmployeesPage,
});
```

A route with search params of its own spreads it into its validator:

```tsx
validateSearch: (search) => ({
  ...employeesLink.validateSearch(search),
  tab: search.tab === "chart" ? "chart" : "table",
}),
```

## Keep the grid's param in the router

Pass the router's search to the definition's `persist`:

```tsx
const router = useRouter();
const persist = useMemo(
  () =>
    employeesLink.persist({
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
```

The grid writes through `router.navigate`, so the router sees every change.
`replace: true` keeps a filter change out of the history, as the grid's own URL writes do.
With `createHashHistory()`, the param is written after the `#`, with the rest of the router's search.

## Link into the grid

Pass `search` to the link:

```tsx
<Link
  to="/employees"
  search={employeesLink.search({
    filters: {
      salary: { operator: "between", value: [40_000, 60_000] },
      status: { operator: "isAnyOf", value: ["Active"] },
    },
    sorting: [{ id: "salary", desc: true }],
  })}
>
  Active, highest salary first
</Link>
```

`search` fails to compile on a column the grid does not have, an operator the column does not offer, or a value of the wrong type.
The router then checks the result against the route's search.

## Readable URLs

By default, TanStack Router writes the param as JSON and escapes it with `URLSearchParams`, so every brace and quote is percent-escaped.
To write it readable, encode the values with [JSURL2](https://github.com/wmertens/jsurl2) and escape them with `encodeURIComponent`, which leaves JSURL2's `(`, `)`, `~` and `!` as they are:

```tsx
import { parse, stringify } from "jsurl2";

function toSearchValue(value: unknown): string {
  if (typeof value === "object" && value !== null) return stringify(value);
  if (typeof value !== "string") return String(value);
  try {
    parse(value);
    return stringify(value);
  } catch {
    return value;
  }
}

function stringifySearch(search: Record<string, unknown>): string {
  const pairs = Object.entries(search).flatMap(([key, value]) =>
    value === undefined
      ? []
      : [`${encodeURIComponent(key)}=${encodeURIComponent(toSearchValue(value))}`],
  );
  return pairs.length === 0 ? "" : `?${pairs.join("&")}`;
}

const router = createRouter({
  routeTree,
  parseSearch: parseSearchWith(parse),
  stringifySearch,
});
```

TanStack Router's own `stringifySearchWith(stringify)` encodes the values as JSURL2 too, but its `URLSearchParams` escapes JSURL2's delimiters again.

```demo
file: recipes/ReadableSearch.tsx
hint: The same links as above. Compare the two addresses.
extraSources: data/employeeLinks.tsx, data/EmployeeLinksGrid.tsx
height: 600
```

The serializer applies to every route, and the grid is unaffected.
JSURL2's `parse` also reads JSON, so a link written before the switch still opens.

## Links without a router

Without a router, leave out the storage: the grid reads and writes the browser's URL.
Build a link with `searchParams`:

```tsx
const persist = employeesLink.persist();

const href = `/employees?${employeesLink.searchParams({
  filters: { department: { operator: "isAnyOf", value: ["Design"] } },
})}`;
```

```demo
file: recipes/PlainLinks.tsx
hint: Each link loads this page with the grid's param set.
extraSources: data/employeeLinks.tsx
height: 560
```

## Links to the page the grid is on

The grid reads its param once, when it mounts.
Note that a link to the route the grid is already on changes the URL but not the grid.
Link to such a route from another route, or remount the grid on the navigation.
