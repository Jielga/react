import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, type Employee } from "../../data/employees";

// Module scope: a new array on every render rebuilds the table's column model.
const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name" }),
  columnHelper.accessor("lastName", { header: "Last name" }),
  columnHelper.accessor("department", { header: "Department" }),
  columnHelper.accessor("salary", {
    header: "Salary",
    meta: { type: "number", align: "right" },
  }),
]);

export function Minimal() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
  });

  // `flex: 1, minHeight: 0` is what lets the grid size itself to the space it
  // is given - without it a flex child refuses to shrink and the body grows
  // instead of scrolling.
  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
