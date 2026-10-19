import { Text } from "@mantine/core";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function DetailsPanelRight() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: compactEmployeeColumns,
    getRowId: (row) => String(row.id),
    renderDetails: ({ row }) => (
      <Text size="sm" p="var(--dg-padding)">
        {row.original.email} · {row.original.location}
      </Text>
    ),
    // The chevron lane moves to the right edge, after every column, and stays
    // pinned there. Everything else about the lane is unchanged.
    detailsColumnPosition: "right",
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
