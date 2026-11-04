import { useCallback, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridSaveDraftsArgs,
} from "@jielga/tmdatagrid";

type BudgetLine = {
  id: number;
  team: string;
  code: string;
  share: number;
};

const START: Array<BudgetLine> = [
  { id: 1, team: "Platform", code: "PLT", share: 40 },
  { id: 2, team: "Payments", code: "PAY", share: 30 },
  { id: 3, team: "Search", code: "SRC", share: 20 },
  { id: 4, team: "Growth", code: "GRW", share: 10 },
];

const columnHelper = createTMDataGridColumnHelper<BudgetLine>();

const columns = columnHelper.columns([
  columnHelper.accessor("team", { header: "Team", minSize: 140 }),
  columnHelper.accessor("code", { header: "Code", minSize: 110 }),
  columnHelper.accessor("share", {
    header: "Share %",
    minSize: 110,
    meta: { type: "number", align: "right" },
  }),
]);

export function TableValidation() {
  const [lines, setLines] = useState(START);

  const onSaveDrafts = useCallback(
    ({ updated }: TMDataGridSaveDraftsArgs<BudgetLine>) => {
      setLines((previous) =>
        previous.map(
          (line) =>
            updated.find((row) => row.rowId === String(line.id))?.value ??
            line,
        ),
      );
    },
    [],
  );

  const grid = useTMDataGrid({
    data: lines,
    columns,
    getRowId: (row) => String(row.id),
    editing: {
      mode: "cell",
      draft: true,
      columns: ["code", "share"],
      onSaveDrafts,
      // Both rules need the other rows, which is what `rows` carries: the
      // collection with every draft overlaid, so a clash with a pending
      // edit is caught before either is saved.
      tableValidators: {
        onSubmit: ({ value, rowId, rows }) => {
          if (
            rows.some(
              (other) =>
                other.rowId !== rowId && other.value.code === value.code,
            )
          ) {
            return { fields: { code: "Codes must be unique" } };
          }
          const total = rows.reduce((sum, other) => sum + other.value.share, 0);
          return total > 100
            ? { fields: { share: `The book totals ${total}%` } }
            : undefined;
        },
      },
    },
    selectionMode: "highlight",
    enableGrouping: false,
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.DraftActions />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<BudgetLine> />
    </TMDataGrid>
  );
}
