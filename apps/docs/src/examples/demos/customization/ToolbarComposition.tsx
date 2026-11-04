import { Badge, Menu, Switch } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

/**
 * The toolbar is a plain flex row you fill. There is no slot API, no ordered
 * list of allowed children: the built-ins are components like any other, and
 * an app's own actions sit between them wherever they belong.
 */
export function ToolbarComposition() {
  const [refetching, setRefetching] = useState(false);

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    meta: { loading: false },
    selectionMode: "checkbox",
    exportOptions: { fileName: "employees" },
  });

  const selectedCount = useSelector(
    grid.table.store,
    (state) => Object.keys(state.rowSelection).length,
  );

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      {/* Mantine style props land on the row; `withBottomBorder` draws the
          header's line under it. */}
      <TMDataGrid.Toolbar withBottomBorder px="sm">
        {/* Row count after filtering. Pass children to say it your own way. */}
        <TMDataGrid.SummaryCount />

        {selectedCount > 0 && (
          <Badge variant="light" size="sm">
            {selectedCount} selected
          </Badge>
        )}

        <TMDataGrid.Search />

        {/* Everything after the spacer is pushed to the right edge. */}
        <TMDataGrid.Spacer />

        <Switch
          size="xs"
          label="Refetching"
          checked={refetching}
          onChange={(event) => setRefetching(event.currentTarget.checked)}
        />
        {/* A small spinner for refetches that keep rows on screen - the full
            loader would blank a grid the user is still reading. */}
        {refetching && <TMDataGrid.LoadingIndicator />}

        <TMDataGrid.FilterButton />

        {/* One menu: the app's own actions and the grid's column chooser. */}
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Export />
          <TMDataGrid.Menu.ExportSelected />
          <Menu.Divider />
          <Menu.Label>Columns</Menu.Label>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
