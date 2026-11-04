import { Anchor, Stack } from "@mantine/core";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  parseSearchWith,
  RouterProvider,
} from "@tanstack/react-router";
import { parse, stringify } from "jsurl2";
import { AddressBar, EmployeeLinksGrid } from "../../data/EmployeeLinksGrid";
import { AnchorLink, employeesLink } from "../../data/employeeLinks";

const rootRoute = createRootRoute({
  component: () => (
    <Stack h="100%" gap="xs">
      <Anchor component={Link} to="/" data-link="home">
        Links
      </Anchor>
      <AddressBar />
      <Outlet />
    </Stack>
  ),
});

const linksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Links,
});

const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/employees",
  validateSearch: employeesLink.validateSearch,
  component: EmployeeLinksGrid,
});

/** One search value as JSURL2. A plain string stays as it is unless it would parse. */
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

/**
 * The router's default joins the values with URLSearchParams, which escapes
 * JSURL2's ( ) ~ ! as well. encodeURIComponent leaves them as they are.
 */
function stringifySearch(search: Record<string, unknown>): string {
  const pairs = Object.entries(search).flatMap(([key, value]) =>
    value === undefined
      ? []
      : [`${encodeURIComponent(key)}=${encodeURIComponent(toSearchValue(value))}`],
  );
  return pairs.length === 0 ? "" : `?${pairs.join("&")}`;
}

const router = createRouter({
  routeTree: rootRoute.addChildren([linksRoute, employeesRoute]),
  history: createMemoryHistory({ initialEntries: ["/employees"] }),
  // JSURL2's parse reads JSON too, so a link written as JSON still opens.
  parseSearch: parseSearchWith(parse),
  stringifySearch,
});

// This router is not the registered one, so each link names it. In an app,
// register the router and write <AnchorLink to="/employees" search={...}>.
function Links() {
  return (
    <Stack gap={4} data-links>
      <AnchorLink<typeof router, "/", "/employees">
        to="/employees"
        data-link="departments"
        search={employeesLink.search({
          filters: {
            department: { operator: "isAnyOf", value: ["Design", "Engineering"] },
          },
        })}
      >
        Design and Engineering
      </AnchorLink>
      <AnchorLink<typeof router, "/", "/employees">
        to="/employees"
        data-link="salary"
        search={employeesLink.search({
          filters: {
            salary: { operator: "between", value: [40_000, 60_000] },
            status: { operator: "isAnyOf", value: ["Active"] },
          },
          sorting: [{ id: "salary", desc: true }],
        })}
      >
        Active, 40 000 - 60 000 kr, highest salary first
      </AnchorLink>
    </Stack>
  );
}

export function ReadableSearch() {
  return <RouterProvider router={router} />;
}
