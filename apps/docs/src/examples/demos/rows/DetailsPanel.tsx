import { Badge, Button, Group, Stack, Text } from "@mantine/core";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

/** Filler so the panels differ in height - the grid measures each one. */
const NOTES = [
  "Joined through the Stockholm office and has been with the team since.",
  "Currently on a rotation with Product; reviews land in the shared queue.",
  "Owns the on-call handover doc and the quarterly capacity forecast.",
];

/**
 * Whatever `renderDetails` returns. Nothing here is the grid's - it renders
 * what comes back, at whatever height it comes back at, and measures the
 * result. The estimate below only has to be in the right region. The panel
 * has no padding of its own; `--dg-padding` lines the text up with the cells.
 */
function EmployeeDetails({ employee }: { employee: Employee }) {
  return (
    <Stack gap="sm" p="var(--dg-padding)">
      <Group gap="xl">
        <Text size="sm">
          {employee.email} · {employee.location} · {sek(employee.salary)}
        </Text>
        <Group gap={4}>
          {employee.skills.map((skill) => (
            <Badge key={skill} size="sm" variant="light">
              {skill}
            </Badge>
          ))}
        </Group>
      </Group>
      <Text size="sm" c="dimmed" maw={640}>
        {NOTES.slice(0, 1 + (employee.id % NOTES.length)).join(" ")}
      </Text>
      <Group gap="xs">
        <Button size="xs" variant="light">
          Open profile
        </Button>
      </Group>
    </Stack>
  );
}

export function DetailsPanel() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: compactEmployeeColumns,
    getRowId: (row) => String(row.id),
    // Setting the render prop is what turns the details lane on. There is no
    // separate flag to forget.
    renderDetails: ({ row }) => <EmployeeDetails employee={row.original} />,
    // A seed for the virtualizer, not a constraint: every mounted panel is
    // measured and its real height replaces this.
    renderDetailsEstHeight: 120,
    selectionMode: "highlight",
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        {/* Expanding from outside the grid: rows are addressed by the id
            `getRowId` minted, so no reference to a row object is needed. */}
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => grid.table.getRow("3")?.toggleExpanded()}
        >
          Toggle row #3
        </Button>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
