import { Button } from "@mantine/core";
import {
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridPersistence,
} from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * Two keys because there are two lifetimes.
 *
 * *Settings* are the user's arrangement of the grid - visibility, order,
 * widths, pinning. They should outlive everything, so the key persists every
 * slice in its group.
 *
 * *Data* state is what is being looked at - filters, sorting, page. Narrowing
 * the key to the slices worth restoring is how a reload comes back to the same
 * filters without also coming back to page 7 of a list you have since changed.
 *
 * Module scope: a new object every render is a new persistence config.
 */
const persist = {
  settingsKey: "tmdatagrid.demo.persistence.settings",
  dataKey: [
    "tmdatagrid.demo.persistence.data",
    ["columnFilters", "sorting"],
  ],
} satisfies TMDataGridPersistence;

export function Persistence() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    persist,
    enablePagination: true,
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => grid.resetSettings()}
        >
          Reset layout
        </Button>
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}
