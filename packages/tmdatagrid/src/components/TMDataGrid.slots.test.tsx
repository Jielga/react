import { Button, Menu } from "@mantine/core";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  bodyRows,
  countScrolls,
  makeRows,
  openColumnMenu,
  part,
  queryPart,
  renderedRowIds,
  renderGridUi,
  renderWithMantine,
  testColumns,
  type TestRow,
} from "../../test/gridHarness";
import {
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridScrollToRowArgs,
  type UseTMDataGridOptions,
} from "../index";
import { TMDataGrid } from "./TMDataGrid";
import type { TMDataGridDraftActionsSlotArgs } from "./TMDataGridDraftActions";

/**
 * The P2 render slots: the two chrome slots that hand over
 * `{ state, actions, Controls }`, and the two menu slots that hand back the
 * grid's own items.
 *
 * What is worth pinning here is the seam, not the chrome behind it: that a
 * `Controls` member is the built-in control rather than a lookalike, and that
 * the handback decides composition rather than the grid guessing.
 */

describe("renderPagination", () => {
  const paged = {
    enablePagination: true,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  };

  it("hands over the state, the actions and the built-in controls", () => {
    const seen: Array<string> = [];

    renderGridUi({
      ...paged,
      footerProps: {
        renderPagination: ({ state, actions, Controls }) => {
          seen.push(
            `${state.pageIndex}/${state.pageCount}:${state.rowCount}:${state.from}-${state.to}`,
          );
          return (
            <>
              <Controls.PageSize />
              <Button onClick={() => actions.nextPage()}>Forward</Button>
            </>
          );
        },
      },
    });

    expect(seen[0]).toBe("0/3:12:1-5");
    // The built-in select, not a rebuilt one - same part, same options.
    expect(part("page-size")).toBeInTheDocument();
    // The built-in pager was not asked for, so it is not there.
    expect(queryPart("page-next")).not.toBeInTheDocument();
  });

  it("pages the grid through the actions it was handed", async () => {
    const user = userEvent.setup();

    renderGridUi({
      ...paged,
      footerProps: {
        renderPagination: ({ actions }) => (
          <Button onClick={() => actions.nextPage()}>Forward</Button>
        ),
      },
    });

    expect(renderedRowIds()).toEqual(["1", "2", "3", "4", "5"]);
    await user.click(screen.getByRole("button", { name: "Forward" }));
    expect(renderedRowIds()).toEqual(["6", "7", "8", "9", "10"]);
  });

  it("keeps the built-in pager working when it is the part reused", async () => {
    const user = userEvent.setup();

    renderGridUi({
      ...paged,
      footerProps: {
        renderPagination: ({ Controls }) => (
          <>
            <span>Custom label</span>
            <Controls.Pager />
          </>
        ),
      },
    });

    expect(screen.getByText("Custom label")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(renderedRowIds()).toEqual(["6", "7", "8", "9", "10"]);
  });

  it("renders the page number where the layout asks for it", async () => {
    const user = userEvent.setup();

    renderGridUi({
      ...paged,
      footerProps: {
        renderPagination: ({ Controls }) => (
          <>
            <Controls.PageNumber />
            <Controls.Pager />
          </>
        ),
      },
    });

    // Not in the default footer, so the range label is not here either.
    expect(queryPart("page-range")).not.toBeInTheDocument();
    expect(part("page-number")).toHaveTextContent("Page 1 of 3");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(part("page-number")).toHaveTextContent("Page 2 of 3");
  });

  it("reports paging as suspended while a grouping is active", () => {
    const seen: Array<boolean> = [];

    renderGridUi({
      ...paged,
      initialState: {
        pagination: { pageIndex: 0, pageSize: 5 },
        grouping: ["name"],
      },
      footerProps: {
        renderPagination: ({ state }) => {
          seen.push(state.isPagingActive);
          return <span>Pager</span>;
        },
      },
    });

    expect(seen[0]).toBe(false);
  });
});

describe("renderColumnMenuItems", () => {
  it("hands back the items the grid would have rendered", async () => {
    const user = userEvent.setup();
    const seen: Array<number> = [];

    renderGridUi({
      tableProps: {
        renderColumnMenuItems: ({ column, internalItems }) => {
          seen.push(internalItems.length);
          return [
            ...internalItems,
            <Menu.Item key="stats">Stats for {column.id}</Menu.Item>,
          ];
        },
      },
    });

    await openColumnMenu(user, "Name");

    expect(seen[0]).toBeGreaterThan(0);
    // The built-ins survive alongside the addition.
    expect(
      screen.getByRole("menuitem", { name: "Sort ascending" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Stats for name" }),
    ).toBeInTheDocument();
  });

  it("replaces the menu when the built-ins are dropped", async () => {
    const user = userEvent.setup();

    renderGridUi({
      tableProps: {
        renderColumnMenuItems: () => [<Menu.Item key="only">Only mine</Menu.Item>],
      },
    });

    await openColumnMenu(user, "Name");

    expect(
      screen.getByRole("menuitem", { name: "Only mine" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Sort ascending" }),
    ).not.toBeInTheDocument();
  });

  it("leaves no menu button at all when it returns nothing", () => {
    renderGridUi({ tableProps: { renderColumnMenuItems: () => [] } });

    expect(
      screen.queryByRole("button", { name: "Name column menu" }),
    ).not.toBeInTheDocument();
  });

  it("is given the column it is opening", async () => {
    const user = userEvent.setup();
    const columns: Array<string> = [];

    renderGridUi({
      tableProps: {
        renderColumnMenuItems: ({ column, internalItems }) => {
          columns.push(column.id);
          return internalItems;
        },
      },
    });

    await openColumnMenu(user, "Name");

    expect(columns).toContain("name");
  });
});

describe("renderRowContextMenu", () => {
  /** Right-clicks the Name cell of a row. Cell 0 is the checkbox column. */
  const contextClickName = (rowIndex: number) =>
    // `gridcell`, not `cell`: cell selection flips the roles - see the
    // Testing docs page.
    fireEvent.contextMenu(
      within(bodyRows()[rowIndex]).getAllByRole("gridcell")[2],
    );

  const ranged = { cellSelection: "range" as const };

  it("keeps the grid's items above its own when internalItems is untouched", async () => {
    renderGridUi({
      ...ranged,
      tableProps: {
        renderRowContextMenu: () => <Menu.Item>Mine</Menu.Item>,
      },
    });

    contextClickName(0);

    // Both halves, the grid's first - today's zero-config behavior.
    expect(await screen.findByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Mine" })).toBeInTheDocument();
  });

  it("hands the composition over once internalItems is read", async () => {
    renderGridUi({
      ...ranged,
      tableProps: {
        // Read but deliberately not rendered: taking the handback means
        // owning the whole menu, dropping the grid's half included.
        renderRowContextMenu: ({ internalItems }) => {
          void internalItems;
          return <Menu.Item>Mine only</Menu.Item>;
        },
      },
    });

    contextClickName(0);

    expect(
      await screen.findByRole("menuitem", { name: "Mine only" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Copy" }),
    ).not.toBeInTheDocument();
  });

  it("renders the grid's items where they are placed", async () => {
    renderGridUi({
      ...ranged,
      tableProps: {
        renderRowContextMenu: ({ internalItems }) => (
          <>
            <Menu.Item>First mine</Menu.Item>
            {internalItems}
          </>
        ),
      },
    });

    contextClickName(0);

    const items = await screen.findAllByRole("menuitem");
    expect(items[0]).toHaveTextContent("First mine");
    expect(items.map((item) => item.textContent)).toContain("Copy");
  });
});

describe("DraftActions renderActions", () => {
  // The chrome is the draft store's, so the store is what turns it on.
  const editable = {
    editing: { mode: "cell" as const, draft: true as const, onCommit: vi.fn() },
  };

  it("hands over the draft count and the built-in buttons", () => {
    const seen: Array<number> = [];

    renderGridUi({
      ...editable,
      draftActionsProps: {
        renderActions: ({ state, Controls }) => {
          seen.push(state.draftCount);
          return (
            <>
              <span>Pending: {state.draftCount}</span>
              <Controls.Save />
            </>
          );
        },
      },
    });

    expect(seen[0]).toBe(0);
    expect(screen.getByText("Pending: 0")).toBeInTheDocument();
    // The built-in Save, by its part - and disabled, with nothing pending.
    expect(part("save-all")).toBeDisabled();
    expect(queryPart("discard-all")).not.toBeInTheDocument();
  });

  it("renders nothing at all while editing is off", () => {
    renderGridUi({
      draftActionsProps: { renderActions: () => <span>Should not render</span> },
    });

    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
  });

  it("renders under a non-draft grid too - inclusion is the consumer's call", () => {
    renderGridUi({
      editing: { mode: "cell" as const, onCommit: vi.fn() },
      draftActionsProps: { renderActions: () => <span>Custom chrome</span> },
    });

    expect(screen.getByText("Custom chrome")).toBeInTheDocument();
  });
});

describe("DraftActions and the rows left open", () => {
  const manyRows = makeRows(500);

  /**
   * A draft grid whose chrome is the slot itself: the test drives the engine
   * through `api` and reads back whatever `renderActions` was last handed.
   */
  function DraftSlotGrid({
    onReady,
    onArgs,
    ...options
  }: Partial<UseTMDataGridOptions<TestRow>> & {
    onReady: (api: TMDataGridApi<TestRow>) => void;
    onArgs: (args: TMDataGridDraftActionsSlotArgs) => void;
  }) {
    const grid = useTMDataGrid<TestRow>({
      data: manyRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      editing: { mode: "row", draft: true },
      ...options,
    } as UseTMDataGridOptions<TestRow>);
    onReady(grid);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.DraftActions
            renderActions={(args) => {
              onArgs(args);
              return null;
            }}
          />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  function renderDraftSlotGrid(
    options: Partial<UseTMDataGridOptions<TestRow>> = {},
  ) {
    let api: TMDataGridApi<TestRow> | null = null;
    let args: TMDataGridDraftActionsSlotArgs | null = null;
    renderWithMantine(
      <DraftSlotGrid
        {...options}
        onReady={(next) => (api = next)}
        onArgs={(next) => (args = next)}
      />,
    );
    if (api === null || args === null) throw new Error("grid never rendered");
    return {
      api: api as TMDataGridApi<TestRow>,
      /** The latest slot args, re-read so a stale render is never asserted on. */
      slot: () => args as TMDataGridDraftActionsSlotArgs,
    };
  }

  /** Opens a row and types into it, which is what makes it count as open. */
  const openRow = (api: TMDataGridApi<TestRow>, rowId: string) => {
    act(() => {
      api.edit.begin({ rowId, columnId: "name" });
      api.edit.getForm(rowId)?.setFieldValue("name", `Edited ${rowId}`);
    });
  };

  /**
   * Which row the scroll was asked for, with the body's own scroller stood
   * down. `countScrolls` answers whether anything scrolled; this answers what
   * it aimed at, which no scroll offset can say under jsdom.
   */
  function scrollTargets(
    api: TMDataGridApi<TestRow>,
    run: () => void,
  ): Array<TMDataGridScrollToRowArgs> {
    const seen: Array<TMDataGridScrollToRowArgs> = [];
    const original = api.scrollerRef.current;
    api.scrollerRef.current = (args) => {
      seen.push(args);
      return true;
    };
    try {
      act(run);
    } finally {
      api.scrollerRef.current = original;
    }
    return seen;
  }

  it("hands over the ids behind the count, in the order the rows were opened", () => {
    const { api, slot } = renderDraftSlotGrid();

    expect(slot().state.openRowIds).toEqual([]);

    openRow(api, "8");
    openRow(api, "3");

    expect(slot().state.openRowIds).toEqual(["8", "3"]);
    expect(slot().state.openCount).toBe(2);
  });

  it("scrolls to the first open row in display order, not the first opened", () => {
    const { api, slot } = renderDraftSlotGrid();

    openRow(api, "3");
    openRow(api, "8");
    act(() => {
      api.table.setSorting([{ id: "id", desc: true }]);
    });

    // `openRowIds` still reads ["3", "8"] - the engine's order never moves.
    // On screen row 8 is now above row 3, and that is what "first" means.
    expect(slot().state.openRowIds).toEqual(["3", "8"]);
    expect(
      scrollTargets(api, () => {
        expect(slot().actions.scrollToFirstOpenRow("center")).toBe(true);
      }),
    ).toEqual([{ rowId: "8", align: "center" }]);
  });

  it("skips an open row the current view does not hold", () => {
    const { api, slot } = renderDraftSlotGrid();

    openRow(api, "8");
    openRow(api, "3");
    act(() => {
      // Row 8 is Göteborg and row 3 is Malmö, so only row 3 survives.
      api.table.setGlobalFilter("Malmö");
    });

    expect(
      scrollTargets(api, () => {
        expect(slot().actions.scrollToFirstOpenRow()).toBe(true);
      }),
    ).toEqual([{ rowId: "3", align: undefined }]);
  });

  it("answers false, and scrolls nothing, with no row open", () => {
    const { slot } = renderDraftSlotGrid();

    let answer: boolean | null = null;
    expect(
      countScrolls(() => {
        answer = slot().actions.scrollToFirstOpenRow();
      }),
    ).toBe(0);
    expect(answer).toBe(false);
  });

  it("answers false when every open row is filtered away", () => {
    const { api, slot } = renderDraftSlotGrid();

    openRow(api, "3");
    act(() => {
      api.table.setGlobalFilter("Göteborg");
    });

    let answer: boolean | null = null;
    expect(
      countScrolls(() => {
        answer = slot().actions.scrollToFirstOpenRow();
      }),
    ).toBe(0);
    expect(answer).toBe(false);
  });

  it("answers true for a pinned open row without scrolling it", () => {
    const { api, slot } = renderDraftSlotGrid({ enableRowPinning: true });

    openRow(api, "300");
    act(() => {
      api.table.setRowPinning({ top: ["300"], bottom: [] });
    });

    // Parked at the edge, and out of the scrolling order - already on screen.
    let answer: boolean | null = null;
    expect(
      countScrolls(() => {
        answer = slot().actions.scrollToFirstOpenRow();
      }),
    ).toBe(0);
    expect(answer).toBe(true);
  });

  it("hands `scrollToRow` straight through", () => {
    const { slot } = renderDraftSlotGrid();

    // The point of the passthrough: row 400 is real and has no element.
    expect(queryPart("row", { rowId: "400" })).toBeNull();

    let answer: boolean | null = null;
    expect(
      countScrolls(() => {
        answer = slot().actions.scrollToRow({ rowId: "400" });
      }),
    ).toBe(1);
    expect(answer).toBe(true);

    expect(
      countScrolls(() => {
        answer = slot().actions.scrollToRow({ rowId: "9999" });
      }),
    ).toBe(0);
    expect(answer).toBe(false);
  });
});
