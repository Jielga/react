import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  MantineWrapper,
  renderGrid,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { TMDataGrid } from "../components/TMDataGrid";
import { autosizeColumn, measureColumnContentWidth } from "./autosize";
import { useTMDataGrid, type TMDataGridApi } from "../useTMDataGrid";

/**
 * jsdom lays nothing out, so `scrollWidth` is always 0 there. The tests stub
 * it to a deterministic proxy (text length × a chosen px width), which is
 * enough to prove the measurement is read, clamped and written. The width is
 * per test: wide enough to clear the column's `minSize` when the measurement
 * itself is under test, narrow when the clamp is.
 */
function stubScrollWidth(pxPerChar: number) {
  Object.defineProperty(window.Element.prototype, "scrollWidth", {
    configurable: true,
    get(this: Element) {
      return (this.textContent ?? "").length * pxPerChar;
    },
  });
}

function restoreScrollWidth() {
  delete (window.Element.prototype as { scrollWidth?: unknown }).scrollWidth;
}

afterEach(restoreScrollWidth);

function renderTable(grid: ReturnType<typeof renderGrid>["result"]) {
  return render(
    <TMDataGrid {...grid.current}>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>,
    { wrapper: MantineWrapper },
  );
}

describe("autosizeColumn", () => {
  it("writes the measured width of the widest mounted content", () => {
    // 16px/char puts "Stockholm" well past the column's 120px minSize, so
    // the measurement itself has to carry the result - a broken measurement
    // could not hide behind the clamp.
    stubScrollWidth(16);
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const scroller = container.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    );
    expect(scroller).not.toBeNull();

    const applied = autosizeColumn({
      table: result.current.table,
      columnId: "city",
      container: scroller as HTMLElement,
    });

    expect(applied).toBe(true);
    const measured = measureColumnContentWidth({
      container: scroller as HTMLElement,
      columnId: "city",
    });
    expect(measured).toBeGreaterThan(120);
    expect(result.current.table.store.state.columnSizing["city"]).toBe(
      Math.round(measured),
    );
  });

  it("floors at the column's minSize when the content measures narrower", () => {
    // At 8px/char every city value and the header land under 120px.
    stubScrollWidth(8);
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const scroller = container.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    ) as HTMLElement;

    autosizeColumn({
      table: result.current.table,
      columnId: "city",
      container: scroller,
    });

    expect(result.current.table.store.state.columnSizing["city"]).toBe(120);
  });

  it("caps at the column's maxSize when the content measures wider", () => {
    stubScrollWidth(16);
    const { result } = renderGrid({
      columns: [
        { accessorKey: "city", header: "City", minSize: 80, maxSize: 100 },
      ],
    } as never);
    const { container } = renderTable(result);
    const scroller = container.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    ) as HTMLElement;

    autosizeColumn({
      table: result.current.table,
      columnId: "city",
      container: scroller,
    });

    expect(result.current.table.store.state.columnSizing["city"]).toBe(100);
  });

  it("is a no-op for a column that cannot be resized", () => {
    stubScrollWidth(8);
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const scroller = container.querySelector<HTMLElement>(
      "[data-dg-scroll-container]",
    ) as HTMLElement;

    // The generated checkbox lane declares enableResizing: false.
    const applied = autosizeColumn({
      table: result.current.table,
      columnId: "__select__",
      container: scroller,
    });

    expect(applied).toBe(false);
    expect(
      result.current.table.store.state.columnSizing["__select__"],
    ).toBeUndefined();
  });

  it("returns false with nothing mounted to measure", () => {
    const { result } = renderGrid();
    const detached = document.createElement("div");

    expect(
      autosizeColumn({
        table: result.current.table,
        columnId: "city",
        container: detached,
      }),
    ).toBe(false);
  });
});

describe("meta.autoSize", () => {
  /**
   * The one thing this has to prove: the width comes from the data, not from
   * the header. The virtualizer mounts its first rows a render after the grid
   * does, so a pass that ran on the mounting commit alone would see the title
   * and nothing else - "City" is narrower than "Stockholm", and narrower than
   * the column's own minSize, so a header-only measurement is visible as the
   * floor rather than as the content width.
   */
  const autoSizedColumns = [
    { accessorKey: "city", header: "City", minSize: 120, meta: { autoSize: true } },
  ];

  it("fits the column to its mounted content once the rows arrive", async () => {
    stubScrollWidth(16);
    const { result } = renderGrid({ columns: autoSizedColumns } as never);
    renderTable(result);

    await waitFor(() =>
      expect(
        result.current.table.store.state.columnSizing["city"],
      ).toBeGreaterThan(120),
    );
  });

  it("fits the header when every mounted cell spans", async () => {
    // A spanning cell says nothing about its column's width, so it is left
    // out of the measurement - but it still counts as a mounted row, or the
    // column would wait for ever for a cell it never gets.
    stubScrollWidth(16);
    const spanningColumns = [
      {
        accessorKey: "name",
        header: "Name",
        minSize: 80,
        meta: { autoSize: true, colSpan: 2 },
      },
      { accessorKey: "age", header: "Age" },
    ];
    const { result } = renderGrid({ columns: spanningColumns } as never);
    renderTable(result);

    await waitFor(() =>
      expect(result.current.table.store.state.columnSizing["name"]).toBeDefined(),
    );
    // "Name" at 16px/char plus the header's allowance, well under the
    // "Stockholm"-sized widths the value cells would have given.
    expect(result.current.table.store.state.columnSizing["name"]).toBeLessThan(
      "Stockholm".length * 16,
    );
  });

  it("waits for data that arrives after the mount", async () => {
    // The case the demos never hit: a grid whose rows are fetched. It mounts
    // empty, so the only thing in the DOM to measure is the header - a width
    // that fits the title and nothing else, and used to be the one the column
    // kept for good.
    stubScrollWidth(16);

    function AsyncGrid({ rows }: { rows: Array<TestRow> }) {
      const grid = useTMDataGrid<TestRow>({
        data: rows,
        columns: autoSizedColumns as never,
        getRowId: (row) => String(row.id),
      });
      apiRef = grid;
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }
    let apiRef: TMDataGridApi<TestRow> | null = null;

    const empty: Array<TestRow> = [];
    const { rerender } = render(<AsyncGrid rows={empty} />, {
      wrapper: MantineWrapper,
    });
    expect(apiRef!.table.store.state.columnSizing["city"]).toBeUndefined();

    rerender(<AsyncGrid rows={testRows} />);

    await waitFor(() =>
      expect(apiRef!.table.store.state.columnSizing["city"]).toBeGreaterThan(
        120,
      ),
    );
  });

  it("leaves a column a persisted width already covers alone", () => {
    stubScrollWidth(16);
    const { result } = renderGrid({
      columns: autoSizedColumns,
      initialState: { columnSizing: { city: 200 } },
    } as never);
    renderTable(result);

    expect(result.current.table.store.state.columnSizing["city"]).toBe(200);
  });
});
