import { SegmentedControl, Stack, Switch, Group } from "@mantine/core";
import { useState } from "react";
import {
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridSelectionMode,
} from "@jielga/tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const MODES = [
  // A checkbox lane; clicking the row does nothing.
  { value: "checkbox", label: "checkbox" },
  // The row itself selects, Ctrl and Shift included. No lane.
  { value: "row", label: "row" },
  // Both: tick to select, click to highlight one row without selecting it.
  { value: "checkboxAndHighlight", label: "checkbox + highlight" },
  // No selection at all - just "which row am I looking at".
  { value: "highlight", label: "highlight" },
] as const satisfies ReadonlyArray<{
  value: TMDataGridSelectionMode;
  label: string;
}>;

export function SelectionModes() {
  const [mode, setMode] = useState<TMDataGridSelectionMode>("checkbox");
  const [multi, setMulti] = useState(true);

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: compactEmployeeColumns,
    getRowId: (row) => String(row.id),
    selectionMode: mode,
    // TanStack's own option, passed straight through. Off, `rowSelection`
    // holds at most one id and the select-all checkbox goes with it.
    enableMultiRowSelection: multi,
  });

  return (
    <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
      <Group gap="md">
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(value) => setMode(value as TMDataGridSelectionMode)}
          data={MODES as unknown as Array<{ value: string; label: string }>}
        />
        <Switch
          size="xs"
          label="Multi-select"
          checked={multi}
          onChange={(event) => setMulti(event.currentTarget.checked)}
        />
      </Group>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    </Stack>
  );
}
