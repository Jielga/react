import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  erased,
  MantineWrapper,
  renderGrid,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { useTMDataGrid } from "../useTMDataGrid";
import { readPinnedRows } from "./rowPinning";

/**
 * `readPinnedRows` exists for the cases TanStack's own `getTopRows()` throws
 * on: pinned ids outliving their data. Every test here is one of the ways an
 * id goes stale or a row leaves the body while its pin should hold.
 */

/** A grid whose `data` prop can be swapped, the way a refetch would. */
function renderPinnableGrid() {
  return renderHook(
    ({ data }: { data: Array<TestRow> }) =>
      useTMDataGrid<TestRow>({
        data,
        columns: testColumns,
        getRowId: (row) => String(row.id),
        enableRowPinning: true,
      }),
    { wrapper: MantineWrapper, initialProps: { data: testRows } },
  );
}

const pinnedIds = (
  api: ReturnType<typeof erased>,
  position: "top" | "bottom",
) => readPinnedRows(api.table, position).map((row) => row.id);

describe("readPinnedRows", () => {
  it("resolves each edge in pin order, not row order", () => {
    const api = erased(renderGrid({ enableRowPinning: true }).result.current);

    act(() => {
      api.table.getRow("7").pin("top");
      api.table.getRow("2").pin("top");
      api.table.getRow("4").pin("bottom");
    });

    expect(pinnedIds(api, "top")).toEqual(["7", "2"]);
    expect(pinnedIds(api, "bottom")).toEqual(["4"]);
  });

  it("skips an id whose data is gone instead of throwing", () => {
    const { result, rerender } = renderPinnableGrid();
    act(() => {
      result.current.table.getRow("2").pin("top");
    });

    // A refetch comes back without row 2.
    rerender({ data: testRows.filter((row) => row.id !== 2) });
    const api = erased(result.current);

    expect(pinnedIds(api, "top")).toEqual([]);
    // The id stays in state, harmless, rather than being cleaned up.
    expect(api.table.store.state.rowPinning.top).toEqual(["2"]);
  });

  it("returns the row to its edge when its data comes back", () => {
    const { result, rerender } = renderPinnableGrid();
    act(() => {
      result.current.table.getRow("2").pin("top");
    });

    rerender({ data: testRows.filter((row) => row.id !== 2) });
    rerender({ data: testRows });

    expect(pinnedIds(erased(result.current), "top")).toEqual(["2"]);
  });

  it("keeps a row at its edge when a filter drops it from the body", () => {
    const api = erased(renderGrid({ enableRowPinning: true }).result.current);

    act(() => {
      api.table.getRow("2").pin("top"); // Erik
      api.table.setGlobalFilter("Anna");
    });

    // The body shrank to the matches, the pinned row is not one of them -
    // `keepPinnedRows` semantics say it stays at its edge regardless.
    expect(api.table.getPrePaginatedRowModel().rowsById["2"]).toBeUndefined();
    expect(pinnedIds(api, "top")).toEqual(["2"]);
  });

  it("hides a pinned leaf while its group is collapsed, as the body does", () => {
    const api = erased(renderGrid({ enableRowPinning: true }).result.current);

    act(() => {
      api.table.getRow("1").pin("top");
      api.table.setGrouping(["city"]);
    });
    // Grouping collapses everything; the leaf's parent group is closed.
    expect(pinnedIds(api, "top")).toEqual([]);

    act(() => {
      api.table.toggleAllRowsExpanded(true);
    });
    expect(pinnedIds(api, "top")).toEqual(["1"]);
  });
});
