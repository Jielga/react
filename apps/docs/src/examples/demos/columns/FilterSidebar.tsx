import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * `filters.surface: "sidebar"` puts the panel beside the rows instead of over
 * them. It is a column of the grid frame, so the rows give up the width rather
 * than being covered, and nothing about clicking in the table dismisses it -
 * not a click on a row, and not clearing the filters. That is what a screen
 * where filtering is the work needs.
 *
 * A sidebar starts open, being a layout choice rather than a transient one;
 * `defaultOpen: false` overrides that. The toolbar's filter button toggles it
 * either way.
 */
export function FilterSidebar() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    filters: { surface: "sidebar", sidebarSide: "right" },
    initialState: {
      columnFilters: [
        { id: "department", value: { operator: "isAnyOf", value: ["Sales"] } },
      ],
    },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
