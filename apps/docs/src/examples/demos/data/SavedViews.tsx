import {
  createLocalStorageViewStore,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridPersistence,
  type TMDataGridViewsOptions,
} from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const persist = {
  settingsKey: "tmdatagrid.demo.saved-views.settings",
} satisfies TMDataGridPersistence;

const views: TMDataGridViewsOptions = {
  store: createLocalStorageViewStore("tmdatagrid.demo.saved-views"),
  presets: [
    {
      id: "contact",
      name: "Contact",
      state: { columnVisibility: { salary: false, status: false } },
    },
    {
      id: "payroll",
      name: "Payroll",
      state: {
        columnVisibility: { location: false },
        columnOrder: ["lastName", "firstName", "salary"],
        columnPinning: { start: ["lastName"], end: [] },
      },
    },
  ],
};

export function SavedViews() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    persist,
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
