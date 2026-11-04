import { Button, Paper, Stack, Text } from "@mantine/core";
import type { Row } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridFeatures,
  type TMDataGridSaveDraftsArgs,
} from "@jielga/tmdatagrid";
import { makeEmployees, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

/** What Use sent, and which record it came from. */
type Picked = { rowId: string; sent: Employee };

/**
 * A cell that acts on its row. Inside a `cell` renderer `row.original` is the
 * row as shown: the open form's values while the row is edited, the committed
 * draft after ✓, and `data` otherwise - no store lookup needed. A handler with
 * no cell context, a toolbar action or a callback that got only an id, reaches
 * the same row with `edit.getRowValues(rowId)`.
 */
function UseRowButton({
  row,
  onPick,
}: {
  row: Row<TMDataGridFeatures, Employee>;
  onPick: (picked: Picked) => void;
}) {
  return (
    <Button
      size="compact-xs"
      variant="light"
      onClick={() => onPick({ rowId: row.id, sent: row.original })}
    >
      Use
    </Button>
  );
}

/** The columns take the handler once, so the handler has to stay stable. */
const makeColumns = (onPick: (picked: Picked) => void) =>
  columnHelper.columns([
    columnHelper.accessor("firstName", { header: "First name", minSize: 90 }),
    columnHelper.accessor("lastName", { header: "Last name", minSize: 90 }),
    columnHelper.accessor("salary", {
      header: "Salary",
      minSize: 100,
      meta: { type: "number", align: "right" },
      cell: (info) => sek(info.getValue()),
    }),
    columnHelper.display({
      id: "use",
      header: "",
      size: 70,
      minSize: 70,
      maxSize: 70,
      meta: { label: "Use", align: "center" },
      enableResizing: false,
      cell: ({ row }) => <UseRowButton row={row} onPick={onPick} />,
    }),
  ]);

const describe = (employee: Employee) =>
  `${employee.firstName} ${employee.lastName}, ${sek(employee.salary)}`;

export function ActionCell() {
  const [employees, setEmployees] = useState(() => makeEmployees(30));
  const [picked, setPicked] = useState<Picked | null>(null);

  // A state setter is stable, so the columns are built once.
  const columns = useMemo(() => makeColumns(setPicked), []);

  const onSaveDrafts = useCallback(
    async ({ updated }: TMDataGridSaveDraftsArgs<Employee>) => {
      setEmployees((previous) =>
        previous.map(
          (employee) =>
            updated.find((row) => row.rowId === String(employee.id))?.value ??
            employee,
        ),
      );
    },
    [],
  );

  const grid = useTMDataGrid({
    data: employees,
    columns,
    getRowId: (row) => String(row.id),
    editing: { mode: "row", draft: true, onSaveDrafts },
    selectionMode: "highlight",
  });

  // What `data` holds for the row Use came from - unchanged until Save.
  const record =
    picked === null
      ? undefined
      : employees.find((employee) => String(employee.id) === picked.rowId);

  return (
    <div style={{ display: "flex", gap: 12, height: "100%", minHeight: 0 }}>
      <TMDataGrid {...grid} style={{ flex: 1, minWidth: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.DraftActions />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>

      <Paper withBorder radius="sm" p="sm" w={220}>
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Use sent
          </Text>
          {picked === null || record === undefined ? (
            <Text size="xs" c="dimmed">
              Nothing yet. Double-click a row, change the salary, press Use.
            </Text>
          ) : (
            <>
              <Text size="xs">Sent: {describe(picked.sent)}</Text>
              <Text size="xs" c="dimmed">
                data: {describe(record)}
              </Text>
            </>
          )}
        </Stack>
      </Paper>
    </div>
  );
}
