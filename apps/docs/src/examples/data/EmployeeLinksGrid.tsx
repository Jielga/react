import { Code } from "@mantine/core";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { employeeLinkColumns, employeesLink } from "./employeeLinks";
import { EMPLOYEES, type Employee } from "./employees";

/** The grid, reading and writing its param through the router. */
export function EmployeeLinksGrid() {
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

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeLinkColumns,
    getRowId: (row) => String(row.id),
    persist,
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.Search />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}

/** The router's current address, as it would stand in the address bar. */
export function AddressBar() {
  const href = useRouterState({ select: (state) => state.location.href });
  return (
    <Code block data-address style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {href}
    </Code>
  );
}
