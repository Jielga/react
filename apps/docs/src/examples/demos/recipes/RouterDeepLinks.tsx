import { Anchor, Group, Stack } from "@mantine/core";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AddressBar, EmployeeLinksGrid } from "../../data/EmployeeLinksGrid";
import { AnchorLink, employeesLink } from "../../data/employeeLinks";

const rootRoute = createRootRoute({
  component: () => (
    <Stack h="100%" gap="xs">
      <Group gap="md">
        <Anchor component={Link} to="/" data-link="home">
          Links
        </Anchor>
      </Group>
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

const router = createRouter({
  routeTree: rootRoute.addChildren([linksRoute, employeesRoute]),
  // In an app: createBrowserHistory() or createHashHistory().
  history: createMemoryHistory({ initialEntries: ["/employees"] }),
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
      <AnchorLink<typeof router, "/", "/employees">
        to="/employees"
        data-link="hired"
        search={employeesLink.search({
          filters: { hired: { operator: "onOrAfter", value: new Date(2024, 0, 1) } },
          sorting: [{ id: "hired", desc: false }],
        })}
      >
        Hired in 2024 or later
      </AnchorLink>
      <AnchorLink<typeof router, "/", "/employees">
        to="/employees"
        data-link="search"
        search={employeesLink.search({ globalFilter: "anna" })}
      >
        Search for "anna"
      </AnchorLink>
      <AnchorLink<typeof router, "/", "/employees"> to="/employees" data-link="none">
        All employees
      </AnchorLink>
    </Stack>
  );
}

export function RouterDeepLinks() {
  return <RouterProvider router={router} />;
}
