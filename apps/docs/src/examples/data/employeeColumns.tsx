import { Badge } from "@mantine/core";
import { createTMDataGridColumnHelper } from "@jielga/tmdatagrid";
import { sek, type Employee, type EmployeeStatus } from "./employees";

/**
 * A ready-made column set for the demos whose subject is *not* the column
 * definition - pagination, persistence, search, cell selection, export. Those
 * demos import from here so the file you read is the feature and nothing else.
 *
 * Where the column definition *is* the lesson - types, sizing, filter
 * controls, editors, aggregation - the demo defines its own columns inline.
 */

const columnHelper = createTMDataGridColumnHelper<Employee>();

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  Active: "green",
  "On leave": "yellow",
  Terminated: "red",
};

export const statusColumn = columnHelper.accessor("status", {
  header: "Status",
  minSize: 120,
  meta: { type: "select", options: "faceted" },
  cell: (info) => {
    const value = info.getValue();
    return (
      <Badge color={STATUS_COLORS[value]} variant="light" size="sm">
        {value}
      </Badge>
    );
  },
});

export const salaryColumn = columnHelper.accessor("salary", {
  header: "Salary",
  minSize: 130,
  meta: { type: "number", align: "right" },
  cell: (info) => sek(info.getValue()),
});

/** Seven columns - wide enough to need horizontal scroll on a narrow demo. */
export const employeeColumns = columnHelper.columns([
  columnHelper.accessor("id", {
    header: "ID",
    minSize: 80,
    meta: { type: "number", flex: 0.4 },
  }),
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    meta: { type: "select", options: "faceted" },
  }),
  columnHelper.accessor("location", { header: "Location", minSize: 120 }),
  salaryColumn,
  statusColumn,
]);

/** Four columns, for demos that need the grid to be readable at 360px tall. */
export const compactEmployeeColumns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
    meta: { type: "select", options: "faceted" },
  }),
  salaryColumn,
]);
