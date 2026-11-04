import {
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridPersistence,
} from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const persist = {
  settingsKey: "tmdatagrid.demo.deep-links.settings",
  dataKey: ["tmdatagrid.demo.deep-links.data", ["sorting"]],
  urlKey: ["employees", ["columnFilters", "globalFilter"]],
} satisfies TMDataGridPersistence;

const columns = employeeColumns.map((column) =>
  "accessorKey" in column && column.accessorKey === "location"
    ? {
        ...column,
        meta: { ...column.meta, filter: { ...column.meta?.filter, url: false } },
      }
    : column,
);

export function DeepLinks() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
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
