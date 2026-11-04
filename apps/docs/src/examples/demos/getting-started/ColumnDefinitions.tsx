import { Badge, Group } from "@mantine/core";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, SKILLS, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  // A key accessor: the column id, the header and the value all come free.
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),

  // A computed accessor needs its own `id`, and a `meta.label` for the menus
  // - there is no key for them to fall back on.
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "fullName",
    header: "Full name",
    meta: { label: "Full name" },
    minSize: 160,
  }),

  // `type` decides which filter operators the column offers and which editor
  // it would open. `align` moves header and cells together.
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    // `cell` changes what is displayed, never what is filtered or sorted:
    // this column still compares as a number.
    cell: (info) => sek(info.getValue()),
  }),

  columnHelper.accessor("hired", {
    header: "Hired",
    minSize: 120,
    meta: { type: "date" },
  }),

  columnHelper.accessor("active", {
    header: "Active",
    minSize: 90,
    meta: { type: "boolean", align: "center" },
    cell: (info) => (info.getValue() ? "✓" : "-"),
  }),

  // `options: "faceted"` reads the choices out of the data itself; an array
  // states them. Either way one declaration feeds the filter and the editor.
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    meta: { type: "select", options: "faceted" },
  }),

  columnHelper.accessor("skills", {
    header: "Skills",
    minSize: 200,
    meta: { type: "multiSelect", options: SKILLS },
    cell: (info) => (
      <Group gap={4} wrap="nowrap">
        {info.getValue().map((skill) => (
          <Badge key={skill} variant="light" size="sm">
            {skill}
          </Badge>
        ))}
      </Group>
    ),
  }),

  // `flex` is the share of the leftover width; `minSize` is the floor, and
  // what the grid adds up to decide its own minimum width.
  columnHelper.accessor("id", {
    header: "ID",
    minSize: 70,
    meta: { type: "number", flex: 0.3 },
  }),
]);

export function ColumnDefinitions() {
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
