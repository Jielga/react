import { Anchor, Group } from "@mantine/core";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeLinkColumns, employeesLink } from "../../data/employeeLinks";
import { EMPLOYEES, type Employee } from "../../data/employees";

// No storage: the grid reads and writes the browser's URL itself.
const persist = employeesLink.persist();

const designLink = `?${employeesLink.searchParams({
  filters: { department: { operator: "isAnyOf", value: ["Design"] } },
  sorting: [{ id: "fullName" }],
})}`;

const onLeaveLink = `?${employeesLink.searchParams({
  filters: { status: { operator: "isAnyOf", value: ["On leave"] } },
})}`;

export function PlainLinks() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeLinkColumns,
    getRowId: (row) => String(row.id),
    persist,
  });

  return (
    <>
      <Group gap="md" mb="xs">
        <Anchor href={designLink} data-link="design">
          Design, by name
        </Anchor>
        <Anchor href={onLeaveLink} data-link="on-leave">
          On leave
        </Anchor>
      </Group>
      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.Search />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
        <TMDataGrid.Footer />
      </TMDataGrid>
    </>
  );
}
