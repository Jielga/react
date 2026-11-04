import { csvFormat, TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function CopyAndExport() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    cellSelection: "range",
    selectionMode: "highlight",
    // What Ctrl+C and the download item write. The default is a CSV for
    // a Nordic Excel; this one is plain CSV, for Sheets and tooling.
    exportOptions: { format: csvFormat(), fileName: "employees" },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
