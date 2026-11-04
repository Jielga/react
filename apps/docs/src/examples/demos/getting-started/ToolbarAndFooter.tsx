import { Checkbox, Group, Stack } from "@mantine/core";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * The grid is compound: nothing renders that you did not ask for. Tick the
 * boxes to add each part and see exactly what it brings.
 */
export function ToolbarAndFooter() {
  const [toolbar, setToolbar] = useState(true);
  const [search, setSearch] = useState(true);
  const [footer, setFooter] = useState(true);

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    // The footer's pager only exists once pagination does.
    enablePagination: footer,
  });

  return (
    <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
      <Group gap="lg">
        <Checkbox
          size="xs"
          label="Toolbar"
          checked={toolbar}
          onChange={(event) => setToolbar(event.currentTarget.checked)}
        />
        <Checkbox
          size="xs"
          label="Search"
          checked={search}
          onChange={(event) => setSearch(event.currentTarget.checked)}
        />
        <Checkbox
          size="xs"
          label="Footer"
          checked={footer}
          onChange={(event) => setFooter(event.currentTarget.checked)}
        />
      </Group>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        {toolbar && (
          <TMDataGrid.Toolbar>
            {/* How many rows, after filtering. */}
            <TMDataGrid.SummaryCount />
            {search && <TMDataGrid.Search />}
            {/* Everything after the spacer is pushed to the right edge. */}
            <TMDataGrid.Spacer />
            <TMDataGrid.FilterButton />
            <TMDataGrid.Menu>
              <TMDataGrid.Menu.Columns />
            </TMDataGrid.Menu>
          </TMDataGrid.Toolbar>
        )}

        <TMDataGrid.Table<Employee> />

        {footer && <TMDataGrid.Footer pageSizeOptions={[10, 25, 50]} />}
      </TMDataGrid>
    </Stack>
  );
}
