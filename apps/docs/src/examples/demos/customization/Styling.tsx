import { ColorSwatch, Group, Switch, Text } from "@mantine/core";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const ACCENTS = ["blue", "grape", "teal", "orange"] as const;

export function Styling() {
  const [accent, setAccent] = useState<(typeof ACCENTS)[number]>("grape");
  const [roomy, setRoomy] = useState(false);
  const [square, setSquare] = useState(false);
  const [bigHeader, setBigHeader] = useState(false);

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    selectionMode: "checkboxAndHighlight",
    // Row height is the one that cannot be a bare CSS variable: the
    // virtualizer needs the number in JavaScript to place rows at all.
    meta: roomy ? { rowHeight: 64 } : undefined,
  });

  return (
    <>
      <Group gap="md" mb="xs">
        <Group gap={6}>
          <Text size="sm" c="dimmed">
            Selection tint
          </Text>
          {ACCENTS.map((color) => (
            <ColorSwatch
              key={color}
              component="button"
              color={`var(--mantine-color-${color}-light)`}
              size={20}
              onClick={() => setAccent(color)}
              style={{ cursor: "pointer" }}
              aria-label={color}
            />
          ))}
        </Group>
        <Switch
          size="xs"
          label="Roomy rows"
          checked={roomy}
          onChange={(event) => setRoomy(event.currentTarget.checked)}
        />
        <Switch
          size="xs"
          label="Square corners"
          checked={square}
          onChange={(event) => setSquare(event.currentTarget.checked)}
        />
        <Switch
          size="xs"
          label="Bigger header text"
          checked={bigHeader}
          onChange={(event) => setBigHeader(event.currentTarget.checked)}
        />
      </Group>

      <TMDataGrid
        {...grid}
        style={{
          flex: 1,
          minHeight: 0,
          // `style` is widened to accept custom properties, which is how the
          // grid's own values are themed. The same variables can be set from a
          // stylesheet through `className`, or globally in your theme. There is
          // no separate theming API.
          "--dg-row-selected-bg": `var(--mantine-color-${accent}-light)`,
          "--dg-row-highlight-bg": `var(--mantine-color-${accent}-light-hover)`,
          "--dg-row-striped-bg": "var(--mantine-color-default-hover)",
          // The frame's own radius. The root clips its overflow, so the header
          // and the last row follow the corner it is given.
          "--dg-radius": square ? "0" : "var(--mantine-radius-md)",
          // The header's own text size. `var(--dg-font-size)` is the default:
          // the header follows the cells until given a size of its own.
          "--dg-header-font-size": bigHeader
            ? "var(--mantine-font-size-md)"
            : "var(--dg-font-size)",
        }}
      >
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> striped />
      </TMDataGrid>
    </>
  );
}
