import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bodyRows,
  clickMenuItem,
  countScrolls,
  Grid,
  gridRowCount,
  header,
  makeRows,
  part,
  parts,
  renderedHeaderIds,
  queryPart,
  renderedColumn,
  renderedRowIds,
  renderGrid,
  renderGridUi,
  renderWithMantine,
  testColumns,
  testRows,
  type GridProps,
  type TestRow,
} from "../../test/gridHarness";
import { aggregateColumn } from "../core/summary";
import { SIZE_ROW_HEIGHT, type TMDataGridSize } from "../core/sizes";
import { TMDATAGRID_LABELS_SV } from "../core/labelsSv";
import { EDIT_COLUMN_ID } from "./TMDataGridEditColumn";
import { GROUP_COLUMN_ID } from "./TMDataGridGroupColumn";
import type { TMDataGridToolbarProps } from "./TMDataGridToolbar";
import { SELECT_COLUMN_ID } from "./TMDataGridSelectColumn";
import { TMDataGrid } from "./TMDataGrid";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";

describe("rendering", () => {
  it("renders a header per column and the rows beneath them", () => {
    renderGridUi();

    expect(header("name")).toHaveTextContent("Name");
    expect(header("city")).toHaveTextContent("City");
    expect(renderedRowIds().length).toBeGreaterThan(0);
  });

  it("states the row and column counts for a virtualized grid", () => {
    renderGridUi();
    const grid = screen.getByRole("table");

    // Five columns: the generated checkbox column plus the four defined ones.
    expect(grid).toHaveAttribute("aria-colcount", "5");
    // Every row plus the header row, whether or not it is mounted.
    expect(grid).toHaveAttribute(
      "aria-rowcount",
      String(testRows.length + 1),
    );
  });

  it("says truly-empty when there is no data and no filter", () => {
    renderGridUi({ data: [] });

    expect(screen.getByText("No rows to show")).toBeInTheDocument();
    expect(
      screen.queryByText("No rows match your filters"),
    ).not.toBeInTheDocument();
  });

  it("says filtered-empty once a filter is what emptied it", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "999999");

    expect(
      screen.getByText("No rows match your filters"),
    ).toBeInTheDocument();
  });

  it("meta.noResultsLabel names the filtered case", async () => {
    const user = userEvent.setup();
    renderGridUi({ meta: { noResultsLabel: "Nothing here" } });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "999999");

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renderEmptyState takes over and learns which emptiness it is", () => {
    renderGridUi({
      data: [],
      tableProps: {
        renderEmptyState: ({ hasActiveFilters }) => (
          <div>blank slate, filtered: {String(hasActiveFilters)}</div>
        ),
      },
    });

    expect(
      screen.getByText("blank slate, filtered: false"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No rows to show")).not.toBeInTheDocument();
  });

  it("says truly-empty while the filter panel holds only a half-typed filter", async () => {
    const user = userEvent.setup();
    renderGridUi({ data: [] });

    // Opening the panel seeds `{ operator, value: "" }`, which filters nothing.
    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByText("No rows to show")).toBeInTheDocument();
    expect(
      screen.queryByText("No rows match your filters"),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Value"), "999999");

    expect(
      screen.getByText("No rows match your filters"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No rows to show")).not.toBeInTheDocument();
  });

  it("renderEmptyState counts only a filter that says something", async () => {
    const user = userEvent.setup();
    renderGridUi({
      data: [],
      tableProps: {
        renderEmptyState: ({ hasActiveFilters }) => (
          <div>blank slate, filtered: {String(hasActiveFilters)}</div>
        ),
      },
    });

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(
      screen.getByText("blank slate, filtered: false"),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Value"), "999999");

    expect(
      screen.getByText("blank slate, filtered: true"),
    ).toBeInTheDocument();
  });

  it("shows no message while an entry row is open on an empty grid", async () => {
    const user = userEvent.setup();
    // Referentially stable - an inline `[]` would be a new array every render,
    // and TanStack rebuilds the row models whenever `data` identity changes.
    const emptyRows: TestRow[] = [];
    function EmptyEntryGrid() {
      const grid = useTMDataGrid<TestRow>({
        data: emptyRows,
        columns: testColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell", draft: true,
          newRowDefaults: () => ({ ...testRows[0]!, id: 0 }),
        },
      } as UseTMDataGridOptions<TestRow>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button type="button" onClick={() => grid.edit.addRow()}>
              Add row
            </button>
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<EmptyEntryGrid />);

    expect(screen.getByText("No rows to show")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add row" }));

    // The entry row is the content now; "no rows" beside it would contradict.
    expect(screen.queryByText("No rows to show")).not.toBeInTheDocument();
  });
});

describe("sorting", () => {
  it("sorts on a header click and reports it through aria-sort", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const nameHeader = header("name");

    expect(nameHeader).toHaveAttribute("aria-sort", "none");

    // The name column repeats values, so the order is asserted on the values
    // themselves - a stable sort keeps tied rows in place, which means
    // descending is not the exact reverse of ascending.
    await user.click(nameHeader);
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    const ascending = renderedColumn(2);
    expect(ascending).toEqual([...ascending].sort());

    await user.click(nameHeader);
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    const descending = renderedColumn(2);
    expect(descending).toEqual([...descending].sort().reverse());
  });

  it("sorts a numeric column descending first, as TanStack does", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const ageHeader = header("age");

    await user.click(ageHeader);

    expect(ageHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("advances the sort one step per click on the sort arrow", async () => {
    const user = userEvent.setup();
    renderGridUi();

    // The arrow sits inside the header, which sorts on click as well.
    await user.click(part("header-sort", { columnId: "name" }));

    expect(header("name")).toHaveAttribute("aria-sort", "ascending");
  });

  it("does not advertise sorting on a grid that has it switched off", () => {
    renderGridUi({ enableSorting: false });

    expect(header("age")).not.toHaveAttribute(
      "aria-sort",
    );
  });
});

describe("column visibility", () => {
  it("hides a column from the grid menu", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle", { columnId: "city" }));

    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
    expect(header("name")).toBeInTheDocument();
  });

  it("lists no column toggles when hiding is off", async () => {
    const user = userEvent.setup();
    renderGridUi({ enableHiding: false });

    // The menu itself still renders - it holds whatever the consumer put in
    // it, and cannot know that this grid's only item is the column chooser.
    await user.click(part("menu-button"));

    expect(screen.queryAllByRole("menuitemcheckbox")).toHaveLength(0);
  });

  it("Reset layout brings a hidden column back", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle", { columnId: "city" }));
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();

    await user.click(part("columns-reset"));

    expect(header("city")).toBeInTheDocument();
  });

  it("leaves the generated lanes out of the menu", async () => {
    const user = userEvent.setup();
    renderGridUi({ enableRowNumbers: true, initialState: { grouping: ["city"] } });

    await user.click(part("menu-button"));

    // Chrome the grid generated, not a column the consumer declared: the
    // checkbox lane, the row-number gutter and the tree column are all
    // `enableHiding: false`, so none of them is a setting to offer.
    expect(parts("columns-toggle").map((box) => box.dataset.columnId)).toEqual([
      "id",
      "name",
      "age",
    ]);
  });

  it("show/hide all leaves a lane the menu never listed alone", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    // Off, then on again. The tree column is hidden because nothing is grouped,
    // not because anyone hid it, and the checkbox lane is not a setting either:
    // neither pass may touch them. `table.toggleAllColumnsVisible` writes an
    // entry for every leaf column, which is what published the tree column.
    await user.click(part("columns-toggle-all"));
    expect(queryPart("header", { columnId: GROUP_COLUMN_ID })).not.toBeInTheDocument();
    expect(part("select-all")).toBeInTheDocument();
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();

    await user.click(part("columns-toggle-all"));
    expect(queryPart("header", { columnId: GROUP_COLUMN_ID })).not.toBeInTheDocument();
    expect(part("select-all")).toBeInTheDocument();
    expect(header("city")).toBeInTheDocument();
  });

  // enableHiding: false only gates toggleVisibility - TanStack applies a
  // `columnVisibility` entry regardless - so without the scrub a stale `false`
  // would hide a lane the panel no longer lists and cannot bring back.
  it("ignores a visibility entry for a control lane in initialState", () => {
    renderGridUi({
      initialState: { columnVisibility: { [SELECT_COLUMN_ID]: false } },
    });

    expect(part("select-all")).toBeInTheDocument();
  });

  it("ignores a persisted visibility entry for a control lane", () => {
    // The payload a pre-2.1 session left behind, when the lane was hideable.
    localStorage.setItem(
      "s",
      JSON.stringify({ __v: 1, columnVisibility: { [SELECT_COLUMN_ID]: false, city: false } }),
    );
    renderGridUi({ persist: { settingsKey: "s" } });

    expect(part("select-all")).toBeInTheDocument();
    // The user's own hidden column still restores.
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
  });
});

describe("row numbers", () => {
  it("numbers the view in display order, renumbering on sort", async () => {
    const user = userEvent.setup();
    renderGridUi({ enableRowNumbers: true });

    const numbersAt = () =>
      bodyRows().map(
        (row) => within(row).getAllByRole("cell")[0]?.textContent ?? "",
      );

    expect(screen.getByText("#")).toBeInTheDocument();
    const before = numbersAt();
    expect(before.slice(0, 3)).toEqual(["1", "2", "3"]);

    // Sorting reorders the rows; the gutter numbers the view, so it stays
    // 1, 2, 3 while the row ids underneath change order.
    await user.click(header("name"));
    expect(numbersAt().slice(0, 3)).toEqual(["1", "2", "3"]);
  });

  it("renders no gutter by default", () => {
    renderGridUi();

    expect(screen.queryByText("#")).not.toBeInTheDocument();
  });
});

describe("match highlighting", () => {
  it("marks the matched text while a contains filter is active", async () => {
    const user = userEvent.setup();
    renderGridUi({ enableMatchHighlighting: true });

    // The panel seeds on "id", whose "equals" is not a substring match - the
    // highlight wants the Name column's "contains".
    await user.click(screen.getByRole("button", { name: "Filters" }));
    // Mantine's Select renders a hidden input under the same label, so the
    // query goes by role, which only the visible input carries.
    await user.click(
      within(part("filter-panel")).getByRole("combobox", { name: "Column" }),
    );
    await user.click(await screen.findByRole("option", { name: "Name" }));
    await user.type(screen.getByLabelText("Value"), "anna");

    // The filter itself must be live on Name before marks mean anything.
    expect(renderedRowIds()).toEqual(["1", "6", "11"]);
    const marks = await screen.findAllByText("Anna", { selector: "mark" });
    expect(marks.length).toBeGreaterThan(0);
  });

  it("renders no marks without the flag", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "anna");

    expect(screen.getAllByText("Anna").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("mark")).toHaveLength(0);
  });
});

describe("scroll edge callbacks", () => {
  it("fires on arrival at an edge, once, and not on mount", () => {
    const events: Array<string> = [];
    renderGridUi({
      tableProps: {
        onScrollToTop: () => events.push("top"),
        onScrollToBottom: () => events.push("bottom"),
      },
    });

    const container = document.querySelector(
      "[data-dg-scroll-container]",
    ) as HTMLElement;
    // jsdom has no layout, so the metrics are stated.
    Object.defineProperties(container, {
      clientHeight: { value: 400, configurable: true },
      scrollHeight: { value: 1000, configurable: true },
      clientWidth: { value: 600, configurable: true },
      scrollWidth: { value: 600, configurable: true },
    });

    // Mounting fired nothing - the grid starts at the top edge.
    expect(events).toEqual([]);

    container.scrollTop = 600;
    fireEvent.scroll(container);
    container.scrollTop = 599;
    fireEvent.scroll(container);

    // Two scroll events inside the bottom tolerance, one arrival.
    expect(events).toEqual(["bottom"]);

    container.scrollTop = 300;
    fireEvent.scroll(container);
    container.scrollTop = 0;
    fireEvent.scroll(container);

    expect(events).toEqual(["bottom", "top"]);
  });
});

describe("per-row styling", () => {
  it("stripes by view position and applies rowClassName/rowStyle", () => {
    renderGridUi({
      tableProps: {
        striped: true,
        rowClassName: (row) => (row.id === "1" ? "vip" : undefined),
        rowStyle: (row) =>
          row.id === "2"
            ? ({ "--row-bg": "rgb(255, 0, 0)" } as React.CSSProperties)
            : undefined,
      },
    });

    const rows = bodyRows();
    expect(rows[0]!.getAttribute("data-striped")).toBeNull();
    expect(rows[1]!.getAttribute("data-striped")).toBe("true");
    expect(rows[0]!.className).toContain("vip");
    expect(rows[1]!.className).not.toContain("vip");
    expect(rows[1]!.style.getPropertyValue("--row-bg")).toBe("rgb(255, 0, 0)");
  });

  it("adds no stripe attribute while striped is off", () => {
    renderGridUi();

    expect(bodyRows()[1]!.hasAttribute("data-striped")).toBe(false);
  });

  it("marks rows for the hover tint only when the row answers a gesture", () => {
    const { unmount } = renderGridUi();
    expect(bodyRows()[0]!.hasAttribute("data-highlight-on-hover")).toBe(false);
    unmount();

    const { unmount: unmountRowMode } = renderGridUi({ selectionMode: "row" });
    expect(bodyRows()[0]!.getAttribute("data-highlight-on-hover")).toBe("true");
    unmountRowMode();

    const { unmount: unmountClick } = renderGridUi({
      tableProps: { onRowClick: () => {} },
    });
    expect(bodyRows()[0]!.getAttribute("data-highlight-on-hover")).toBe("true");
    unmountClick();

    renderGridUi({
      tableProps: { renderRowContextMenu: () => null },
    });
    expect(bodyRows()[0]!.getAttribute("data-highlight-on-hover")).toBe("true");
  });

  it("highlightOnHover overrides the default either way", () => {
    const { unmount } = renderGridUi({
      tableProps: { highlightOnHover: true },
    });
    expect(bodyRows()[0]!.getAttribute("data-highlight-on-hover")).toBe("true");
    unmount();

    renderGridUi({
      selectionMode: "row",
      tableProps: { highlightOnHover: false },
    });
    expect(bodyRows()[0]!.hasAttribute("data-highlight-on-hover")).toBe(false);
  });
});

describe("cell click handlers", () => {
  it("onCellClick reports the cell and composes with row selection", async () => {
    const user = userEvent.setup();
    const clicks: Array<string> = [];
    renderGridUi({
      selectionMode: "row",
      tableProps: {
        onCellClick: ({ row, column }) => clicks.push(`${row.id}:${column.id}`),
      },
    });

    await user.click(within(bodyRows()[0]!).getAllByRole("cell")[1]!);

    // No checkbox lane under "row" mode, so cell 1 is the name column.
    expect(clicks).toEqual(["1:name"]);
    // The row click still selected - composed, not suppressed.
    expect(bodyRows()[0]!.getAttribute("data-selected")).toBe("true");
  });

  it("onCellDoubleClick and onCellContextMenu fire with the cell", async () => {
    const user = userEvent.setup();
    const events: Array<string> = [];
    renderGridUi({
      tableProps: {
        onCellDoubleClick: ({ column }) => events.push(`dbl:${column.id}`),
        onCellContextMenu: ({ column }) => events.push(`ctx:${column.id}`),
      },
    });

    const nameCell = within(bodyRows()[0]!).getAllByRole("cell")[2]!;
    await user.dblClick(nameCell);
    fireEvent.contextMenu(nameCell);

    expect(events).toEqual(["dbl:name", "ctx:name"]);
  });
});

describe("resetSettings", () => {
  it("puts every settings slice back to a clean first visit", () => {
    const { result } = renderGrid();
    const { table } = result.current;

    act(() => {
      table.getColumn("city")?.toggleVisibility(false);
      table.setColumnSizing({ name: 300 });
      table.setColumnOrder(["city", "name", "id", "age"]);
      table.setGrouping(["city"]);
    });

    act(() => result.current.resetSettings());

    const state = table.store.state;
    expect(state.columnVisibility.city).not.toBe(false);
    expect(state.columnSizing).toEqual({});
    expect(state.columnOrder).toEqual([]);
    expect(state.grouping).toEqual([]);
    // The structural lanes keep their pinning through a reset.
    expect(state.columnPinning.start).toContain(SELECT_COLUMN_ID);
  });

  it("keeps the consumer's initialState as the floor", () => {
    const { result } = renderGrid({
      initialState: { columnVisibility: { age: false } },
    });
    const { table } = result.current;

    act(() => {
      table.getColumn("age")?.toggleVisibility(true);
      table.getColumn("city")?.toggleVisibility(false);
    });

    act(() => result.current.resetSettings());

    const state = table.store.state;
    // Hidden by definition, so the reset hides it again.
    expect(state.columnVisibility.age).toBe(false);
    expect(state.columnVisibility.city).not.toBe(false);
  });
});

describe("column menu", () => {
  const itemLabels = () =>
    screen.getAllByRole("menuitem").map((item) => item.textContent);

  it("opens the same items from a right-click as from the button", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "City column menu" }));
    const fromButton = itemLabels();
    await user.keyboard("{Escape}");
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);

    fireEvent.contextMenu(header("city"));

    expect(itemLabels()).toEqual(fromButton);
  });

  it("leaves a control lane's header to the browser's own menu", () => {
    renderGridUi();

    // No column menu on the select-all lane, so nothing to open - the native
    // menu is the right answer there rather than an empty dropdown.
    fireEvent.contextMenu(header(SELECT_COLUMN_ID));

    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });
});

describe("column pinning", () => {
  it("keeps the edit lane outside a column the user pins right", async () => {
    const user = userEvent.setup();
    renderGridUi({ editing: { mode: "row", onCommit: () => {} } });

    await clickMenuItem(user, "City", "Pin to right");

    // The row's Save and Cancel stay the last thing in the row: a column pinned
    // right lands to the left of the lane, not outside it. `column.pin("end")`
    // appends, so this is the grid putting the lane back on the edge.
    expect(renderedHeaderIds().at(-1)).toBe(EDIT_COLUMN_ID);
    expect(renderedHeaderIds().at(-2)).toBe("city");
  });
});

describe("labels", () => {
  it("renders the chrome in Swedish from the preset", async () => {
    renderGridUi({ labels: TMDATAGRID_LABELS_SV });

    expect(screen.getByRole("button", { name: "Meny" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Markera alla rader" }),
    ).toBeInTheDocument();
  });

  it("merges a partial override over the English defaults", () => {
    renderGridUi({
      labels: { menuButton: "Kolumner" },
      data: [],
    } as GridProps);

    expect(
      screen.getByRole("button", { name: "Kolumner" }),
    ).toBeInTheDocument();
    // Untouched keys stay English - including the empty state.
    expect(screen.getByText("No rows to show")).toBeInTheDocument();
  });

  it("puts the localized label on the generated lane's column meta", () => {
    // Read off the column rather than out of the columns panel: a generated
    // lane cannot be hidden, so the panel does not list it.
    const { result } = renderGrid({ labels: TMDATAGRID_LABELS_SV });

    expect(
      result.current.table.getColumn(SELECT_COLUMN_ID)?.columnDef.meta?.label,
    ).toBe("Radmarkering");
  });
});

describe("Toolbar", () => {
  function StyledToolbarGrid({
    toolbarProps,
  }: {
    toolbarProps?: TMDataGridToolbarProps;
  }) {
    const grid = useTMDataGrid<TestRow>({
      data: testRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      enablePagination: true,
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar {...toolbarProps}>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer hiddenFrom="md" />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
        <TMDataGrid.Footer mt="lg" className="footer-of-mine" />
      </TMDataGrid>
    );
  }

  it("draws no bottom border unless asked", () => {
    renderWithMantine(<StyledToolbarGrid />);
    expect(part("toolbar")).not.toHaveAttribute("data-with-bottom-border");
  });

  it("marks itself for the bottom border under withBottomBorder", () => {
    renderWithMantine(<StyledToolbarGrid toolbarProps={{ withBottomBorder: true }} />);
    expect(part("toolbar")).toHaveAttribute("data-with-bottom-border", "true");
  });

  it("sets Mantine style props on the wrappers and keeps the part classes", () => {
    renderWithMantine(
      <StyledToolbarGrid
        toolbarProps={{ mb: "sm", className: "toolbar-of-mine", mod: { tone: "quiet" } }}
      />,
    );
    const toolbar = part("toolbar");
    expect(toolbar.style.marginBottom).toBe("var(--mantine-spacing-sm)");
    expect(toolbar).toHaveClass("toolbar-of-mine");
    // A consumer `mod` rides alongside the border modifier.
    expect(toolbar).toHaveAttribute("data-tone", "quiet");
    expect(toolbar.className).toMatch(/toolbar/);

    const footer = part("footer");
    expect(footer.style.marginTop).toBe("var(--mantine-spacing-lg)");
    expect(footer).toHaveClass("footer-of-mine");
  });
});

describe("LoadingIndicator", () => {
  function ToolbarGrid({ loading }: { loading?: boolean }) {
    const grid = useTMDataGrid<TestRow>({
      data: testRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      meta: { loading },
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.LoadingIndicator />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  it("spins while meta.loading is true, with rows still on screen", () => {
    renderWithMantine(<ToolbarGrid loading />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    expect(bodyRows().length).toBeGreaterThan(0);
  });

  it("renders nothing otherwise", () => {
    renderWithMantine(<ToolbarGrid />);
    expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument();
  });
});

describe("multi-column sorting", () => {
  it("adds a second column with Shift+click and shows priorities", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(header("city"));
    await user.keyboard("{Shift>}");
    await user.click(header("age"));
    await user.keyboard("{/Shift}");

    // Both columns sort at once: city first, age appended by the Shift.
    expect(header("city")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(header("age")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(
      part("sort-index", undefined, header("city")),
    ).toHaveTextContent("1");
    expect(
      part("sort-index", undefined, header("age")),
    ).toHaveTextContent("2");
  });

  it("collapses back to one sort on a plain click, hiding the priorities", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(header("city"));
    await user.keyboard("{Shift>}");
    await user.click(header("age"));
    await user.keyboard("{/Shift}");
    await user.click(header("name"));

    expect(header("name")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(header("city")).toHaveAttribute(
      "aria-sort",
      "none",
    );
    expect(queryPart("sort-index")).not.toBeInTheDocument();
  });
});

describe("summary row", () => {
  const summaryColumns = (() => {
    const helper = createTMDataGridColumnHelper<TestRow>();
    return helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", {
        header: "Age",
        footer: ({ table }) =>
          `Sum ${String(aggregateColumn({ table, columnId: "age" }))}`,
      }),
    ]);
  })();

  function SummaryGrid(options: Partial<UseTMDataGridOptions<TestRow>> = {}) {
    const grid = useTMDataGrid<TestRow>({
      data: testRows,
      columns: summaryColumns,
      getRowId: (row) => String(row.id),
      ...options,
    } as UseTMDataGridOptions<TestRow>);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  it("renders one sticky row of footers when a column defines one", () => {
    renderWithMantine(<SummaryGrid />);

    const total = testRows.reduce((sum, row) => sum + row.age, 0);
    const summary = part("summary-row");
    expect(within(summary).getByText(`Sum ${total}`)).toBeInTheDocument();
    // Included in the stated row count: header + rows + summary.
    expect(screen.getByRole("table")).toHaveAttribute(
      "aria-rowcount",
      String(testRows.length + 2),
    );
  });

  it("renders no summary row when no column defines a footer", () => {
    renderGridUi();
    expect(queryPart("summary-row")).not.toBeInTheDocument();
  });

  it("follows the filters through aggregateColumn", () => {
    const { result } = renderGrid();
    const filtered = aggregateColumn({
      table: result.current.table,
      columnId: "age",
    });
    expect(filtered).toBe(testRows.reduce((sum, row) => sum + row.age, 0));

    act(() => {
      result.current.table.setColumnFilters([
        { id: "name", value: { operator: "equals", value: "Anna" } },
      ]);
    });

    const expected = testRows
      .filter((row) => row.name === "Anna")
      .reduce((sum, row) => sum + row.age, 0);
    expect(
      aggregateColumn({ table: result.current.table, columnId: "age" }),
    ).toBe(expected);
  });
});

describe("scrollToRow", () => {
  const manyRows = makeRows(500);

  /** Captures the api so a test can call it the way a consumer would. */
  function ScrollGrid({
    onReady,
    ...options
  }: Partial<UseTMDataGridOptions<TestRow>> & {
    onReady: (api: TMDataGridApi<TestRow>) => void;
  }) {
    const grid = useTMDataGrid<TestRow>({
      data: manyRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      ...options,
    } as UseTMDataGridOptions<TestRow>);
    onReady(grid);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  const renderScrollGrid = (options: Partial<UseTMDataGridOptions<TestRow>> = {}) => {
    let api: TMDataGridApi<TestRow> | null = null;
    renderWithMantine(
      <ScrollGrid {...options} onReady={(next) => (api = next)} />,
    );
    if (api === null) throw new Error("grid never rendered");
    return api as TMDataGridApi<TestRow>;
  };

  it("scrolls for a row virtualization left out of the DOM", () => {
    const api = renderScrollGrid();

    // The point of the method: row 400 is real, and has no element - so there
    // is nothing for `scrollIntoView` to be called on.
    expect(queryPart("row", { rowId: "400" })).toBeNull();

    expect(countScrolls(() => api.scrollToRow({ rowId: "400" }))).toBe(1);
  });

  it("does not scroll for a row it cannot reach", () => {
    const api = renderScrollGrid();

    expect(countScrolls(() => api.scrollToRow({ rowId: "9999" }))).toBe(0);
  });

  it("answers false for a row the current view does not hold", () => {
    const api = renderScrollGrid();

    expect(api.scrollToRow({ rowId: "9999" })).toBe(false);
  });

  it("answers false for a row a filter has taken out", () => {
    const api = renderScrollGrid();

    act(() => {
      api.table.setGlobalFilter("Stockholm");
    });

    // Row 2 is Göteborg - filtered away, so there is nowhere to scroll to.
    expect(api.scrollToRow({ rowId: "2" })).toBe(false);
    expect(api.scrollToRow({ rowId: "1" })).toBe(true);
  });

  it("answers true for a pinned row without scrolling", () => {
    const api = renderScrollGrid({ enableRowPinning: true });

    act(() => {
      api.table.setRowPinning({ top: ["300"], bottom: [] });
    });

    // Parked at the edge: already on screen, and out of the scrolling order.
    expect(api.scrollToRow({ rowId: "300" })).toBe(true);
    expect(part("row", { rowId: "300" }, part("pinned-top"))).toBeInTheDocument();
  });
});

describe("size", () => {
  const manyRows = makeRows(500);

  function SizedGrid({ size }: { size: TMDataGridSize }) {
    const grid = useTMDataGrid<TestRow>({
      data: manyRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
    });
    return (
      <TMDataGrid {...grid} size={size}>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  /**
   * The spacer standing in for the rows below the virtual window - the last
   * `aria-hidden` child of the rowgroup. jsdom lays nothing out, so the
   * mounted rows measure zero; the spacer's inline height is pure estimate
   * arithmetic, `(total - mounted) × rowHeight`, which makes it the one
   * number the estimates can be read back through.
   */
  const bottomSpacerHeight = () => {
    const rowgroup = bodyRows()[0]?.parentElement;
    if (!rowgroup) throw new Error("no rowgroup");
    const spacer = Array.from(rowgroup.children)
      .filter((child) => child.hasAttribute("aria-hidden"))
      .at(-1);
    if (!(spacer instanceof HTMLElement)) throw new Error("no bottom spacer");
    return Number.parseFloat(spacer.style.height);
  };

  const expectedSpacer = (size: TMDataGridSize) =>
    (manyRows.length - bodyRows().length) * SIZE_ROW_HEIGHT[size];

  it("re-estimates virtualized row heights when size changes live", () => {
    const { rerender } = renderWithMantine(<SizedGrid size="md" />);
    expect(bottomSpacerHeight()).toBe(expectedSpacer("md"));

    // The runtime density toggle: same grid, new size. The virtualizer's
    // measurement cache does not list `estimateSize`, so without the
    // `measure()` call on a rowHeight change the spacer would keep the md
    // arithmetic.
    rerender(<SizedGrid size="xs" />);
    expect(bottomSpacerHeight()).toBe(expectedSpacer("xs"));

    rerender(<SizedGrid size="xl" />);
    expect(bottomSpacerHeight()).toBe(expectedSpacer("xl"));
  });
});

describe("onReachEnd", () => {
  function ReachGrid({
    rows,
    onReachEnd,
  }: {
    rows: TestRow[];
    onReachEnd: () => void;
  }) {
    const grid = useTMDataGrid<TestRow>({
      data: rows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<TestRow> onReachEnd={onReachEnd} />
      </TMDataGrid>
    );
  }

  it("fires once per row count and again when rows are appended", async () => {
    const calls: number[] = [];
    // Twelve rows all fit the stubbed 600px viewport, so the last row is
    // mounted immediately and the threshold is met on mount.
    const { rerender } = renderWithMantine(
      <ReachGrid rows={testRows} onReachEnd={() => calls.push(1)} />,
    );
    await waitFor(() => expect(calls.length).toBe(1));

    // Same count → the latch holds through re-renders.
    rerender(<ReachGrid rows={testRows} onReachEnd={() => calls.push(1)} />);
    expect(calls.length).toBe(1);

    // The append changes the count, which re-arms the latch.
    rerender(
      <ReachGrid
        rows={[...testRows, ...makeRows(2).map((row) => ({ ...row, id: row.id + 100 }))]}
        onReachEnd={() => calls.push(1)}
      />,
    );
    await waitFor(() => expect(calls.length).toBe(2));
  });

  it("does not fire on an empty grid", () => {
    const calls: number[] = [];
    renderWithMantine(<ReachGrid rows={[]} onReachEnd={() => calls.push(1)} />);
    expect(calls.length).toBe(0);
  });
});

describe("testing contract", () => {
  it("names the root and the grid element", () => {
    renderWithMantine(
      <Grid tableProps={{ "aria-label": "Employees" }} data-testid="employees" />,
    );

    const root = screen.getByTestId("employees");
    expect(root).toHaveAttribute("data-dg-root");
    // The scoping the whole contract rests on: a row is found *through* the
    // named root, which is what keeps two grids on a page apart.
    expect(part("row", { rowId: "1" }, root)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Employees" })).toBeInTheDocument();
  });

  it("addresses a cell by its row and column, with cell selection off", () => {
    const { container } = renderGridUi();

    const cell = container.querySelector(
      '[data-row-id="3"][data-column-id="name"]',
    );
    expect(cell).toHaveTextContent("Maria");
    // Not a `gridcell`: that role is cell selection's promise, and this grid
    // makes none.
    expect(cell).toHaveAttribute("role", "cell");
  });

  it("carries the column id on the header as well as the cells", () => {
    const { container } = renderGridUi();

    expect(header("name")).toHaveAttribute(
      "data-column-id",
      "name",
    );
    expect(
      container.querySelectorAll('[data-column-id="name"]').length,
    ).toBeGreaterThan(1);
  });

  it("publishes the row count the grid is showing, mounted or not", async () => {
    const user = userEvent.setup();
    renderGridUi();

    const grid = screen.getByRole("table");
    expect(grid).toHaveAttribute("data-dg-row-count", String(testRows.length));

    await user.click(part("filter-button"));
    await user.type(part("filter-value"), "3");

    expect(grid).toHaveAttribute("data-dg-row-count", "1");
  });

  it("marks itself busy while meta.loading is set", () => {
    const { rerender } = renderGridUi();
    expect(screen.getByRole("table")).not.toHaveAttribute("aria-busy");

    // Set even with rows on screen: a refetch is still a fetch, and this is
    // the only thing saying so once the body has stopped being empty.
    rerender(<Grid meta={{ loading: true }} />);
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(bodyRows().length).toBeGreaterThan(0);
  });

  it("reaches the chrome by test id under a translated grid", async () => {
    const user = userEvent.setup();
    // The point of the sweep: none of these ids move when the copy does.
    renderGridUi({ labels: TMDATAGRID_LABELS_SV });

    expect(part("toolbar")).toBeInTheDocument();
    expect(part("summary-count")).toHaveTextContent("12 / 12");

    await user.click(part("filter-button"));
    const filterRow = part("filter-row", { columnId: "id" });
    expect(filterRow).toHaveAttribute("data-column-id", "id");
    await user.type(part("filter-value", undefined, filterRow), "3");
    expect(gridRowCount()).toBe(1);

    await user.click(part("filter-panel-close"));
    expect(queryPart("filter-panel")).not.toBeInTheDocument();

    // Clearing takes the panel with it - nothing left in it to show.
    await user.click(part("filter-button"));
    await user.click(part("filter-clear-all"));
    expect(gridRowCount()).toBe(12);

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle", { columnId: "city" }));
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
  });

  it("sorts and pages through the lane and pager test ids", async () => {
    const user = userEvent.setup();
    renderGridUi({ enablePagination: true, initialState: { pagination: { pageIndex: 0, pageSize: 5 } } });

    // A numeric column sorts descending first.
    await user.click(part("header-sort", { columnId: "age" }));
    expect(header("age")).toHaveAttribute(
      "aria-sort",
      "descending",
    );

    expect(part("page-range")).toHaveTextContent("1–5 of 12");
    await user.click(part("page-next"));
    expect(part("page-range")).toHaveTextContent("6–10 of 12");
  });

  it("drives the edit lane and its editor by test id", async () => {
    const user = userEvent.setup();
    type Employee = { id: number; name: string; age: number };
    const helper = createTMDataGridColumnHelper<Employee>();
    const columns = helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]);
    const commits: Array<{ rowId: string }> = [];
    // Outside the component: a fresh array identity every render rebuilds the
    // row model, and the render that follows makes another one.
    const data: Array<Employee> = [{ id: 1, name: "Anna", age: 34 }];

    function EditGrid() {
      const grid = useTMDataGrid<Employee>({
        data,
        columns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "row",
          onCommit: (args) => void commits.push({ rowId: args.rowId }),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }

    renderWithMantine(<EditGrid />);

    await user.click(part("edit-row", { rowId: "1" }));
    const editor = part("editor", { rowId: "1", columnId: "name" });
    await user.clear(part("editor-input", undefined, editor));
    await user.type(part("editor-input", undefined, editor), "Annika");
    await user.click(part("save-row", { rowId: "1" }));

    await waitFor(() => expect(commits).toEqual([{ rowId: "1" }]));
  });

  it("narrows through the search test id", async () => {
    const user = userEvent.setup();
    function SearchGrid() {
      const grid = useTMDataGrid<TestRow>({
        data: testRows,
        columns: testColumns,
        getRowId: (row) => String(row.id),
      });
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <TMDataGrid.Search debounce={0} />
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }

    renderWithMantine(<SearchGrid />);

    await user.type(part("search"), "Sofia");
    // The count the docs tell a Playwright suite to wait on.
    expect(screen.getByRole("table")).toHaveAttribute("data-dg-row-count", "2");

    await user.click(part("search-clear"));
    expect(screen.getByRole("table")).toHaveAttribute("data-dg-row-count", "12");
  });

  it("ticks a row through its checkbox part", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("select-row", { rowId: "2" }));
    expect(part("row", { rowId: "2" })).toHaveAttribute(
      "data-selected",
      "true",
    );

    await user.click(part("select-all"));
    expect(part("row", { rowId: "1" })).toHaveAttribute(
      "data-selected",
      "true",
    );
  });

  it("unticks a row enableRowSelection locks along with the rest", async () => {
    const user = userEvent.setup();
    renderGridUi({
      enableRowSelection: (row) => row.original.id !== 1,
      initialState: { rowSelection: { "1": true, "2": true } },
    });
    const header = () => part("select-all") as HTMLInputElement;

    // Some rows ticked: the first click ticks the rest, the second clears.
    await user.click(header());
    await user.click(header());

    for (const rowId of ["1", "2", "3"]) {
      expect(part("row", { rowId })).not.toHaveAttribute("data-selected");
    }
    expect(header().checked).toBe(false);
    expect(header().indeterminate).toBe(false);
  });
});

describe("persist.urlKey", () => {
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, "", "/");
  });

  const persist = {
    urlKey: ["g", ["columnFilters"]],
  } satisfies UseTMDataGridOptions<TestRow>["persist"];

  const nameFilter = (value: string) => ({
    id: "name",
    value: { operator: "contains", value },
  });

  it("restores the filters in the link and writes changes back after the debounce", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    window.history.replaceState(
      null,
      "",
      `/?other=1&g=${encodeURIComponent(
        JSON.stringify({ columnFilters: [nameFilter("An")] }),
      )}`,
    );

    const { result } = renderGrid({ persist });

    expect(result.current.table.store.state.columnFilters).toEqual([
      nameFilter("An"),
    ]);

    act(() => result.current.table.setColumnFilters([nameFilter("Er")]));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const search = new URLSearchParams(window.location.search);
    expect(JSON.parse(search.get("g") ?? "")).toEqual({
      columnFilters: [nameFilter("Er")],
    });
    expect(search.get("other")).toBe("1");

    // Back to the initial state: the param goes away.
    act(() => result.current.table.setColumnFilters([]));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(window.location.search).toBe("?other=1");
  });

  it("debounces writes across re-renders", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Every URL write reads the param first, so `get` counts the writes and
    // `set` the ones that changed something.
    const urlStorage = { get: vi.fn(() => null), set: vi.fn() };
    const debounced = {
      dataKey: ["d", ["sorting"]],
      urlKey: ["g", ["columnFilters"]],
      urlStorage,
    } satisfies UseTMDataGridOptions<TestRow>["persist"];
    const { result, rerender } = renderGrid({ persist: debounced });
    // The mount reads the URL once and writes once, to both groups; the URL
    // write finds nothing to change.
    const mountReads = urlStorage.get.mock.calls.length;
    expect(urlStorage.set).not.toHaveBeenCalled();
    const setItem = vi.spyOn(window.localStorage, "setItem");

    rerender();
    expect(urlStorage.get).toHaveBeenCalledTimes(mountReads);
    expect(setItem).not.toHaveBeenCalled();

    act(() => result.current.table.setColumnFilters([nameFilter("Er")]));
    rerender();
    expect(urlStorage.get).toHaveBeenCalledTimes(mountReads);
    expect(setItem).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(urlStorage.set).toHaveBeenCalledTimes(1);
    expect(urlStorage.set).toHaveBeenLastCalledWith(
      "g",
      JSON.stringify({ columnFilters: [nameFilter("Er")] }),
    );
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  /** Changes a filter and a sort, then unmounts before the debounce fires. */
  function unmountMidDebounce({ navigateFirst }: { navigateFirst: boolean }) {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    window.history.replaceState(null, "", "/grid");
    const { result, unmount } = renderGrid({
      persist: { dataKey: ["d", ["sorting"]], urlKey: ["g", ["columnFilters"]] },
    });

    act(() => {
      result.current.table.setColumnFilters([nameFilter("Er")]);
      result.current.table.setSorting([{ id: "name", desc: true }]);
    });
    // An SPA router moves the URL before React unmounts the old page.
    if (navigateFirst) window.history.pushState(null, "", "/elsewhere");
    unmount();
  }

  const storedSorting = () =>
    JSON.parse(localStorage.getItem("d") ?? "{}").sorting as unknown;

  it("flushes the URL and storage when the grid unmounts in place", () => {
    unmountMidDebounce({ navigateFirst: false });

    expect(window.location.pathname).toBe("/grid");
    expect(
      JSON.parse(new URLSearchParams(window.location.search).get("g") ?? ""),
    ).toEqual({ columnFilters: [nameFilter("Er")] });
    expect(storedSorting()).toEqual([{ id: "name", desc: true }]);
  });

  it("flushes storage but not the URL when a navigation unmounts the grid", () => {
    unmountMidDebounce({ navigateFirst: true });

    expect(window.location.pathname).toBe("/elsewhere");
    expect(window.location.search).toBe("");
    expect(storedSorting()).toEqual([{ id: "name", desc: true }]);
  });

  it("reports a slice listed by both dataKey and urlKey, once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = renderGrid({
      persist: {
        dataKey: ["d", ["columnFilters", "sorting"]],
        urlKey: ["g", ["columnFilters"]],
      },
    });
    rerender();

    const overlaps = error.mock.calls.filter(([message]) =>
      String(message).includes("persist.urlKey"),
    );
    expect(overlaps).toEqual([
      [
        "TMDataGrid: persist.dataKey and persist.urlKey both list columnFilters - a slice lives in one group; urlKey takes it.",
      ],
    ]);
  });
});
