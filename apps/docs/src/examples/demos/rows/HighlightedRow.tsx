import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function HighlightedRow() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: compactEmployeeColumns,
    getRowId: (row) => String(row.id),
    selectionMode: "highlight",
    defaultHighlightedRowId: "3",
  });

  const highlightedRowId = useSelector(grid.ui, (state) => state.highlightedRowId);
  const employee = EMPLOYEES.find((row) => String(row.id) === highlightedRowId);

  return (
    <Group align="stretch" gap="sm" wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid {...grid} style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>

      <Paper withBorder p="sm" w={220}>
        {employee ? (
          <Stack gap="xs" align="flex-start">
            <Text fw={600}>
              {employee.firstName} {employee.lastName}
            </Text>
            <Text size="sm">{employee.email}</Text>
            <Text size="sm">{employee.location}</Text>
            <Button
              size="xs"
              variant="default"
              onClick={() => grid.ui.actions.setHighlightedRow(null)}
            >
              Close
            </Button>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Click a row.
          </Text>
        )}
      </Paper>
    </Group>
  );
}
