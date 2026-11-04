import {
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useCallback, useRef, useState } from "react";
import { useSelector } from "@tanstack/react-store";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridSaveDraftsArgs,
  type TMDataGridSaveDraftsResponse,
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
    minSize: 110,
    meta: { edit: { validate: z.string().min(2, "At least two characters") } },
  }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 110 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 110,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 130,
    meta: { type: "select", options: DEPARTMENTS },
  }),
]);

/** The shape a new row starts as, before anyone types into it. */
const newEmployee = (): Employee => ({
  id: 0,
  firstName: "",
  lastName: "",
  email: "",
  department: "Engineering",
  location: "Stockholm",
  salary: 32_000,
  age: 30,
  hired: "2026-01-01",
  active: true,
  status: "Active",
  skills: [],
});

/** One `onSaveDrafts` call, as the backend panel logs it. */
type SaveCall = {
  call: number;
  at: string;
  updated: number;
  created: number;
  deleted: number;
  /** Undefined until the call returns. */
  result?: { ms: number; outcome: string };
};

/** Wall-clock `HH:MM:SS`, so two calls are told apart. */
const clockTime = () => new Date().toLocaleTimeString("sv-SE");

export function DraftEditing() {
  // The backend's table. A row's ✓ never reaches it; only a save does.
  const [employees, setEmployees] = useState(() => makeEmployees(60, 2000));
  const [log, setLog] = useState<Array<SaveCall>>([]);
  const [rejectSales, setRejectSales] = useState(false);
  // `onSaveDrafts` reads the switch through a ref, so it stays stable.
  const rejectSalesRef = useRef(rejectSales);
  const calls = useRef(0);

  // The whole draft store (edits, additions, deletions) arrives here at once,
  // so the server can apply it as a single transaction.
  const onSaveDrafts = useCallback(
    async ({
      updated,
      created,
      deleted,
    }: TMDataGridSaveDraftsArgs<Employee>): Promise<
      TMDataGridSaveDraftsResponse | undefined
    > => {
      const call = (calls.current += 1);
      const startedAt = Date.now();
      setLog((previous) => [
        ...previous,
        {
          call,
          at: clockTime(),
          updated: updated.length,
          created: created.length,
          deleted: deleted.length,
        },
      ]);

      await new Promise((resolve) => setTimeout(resolve, 800));

      // The backend refuses Sales rows while the switch is on. Deletions
      // always go through.
      const refused = (employee: Employee) =>
        rejectSalesRef.current && employee.department === "Sales";
      const savedUpdates = updated.filter((row) => !refused(row.value));
      const savedCreates = created.filter((add) => !refused(add.value));

      setEmployees((previous) => {
        const edited = previous.map(
          (employee) =>
            savedUpdates.find((row) => row.rowId === String(employee.id))
              ?.value ?? employee,
        );
        const kept = edited.filter(
          (employee) => !deleted.includes(String(employee.id)),
        );
        // The engine mints a temporary id; the real one is the app's to
        // assign, which here means "one past the highest".
        const maxId = Math.max(2999, ...kept.map((employee) => employee.id));
        return [
          ...kept,
          ...savedCreates.map((add, index) => ({
            ...add.value,
            id: maxId + index + 1,
          })),
        ];
      });

      const rejected =
        updated.length -
        savedUpdates.length +
        (created.length - savedCreates.length);
      setLog((previous) =>
        previous.map((entry) =>
          entry.call === call
            ? {
                ...entry,
                result: {
                  ms: Date.now() - startedAt,
                  outcome: rejected === 0 ? "ok" : `${rejected} rejected`,
                },
              }
            : entry,
        ),
      );

      if (rejected === 0) return undefined;
      // An id reported `false` keeps its draft, committed and ready for the
      // next save; every id left out is cleared from the store.
      return {
        updated: Object.fromEntries(
          updated
            .filter((row) => refused(row.value))
            .map((row) => [row.rowId, false]),
        ),
        created: Object.fromEntries(
          created
            .filter((add) => refused(add.value))
            .map((add) => [add.tempId, false]),
        ),
      };
    },
    [],
  );

  const grid = useTMDataGrid({
    data: employees,
    columns,
    getRowId: (row) => String(row.id),
    editing: {
      mode: "row",
      draft: true,
      onSaveDrafts,
      newRowDefaults: newEmployee,
    },
    selectionMode: "highlight",
    enableGrouping: false,
  });

  // One entry row at a time: `edit.store` publishes every new row with its
  // `confirmed` flag, so the Add button waits until the open one is entered
  // or discarded.
  const hasOpenEntry = useSelector(grid.edit.store, (state) =>
    state.newRows.some((newRow) => !newRow.committed),
  );

  return (
    <div style={{ display: "flex", gap: 12, height: "100%", minHeight: 0 }}>
      <TMDataGrid {...grid} style={{ flex: 1, minWidth: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <Button
            size="compact-xs"
            variant="light"
            disabled={hasOpenEntry}
            onClick={() => grid.edit.addRow()}
          >
            Add row
          </Button>
          {/* The same entry row, seeded: the argument overrides
              `newRowDefaults` field by field. */}
          <Button
            size="compact-xs"
            variant="light"
            disabled={hasOpenEntry}
            onClick={() =>
              grid.edit.addRow({ department: "Sales", salary: 45_000 })
            }
          >
            Add to Sales
          </Button>
          {/* Save and Discard for every pending draft, plus a way back to a row
              left undecided - `scrollToFirstOpenRow` takes "first" in display
              order, so it follows the sort rather than the order rows opened. */}
          <TMDataGrid.DraftActions
            renderActions={({ state, actions, Controls }) => (
              <Group gap="xs" wrap="nowrap">
                <Button
                  size="compact-xs"
                  variant="light"
                  disabled={state.openCount === 0}
                  onClick={() => {
                    actions.scrollToFirstOpenRow("center");
                  }}
                >
                  Go to open row
                </Button>
                <Controls.OpenRowsNote />
                <Controls.Save />
                <Controls.Discard />
              </Group>
            )}
          />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>

      {/* A stand-in for the server: what it holds, and every call it took. */}
      <Paper
        withBorder
        radius="sm"
        p="sm"
        w={240}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minHeight: 0,
        }}
      >
        <Text size="sm" fw={600}>
          Backend
        </Text>
        <Text size="xs" c="dimmed">
          Rows: {employees.length} · Calls: {log.length}
        </Text>
        <Switch
          size="xs"
          label="Reject Sales rows"
          checked={rejectSales}
          onChange={(event) => {
            setRejectSales(event.currentTarget.checked);
            rejectSalesRef.current = event.currentTarget.checked;
          }}
        />
        <Text size="xs" fw={600}>
          Calls
        </Text>
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          {log.length === 0 ? (
            <Text size="xs" c="dimmed">
              No calls yet - ✓ commits into the draft store, Save sends it.
            </Text>
          ) : (
            <Stack gap={6}>
              {[...log].reverse().map((entry) => (
                <div key={entry.call}>
                  <Text size="xs" fw={500}>
                    #{entry.call} · {entry.at} ·{" "}
                    {entry.result === undefined
                      ? "saving…"
                      : `${entry.result.ms} ms · ${entry.result.outcome}`}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {entry.updated} updated, {entry.created} created,{" "}
                    {entry.deleted} deleted
                  </Text>
                </div>
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Paper>
    </div>
  );
}
