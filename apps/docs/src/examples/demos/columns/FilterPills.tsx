import { Group, Paper, Text } from "@mantine/core";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * Nearly every part reads the grid from React context, which is why it has to
 * be rendered inside `<TMDataGrid>`. `FilterPills` is the exception: it takes
 * the grid as an `api` prop, so what is filtered can be shown wherever the
 * page wants it - a header, a sidebar, a summary bar above three grids.
 */
export function FilterPills() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    initialState: {
      columnFilters: [
        { id: "department", value: { operator: "isAnyOf", value: ["Sales"] } },
        { id: "lastName", value: { operator: "contains", value: "son" } },
      ],
    },
  });

  return (
    <>
      {/* Outside the grid entirely - this Paper is the page, not the chrome. */}
      <Paper withBorder p="xs" mb="sm" radius="sm">
        <Group gap="sm">
          <Text size="sm" fw={600}>
            Showing
          </Text>
          <TMDataGrid.FilterPills api={grid} />
        </Group>
      </Paper>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    </>
  );
}
