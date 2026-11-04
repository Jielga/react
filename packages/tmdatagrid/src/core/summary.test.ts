import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MantineWrapper } from "../../test/gridHarness";
import { aggregateColumn } from "./summary";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridRowData,
  type UseTMDataGridOptions,
} from "../index";

/**
 * Which rows a summary total covers. The aggregation itself is TanStack's, so
 * what is tested here is the row model the grid hands it: every record once,
 * whatever shape the data has - flat, a tree under `getSubRows`, or grouped.
 *
 * The filter half of the contract is tested through the rendered summary row,
 * in TMDataGrid.test.tsx.
 */
type Account = {
  id: string;
  owner: string;
  amount: number;
  children?: Array<Account>;
};

const helper = createTMDataGridColumnHelper<Account>();

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
const columns = helper.columns([
  helper.accessor("owner", { header: "Owner" }),
  helper.accessor("amount", { header: "Amount", meta: { type: "number" } }),
]);

/** Two roots with children, and an amount on every level - 1113 in all. */
const tree: Array<Account> = [
  {
    id: "a",
    owner: "Anna",
    amount: 1,
    children: [
      { id: "a1", owner: "Anna", amount: 10 },
      { id: "a2", owner: "Anna", amount: 100 },
    ],
  },
  {
    id: "b",
    owner: "Erik",
    amount: 2,
    children: [{ id: "b1", owner: "Erik", amount: 1000 }],
  },
];

/** Two owners over three rows - 12 in all. */
const flat: Array<Account> = [
  { id: "x", owner: "Anna", amount: 3 },
  { id: "y", owner: "Anna", amount: 4 },
  { id: "z", owner: "Erik", amount: 5 },
];

function renderSummaryGrid(options: Partial<UseTMDataGridOptions<Account>>) {
  const { result } = renderHook(
    () =>
      useTMDataGrid<Account>({
        columns,
        getRowId: (row) => row.id,
        ...options,
      } as UseTMDataGridOptions<Account>),
    { wrapper: MantineWrapper },
  );
  return result;
}

const total = (api: TMDataGridApi<Account>) =>
  aggregateColumn({ table: api.table, columnId: "amount" });

describe("aggregateColumn", () => {
  it("totals every row of flat data", () => {
    const grid = renderSummaryGrid({ data: flat });

    expect(total(grid.current)).toBe(12);
  });

  it("totals a tree's children as well as its roots", () => {
    const grid = renderSummaryGrid({
      data: tree,
      getSubRows: (row) => row.children,
    });

    // The filtered model nests, so the top-level array holds the two roots
    // alone and every child would go missing from the total.
    expect(total(grid.current)).toBe(1113);
  });

  it("counts each record once while the grid is grouped", () => {
    const grid = renderSummaryGrid({ data: flat });
    const table = grid.current
      .table as unknown as TMDataGridApi<TMDataGridRowData>["table"];

    act(() => {
      table.setGrouping(["owner"]);
    });

    // Group rows are built from the filtered model rather than held in it, so
    // grouping adds no subtotals for the sum to count a second time.
    expect(total(grid.current)).toBe(12);
  });
});
