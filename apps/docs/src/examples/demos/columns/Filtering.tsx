import { Button } from "@mantine/core";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridFilterValue,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  // A string column offers contains / equals / starts with / is empty …
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),

  // … a select column offers "is any of" over its own values …
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    meta: { type: "select", options: "faceted" },
  }),

  // … and a number column offers the comparisons. `defaultFilterOperator`
  // picks which one a fresh filter opens on: salaries are asked about as a
  // range far more often than as an exact figure.
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: {
      type: "number",
      align: "right",
      filter: { defaultOperator: "between" },
    },
    cell: (info) => sek(info.getValue()),
  }),

  columnHelper.accessor("hired", {
    header: "Hired",
    minSize: 120,
    meta: { type: "date" },
  }),

  // Filtering off for this column alone: no menu item, no panel row.
  columnHelper.accessor("email", {
    header: "Email (not filterable)",
    minSize: 200,
    enableColumnFilter: false,
  }),
]);

export function Filtering() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        {/* The operator travels inside the value, so setting a filter from
            your own UI is one call - and opening the panel shows what just
            happened rather than leaving it a mystery. */}
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => {
            grid.table.getColumn("department")?.setFilterValue({
              operator: "isAnyOf",
              value: ["Engineering", "Design"],
            } satisfies TMDataGridFilterValue);
            grid.ui.actions.openFilterPanel("department");
          }}
        >
          Filter to Engineering + Design
        </Button>
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
