import {
  aggregateColumn,
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    meta: { type: "select", options: "faceted" },
    // A footer need not aggregate anything - it is a cell like any other.
    footer: "Total",
  }),

  // Defining a `footer` on any column is what summons the sticky summary row
  // along the bottom. `aggregateColumn` runs over every *filtered* row, all
  // pages - not just the page on screen. Filter the grid and watch it move.
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 140,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
    footer: ({ table }) =>
      sek(Number(aggregateColumn({ table, columnId: "salary" }))),
  }),

  columnHelper.accessor("age", {
    header: "Age",
    minSize: 110,
    meta: { type: "number", align: "right" },
    footer: ({ table }) =>
      Math.round(
        Number(aggregateColumn({ table, columnId: "age", fn: "mean" })),
      ),
  }),
]);

export function SummaryRow() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
    enablePagination: true,
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}
