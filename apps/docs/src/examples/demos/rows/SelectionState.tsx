import { Badge, Button } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * The table store is subscribable, which is how a page reacts to grid state
 * without owning it: no `onRowSelectionChange` to thread through, no copy of
 * the selection to keep in step.
 */
export function SelectionState() {
  const [employees, setEmployees] = useState(EMPLOYEES);

  const grid = useTMDataGrid({
    data: employees,
    columns: compactEmployeeColumns,
    getRowId: (row) => String(row.id),
    selectionMode: "checkbox",
  });

  // Re-renders only when the selection actually changes - the selector is what
  // keeps every other table update from touching this component.
  const selectedIds = useSelector(grid.table.store, (state) =>
    Object.keys(state.rowSelection),
  );

  const removeSelected = () => {
    setEmployees((previous) =>
      previous.filter((employee) => !selectedIds.includes(String(employee.id))),
    );
    grid.table.resetRowSelection();
  };

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        {/* Gated on the capability flag as well as the count: under a mode
            with no selection, a stale count could still be in state. */}
        {grid.features.rowSelection && selectedIds.length > 0 && (
          <>
            <Badge variant="light" size="sm">
              {selectedIds.length} selected
            </Badge>
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              onClick={removeSelected}
            >
              Remove
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => grid.table.resetRowSelection()}
            >
              Clear
            </Button>
          </>
        )}
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
