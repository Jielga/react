import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { xlsxFormat } from "@jielga/tmdatagrid-xlsx";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function ExportXlsx() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    selectionMode: "checkbox",
    exportOptions: { fileName: "employees" },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Export />
          <TMDataGrid.Menu.Export
            format={xlsxFormat()}
            label="Export all rows as xlsx"
          />
          <TMDataGrid.Menu.ExportSelected format={xlsxFormat()} />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
