import { Paper, Text } from "@mantine/core";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * `filters.surface: "none"` leaves the grid with no panel of its own, so a
 * hand-placed `TMDataGrid.FilterPanel` is the only one on the page. It renders
 * whenever it is mounted - there is no open state to drive - so it can go in a
 * card, a form, a drawer, or here, above the toolbar.
 *
 * `layout` decides how one filter row is laid out: the default `"row"` puts
 * column, operator and value side by side and wants about 550px, which this
 * card has. Anything narrower - a drawer, a page column - wants
 * `layout="stacked"`.
 *
 * The filter button renders nothing under this surface: it would have nothing
 * to toggle. Read `grid.ui.state.filterPanelOpen` and render your own control
 * if the panel belongs behind one.
 */
export function FilterPanelPlaced() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: compactEmployeeColumns,
    getRowId: (row) => String(row.id),
    filters: { surface: "none" },
    initialState: {
      columnFilters: [
        { id: "department", value: { operator: "isAnyOf", value: ["Sales"] } },
      ],
    },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <Paper withBorder p="sm" mb="sm" radius="sm">
        <Text size="sm" fw={600} mb="xs">
          Narrow the list
        </Text>
        <TMDataGrid.FilterPanel />
      </Paper>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
