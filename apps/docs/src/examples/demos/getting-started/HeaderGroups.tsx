import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

/**
 * `columnHelper.group` nests columns under a shared header. The group is a
 * header row, not a column: it has no cells, so filtering, sorting, resizing
 * and pinning all stay with the leaf columns underneath it.
 */
const columns = columnHelper.columns([
  columnHelper.group({
    id: "person",
    header: "Person",
    columns: columnHelper.columns([
      columnHelper.accessor("firstName", { header: "First", minSize: 110 }),
      columnHelper.accessor("lastName", { header: "Last", minSize: 110 }),
      columnHelper.accessor("age", {
        header: "Age",
        minSize: 80,
        meta: { type: "number", align: "right" },
      }),
    ]),
  }),
  columnHelper.group({
    id: "employment",
    header: "Employment",
    columns: columnHelper.columns([
      columnHelper.accessor("department", {
        header: "Department",
        minSize: 140,
        meta: { type: "select", options: "faceted" },
      }),
      columnHelper.accessor("location", { header: "Location", minSize: 120 }),
      columnHelper.accessor("hired", {
        header: "Hired",
        minSize: 120,
        meta: { type: "date" },
      }),
    ]),
  }),
  // A column need not belong to a group; it simply spans both header rows.
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
]);

export function HeaderGroups() {
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
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
