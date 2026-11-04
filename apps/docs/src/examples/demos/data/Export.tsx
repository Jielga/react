import { ActionIcon, Button, Menu } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import {
  createTMDataGridColumnHelper,
  csvFormat,
  jsonFormat,
  TMDataGrid,
  useTMDataGrid,
  useTMDataGridExport,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    meta: { type: "select", options: "faceted" },
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    // Renders "32 000 kr"; exports 32000, the value.
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("hired", {
    header: "Hired",
    minSize: 120,
    meta: {
      type: "date",
      // The data holds an ISO date; a Date is what a spreadsheet wants. With
      // a time and no zone it parses as local midnight - the bare date would
      // be UTC midnight, and shift by the offset once written.
      exportValue: ({ value }) => new Date(`${String(value)}T00:00:00`),
    },
  }),
  columnHelper.display({
    id: "open",
    header: "",
    size: 48,
    enableResizing: false,
    // A column of buttons has nothing to export.
    meta: { enableExport: false },
    cell: () => (
      <ActionIcon variant="subtle" size="sm" aria-label="Open">
        <IconExternalLink size={14} />
      </ActionIcon>
    ),
  }),
]);

/** A button of your own, through the same hook the menu items use. */
function ExportSelectedAsJson() {
  const { exportSelected, selectedCount, canExportSelected } =
    useTMDataGridExport({ format: jsonFormat() });

  if (!canExportSelected) return null;
  return (
    <Button
      size="compact-xs"
      variant="light"
      disabled={selectedCount === 0}
      onClick={() => void exportSelected()}
    >
      Selected as JSON ({selectedCount})
    </Button>
  );
}

export function Export() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
    selectionMode: "checkbox",
    // The default format is a CSV for a Nordic Excel; only the name is set.
    exportOptions: { fileName: "employees" },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <ExportSelectedAsJson />
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Export />
          <TMDataGrid.Menu.Export
            format={csvFormat()}
            fileName="employees-plain"
            label="Export all rows as plain CSV"
          />
          {/* A picker instead of a download: visible columns ticked, hidden
              ones offered. */}
          <TMDataGrid.Menu.Export
            columns="custom"
            label="Export all rows, choose columns"
          />
          <TMDataGrid.Menu.ExportSelected />
          <Menu.Divider />
          <Menu.Label>Columns</Menu.Label>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
