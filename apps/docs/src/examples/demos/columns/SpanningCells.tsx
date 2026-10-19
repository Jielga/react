import { Text } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { Row } from "@tanstack/react-table";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridFeatures,
} from "@jielga/tmdatagrid";
import { salaryColumn } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

function NameCell({ row }: { row: Row<TMDataGridFeatures, Employee> }) {
  const expanded = useSelector(row.table.store, () => row.getIsExpanded());
  const { firstName, lastName, department, location } = row.original;
  return expanded ? (
    <Text fw={600}>
      {firstName} {lastName} · {department}, {location}
    </Text>
  ) : (
    `${firstName} ${lastName}`
  );
}

const columns = columnHelper.columns([
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "name",
    header: "Name",
    minSize: 160,
    meta: {
      label: "Name",
      colSpan: ({ row }) => (row.getIsExpanded() ? Infinity : 1),
    },
    cell: ({ row }) => <NameCell row={row} />,
  }),
  columnHelper.accessor("department", { header: "Department", minSize: 140 }),
  columnHelper.accessor("location", { header: "Location", minSize: 120 }),
  salaryColumn,
]);

export function SpanningCells() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
    renderDetails: ({ row }) => (
      <Text size="sm">{row.original.email}</Text>
    ),
    renderDetailsEstHeight: 60,
    initialState: { expanded: { "2": true } },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
