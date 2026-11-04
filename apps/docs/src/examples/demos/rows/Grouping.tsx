import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("department", { header: "Department", minSize: 140 }),
  columnHelper.accessor("location", { header: "Location", minSize: 120 }),
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),

  // Aggregation is opt-in per column: only the ones told how to summarise
  // themselves fill in on a group row, and the rest stay deliberately blank
  // rather than showing the first row's value as if it meant something.
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 140,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
    aggregationFn: "sum",
    aggregatedCell: (info) => sek(Number(info.getValue() ?? 0)),
  }),
  columnHelper.accessor("age", {
    header: "Age",
    minSize: 100,
    meta: { type: "number", align: "right" },
    aggregationFn: "mean",
    aggregatedCell: (info) => Math.round(Number(info.getValue() ?? 0)),
  }),
]);

export function Grouping() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
    enableGrouping: true,
    // Grouping suspends pagination - a page of group rows would cut a group
    // in half, so the grid shows the whole tree and relies on virtualization.
    enablePagination: true,
    initialState: { grouping: ["department"] },
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
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}
