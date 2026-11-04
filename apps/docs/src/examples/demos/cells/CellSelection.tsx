import { Button, Code, Group, SegmentedControl } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useMemo, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridCellSelectionMode,
} from "@jielga/tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const MODES = [
  { value: "none", label: "none" },
  // One cell at a time - a cursor, not a selection.
  { value: "single", label: "single" },
  // Drag, or Shift+arrows, to take a block.
  { value: "range", label: "range" },
] as const satisfies ReadonlyArray<{
  value: TMDataGridCellSelectionMode;
  label: string;
}>;

export function CellSelection() {
  const [mode, setMode] = useState<TMDataGridCellSelectionMode>("range");
  const [opened, setOpened] = useState<string | null>(null);

  // A plain button in a body cell - no `tabIndex`, no hook on it. The body is
  // still exactly one tab stop: Tab from anywhere in it leaves the grid, and
  // Enter or F2 steps into the cell to reach the button.
  const columns = useMemo(
    () => [
      ...compactEmployeeColumns,
      columnHelper.display({
        id: "open",
        header: "",
        size: 90,
        minSize: 90,
        maxSize: 90,
        meta: { label: "Open", align: "center" },
        enableResizing: false,
        cell: ({ row }) => (
          <Button
            size="compact-xs"
            variant="light"
            onClick={() => setOpened(row.id)}
          >
            Open
          </Button>
        ),
      }),
    ],
    [],
  );

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
    cellSelection: mode,
    selectionMode: "highlight",
  });

  // The cursor and the range are chrome state, not table state, so they live
  // on the ui store beside the panels rather than in TanStack's state tree.
  const focusedCell = useSelector(grid.ui, (state) => state.focusedCell);

  return (
    <>
      <Group gap="md" mb="xs">
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(value) =>
            setMode(value as TMDataGridCellSelectionMode)
          }
          data={MODES as unknown as Array<{ value: string; label: string }>}
        />
        <Code>
          {focusedCell
            ? `${focusedCell.rowId} · ${focusedCell.columnId}`
            : "no cell"}
        </Code>
        <Code>{opened === null ? "nothing opened" : `opened ${opened}`}</Code>
      </Group>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    </>
  );
}
