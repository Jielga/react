import {
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridViewsOptions,
} from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const views = {
  presets: [
    {
      id: "contact",
      name: "Contact",
      state: { columnVisibility: { salary: false, status: false } },
    },
    {
      id: "byDepartment",
      name: "By department",
      state: { grouping: ["department"] },
    },
  ],
  defaultView: "contact",
  allowUserViews: false,
} satisfies TMDataGridViewsOptions;

export function LockedViews() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    views,
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
