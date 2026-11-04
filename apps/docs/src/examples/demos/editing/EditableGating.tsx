import { useCallback, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
} from "@jielga/tmdatagrid";
import { makeEmployees, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  // A generated id is nobody's to change.
  columnHelper.accessor("id", {
    header: "ID",
    minSize: 70,
    meta: { type: "number", flex: 0.3, edit: { enabled: false } },
  }),

  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),

  // Editable per row: a terminated employee's salary is history, not a field.
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: {
      type: "number",
      align: "right",
      edit: { enabled: (row) => row.original.status !== "Terminated" },
    },
    cell: (info) => sek(info.getValue()),
  }),

  columnHelper.accessor("status", {
    header: "Status",
    minSize: 130,
    meta: { type: "select", options: "faceted" },
  }),

  // A computed column has no field to write back to - `edit.field` names one.
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "fullName",
    header: "Full name → edits last name",
    minSize: 200,
    meta: { label: "Full name", edit: { field: "lastName" } },
  }),
]);

export function EditableGating() {
  const [employees, setEmployees] = useState(() => makeEmployees(50));

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
      mode: "cell",
      onCommit,
      // The whole-row gate, checked before any column's own. Every row under 25
      // here is a probation record this demo treats as read-only.
      isRowEditable: (row) => row.original.age >= 25,
    },
    selectionMode: "highlight",
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
