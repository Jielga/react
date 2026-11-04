import { Menu, Text } from "@mantine/core";
import { IconChartBar } from "@tabler/icons-react";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function ColumnMenuItems() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
  });
  const [stats, setStats] = useState<string | null>(null);

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <Text size="sm" c="dimmed">
          {stats ?? "Open a column menu and pick Column statistics"}
        </Text>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee>
        renderColumnMenuItems={({ column, internalItems }) =>
          // No menu at all on the ID column.
          column.id === "id"
            ? []
            : [
                ...internalItems,
                <Menu.Divider key="stats-divider" />,
                <Menu.Item
                  key="stats"
                  leftSection={<IconChartBar size={16} stroke={1.6} />}
                  onClick={() =>
                    setStats(
                      `${String(column.columnDef.header)}: ${
                        column.getFacetedUniqueValues().size
                      } distinct values`,
                    )
                  }
                >
                  Column statistics
                </Menu.Item>,
              ]
        }
      />
    </TMDataGrid>
  );
}
