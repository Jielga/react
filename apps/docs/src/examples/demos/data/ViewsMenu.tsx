import {
  createLocalStorageViewStore,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridViewsOptions,
} from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const views = {
  store: createLocalStorageViewStore("tmdatagrid.demo.views-menu"),
  presets: [
    {
      id: "contact",
      name: "Contact",
      state: { columnVisibility: { salary: false, status: false } },
    },
  ],
} satisfies TMDataGridViewsOptions;

export function ViewsMenu() {
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
        <TMDataGrid.ViewsMenu />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns views={false} />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
