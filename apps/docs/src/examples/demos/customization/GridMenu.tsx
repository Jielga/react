import { Menu } from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * The burger is a Mantine Menu the app fills: the built-in export item, its
 * own items, the column chooser as built-in items after them.
 */
export function GridMenu() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    exportOptions: { fileName: "employees" },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Export />
          <Menu.Item
            leftSection={<IconDeviceFloppy size={16} stroke={1.6} />}
            onClick={() => window.alert("Saved")}
          >
            Save view
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Columns</Menu.Label>
          {/* Search, one checkbox item per column, show/hide all, and Reset
              layout - the same chooser as the header menu's "Manage columns". */}
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
