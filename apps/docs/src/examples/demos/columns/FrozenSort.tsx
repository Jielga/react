import { SegmentedControl } from "@mantine/core";
import { useCallback, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
  type TMDataGridSortMode,
} from "@jielga/tmdatagrid";
import { makeEmployees, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("department", { header: "Department", minSize: 140 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
]);

export function FrozenSort() {
  const [employees, setEmployees] = useState(() => makeEmployees(50));
  const [sortMode, setSortMode] = useState<TMDataGridSortMode>("frozen");

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
    // Rows are held by id.
    getRowId: (row) => String(row.id),
    editing: { mode: "cell", onCommit },
    sortMode,
    initialState: { sorting: [{ id: "salary", desc: false }] },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <SegmentedControl
          size="xs"
          value={sortMode}
          onChange={(value) => setSortMode(value as TMDataGridSortMode)}
          data={[
            // An edited row moves to its new place as soon as it commits.
            { value: "live", label: "live" },
            // An edited row stays; the header's button sorts again.
            { value: "frozen", label: "frozen" },
          ]}
        />
        <TMDataGrid.Spacer />
        <TMDataGrid.SummaryCount />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
