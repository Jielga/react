import { Menu } from "@mantine/core";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  bodyRows,
  cellAt,
  parts,
  renderedRowIds,
  renderGridUi,
  selectedCells,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { captureDownloads } from "../../test/downloadStub";
import { tsvFormat, type TMDataGridExportContext } from "../core/export";
import { createTMDataGridColumnHelper } from "../useTMDataGrid";
import { SELECT_COLUMN_ID } from "./TMDataGridSelectColumn";

/** Where the keyboard is, read off the DOM rather than off the store. */
const focused = () => document.activeElement as HTMLElement;

const focusedCoords = () => {
  const cell = document.querySelector<HTMLElement>(
    '[data-cell="true"][data-focused="true"]',
  );
  return cell === null
    ? null
    : { rowId: cell.dataset.rowId, columnId: cell.dataset.columnId };
};

/** Whether the keyboard is anywhere in the body at all. */
const focusIsInABody = () => focused().closest('[data-dg-part="row"]') !== null;

/**
 * The harness columns plus a lane whose cell holds a plain button - the custom
 * cell a consumer writes, with no `tabIndex` of its own. Module scope for the
 * same reason `testColumns` is: `useTMDataGrid` memoizes on the reference.
 */
const buttonColumns = (() => {
  const helper = createTMDataGridColumnHelper<TestRow>();
  return [
    ...testColumns,
    helper.display({
      id: "open",
      header: "Open",
      cell: () => <button type="button">Open</button>,
    }),
  ];
})();

/** The button lane's cell, on a grid rendered with `buttonColumns`. */
const buttonCell = (rowIndex: number) => cellAt(rowIndex, 5);

/**
 * The cell cursor and the range rectangle. Split from TMDataGrid.test.tsx
 * for worker parallelism; the shared scaffolding lives in the harness.
 */
describe("cell selection", () => {
  /**
   * All twelve test rows are mounted under jsdom - the virtualizer falls back
   * to a 600px viewport, which is more than they need - so a move never has to
   * wait for a scroll to mount its target here.
   */
  it("is off unless asked for", () => {
    renderGridUi();

    // Still a table of cells, and nothing in the body is reachable by Tab -
    // exactly as it was before the option existed.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    const [firstRow] = bodyRows();
    expect(within(firstRow!).getAllByRole("cell")[0]).not.toHaveAttribute(
      "tabindex",
    );
  });

  it("reports itself as a grid of gridcells", () => {
    renderGridUi({ cellSelection: "single" });

    expect(screen.getByRole("grid")).toBeInTheDocument();
    // 1-based, and in render order - the checkbox lane is column 1.
    expect(cellAt(0, 0)).toHaveAttribute("aria-colindex", "1");
    expect(cellAt(0, 4)).toHaveAttribute("aria-colindex", "5");
  });

  it("keeps every cell out of the tab order and enters through the guards", () => {
    renderGridUi({ cellSelection: "single" });

    // No cell is a tab stop of its own: a cell in the tab order would turn up
    // between two of a row's controls when Tab walks them. The two guards
    // bracketing the body are where Tab lands, and they hand the focus on.
    const stops = screen
      .getAllByRole("gridcell")
      .filter((cell) => cell.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(0);
    const guards = document.querySelectorAll('[data-dg-part="tab-guard"]');
    expect(guards).toHaveLength(2);
    for (const guard of guards) expect(guard).toHaveAttribute("tabindex", "0");
  });

  it("takes the body's controls out of the tab order", () => {
    renderGridUi({ cellSelection: "single", renderDetails: () => "panel" });

    // Every checkbox and chevron in the body. Left tabbable, Tab would walk
    // through one per mounted row - and how many that is depends on the scroll
    // position, which is no way to build a tab order.
    for (const row of bodyRows()) {
      for (const control of within(row).getAllByRole("checkbox")) {
        expect(control).toHaveAttribute("tabindex", "-1");
      }
      for (const control of within(row).getAllByRole("button")) {
        expect(control).toHaveAttribute("tabindex", "-1");
      }
    }

    // The header's own controls stay reachable: the header row is not part of
    // cell navigation, so Tab is the only way to them.
    expect(
      screen.getByRole("checkbox", { name: "Select all rows" }),
    ).not.toHaveAttribute("tabindex", "-1");
  });

  it("leaves the body's controls alone when cell selection is off", () => {
    renderGridUi();

    expect(within(bodyRows()[0]!).getByRole("checkbox")).not.toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("is one tab stop for the whole body", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(1, 2));
    await user.tab();

    // Out of the body entirely - not into the next row's checkbox, and not into
    // a control inside the cell just left.
    expect(focusIsInABody()).toBe(false);
  });

  it("is one tab stop backwards too", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(1, 2));
    await user.tab({ shift: true });

    expect(focusIsInABody()).toBe(false);
  });

  it("keeps a custom cell's button out of the page's tab order", () => {
    renderGridUi({ cellSelection: "single", columns: buttonColumns });

    // The consumer set no `tabIndex`, so the button is tabbable in itself.
    // What keeps it out of the page's order is that Tab never walks the body:
    // it enters at the cursor cell, and leaves it for the guard past the edge,
    // from where the browser's own Tab carries on out of the grid.
    const [leading, trailing] = parts("tab-guard");
    expect(
      screen.getAllByRole("button", { name: "Open" })[0],
    ).not.toHaveAttribute("tabindex");

    leading!.focus();
    expect(focused()).toBe(cellAt(0, 0));

    // `fireEvent`, not `user.tab()`: user-event picks its destination from the
    // element the key was pressed on, so it walks into a button the browser
    // would never stop at. The hop onto the guard is the part the grid owns.
    fireEvent.keyDown(cellAt(0, 0), { key: "Tab" });
    expect(focused()).toBe(trailing);
    expect(focusIsInABody()).toBe(false);
  });

  it("steps into a custom cell's button and back out again", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single", columns: buttonColumns });

    await user.click(buttonCell(0));
    await user.keyboard("{Enter}");
    expect(focused()).toBe(within(buttonCell(0)).getByRole("button"));

    await user.keyboard("{Escape}");
    expect(focused()).toBe(buttonCell(0));
  });

  it("moves the cursor to the next row past a row's last control", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single", columns: buttonColumns });

    await user.click(buttonCell(0));
    await user.keyboard("{Enter}");
    await user.tab();

    // The next row's first cell, and the cell itself - the row it lands on is
    // not stepped into.
    expect(focused()).toBe(cellAt(1, 0));

    // Backwards, the same rule the other way: the previous row's last cell.
    await user.click(buttonCell(2));
    await user.keyboard("{Enter}");
    await user.tab({ shift: true });
    expect(focused()).toBe(cellAt(1, 5));
  });

  it("leaves the body from the last row's last control", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single", columns: buttonColumns });

    const lastRow = bodyRows().length - 1;
    await user.click(buttonCell(lastRow));
    await user.keyboard("{Enter}");
    await user.tab();

    expect(focusIsInABody()).toBe(false);
  });

  it("selects the row from Space under the checkbox mode too", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(1, 3));
    await user.keyboard(" ");

    // The checkbox is no longer a tab stop, so Space on any cell of the row is
    // what replaces it. It adds rather than replaces, as ticking a box does.
    expect(bodyRows()[1]).toHaveAttribute("data-selected", "true");

    await user.keyboard("{ArrowDown} ");

    expect(bodyRows()[1]).toHaveAttribute("data-selected", "true");
    expect(bodyRows()[2]).toHaveAttribute("data-selected", "true");
  });

  it("still steps into the checkbox with Enter", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 0));
    await user.keyboard("{Enter}");

    // `tabindex="-1"` keeps it out of the tab order without putting it out of
    // reach, which is what the pair is for.
    expect(focused()).toBe(within(cellAt(0, 0)).getByRole("checkbox"));
  });

  it("moves the focus with the arrow keys", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    expect(focusedCoords()).toEqual({ rowId: "1", columnId: "name" });

    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(cellAt(1, 2));
    expect(focusedCoords()).toEqual({ rowId: "2", columnId: "name" });

    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe(cellAt(1, 3));

    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(focused()).toBe(cellAt(0, 2));
  });

  it("hands the focus to the cursor cell when Tab arrives at a guard", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(cellAt(1, 2));

    // Focus arriving at a guard from outside the body is forwarded to the
    // cursor, so Shift+Tab from below the grid comes back to where it was.
    const [, trailing] = document.querySelectorAll<HTMLElement>(
      '[data-dg-part="tab-guard"]',
    );
    trailing!.focus();
    expect(focused()).toBe(cellAt(1, 2));
  });

  it("takes Home and End across the row, and Ctrl to the corners", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(2, 2));
    await user.keyboard("{End}");
    expect(focused()).toBe(cellAt(2, 4));

    await user.keyboard("{Home}");
    expect(focused()).toBe(cellAt(2, 0));

    await user.keyboard("{Control>}{End}{/Control}");
    expect(focusedCoords()).toEqual({
      rowId: String(testRows.length),
      columnId: "city",
    });

    await user.keyboard("{Control>}{Home}{/Control}");
    expect(focusedCoords()).toEqual({ rowId: "1", columnId: SELECT_COLUMN_ID });
  });

  it("stops at the edges instead of wrapping", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 0));
    await user.keyboard("{ArrowUp}{ArrowLeft}");

    expect(focused()).toBe(cellAt(0, 0));
  });

  it("steps into the cell with Enter and back out with Escape", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    const checkboxCell = cellAt(0, 0);
    await user.click(checkboxCell);
    await user.keyboard("{Enter}");

    // Inside the cell now - the arrow keys belong to whatever holds the focus,
    // which is what leaves room for an editor to take the same step later.
    expect(focused()).toBe(within(checkboxCell).getByRole("checkbox"));
    // The ring stays on the cell: that is still where navigation resumes from.
    expect(checkboxCell).toHaveAttribute("data-focused", "true");

    await user.keyboard("{Escape}");
    expect(focused()).toBe(checkboxCell);

    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(cellAt(1, 0));
  });

  it("leaves Enter alone in a cell with nothing to step into", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{Enter}");

    expect(focused()).toBe(cellAt(0, 2));
  });

  it("still selects the row from Space", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single", selectionMode: "row" });

    // The click selects the row it lands on, as a click does in this mode.
    await user.click(cellAt(0, 2));
    // Moving the cell is not selecting - the keyboard walks the grid freely.
    await user.keyboard("{ArrowDown}");
    expect(bodyRows()[1]).not.toHaveAttribute("data-selected");

    await user.keyboard(" ");

    // The row lost its own tab stop to the cells, so Space on a cell is the
    // only keyboard route left to a selection under `"row"`. It toggles rather
    // than replaces, so the row clicked into the selection is still in it.
    expect(bodyRows()[1]).toHaveAttribute("data-selected", "true");
    expect(bodyRows()[0]).toHaveAttribute("data-selected", "true");
    expect(bodyRows()[1]).not.toHaveAttribute("tabindex");
  });

  it("adds the range from the anchor row with Shift+Space", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single", selectionMode: "row" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{ArrowDown}{ArrowDown}{Shift>} {/Shift}");

    for (const row of bodyRows().slice(0, 3)) {
      expect(row).toHaveAttribute("data-selected", "true");
    }
    expect(bodyRows()[3]).not.toHaveAttribute("data-selected");
  });

  it("highlights the row from Space under the highlight mode", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single", selectionMode: "highlight" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{ArrowDown} ");

    expect(bodyRows()[1]).toHaveAttribute("data-highlighted", "true");
    expect(bodyRows()[0]).not.toHaveAttribute("data-highlighted");
    expect(bodyRows()[1]).not.toHaveAttribute("data-selected");
  });

  it("keeps the focus on its cell when sorting moves the row", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    // Row 3 - City "Malmö", the third of the repeating three.
    await user.click(cellAt(2, 4));
    expect(focusedCoords()).toEqual({ rowId: "3", columnId: "city" });

    await user.click(screen.getByRole("button", { name: "Sort City" }));

    // The row is somewhere else entirely now. A row/column index pair would be
    // pointing at whichever row slid into position 2; ids move with the cell.
    expect(focusedCoords()).toEqual({ rowId: "3", columnId: "city" });
    expect(renderedRowIds().indexOf("3")).not.toBe(2);
  });

  it('selects nothing but the focused cell under "single"', async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");

    // Shift is a range gesture and there are no ranges here: the focus moved,
    // and the block Ctrl+C would take is still the one cell it moved to.
    expect(selectedCells()).toEqual(["2:name"]);
  });

  it("reports every move through onFocusedCellChange", async () => {
    const user = userEvent.setup();
    const moves: Array<string> = [];
    renderGridUi({
      cellSelection: "single",
      onFocusedCellChange: (cell) =>
        moves.push(cell === null ? "none" : `${cell.rowId}:${cell.columnId}`),
    });

    await user.click(cellAt(0, 2));
    await user.keyboard("{ArrowDown}");

    expect(moves).toEqual(["1:name", "2:name"]);
  });

  /**
   * The stacking ladder, read off the DOM. A pinned lane stays over the row
   * scrolling under it, ring and all - so a focused cell only outranks the
   * lane when it is pinned itself.
   */
  it("keeps the focus ring under a pinned lane unless the cell is pinned too", async () => {
    const user = userEvent.setup();
    renderGridUi({
      cellSelection: "single",
      initialState: { columnPinning: { start: ["id"], end: [] } },
    });

    const pinnedCell = () =>
      document.querySelector<HTMLElement>(
        '[data-cell="true"][data-row-id="1"][data-column-id="id"]',
      )!;
    const focusedCell = () =>
      document.querySelector<HTMLElement>(
        '[data-cell="true"][data-focused="true"]',
      )!;

    await user.click(cellAt(0, 3));

    expect(focusedCell().dataset.columnId).not.toBe("id");
    expect(focusedCell().style.zIndex).toBe("var(--dg-z-focused-cell, 1)");
    expect(pinnedCell().style.zIndex).toBe("var(--dg-z-pinned-cell, 2)");

    await user.click(pinnedCell());

    expect(focusedCell().dataset.columnId).toBe("id");
    expect(focusedCell().style.zIndex).toBe(
      "var(--dg-z-pinned-focused-cell, 3)",
    );
  });
});

describe("cell selection - ranges", () => {
  const rangeGrid = () => renderGridUi({ cellSelection: "range" });

  it("selects the rectangle a drag covers", async () => {
    const user = userEvent.setup();
    rangeGrid();

    // Name of row 1 down to Age of row 3 - a two-by-three block, dragged from
    // its top-left corner.
    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(2, 3) },
      { keys: "[/MouseLeft]" },
    ]);

    expect(selectedCells()).toEqual([
      "1:name",
      "1:age",
      "2:name",
      "2:age",
      "3:name",
      "3:age",
    ]);
  });

  it('extends the rectangle and the row selection with one Shift+click under selectionMode "row"', async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "range", selectionMode: "row" });

    await user.click(cellAt(0, 2));
    await user.keyboard("{Shift>}");
    await user.click(cellAt(2, 2));
    await user.keyboard("{/Shift}");

    expect(selectedCells()).toHaveLength(3);
    for (const row of bodyRows().slice(0, 3)) {
      expect(row).toHaveAttribute("data-selected", "true");
    }
  });

  it("selects the same rectangle dragged the other way", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(2, 3), keys: "[MouseLeft>]" },
      { target: cellAt(0, 2) },
      { keys: "[/MouseLeft]" },
    ]);

    expect(selectedCells()).toHaveLength(6);
    expect(selectedCells()).toContain("1:name");
    expect(selectedCells()).toContain("3:age");
  });

  it("outlines the edges of the block, not every cell in it", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(2, 3) },
      { keys: "[/MouseLeft]" },
    ]);

    // Top-left corner: two sides. The cell in the middle of the left column:
    // one. The stylesheet draws whichever sides these name.
    expect(cellAt(0, 2)).toHaveAttribute("data-edge-top", "true");
    expect(cellAt(0, 2)).toHaveAttribute("data-edge-left", "true");
    expect(cellAt(0, 2)).not.toHaveAttribute("data-edge-bottom");
    expect(cellAt(1, 2)).toHaveAttribute("data-edge-left", "true");
    expect(cellAt(1, 2)).not.toHaveAttribute("data-edge-top");
  });

  it("extends the block with Shift+click, from the anchor", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(1, 2));
    await user.keyboard("{Shift>}");
    await user.click(cellAt(3, 2));
    await user.keyboard("{/Shift}");

    expect(selectedCells()).toEqual(["2:name", "3:name", "4:name"]);
  });

  it("keeps the block when a control inside a cell is pressed", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "range", columns: buttonColumns });

    await user.click(cellAt(0, 2));
    await user.keyboard("{Shift>}");
    await user.click(cellAt(2, 3));
    await user.keyboard("{/Shift}");
    const block = selectedCells();
    expect(block.length).toBeGreaterThan(1);

    await user.click(within(buttonCell(4)).getByRole("button"));

    // Pressing a button is not a selection gesture: the block survives it. The
    // cursor still follows the press, so it names the row acted on.
    expect(selectedCells()).toEqual(block);
    expect(focusedCoords()).toEqual({ rowId: "5", columnId: "open" });
  });

  it("extends the block with Shift+arrows, and collapses it without", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(0, 2));
    await user.keyboard("{Shift>}{ArrowDown}{ArrowRight}{/Shift}");

    expect(selectedCells()).toEqual(["1:name", "1:age", "2:name", "2:age"]);
    // The focus is the corner that moved; the anchor stayed put.
    expect(cellAt(1, 3)).toHaveAttribute("data-focused", "true");

    await user.keyboard("{ArrowDown}");

    // A plain arrow is a move, not an extension - the block comes back to the
    // one cell, which is what keeps "what would Ctrl+C take" answerable.
    expect(selectedCells()).toEqual(["3:age"]);
  });

  it("drops the block back to one cell on Escape", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(0, 2));
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selectedCells()).toHaveLength(2);

    await user.keyboard("{Escape}");

    // Onto the focused cell, not back to the anchor: the focus is where the
    // user is looking, and the next arrow key continues from there either way.
    expect(selectedCells()).toEqual(["2:name"]);
  });

  it("copies the block as tab-separated text on Ctrl+C", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(1, 3) },
      { keys: "[/MouseLeft]" },
    ]);
    await user.keyboard("{Control>}c{/Control}");

    // Tabs between cells and CRLF between rows is what a spreadsheet reads as
    // cells; the first two rows of the fixture are Anna 20 and Erik 27.
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(
        `${testRows[0]!.name}\t${testRows[0]!.age}\r\n${testRows[1]!.name}\t${testRows[1]!.age}`,
      ),
    );
  });

  it("copies the focused cell alone when nothing is dragged", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(2, 4));
    await user.keyboard("{Control>}c{/Control}");

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(testRows[2]!.city),
    );
  });

  it("leaves the generated lanes out of what it copies", async () => {
    const user = userEvent.setup();
    rangeGrid();

    // The checkbox lane through to Name - the lane holds a control, not data.
    await user.pointer([
      { target: cellAt(0, 0), keys: "[MouseLeft>]" },
      { target: cellAt(0, 2) },
      { keys: "[/MouseLeft]" },
    ]);
    await user.keyboard("{Control>}c{/Control}");

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(
        `${testRows[0]!.id}\t${testRows[0]!.name}`,
      ),
    );
  });

  it("marks the system lanes as selected but never copies them", async () => {
    const user = userEvent.setup();
    rangeGrid();

    // The checkbox lane through to Name.
    await user.pointer([
      { target: cellAt(0, 0), keys: "[MouseLeft>]" },
      { target: cellAt(0, 2) },
      { keys: "[/MouseLeft]" },
    ]);

    // Part of the block: it takes the tint and the outline, so the rectangle
    // stays a rectangle and the lane keeps its place in the navigation.
    expect(cellAt(0, 0)).toHaveAttribute("data-selected", "true");
    expect(cellAt(0, 0)).toHaveAttribute("data-edge-left", "true");

    fireEvent.contextMenu(cellAt(0, 0));

    // Three cells wide, but only the two data columns can be written out.
    expect(await screen.findByText("3 cells")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeEnabled();
  });

  it("disables copy and export for a block of nothing but system lanes", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(0, 0));
    fireEvent.contextMenu(cellAt(0, 0));

    // A checkbox has no value to copy. Saying so beats an item that looks live
    // and puts an empty string on the clipboard.
    expect(
      await screen.findByRole("menuitem", { name: "Copy" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Download as CSV" }),
    ).toBeDisabled();
  });

  it("offers the export items on a right-click inside the block", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(2, 3) },
      { keys: "[/MouseLeft]" },
    ]);
    fireEvent.contextMenu(cellAt(1, 2));

    expect(await screen.findByText("6 cells")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Download as CSV" }),
    ).toBeInTheDocument();
    // The block is the one that was dragged: a right-click inside it is about
    // it, not about the cell under the pointer.
    expect(selectedCells()).toHaveLength(6);
  });

  it("names the download item after the grid's format", async () => {
    const user = userEvent.setup();
    renderGridUi({
      cellSelection: "range",
      exportOptions: { format: tsvFormat() },
    });

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));

    expect(
      await screen.findByRole("menuitem", { name: "Download as TSV" }),
    ).toBeInTheDocument();
  });

  it("shows a string label for the download item as it is", async () => {
    const user = userEvent.setup();
    renderGridUi({
      cellSelection: "range",
      labels: { exportCells: "Save cells" },
    });

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));

    expect(
      await screen.findByRole("menuitem", { name: "Save cells" }),
    ).toBeInTheDocument();
  });

  it("keeps only Copy under enableDownload: false", async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "range", enableDownload: false });

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));

    expect(await screen.findByRole("menuitem", { name: "Copy" })).toBeEnabled();
    expect(
      screen.queryByRole("menuitem", { name: "Download as CSV" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Include headers")).not.toBeInTheDocument();
  });

  it("copies what mapExportData returns", async () => {
    const user = userEvent.setup();
    const contexts: Array<TMDataGridExportContext> = [];
    renderGridUi({
      cellSelection: "range",
      mapExportData: (data, context) => {
        contexts.push(context);
        return { ...data, rows: data.rows.slice(0, 1) };
      },
    });

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(2, 2) },
      { keys: "[/MouseLeft]" },
    ]);
    await user.keyboard("{Control>}c{/Control}");

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(testRows[0]!.name),
    );
    expect(contexts).toEqual([{ target: "clipboard", rows: "range" }]);
  });

  it("copies nothing when mapExportData returns null", async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderGridUi({
      cellSelection: "range",
      mapExportData: () => {
        calls += 1;
        return null;
      },
    });
    await navigator.clipboard.writeText("before");

    await user.click(cellAt(0, 2));
    await user.keyboard("{Control>}c{/Control}");

    await waitFor(() => expect(calls).toBe(1));
    expect(await navigator.clipboard.readText()).toBe("before");
  });

  it("downloads what mapExportData returns from the menu", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    const contexts: Array<TMDataGridExportContext> = [];
    renderGridUi({
      cellSelection: "range",
      mapExportData: (data, context) => {
        contexts.push(context);
        return { ...data, rows: data.rows.slice(0, 1) };
      },
    });

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(2, 2) },
      { keys: "[/MouseLeft]" },
    ]);
    fireEvent.contextMenu(cellAt(1, 2));
    await user.click(
      await screen.findByRole("menuitem", { name: "Download as CSV" }),
    );

    await waitFor(() => expect(downloads).toHaveLength(1));
    const text = (await downloads[0]?.text()) ?? "";
    // `trim` takes the BOM with it.
    expect(text.trim().split("\r\n")).toEqual([
      "sep=;",
      "Name",
      testRows[0]!.name,
    ]);
    expect(contexts).toEqual([{ target: "file", rows: "range" }]);
  });

  it("moves the block to a right-click outside it", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.pointer([
      { target: cellAt(0, 2), keys: "[MouseLeft>]" },
      { target: cellAt(1, 2) },
      { keys: "[/MouseLeft]" },
    ]);
    fireEvent.contextMenu(cellAt(3, 4));

    expect(await screen.findByText("1 cell")).toBeInTheDocument();
    expect(selectedCells()).toEqual(["4:city"]);
  });

  it("keeps a consumer's row menu, under the grid's own items", async () => {
    const user = userEvent.setup();
    renderGridUi({
      cellSelection: "range",
      tableProps: { renderRowContextMenu: () => <Menu.Item>Open</Menu.Item> },
    });

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));

    expect(
      await screen.findByRole("menuitem", { name: "Copy" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
  });

  it('has no menu of its own under "single"', async () => {
    const user = userEvent.setup();
    renderGridUi({ cellSelection: "single" });

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));

    // Nothing to offer: the selection is always the one cell under the pointer,
    // and Ctrl+C already copies it.
    expect(
      screen.queryByRole("menuitem", { name: "Copy" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the headers toggle open while it is being toggled", async () => {
    const user = userEvent.setup();
    rangeGrid();

    await user.click(cellAt(0, 2));
    fireEvent.contextMenu(cellAt(0, 2));
    const toggle = await screen.findByRole("checkbox", {
      name: "Include headers",
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(
      screen.getByRole("checkbox", { name: "Include headers" }),
    ).not.toBeChecked();
  });
});
