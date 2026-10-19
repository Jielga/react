import { useEffect, type CSSProperties, type ReactNode } from "react";
import {
  aggregateColumn,
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridApi,
} from "../../src";
import { Grid, makeRows, testColumns, type TestRow } from "../fixtures";

declare global {
  interface Window {
    /** Set by the `Virtualized` story, the way testing.md tells a consumer to. */
    __grid?: TMDataGridApi<TestRow>;
  }
}

// A flex column, so the grid root - itself a shrinkable flex item with
// `min-height: 0` - takes the frame's height and scrolls its body inside it
// instead of growing to fit every row.
const FRAME_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: 400,
};

function Frame({
  width,
  children,
}: {
  width?: number;
  children: ReactNode;
}) {
  return <div style={{ ...FRAME_STYLE, width }}>{children}</div>;
}

// Module scope: `useTMDataGrid` memoizes on the data and columns references.
const ROWS_200 = makeRows(200);
const ROWS_5000 = makeRows(5000);
const ROWS_50 = makeRows(50);
const ROWS_500 = makeRows(500);

export function Default() {
  return (
    <Frame>
      <Grid data={ROWS_200} />
    </Frame>
  );
}

export function Virtualized() {
  const grid = useTMDataGrid<TestRow>({
    data: ROWS_5000,
    columns: testColumns,
    getRowId: (row) => String(row.id),
  });

  useEffect(() => {
    window.__grid = grid;
    return () => {
      delete window.__grid;
    };
  }, [grid]);

  return (
    <Frame>
      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    </Frame>
  );
}

type PinnedRow = TestRow & {
  email: string;
  phone: string;
  team: string;
  role: string;
  office: string;
  country: string;
  status: string;
};

const pinnedHelper = createTMDataGridColumnHelper<PinnedRow>();

const COLUMN_WIDTH = 160;

// Eleven columns of at least 160px in a 720px frame, so the body overflows
// sideways. `minSize`, because an unresized column is a fluid track and
// `minSize` is its floor.
const pinnedColumns = pinnedHelper.columns([
  pinnedHelper.accessor("id", {
    header: "ID",
    meta: { type: "number" },
    minSize: COLUMN_WIDTH,
  }),
  pinnedHelper.accessor("name", { header: "Name", minSize: COLUMN_WIDTH }),
  pinnedHelper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right" },
    minSize: COLUMN_WIDTH,
  }),
  pinnedHelper.accessor("city", { header: "City", minSize: COLUMN_WIDTH }),
  pinnedHelper.accessor("email", { header: "Email", minSize: COLUMN_WIDTH }),
  pinnedHelper.accessor("phone", { header: "Phone", minSize: COLUMN_WIDTH }),
  pinnedHelper.accessor("team", { header: "Team", minSize: COLUMN_WIDTH }),
  pinnedHelper.accessor("role", { header: "Role", minSize: COLUMN_WIDTH }),
  pinnedHelper.accessor("office", { header: "Office", minSize: COLUMN_WIDTH }),
  pinnedHelper.accessor("country", { header: "Country", minSize: COLUMN_WIDTH }),
  pinnedHelper.accessor("status", { header: "Status", minSize: COLUMN_WIDTH }),
]);

const TEAMS = ["Core", "Platform", "Design"];
const STATUSES = ["Active", "On leave"];

const PINNED_ROWS: Array<PinnedRow> = ROWS_200.map((row) => ({
  ...row,
  email: `${row.name.toLowerCase()}${row.id}@example.com`,
  phone: `+46 70 ${String(row.id).padStart(3, "0")} 00 00`,
  team: TEAMS[row.id % TEAMS.length],
  role: row.id % 4 === 0 ? "Lead" : "Engineer",
  office: row.city,
  country: "Sweden",
  status: STATUSES[row.id % STATUSES.length],
}));

export function Pinned() {
  const grid = useTMDataGrid<PinnedRow>({
    data: PINNED_ROWS,
    columns: pinnedColumns,
    getRowId: (row) => String(row.id),
    initialState: { columnPinning: { start: ["id"], end: ["status"] } },
  });

  return (
    <Frame width={720}>
      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<PinnedRow> />
      </TMDataGrid>
    </Frame>
  );
}

/** No user pinning, but the generated lanes still hold the left edge. */
export function PinningOff() {
  const grid = useTMDataGrid<PinnedRow>({
    data: PINNED_ROWS,
    columns: pinnedColumns,
    getRowId: (row) => String(row.id),
    enableColumnPinning: false,
    renderDetails: ({ row }) => (
      <div style={{ padding: "var(--dg-padding)" }}>
        Details for {row.original.id}
      </div>
    ),
  });

  return (
    <Frame width={720}>
      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<PinnedRow> />
      </TMDataGrid>
    </Frame>
  );
}

export function CellSelection() {
  return (
    <Frame>
      <Grid data={ROWS_50} cellSelection="range" />
    </Frame>
  );
}

const summaryHelper = createTMDataGridColumnHelper<TestRow>();

// A `footer` on any column is what renders the summary row.
const summaryColumns = summaryHelper.columns([
  summaryHelper.accessor("id", {
    header: "ID",
    meta: { type: "number" },
    minSize: 80,
    footer: "Total",
  }),
  summaryHelper.accessor("name", { header: "Name", minSize: 120 }),
  summaryHelper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right" },
    minSize: 80,
    footer: ({ table }) =>
      Math.round(
        Number(aggregateColumn({ table, columnId: "age", fn: "mean" })),
      ),
  }),
  summaryHelper.accessor("city", { header: "City", minSize: 120 }),
]);

export function WithSummary() {
  return (
    <Frame>
      <Grid data={ROWS_500} columns={summaryColumns} />
    </Frame>
  );
}
