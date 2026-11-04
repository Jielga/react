import { Code } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("department", { header: "Department", minSize: 140 }),
  columnHelper.accessor("age", {
    header: "Age",
    minSize: 90,
    meta: { type: "number", align: "right" },
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  // Per-column opt-out. The header stays a header; it just stops being a
  // button, and the sort item leaves its menu.
  columnHelper.accessor("email", {
    header: "Email (not sortable)",
    minSize: 200,
    enableSorting: false,
  }),
]);

export function Sorting() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
    // Where a grid starts sorted. Not state you own - the table takes it from
    // here and manages it thereafter.
    initialState: { sorting: [{ id: "department", desc: false }] },
  });

  // Sorting is table state, so it comes off the table store. Shift+click a
  // second header and watch this grow.
  const sorting = useSelector(grid.table.store, (state) => state.sorting);

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <Code>{JSON.stringify(sorting)}</Code>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
