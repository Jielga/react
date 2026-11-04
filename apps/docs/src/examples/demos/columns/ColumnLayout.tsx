import { Button } from "@mantine/core";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridPersistence,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    header: "ID",
    minSize: 70,
    meta: { type: "number", flex: 0.3 },
  }),
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("email", { header: "Email", minSize: 220 }),
  columnHelper.accessor("department", { header: "Department", minSize: 140 }),
  columnHelper.accessor("location", { header: "Location", minSize: 120 }),
  columnHelper.accessor("age", {
    header: "Age",
    minSize: 80,
    meta: { type: "number", align: "right" },
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  // Some columns should stay put. This one can still be hidden or pinned -
  // only its position is fixed.
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 120,
    meta: { enableOrdering: false },
  }),
]);

// Layout is a *setting*: it belongs to the user, not to the data, so it
// persists under its own key and outlives any filter.
const persist = {
  settingsKey: "tmdatagrid.demo.column-layout",
} satisfies TMDataGridPersistence;

export function ColumnLayout() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
    persist,
    initialState: {
      // Pinned columns stop being fluid - sticky offsets are measured in
      // pixels, so the grid freezes the width a column had when it was pinned.
      columnPinning: { start: ["id"], end: ["status"] },
      columnVisibility: { age: false },
    },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        {/* One button, honest scope: every settings slice - visibility, order,
            widths, pinning - back to a first visit. Not TanStack's per-slice
            resets, which would restore the very layout being thrown away once
            persistence has baked it into `initialState`. */}
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => grid.resetSettings()}
        >
          Reset layout
        </Button>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
