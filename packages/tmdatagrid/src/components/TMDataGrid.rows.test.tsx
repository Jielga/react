import { Menu } from "@mantine/core";
import { useState } from "react";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  bodyRows,
  clickMenuItem,
  erased,
  gridRowCount,
  header,
  openColumnMenu,
  part,
  parts,
  queryPart,
  renderedColumn,
  renderedRowIds,
  renderGrid,
  renderGridUi,
  renderWithMantine,
  testColumns,
  testRows,
  type TestRow,
  visibleColumnIds,
} from "../../test/gridHarness";
import { getColumnCapabilities } from "../core/capabilities";
import { DETAILS_COLUMN_ID } from "./TMDataGridDetailsColumn";
import { EDIT_COLUMN_ID } from "./TMDataGridEditColumn";
import { GROUP_COLUMN_ID } from "./TMDataGridGroupColumn";
import { SELECT_COLUMN_ID } from "./TMDataGridSelectColumn";
import { TMDataGrid } from "./TMDataGrid";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridDetailsArgs,
} from "../useTMDataGrid";

/**
 * Row-level behaviour: pinning, selection, the context menu, the pager,
 * grouping and the details panel. Split from TMDataGrid.test.tsx for worker
 * parallelism; the shared scaffolding lives in the harness.
 */
describe("row pinning", () => {
  // Referentially stable - see the entry-row test's note on data identity.
  const pinTestRows = testRows;

  function PinGrid() {
    const [data, setData] = useState(pinTestRows);
    const grid = useTMDataGrid<TestRow>({
      data,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      enableRowPinning: true,
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.FilterButton />
          <button
            type="button"
            onClick={() => grid.table.getRow("1", true).pin("top")}
          >
            Pin 1 top
          </button>
          <button
            type="button"
            onClick={() => grid.table.getRow("2", true).pin("bottom")}
          >
            Pin 2 bottom
          </button>
          <button
            type="button"
            onClick={() => grid.table.getRow("1", true).pin(false)}
          >
            Unpin 1
          </button>
          <button
            type="button"
            onClick={() => setData((rows) => rows.filter((row) => row.id !== 1))}
          >
            Remove 1
          </button>
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  it("pins a row into the top block and out of the scrolling order", async () => {
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 1 top" }));

    const topBlock = part("pinned-top");
    expect(part("row", { rowId: "1" }, topBlock)).toBeInTheDocument();
    // Exactly once: the centre no longer renders it.
    expect(parts("row", { rowId: "1" })).toHaveLength(1);
  });

  it("pins a row into the bottom block", async () => {
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 2 bottom" }));

    const bottomBlock = part("pinned-bottom");
    expect(part("row", { rowId: "2" }, bottomBlock)).toBeInTheDocument();
  });

  it("unpins back into the body", async () => {
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 1 top" }));
    await user.click(screen.getByRole("button", { name: "Unpin 1" }));

    expect(queryPart("pinned-top")).not.toBeInTheDocument();
    expect(part("row", { rowId: "1" })).toBeInTheDocument();
  });

  it("survives the pinned row's data being deleted", async () => {
    // TanStack's own getTopRows() throws over a stale pinned id; the grid's
    // reader skips it instead - see readPinnedRows.
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 1 top" }));
    await user.click(screen.getByRole("button", { name: "Remove 1" }));

    expect(queryPart("pinned-top")).not.toBeInTheDocument();
    expect(part("row", { rowId: "2" })).toBeInTheDocument();
  });

  it("keeps a pinned row at its edge when the filters drop it", async () => {
    const user = userEvent.setup();
    renderWithMantine(<PinGrid />);

    await user.click(screen.getByRole("button", { name: "Pin 1 top" }));
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "999999");

    const topBlock = part("pinned-top");
    expect(part("row", { rowId: "1" }, topBlock)).toBeInTheDocument();
    // The pinned row is content, so the filtered-empty message stays away.
    expect(
      screen.queryByText("No rows match your filters"),
    ).not.toBeInTheDocument();
  });

  it("answers getCanPin per flag, predicate and group row", () => {
    const off = renderGrid({});
    expect(off.result.current.table.getRow("1", true).getCanPin()).toBe(false);

    const predicate = renderGrid({
      enableRowPinning: (row) => row.original.id !== 2,
    });
    expect(
      predicate.result.current.table.getRow("1", true).getCanPin(),
    ).toBe(true);
    expect(
      predicate.result.current.table.getRow("2", true).getCanPin(),
    ).toBe(false);

    const grouped = renderGrid({ enableRowPinning: true });
    act(() => {
      grouped.result.current.table.getColumn("city")?.toggleGrouping();
    });
    const groupRow = grouped.result.current.table
      .getPrePaginatedRowModel()
      .rows.find((row) => row.getIsGrouped());
    expect(groupRow).toBeDefined();
    expect(groupRow?.getCanPin()).toBe(false);
  });
});

describe("row selection", () => {
  it("selects a row from its checkbox", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const [firstRow] = screen.getAllByRole("row").filter((row) =>
      row.hasAttribute("data-row-id"),
    );

    await user.click(within(firstRow).getByRole("checkbox"));

    expect(firstRow).toHaveAttribute("data-selected", "true");
    expect(firstRow).toHaveAttribute("aria-selected", "true");
  });

  it("marks the control lanes, which the stylesheet unpads", () => {
    renderGridUi();
    const [firstRow] = bodyRows();

    // jsdom has no layout, so the clipping this guards against cannot be
    // asserted here: the cell padding grows with `size` and would squeeze the
    // box out of its fixed 36px track at `xl`. The attribute is what the CSS
    // hangs off, so it is what the test pins down.
    expect(header("__select__")).toHaveAttribute(
      "data-control-column",
      "true",
    );
    expect(within(firstRow).getAllByRole("cell")[0]).toHaveAttribute(
      "data-control-column",
      "true",
    );
    expect(within(firstRow).getAllByRole("cell")[1]).not.toHaveAttribute("data-control-column");
  });

  it("drops the checkbox column in row selection mode", () => {
    renderGridUi({ selectionMode: "row" });

    expect(
      screen.queryByRole("checkbox", { name: "Select all rows" }),
    ).not.toBeInTheDocument();
  });

  it("selects on row click in row selection mode", async () => {
    const user = userEvent.setup();
    renderGridUi({ selectionMode: "row" });
    const [firstRow] = screen.getAllByRole("row").filter((row) =>
      row.hasAttribute("data-row-id"),
    );

    await user.click(firstRow);

    expect(firstRow).toHaveAttribute("data-selected", "true");
  });
});

describe("row context menu", () => {
  /** Right-clicks the Name cell of a row. Cell 0 is the checkbox column. */
  const contextClickName = (rowIndex: number) =>
    fireEvent.contextMenu(
      within(bodyRows()[rowIndex]).getAllByRole("cell")[2],
    );

  it("opens the menu for the right-clicked row and cell", async () => {
    const targets: string[] = [];
    renderGridUi({
      tableProps: {
        renderRowContextMenu: ({ row, cell }) => {
          targets.push(`${row.id}:${cell?.column.id ?? "none"}`);
          return <Menu.Item>Open</Menu.Item>;
        },
      },
    });

    contextClickName(1);

    expect(
      await screen.findByRole("menuitem", { name: "Open" }),
    ).toBeInTheDocument();
    // The second row, and the cell the pointer was actually over.
    expect(targets).toContain("2:name");
    expect(bodyRows()[1]).toHaveAttribute("data-context-menu", "true");
  });

  it("closes again when an item is picked", async () => {
    const user = userEvent.setup();
    renderGridUi({
      tableProps: { renderRowContextMenu: () => <Menu.Item>Open</Menu.Item> },
    });

    contextClickName(0);
    await user.click(await screen.findByRole("menuitem", { name: "Open" }));

    expect(
      screen.queryByRole("menuitem", { name: "Open" }),
    ).not.toBeInTheDocument();
    expect(bodyRows()[0]).not.toHaveAttribute("data-context-menu", "true");
  });

  it("leaves a row without a menu when the render prop returns null", async () => {
    renderGridUi({
      tableProps: {
        renderRowContextMenu: ({ row }) =>
          row.id === "1" ? null : <Menu.Item>Open</Menu.Item>,
      },
    });

    contextClickName(0);
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

    contextClickName(1);
    expect(
      await screen.findByRole("menuitem", { name: "Open" }),
    ).toBeInTheDocument();
  });

  it("opens the menu for a pinned row", async () => {
    // Pinned rows leave the scrolling order, so the body list the menu once
    // resolved its target against no longer holds them. Right-click is the
    // documented way to unpin, and it has to reach a row at either edge.
    const targets: string[] = [];
    renderGridUi({
      enableRowPinning: true,
      initialState: { rowPinning: { top: ["1"], bottom: ["2"] } },
      tableProps: {
        renderRowContextMenu: ({ row }) => {
          targets.push(row.id);
          return <Menu.Item>Unpin</Menu.Item>;
        },
      },
    });

    fireEvent.contextMenu(
      within(part("row", { rowId: "1" }, part("pinned-top"))).getAllByRole(
        "cell",
      )[2],
    );

    expect(
      await screen.findByRole("menuitem", { name: "Unpin" }),
    ).toBeInTheDocument();
    expect(targets).toContain("1");
  });

  it("opens the menu for a bottom-pinned row", async () => {
    renderGridUi({
      enableRowPinning: true,
      initialState: { rowPinning: { top: [], bottom: ["2"] } },
      tableProps: {
        renderRowContextMenu: ({ row }) => (
          <Menu.Item>{`Unpin ${row.id}`}</Menu.Item>
        ),
      },
    });

    fireEvent.contextMenu(
      within(part("row", { rowId: "2" }, part("pinned-bottom"))).getAllByRole(
        "cell",
      )[2],
    );

    expect(
      await screen.findByRole("menuitem", { name: "Unpin 2" }),
    ).toBeInTheDocument();
  });

  it("does not touch right-click without the prop", () => {
    renderGridUi();

    contextClickName(0);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(bodyRows()[0]).not.toHaveAttribute("data-context-menu", "true");
  });
});

describe("pagination", () => {
  it("renders no pager unless pagination is enabled", () => {
    renderGridUi();

    expect(
      screen.queryByRole("button", { name: "Next page" }),
    ).not.toBeInTheDocument();
  });

  it("pages through the rows", async () => {
    const user = userEvent.setup();
    renderGridUi({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    });

    expect(renderedRowIds()).toEqual(["1", "2", "3", "4", "5"]);
    expect(screen.getByText("1–5 of 12")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(renderedRowIds()).toEqual(["6", "7", "8", "9", "10"]);
    expect(screen.getByText("6–10 of 12")).toBeInTheDocument();
  });

  it("keeps a page size that is not one of the offered options", () => {
    renderGridUi({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 7 } },
    });

    // 7 is not in the default [10, 25, 50, 100] - the Select must still show it
    // rather than render blank. Mantine's Select renders a visible input and a
    // hidden one, so both carry the value.
    expect(screen.getAllByDisplayValue("7").length).toBeGreaterThan(0);
  });
});

describe("grouping", () => {
  it("offers to group on a column that has an accessor", async () => {
    const user = userEvent.setup();
    renderGridUi();

    const items = (await openColumnMenu(user, "City")).map(
      (item) => item.textContent,
    );

    expect(items).toContain("Group by City");
  });

  it("replaces the rows with a collapsed tree and takes the column out", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");

    // Three cities over twelve rows, none of them open yet.
    const groups = bodyRows();
    expect(groups).toHaveLength(3);
    expect(groups.every((row) => row.dataset.grouped === "true")).toBe(true);
    // The tree lane replaced the column it groups on.
    expect(header("__group__")).toBeInTheDocument();
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
  });

  it("writes the group value and how many rows are under it", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");

    expect(
      screen.getByRole("button", { name: "Expand Stockholm" }),
    ).toHaveTextContent("Stockholm(4)");
  });

  it("brings the rows into view when the group is expanded", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");
    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));

    expect(bodyRows()).toHaveLength(3 + 4);
    expect(
      screen.getByRole("button", { name: "Collapse Stockholm" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("ungroups from the tree column, the grouped one having gone", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");
    // The City header no longer exists to be ungrouped from, which is why the
    // tree column carries the item.
    await clickMenuItem(user, "Group", "Ungroup City");

    expect(header("city")).toBeInTheDocument();
    expect(queryPart("header", { columnId: "__group__" })).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(12);
  });

  it("selects every row under a group from its checkbox", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");
    const groupBoxes = screen.getAllByRole("checkbox", { name: "Select group" });
    expect(groupBoxes).toHaveLength(3);

    await user.click(groupBoxes[0]!);

    // Four leaves ticked, and the group's own box follows them. The rows cycle
    // through the cities, so the first group is Stockholm's.
    expect(groupBoxes[0]).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));
    expect(
      screen
        .getAllByRole("checkbox", { name: "Select row" })
        .filter((box) => (box as HTMLInputElement).checked),
    ).toHaveLength(4);
  });

  it("leaves a column with no aggregation blank on a group row", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await clickMenuItem(user, "City", "Group by City");

    // Cell 0 is the checkbox lane, 1 the tree, then ID / Name / Age. A plain
    // "group by" is a tree, not a summary - nothing was told how to aggregate.
    expect(renderedColumn(2)).toEqual(["", "", ""]);
    expect(renderedColumn(4)).toEqual(["", "", ""]);
  });

  it("never hands a column's renderer a group row it cannot aggregate", async () => {
    const user = userEvent.setup();
    // A renderer that formats what it gets, as a real one does. On a group
    // row the value is undefined, so reaching it at all would throw.
    const columns = groupingHelper.columns([
      groupingHelper.accessor("name", { header: "Name" }),
      groupingHelper.accessor("age", {
        header: "Age",
        cell: (info) => info.getValue().toFixed(1),
      }),
      groupingHelper.accessor("id", {
        header: "ID",
        aggregationFn: "sum",
        cell: (info) => info.getValue().toFixed(1),
      }),
      groupingHelper.accessor("city", { header: "City" }),
    ]);
    renderGridUi({
      columns,
      renderDetails: ({ row }) => row.original.name.toUpperCase(),
    });

    await clickMenuItem(user, "City", "Group by City");

    // Body cells carry no part; the coordinate pair is their address.
    const groupCell = (columnId: string) =>
      document.querySelector(
        `[data-row-id="city:Stockholm"][data-column-id="${columnId}"]:not([data-dg-part])`,
      );
    expect(groupCell("age")).toHaveTextContent(/^$/);
    // A column told how to aggregate still renders, over the aggregate:
    // ids 1, 4, 7 and 10 live in Stockholm.
    expect(groupCell("id")).toHaveTextContent("22.0");
    expect(groupCell(DETAILS_COLUMN_ID)).toHaveTextContent(/^$/);
  });
});

const groupingHelper = createTMDataGridColumnHelper<TestRow>();

describe("grouping - rendering stays in step", () => {
  /** Header ids in render order. */
  const headerIds = () =>
    screen
      .getAllByRole("columnheader")
      .map((header) => header.getAttribute("data-column-id") ?? "");

  it("drops the second grouped column's header, not only the first", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await openColumnMenu(user, "City");
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    expect(headerIds()).not.toContain("city");

    await openColumnMenu(user, "Name");
    await user.click(screen.getByRole("menuitem", { name: "Group by Name" }));
    expect(headerIds()).not.toContain("name");
  });

  it("gives every row as many cells as there are headers", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await openColumnMenu(user, "City");
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    await openColumnMenu(user, "Name");
    await user.click(screen.getByRole("menuitem", { name: "Group by Name" }));

    // A stale header list would leave a track and a header with no cell under
    // it, shifting every column after it out of alignment.
    const columnCount = headerIds().length;
    for (const row of bodyRows()) {
      expect(within(row).getAllByRole("cell")).toHaveLength(columnCount);
    }
  });
});

describe("grouping and the pager", () => {
  const groupIt = async (user: ReturnType<typeof userEvent.setup>) => {
    await clickMenuItem(user, "City", "Group by City");
  };

  it("greys the pager out rather than hiding it", async () => {
    const user = userEvent.setup();
    renderGridUi({ enablePagination: true });

    expect(screen.getByText("1–12 of 12")).toBeInTheDocument();

    await groupIt(user);

    // Still there - a footer that vanished would read as a bug rather than as a
    // mode the grid is in.
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByText("Grouped · all 12 rows")).toBeInTheDocument();
  });

  it("renders every group rather than a page of them", async () => {
    const user = userEvent.setup();
    renderGridUi({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });
    expect(bodyRows()).toHaveLength(2);

    await groupIt(user);

    // Three cities, none sliced off by a page size of two.
    expect(bodyRows()).toHaveLength(3);
  });

  it("pages again once the grouping is dropped", async () => {
    const user = userEvent.setup();
    renderGridUi({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });

    await groupIt(user);
    await user.click(screen.getByRole("button", { name: "Group column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Ungroup City" }));

    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });
});

describe("grouping and the row context menu", () => {
  it("leaves group rows without a context menu", async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    renderGridUi({
      tableProps: {
        renderRowContextMenu: ({ row }) => {
          seen.push(row.id);
          return <Menu.Item>Open</Menu.Item>;
        },
      },
    });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));

    // A group row is built on its first child's record, so a render prop
    // reaching for `row.original` would be handed the wrong employee. Same
    // reason group rows sit out `onRowClick`.
    fireEvent.contextMenu(within(bodyRows()[0]!).getAllByRole("cell")[2]!);

    expect(screen.queryByRole("menuitem", { name: "Open" })).not.toBeInTheDocument();
    expect(seen).toEqual([]);
    expect(bodyRows()[0]).not.toHaveAttribute("data-context-menu", "true");
  });

  it("still opens one on the rows inside a group", async () => {
    const user = userEvent.setup();
    renderGridUi({
      tableProps: {
        renderRowContextMenu: () => <Menu.Item>Open</Menu.Item>,
      },
    });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));

    const dataRow = bodyRows().find((row) => row.dataset.grouped !== "true");
    fireEvent.contextMenu(within(dataRow!).getAllByRole("cell")[2]!);

    expect(
      await screen.findByRole("menuitem", { name: "Open" }),
    ).toBeInTheDocument();
  });
});


describe("row details", () => {
  const renderDetails = ({ row }: TMDataGridDetailsArgs<TestRow>) => (
    <div>Details for {row.original.name}</div>
  );

  /** The generated lane's chevron, on one row or in the header. */
  const detailsToggle = (rowId?: string) =>
    rowId === undefined
      ? screen.getByRole("button", { name: /(Expand|Collapse) all details/ })
      : within(part("row", { rowId })).getByRole("button", {
          name: /(Show|Hide) details/,
        });

  it("renders no panel until a row is expanded", () => {
    renderGridUi({ renderDetails });

    expect(detailsToggle("1")).toHaveAttribute("aria-expanded", "false");
    expect(queryPart("details", { rowId: "1" })).not.toBeInTheDocument();
  });

  it("lets a data row expand, which it cannot do on its own", () => {
    // TanStack's fallback is `subRows.length > 0`, so without `renderDetails`
    // nothing but a group row can expand.
    expect(renderGrid().result.current.table.getRow("1").getCanExpand()).toBe(
      false,
    );
    expect(
      renderGrid({ renderDetails }).result.current.table
        .getRow("1")
        .getCanExpand(),
    ).toBe(true);
  });

  it("leaves a group row expandable whatever getRowCanExpand says of its record", () => {
    renderGridUi({
      renderDetails,
      // Row 1 is the first record under Stockholm - the one TanStack builds
      // the group row on.
      getRowCanExpand: (row) => row.original.id !== 1,
      enableGrouping: true,
      initialState: { grouping: ["city"] },
    });
    const before = gridRowCount();

    fireEvent.click(part("group-toggle", { rowId: "city:Stockholm" }));

    expect(gridRowCount()).toBe(before + 4);
    // The record itself still has no panel to open.
    expect(queryPart("details-toggle", { rowId: "1" })).not.toBeInTheDocument();
    expect(part("details-toggle", { rowId: "4" })).toBeInTheDocument();
  });

  it("skips a row getRowCanExpand turns down in expand-all", () => {
    renderGridUi({
      renderDetails,
      getRowCanExpand: (row) => row.original.id !== 1,
    });

    fireEvent.click(detailsToggle());

    expect(queryPart("details", { rowId: "1" })).not.toBeInTheDocument();
    expect(part("details", { rowId: "2" })).toBeInTheDocument();
    // Every row that can open is open, so the header reads "all".
    expect(detailsToggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("pins the lane last of the generated ones, and lets no one move it", () => {
    const api = renderGrid({ renderDetails }).result.current;

    // The tree lane is pinned between them, and hidden until something is
    // grouped - so it holds its place without taking a track.
    expect(api.table.store.state.columnPinning.start).toEqual([
      SELECT_COLUMN_ID,
      GROUP_COLUMN_ID,
      DETAILS_COLUMN_ID,
    ]);
    expect(visibleColumnIds(api).slice(0, 2)).toEqual([
      SELECT_COLUMN_ID,
      DETAILS_COLUMN_ID,
    ]);

    // A toggle that could be hidden, unpinned or dragged to the far right would
    // leave rows with panels no one can open.
    const column = erased(api).table.getColumn(DETAILS_COLUMN_ID);
    expect(getColumnCapabilities(column!, api.features)).toMatchObject({
      canHide: false,
      canPin: false,
      canReorder: false,
      canResize: false,
      canSort: false,
    });
  });

  it("pins the lane to the right edge, inside the edit lane, when asked", () => {
    const api = renderGrid({
      renderDetails,
      detailsColumnPosition: "right",
      editing: { mode: "row" },
      // A snapshot saved while the lane was on the left pins nothing there now.
      initialState: { columnPinning: { start: [DETAILS_COLUMN_ID], end: [] } },
    }).result.current;

    expect(api.table.store.state.columnPinning).toEqual({
      start: [SELECT_COLUMN_ID, GROUP_COLUMN_ID],
      end: [DETAILS_COLUMN_ID, EDIT_COLUMN_ID],
    });
    expect(visibleColumnIds(api).slice(-2)).toEqual([
      DETAILS_COLUMN_ID,
      EDIT_COLUMN_ID,
    ]);
  });

  it("opens the panel inside the expanded row, and only that one", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(detailsToggle("3"));

    const panel = part("details", { rowId: "3" });
    expect(panel).toHaveTextContent("Details for Maria");
    // Inside the row element: one measurement covers the row and its panel.
    expect(part("row", { rowId: "3" })).toContainElement(panel);
    expect(queryPart("details", { rowId: "2" })).not.toBeInTheDocument();
  });

  it("closes it again on the second click", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(detailsToggle("3"));
    await user.click(detailsToggle("3"));

    expect(queryPart("details", { rowId: "3" })).not.toBeInTheDocument();
  });

  it("spans every column without adding a row to the count", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });
    const grid = screen.getByRole("table");
    const rowCount = grid.getAttribute("aria-rowcount");

    await user.click(detailsToggle("3"));

    // A cell spanning the row rather than a row of its own, so the count still
    // counts records.
    expect(part("details", { rowId: "3" })).toHaveAttribute(
      "aria-colspan",
      grid.getAttribute("aria-colcount"),
    );
    expect(grid).toHaveAttribute("aria-rowcount", rowCount);
  });

  it("opens and closes every row from the header", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(detailsToggle());

    expect(detailsToggle()).toHaveAttribute("aria-expanded", "true");
    expect(
      bodyRows().every(
        (row) => within(row).queryByText(/^Details for/) !== null,
      ),
    ).toBe(true);

    await user.click(detailsToggle());

    expect(detailsToggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/^Details for/)).not.toBeInTheDocument();
  });

  it("keeps a click inside the panel out of the row's gestures", async () => {
    const user = userEvent.setup();
    // Opened from restored state rather than by clicking the row, so the click
    // under test is the only one the row could have reacted to.
    renderGridUi({
      selectionMode: "row",
      initialState: { expanded: { "3": true } },
      renderDetails: ({ row }) => (
        <button type="button">Act on {row.original.name}</button>
      ),
    });

    await user.click(screen.getByRole("button", { name: "Act on Maria" }));

    expect(part("details", { rowId: "3" })).toBeInTheDocument();
    expect(part("row", { rowId: "3" })).not.toHaveAttribute("data-selected");
  });

  it("sits after the tree lane once something is grouped", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));

    // The lane the user grouped into comes first: the tree says which rows
    // there are, and only then is there one to open.
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.getAttribute("data-column-id"));
    expect(headers.slice(0, 3)).toEqual([
      SELECT_COLUMN_ID,
      GROUP_COLUMN_ID,
      DETAILS_COLUMN_ID,
    ]);
  });

  it("expands every detail from the header without unfolding the tree", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    await user.click(detailsToggle());

    // One `expanded` state holds both, so the whole-table form TanStack's
    // `toggleAllRowsExpanded` writes would have opened all three groups too -
    // and the grid would be showing fifteen rows rather than three.
    expect(gridRowCount()).toBe(3);
    expect(bodyRows().every((row) => row.dataset.grouped === "true")).toBe(true);

    // The panels are there all the same, under the rows inside the group.
    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));
    const dataRows = bodyRows().filter((row) => row.dataset.grouped !== "true");
    expect(dataRows).toHaveLength(4);
    expect(
      dataRows.every((row) => within(row).queryByText(/^Details for/) !== null),
    ).toBe(true);
  });

  it("expands every group from the menu without opening the panels", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));
    await user.click(screen.getByRole("button", { name: "Group column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Expand all groups" }));

    // The mirror of the case above: an item that says "groups" must not open
    // every panel in the grid.
    expect(gridRowCount()).toBe(3 + testRows.length);
    expect(screen.queryByText(/^Details for/)).not.toBeInTheDocument();
  });

  it("leaves group rows to their children", async () => {
    const user = userEvent.setup();
    renderGridUi({ renderDetails });

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Group by City" }));

    // A group row is built on its first child's record, so a panel there would
    // be about an arbitrary one of them. It opens into its rows instead, from
    // the tree lane rather than this one.
    const groupRow = bodyRows()[0]!;
    expect(
      within(groupRow).queryByRole("button", { name: /details/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand Stockholm" }));

    expect(gridRowCount()).toBe(3 + 4);
    expect(screen.queryByText(/^Details for/)).not.toBeInTheDocument();
  });
});

