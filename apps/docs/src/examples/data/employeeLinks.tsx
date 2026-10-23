import { Anchor, Badge } from "@mantine/core";
import {
  createTMDataGridColumnHelper,
  createTMDataGridUrlState,
} from "@jielga/tmdatagrid";
import { createLink } from "@tanstack/react-router";
import { sek, type Employee, type EmployeeStatus } from "./employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  Active: "green",
  "On leave": "yellow",
  Terminated: "red",
};

/** The grid's columns. They decide what a link into the grid may name. */
export const employeeLinkColumns = columnHelper.columns([
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "fullName",
    header: "Name",
    minSize: 150,
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 130,
    meta: { type: "select", options: "faceted" },
  }),
  columnHelper.accessor("location", {
    header: "Location",
    minSize: 110,
    // Filterable in the grid, never in a link.
    meta: { filter: { url: false } },
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 120,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 110,
    meta: { type: "select", options: "faceted" },
    cell: (info) => (
      <Badge color={STATUS_COLORS[info.getValue()]} variant="light" size="sm">
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("hired", {
    header: "Hired",
    minSize: 110,
    meta: { type: "date" },
  }),
]);

/** One definition for the grid, the route and every link. */
export const employeesLink = createTMDataGridUrlState({
  key: "emp",
  columns: employeeLinkColumns,
  slices: ["columnFilters", "globalFilter", "sorting"],
});

/** A Mantine `Anchor` that is a typed router link. */
export const AnchorLink = createLink(Anchor);
