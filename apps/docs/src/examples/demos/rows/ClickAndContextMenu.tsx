import { Code, Group, Menu, Text } from "@mantine/core";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/** Keeps a menu item on one line whatever the cell holds. */
const truncate = (value: string, max = 20) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function ClickAndContextMenu() {
  const [lastEvent, setLastEvent] = useState("-");

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    selectionMode: "checkboxAndHighlight",
  });

  return (
    <>
      <Group gap="xs" mb="xs">
        <Text size="sm" c="dimmed">
          Last event:
        </Text>
        <Code>{lastEvent}</Code>
      </Group>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<Employee>
          // The handlers compose, they never suppress: selecting, highlighting
          // and moving the cell cursor all still happen. Group rows sit them
          // out, the way they sit out row clicks.
          onRowClick={(row) => setLastEvent(`row click · #${row.id}`)}
          onCellClick={({ row, column }) =>
            setLastEvent(`cell click · #${row.id} ${column.id}`)
          }
          onCellDoubleClick={({ row, column }) =>
            setLastEvent(`cell double-click · #${row.id} ${column.id}`)
          }
          // The grid owns the Menu and opens it at the pointer; this fills the
          // dropdown. `cell` is the one that was right-clicked, which is what
          // makes a per-cell action possible at all.
          renderRowContextMenu={({ row, cell, close }) => {
            const value = cell ? String(cell.getValue() ?? "") : "";

            return (
              <>
                <Menu.Label>
                  {row.original.firstName} {row.original.lastName}
                </Menu.Label>
                <Menu.Item
                  disabled={!cell}
                  onClick={() => {
                    void navigator.clipboard.writeText(value);
                    setLastEvent(`copied · ${truncate(value)}`);
                  }}
                >
                  Copy “{truncate(value)}”
                </Menu.Item>
                <Menu.Item onClick={() => row.toggleSelected()}>
                  {row.getIsSelected() ? "Deselect" : "Select"} row
                </Menu.Item>
                <Menu.Divider />
                {/* `close` is there for actions that open something else - a
                    modal wants the menu gone before it appears. */}
                <Menu.Item color="red" onClick={close}>
                  Delete…
                </Menu.Item>
              </>
            );
          }}
        />
      </TMDataGrid>
    </>
  );
}
