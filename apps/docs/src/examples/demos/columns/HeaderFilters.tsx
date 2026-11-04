import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * `filters.inHeader` adds a second header row of value controls, one per
 * filterable column. Each control is the one the column would get in the
 * panel - a multi-select on Department, a number input on Salary - and the
 * funnel button beside it changes that column's operator.
 *
 * The column menu loses its "Filter" item here, and a filtered header loses
 * its funnel indicator: both only existed to reveal a control that is now
 * always on screen.
 *
 * `inHeader` composes with any `surface`; pairing it with `"none"` is what
 * gives header filters and nothing else, which is what this grid wants. Leave
 * `surface` alone and the funnel button and its popup stay, for the
 * multi-column work a header row has no room for.
 */
export function HeaderFilters() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    filters: { inHeader: true, surface: "none" },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
