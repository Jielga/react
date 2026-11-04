import { useCallback, useState } from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
  type TMDataGridRowValidators,
} from "@jielga/tmdatagrid";
import {
  DEPARTMENTS,
  makeEmployees,
  sek,
  type Employee,
} from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", {
    header: "First name",
    minSize: 120,
    meta: { edit: { validate: z.string().min(2, "At least two characters") } },
  }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 150,
    meta: { type: "select", options: DEPARTMENTS },
  }),
]);

/**
 * A rule spanning two fields has no single cell to belong to, so it lives on
 * the row and surfaces on the Save button rather than under an input. Row
 * mode is what makes it possible: one form, one submit, both values present.
 */
const rowValidators = {
  onSubmit: z
    .object({
      firstName: z.string().min(2, "At least two characters"),
      salary: z.number().positive(),
      department: z.string(),
    })
    .refine((row) => !(row.department === "Sales" && row.salary > 60_000), {
      message: "Sales salaries cap at 60 000 kr",
    }),
} satisfies TMDataGridRowValidators;

export function RowEditing() {
  const [employees, setEmployees] = useState(() => makeEmployees(30, 1000));

  // One call per row, however many cells changed.
  const onCommit = useCallback(
    ({ rowId, value }: TMDataGridEditCommitArgs<Employee>) => {
      setEmployees((previous) =>
        previous.map((employee) =>
          String(employee.id) === rowId ? value : employee,
        ),
      );
    },
    [],
  );

  const grid = useTMDataGrid({
    data: employees,
    columns,
    getRowId: (row) => String(row.id),
    editing: {
      // The edit lane (pencil, ✓, ✕) is generated and pinned right.
      mode: "row",
      rowValidators,
      onCommit,
    },
    selectionMode: "highlight",
    enableGrouping: false,
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
