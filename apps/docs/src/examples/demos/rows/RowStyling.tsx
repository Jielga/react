import { Group, Switch } from "@mantine/core";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function RowStyling() {
  const [striped, setStriped] = useState(true);
  const [colourByStatus, setColourByStatus] = useState(true);

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    selectionMode: "checkboxAndHighlight",
  });

  return (
    <>
      <Group gap="md" mb="xs">
        <Switch
          size="xs"
          label="Striped"
          checked={striped}
          onChange={(event) => setStriped(event.currentTarget.checked)}
        />
        <Switch
          size="xs"
          label="Colour by status"
          checked={colourByStatus}
          onChange={(event) => setColourByStatus(event.currentTarget.checked)}
        />
      </Group>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<Employee>
          // Stripes follow the row's position in the *view*, so sorting and
          // filtering restripe and scrolling never shifts them.
          striped={striped}
          rowStyle={
            colourByStatus
              ? (row) => {
                  // `--row-bg`, never `background`. The row's own background,
                  // its sticky pinned cells and the cell-range tint all read
                  // this variable - and hover, selection and highlight keep
                  // working on top of it. A raw `background` bypasses the lot.
                  //
                  // A group row's `original` is an arbitrary child's record,
                  // so the status read off it is not the group's.
                  if (row.getIsGrouped()) return undefined;
                  if (row.original.status === "Terminated") {
                    return { "--row-bg": "var(--mantine-color-red-light)" };
                  }
                  if (row.original.status === "On leave") {
                    return { "--row-bg": "var(--mantine-color-yellow-light)" };
                  }
                  return undefined;
                }
              : undefined
          }
        />
      </TMDataGrid>
    </>
  );
}
