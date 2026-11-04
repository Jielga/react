import { useMemo, useState } from "react";
import { Badge, Button, Text } from "@mantine/core";
import {
  aggregateColumn,
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";

type Holding = {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  price: number;
  shares: number;
  targetPct: number;
};

/** A holding with everything the desk reads off it worked out. */
type Position = Holding & {
  marketValue: number;
  currentPct: number;
  drift: number;
  tradeShares: number;
};

const SECTORS = ["Energy", "Financials", "Health care", "Technology"];

const INITIAL_HOLDINGS: Holding[] = [
  { id: "AAPL", ticker: "AAPL", name: "Apple", sector: "Technology", price: 228.4, shares: 1_850, targetPct: 12 },
  { id: "MSFT", ticker: "MSFT", name: "Microsoft", sector: "Technology", price: 419.2, shares: 780, targetPct: 12 },
  { id: "NVDA", ticker: "NVDA", name: "NVIDIA", sector: "Technology", price: 121.6, shares: 2_400, targetPct: 8 },
  { id: "ASML", ticker: "ASML", name: "ASML Holding", sector: "Technology", price: 742.5, shares: 210, targetPct: 5 },
  { id: "JPM", ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", price: 214.9, shares: 900, targetPct: 9 },
  { id: "BRK", ticker: "BRK.B", name: "Berkshire Hathaway", sector: "Financials", price: 462.1, shares: 320, targetPct: 7 },
  { id: "ALV", ticker: "ALV", name: "Allianz", sector: "Financials", price: 297.3, shares: 410, targetPct: 5 },
  { id: "UNH", ticker: "UNH", name: "UnitedHealth", sector: "Health care", price: 588.7, shares: 260, targetPct: 8 },
  { id: "NOVO", ticker: "NOVO.B", name: "Novo Nordisk", sector: "Health care", price: 108.4, shares: 1_600, targetPct: 7 },
  { id: "ROG", ticker: "ROG", name: "Roche", sector: "Health care", price: 271, shares: 380, targetPct: 5 },
  { id: "XOM", ticker: "XOM", name: "Exxon Mobil", sector: "Energy", price: 117.8, shares: 1_100, targetPct: 8 },
  { id: "EQNR", ticker: "EQNR", name: "Equinor", sector: "Energy", price: 26.4, shares: 4_200, targetPct: 6 },
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const pct = (value: number) => `${value.toFixed(1)}%`;

const signedPct = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;

/**
 * Drift reads as a temperature: teal over target, red under, transparent at
 * rest. Mixing a mid Mantine shade into transparency keeps it legible in both
 * colour schemes.
 */
function driftTint(drift: number) {
  const strength = Math.min(Math.abs(drift) / 4, 1) * 26;

  if (strength < 1) return "transparent";

  const shade = drift > 0 ? "--mantine-color-teal-6" : "--mantine-color-red-6";

  return `color-mix(in srgb, var(${shade}) ${strength.toFixed(0)}%, transparent)`;
}

/** Module scope: a component identity that survives every render of the grid. */
function DriftPill({ drift }: { drift: number }) {
  return (
    <Text
      component="span"
      size="sm"
      fw={500}
      style={{
        background: driftTint(drift),
        borderRadius: "var(--mantine-radius-sm)",
        display: "inline-block",
        minWidth: 62,
        padding: "2px 8px",
        textAlign: "right",
      }}
    >
      {signedPct(drift)}
    </Text>
  );
}

const columnHelper = createTMDataGridColumnHelper<Position>();

const columns = columnHelper.columns([
  columnHelper.accessor("ticker", {
    header: "Ticker",
    minSize: 84,
    footer: () => (
      <Text fw={600} size="xs">
        Portfolio
      </Text>
    ),
  }),
  columnHelper.accessor("name", {
    header: "Holding",
    minSize: 150,
    meta: { flex: 2 },
  }),
  columnHelper.accessor("sector", {
    header: "Sector",
    minSize: 130,
    meta: { type: "select", options: SECTORS },
  }),
  columnHelper.accessor("price", {
    header: "Price",
    minSize: 96,
    meta: { type: "number", align: "right" },
    cell: (info) => money.format(info.getValue()),
  }),
  columnHelper.accessor("shares", {
    header: "Shares",
    minSize: 96,
    aggregationFn: "sum",
    meta: { type: "number", align: "right" },
    cell: (info) => info.getValue().toLocaleString("en-US"),
  }),
  columnHelper.accessor("marketValue", {
    header: "Market value",
    minSize: 116,
    aggregationFn: "sum",
    meta: { type: "number", align: "right" },
    cell: (info) => money.format(info.getValue()),
    aggregatedCell: (info) => (
      <Text fw={600} size="sm">
        {money.format(Number(info.getValue()))}
      </Text>
    ),
    footer: ({ table }) => (
      <Text fw={600} size="xs">
        {money.format(Number(aggregateColumn({ table, columnId: "marketValue" })))}
      </Text>
    ),
  }),
  columnHelper.accessor("currentPct", {
    header: "Current",
    minSize: 86,
    aggregationFn: "sum",
    meta: { type: "number", align: "right" },
    cell: (info) => pct(info.getValue()),
    aggregatedCell: (info) => (
      <Text fw={600} size="sm">
        {pct(Number(info.getValue()))}
      </Text>
    ),
    footer: ({ table }) => (
      <Text fw={600} size="xs">
        {pct(Number(aggregateColumn({ table, columnId: "currentPct" })))}
      </Text>
    ),
  }),
  columnHelper.accessor("targetPct", {
    header: "Target",
    minSize: 94,
    size: 94,
    aggregationFn: "sum",
    meta: {
      type: "number",
      align: "right",
      edit: {
        validate: ({ value }: { value: number | null }) =>
          value == null
            ? "Enter a percentage"
            : value < 0 || value > 100
              ? "Between 0 and 100"
              : undefined,
      },
    },
    cell: (info) => (
      <Text size="sm" fw={500}>
        {pct(info.getValue())}
      </Text>
    ),
    aggregatedCell: (info) => (
      <Text fw={600} size="sm">
        {pct(Number(info.getValue()))}
      </Text>
    ),
    footer: ({ table }) => {
      const total = Number(aggregateColumn({ table, columnId: "targetPct" }));

      return (
        <Text
          fw={600}
          size="xs"
          c={Math.abs(total - 100) < 0.05 ? undefined : "orange"}
        >
          {pct(total)}
        </Text>
      );
    },
  }),
  columnHelper.accessor("drift", {
    header: "Drift",
    minSize: 96,
    size: 96,
    aggregationFn: "sum",
    meta: { type: "number", align: "right" },
    cell: (info) => <DriftPill drift={info.getValue()} />,
    aggregatedCell: (info) => <DriftPill drift={Number(info.getValue())} />,
  }),
  columnHelper.accessor("tradeShares", {
    header: "Trade",
    minSize: 112,
    size: 112,
    enableGrouping: false,
    meta: { type: "number", align: "right" },
    cell: (info) => {
      const shares = info.getValue();

      if (shares === 0) {
        return (
          <Text size="sm" c="dimmed">
            Hold
          </Text>
        );
      }

      return (
        <Badge size="sm" variant="light" radius="sm" color={shares > 0 ? "teal" : "red"}>
          {shares > 0 ? "Buy" : "Sell"} {Math.abs(shares).toLocaleString("en-US")}
        </Badge>
      );
    },
  }),
]);

export function PortfolioRebalancer() {
  const [holdings, setHoldings] = useState(INITIAL_HOLDINGS);

  const positions = useMemo<Position[]>(() => {
    const valued = holdings.map((holding) => ({
      ...holding,
      marketValue: holding.price * holding.shares,
    }));

    const total = valued.reduce((sum, holding) => sum + holding.marketValue, 0);

    return valued.map((holding) => {
      const currentPct = (holding.marketValue / total) * 100;
      const drift = holding.targetPct - currentPct;

      return {
        ...holding,
        currentPct,
        drift,
        tradeShares: Math.round(((drift / 100) * total) / holding.price),
      };
    });
  }, [holdings]);

  const allocated = positions.reduce((sum, position) => sum + position.targetPct, 0);

  const turnover = positions.reduce(
    (sum, position) => sum + Math.abs(position.tradeShares) * position.price,
    0,
  );

  const grid = useTMDataGrid({
    data: positions,
    columns,
    getRowId: (row) => row.id,
    initialState: {
      grouping: ["sector"],
      expanded: true,
      sorting: [{ id: "drift", desc: false }],
      // Market data the desk can bring back from the column manager; the
      // decision columns get the width.
      columnVisibility: { price: false, shares: false, name: false },
      // The decision columns stay on screen while the identity columns scroll.
      columnPinning: { start: [], end: ["targetPct", "drift", "tradeShares"] },
    },
    editing: {
      mode: "cell",
      // Only the target weight is a decision; everything else is market data.
      columns: ["targetPct"],
      onCommit: ({ rowId, value }) =>
        setHoldings((previous) =>
          previous.map((holding) =>
            holding.id === rowId
              ? { ...holding, targetPct: value.targetPct }
              : holding,
          ),
        ),
      // `rows` already carries the committing row's drafted value, so this is
      // the total the book would hold if the edit landed.
      tableValidators: {
        onSubmit: ({ rows }) => {
          const total = rows.reduce(
            (sum, entry) => sum + Number(entry.value.targetPct ?? 0),
            0,
          );

          return total > 100.005
            ? {
                fields: {
                  targetPct: `Targets would total ${pct(total)} - the book only holds 100%`,
                },
              }
            : undefined;
        },
      },
    },
  });

  const zeroSelected = async () => {
    for (const row of grid.table.getSelectedRowModel().rows) {
      await grid.edit.setCellValue(row.id, "targetPct", 0);
    }
  };

  return (
    <TMDataGrid {...grid} size="sm" style={{ height: 560 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <Button size="xs" variant="default" onClick={() => void zeroSelected()}>
          Zero selected targets
        </Button>
        <TMDataGrid.Spacer />
        <Text size="xs" c={Math.abs(allocated - 100) < 0.05 ? "dimmed" : "orange"}>
          {allocated > 100
            ? `Over-allocated by ${pct(allocated - 100)}`
            : `Unallocated ${pct(100 - allocated)}`}
        </Text>
        <Text size="xs" c="dimmed">
          Turnover {money.format(turnover)}
        </Text>
        <TMDataGrid.FilterButton />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Position>
        rowStyle={(row) =>
          // A group row's `original` is an arbitrary child's record, so drift
          // read off it would tint the sector by whichever holding sorted first.
          !row.getIsGrouped() && Math.abs(row.original.drift) >= 3
            ? {
                "--row-bg":
                  "color-mix(in srgb, var(--mantine-color-yellow-6) 10%, transparent)",
              }
            : undefined
        }
      />
    </TMDataGrid>
  );
}
