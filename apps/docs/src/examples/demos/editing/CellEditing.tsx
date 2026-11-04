import { Code, Group, SegmentedControl } from "@mantine/core";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
  type TMDataGridEditMode,
} from "@jielga/tmdatagrid";
import { makeEmployees, sek, type Employee } from "../../data/employees";

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
    minSize: 140,
    meta: { type: "select", options: "faceted" },
  }),
]);

export function CellEditing() {
  const [employees, setEmployees] = useState(() => makeEmployees(50));
  const [mode, setMode] = useState<TMDataGridEditMode>("cell");
  const [lastCommit, setLastCommit] = useState("-");

  // Nothing is written until this is called. The grid holds a draft; the data
  // is yours, and stays yours.
  const onCommit = useCallback(
    ({ rowId, value, changes }: TMDataGridEditCommitArgs<Employee>) => {
      setEmployees((previous) =>
        previous.map((employee) =>
          String(employee.id) === rowId ? value : employee,
        ),
      );
      setLastCommit(
        `#${rowId} · ${changes.map((change) => change.field).join(", ")}`,
      );
    },
    [],
  );

  const grid = useTMDataGrid({
    data: employees,
    columns,
    // Not optional once editing is on: forms are keyed by row id and live
    // outside the DOM, and the index fallback points at a different record
    // after any sort.
    getRowId: (row) => String(row.id),
    editing: { mode, onCommit },
    selectionMode: "highlight",
  });

  return (
    <>
      <Group gap="md" mb="xs">
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(value) => setMode(value as TMDataGridEditMode)}
          data={[
            // Commits on blur, like a spreadsheet.
            { value: "cell", label: "cell" },
            // Waits for ✓ or Enter; Escape drops the draft.
            { value: "cellConfirm", label: "cellConfirm" },
          ]}
        />
        <Code>{lastCommit}</Code>
      </Group>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    </>
  );
}
