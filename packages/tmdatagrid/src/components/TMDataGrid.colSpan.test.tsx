import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  part,
  queryPart,
  renderGrid,
  renderGridUi,
  renderWithMantine,
  type TestRow,
} from "../../test/gridHarness";
import {
  createTMDataGridColumnHelper,
  type TMDataGridColumnMeta,
} from "../useTMDataGrid";
import { TMDataGrid } from "./TMDataGrid";
import { DETAILS_COLUMN_ID } from "./TMDataGridDetailsColumn";

const helper = createTMDataGridColumnHelper<TestRow>();

/**
 * The harness columns with `name` spanning `colSpan`. Called at module scope:
 * `useTMDataGrid` memoizes on the columns reference.
 */
const columnsWithNameSpan = (
  colSpan: TMDataGridColumnMeta<TestRow>["colSpan"],
) =>
  helper.columns([
    helper.accessor("id", { header: "ID", meta: { type: "number" } }),
    helper.accessor("name", { header: "Name", meta: { colSpan } }),
    helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    helper.accessor("city", { header: "City" }),
  ]);

const staticSpan = columnsWithNameSpan(2);
const infiniteSpan = columnsWithNameSpan(Infinity);
const openRowSpan = columnsWithNameSpan(({ row }) =>
  row.getIsExpanded() ? Infinity : 1,
);
// Row 2 only - the one a vertical move lands on in the tests below.
const secondRowSpan = columnsWithNameSpan(({ row }) =>
  row.id === "2" ? 2 : 1,
);
// Row 1 takes the whole row, and City holds a control - for Shift+Tab, which
// walks from a row's first control to the previous row's last column.
const firstRowSpanWithButton = helper.columns([
  helper.accessor("id", { header: "ID", meta: { type: "number" } }),
  helper.accessor("name", {
    header: "Name",
    meta: { colSpan: ({ row }) => (row.id === "1" ? Infinity : 1) },
  }),
  helper.accessor("age", { header: "Age", meta: { type: "number" } }),
  helper.accessor("city", {
    header: "City",
    cell: ({ getValue }) => <button type="button">{getValue<string>()}</button>,
  }),
]);

/** One body cell by its coordinates; `null` when it does not render. */
const bodyCell = (rowId: string, columnId: string) =>
  part("row", { rowId }).querySelector<HTMLElement>(
    `[data-column-id="${columnId}"]:not([data-dg-part])`,
  );

describe("meta.colSpan", () => {
  it("renders one cell over the columns to its right", () => {
    renderGridUi({ columns: staticSpan });

    const name = bodyCell("1", "name");
    expect(name).toHaveAttribute("aria-colspan", "2");
    expect(name).toHaveAttribute("data-col-span", "2");
    expect(name).toHaveStyle({ gridColumn: "span 2" });
    expect(bodyCell("1", "age")).toBeNull();
    expect(bodyCell("1", "id")).not.toBeNull();
    expect(bodyCell("1", "city")).not.toBeNull();
  });

  it("decides per row, here on whether the row is open", async () => {
    const user = userEvent.setup();
    renderGridUi({
      columns: openRowSpan,
      renderDetails: ({ row }) => `Details for ${row.original.name}`,
    });

    expect(bodyCell("1", "name")).not.toHaveAttribute("aria-colspan");
    await user.click(
      within(part("row", { rowId: "1" })).getByRole("button", {
        name: /Show details/,
      }),
    );

    // To the last of the user's columns, and the panel still opens below.
    expect(bodyCell("1", "name")).toHaveAttribute("aria-colspan", "3");
    expect(bodyCell("1", "age")).toBeNull();
    expect(bodyCell("1", "city")).toBeNull();
    expect(queryPart("details", { rowId: "1" })).toBeInTheDocument();
    // The chevron lane is untouched, and so is every closed row.
    expect(part("details-toggle", { rowId: "1" })).toBeInTheDocument();
    expect(bodyCell("2", "age")).not.toBeNull();
  });

  it("never covers a generated lane", () => {
    renderGridUi({
      columns: infiniteSpan,
      renderDetails: () => "panel",
      detailsColumnPosition: "right",
    });

    expect(bodyCell("1", "name")).toHaveAttribute("aria-colspan", "3");
    expect(
      part("row", { rowId: "1" }).querySelector(
        `[data-column-id="${DETAILS_COLUMN_ID}"]`,
      ),
    ).not.toBeNull();
  });

  it("sticks a right-pinned spanning cell at the offset of the last column it covers", () => {
    renderGridUi({
      columns: secondRowSpan,
      initialState: { columnPinning: { start: [], end: ["name", "age"] } },
    });

    // Row 1 is unspanned: Name sits one Age-width in from the right edge.
    // Row 2's Name covers Age, the last column, so it sticks where Age does.
    const unspannedName = bodyCell("1", "name")!;
    const unspannedAge = bodyCell("1", "age")!;
    const spanning = bodyCell("2", "name")!;
    expect(spanning).toHaveAttribute("aria-colspan", "2");
    expect(spanning).toHaveStyle({ position: "sticky" });
    expect(spanning.style.right).toBe(unspannedAge.style.right);
    expect(spanning.style.right).not.toBe(unspannedName.style.right);
  });

  it("is ignored on a group row", () => {
    renderGridUi({
      columns: infiniteSpan,
      initialState: { grouping: ["city"] },
    });

    const groupRow = part("row", { rowId: "city:Stockholm" });
    expect(groupRow.querySelector("[aria-colspan]")).toBeNull();
  });

  describe("under cell selection", () => {
    const focusedCell = () =>
      document.querySelector<HTMLElement>('[data-cell="true"][data-focused="true"]');

    it("steps over the spanning cell as one cell", async () => {
      const user = userEvent.setup();
      renderGridUi({ columns: staticSpan, cellSelection: "single" });

      await user.click(bodyCell("1", "name")!);
      expect(focusedCell()?.dataset.columnId).toBe("name");

      await user.keyboard("{ArrowRight}");
      expect(focusedCell()?.dataset.columnId).toBe("city");
      expect(document.activeElement).toBe(bodyCell("1", "city"));

      // Left from City lands on Age, which Name covers.
      await user.keyboard("{ArrowLeft}");
      expect(focusedCell()?.dataset.columnId).toBe("name");
      expect(document.activeElement).toBe(bodyCell("1", "name"));
    });

    it("moves onto the spanning cell from a column it covers", async () => {
      const user = userEvent.setup();
      renderGridUi({ columns: secondRowSpan, cellSelection: "single" });

      await user.click(bodyCell("1", "age")!);
      await user.keyboard("{ArrowDown}");

      expect(focusedCell()?.dataset.rowId).toBe("2");
      expect(focusedCell()?.dataset.columnId).toBe("name");
      expect(document.activeElement).toBe(bodyCell("2", "name"));
    });

    it("takes the spanning cell into the range when a move lands on it", async () => {
      const user = userEvent.setup();
      renderGridUi({ columns: secondRowSpan, cellSelection: "range" });

      await user.click(bodyCell("1", "age")!);
      await user.keyboard("{Shift>}{ArrowDown}{/Shift}");

      // The move landed on Name, so the rectangle now runs Name to Age; the
      // spanning cell is one box and the right edge falls inside it.
      const name = bodyCell("2", "name")!;
      expect(name).toHaveAttribute("data-selected", "true");
      expect(name).toHaveAttribute("data-edge-left", "true");
      expect(name).toHaveAttribute("data-edge-right", "true");
      expect(bodyCell("1", "name")).toHaveAttribute("data-selected", "true");
    });

    it("leaves the spanning cell out of a range over the columns it covers", async () => {
      const user = userEvent.setup();
      renderGridUi({ columns: secondRowSpan, cellSelection: "range" });

      // Age on rows 1 to 3; row 2's Age is covered by Name, and Name is
      // addressed by its own column, which the rectangle does not hold.
      await user.click(bodyCell("1", "age")!);
      await user.keyboard("{Shift>}");
      await user.click(bodyCell("3", "age")!);
      await user.keyboard("{/Shift}");

      expect(bodyCell("1", "age")).toHaveAttribute("data-selected", "true");
      expect(bodyCell("3", "age")).toHaveAttribute("data-selected", "true");
      expect(bodyCell("2", "name")).not.toHaveAttribute("data-selected");
    });

    it("leaves the range alone when Right is clamped at the spanning cell's end", async () => {
      const user = userEvent.setup();
      renderGridUi({ columns: infiniteSpan, cellSelection: "range" });

      await user.click(bodyCell("1", "id")!);
      await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
      expect(bodyCell("1", "id")).toHaveAttribute("data-selected", "true");
      expect(bodyCell("1", "name")).toHaveAttribute("data-selected", "true");

      // Name runs to the last column: there is nowhere to go, and a move that
      // goes nowhere does not collapse the rectangle.
      await user.keyboard("{ArrowRight}");
      expect(bodyCell("1", "id")).toHaveAttribute("data-selected", "true");
      expect(document.activeElement).toBe(bodyCell("1", "name"));
    });

    it("follows the focus onto the spanning cell when its column is covered", async () => {
      const user = userEvent.setup();
      renderGridUi({
        columns: openRowSpan,
        renderDetails: () => "panel",
        cellSelection: "single",
        // Click-to-expand: the click focuses Age and then opens the row,
        // whose Name now covers Age.
        tableProps: { onRowClick: (row) => row.toggleExpanded() },
      });

      await user.click(bodyCell("1", "age")!);

      expect(queryPart("details", { rowId: "1" })).toBeInTheDocument();
      expect(bodyCell("1", "age")).toBeNull();
      await waitFor(() =>
        expect(document.activeElement).toBe(bodyCell("1", "name")),
      );
      expect(focusedCell()?.dataset.columnId).toBe("name");
    });

    it("walks Shift+Tab onto the spanning cell covering the previous row's last column", async () => {
      const user = userEvent.setup();
      renderGridUi({ columns: firstRowSpanWithButton, cellSelection: "single" });

      await user.click(bodyCell("2", "city")!);
      await user.keyboard("{Enter}");
      expect(document.activeElement).toBe(
        within(bodyCell("2", "city")!).getByRole("button"),
      );

      // Row 1's City is covered by Name, so the cursor lands on Name.
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(bodyCell("1", "name"));
      expect(focusedCell()?.dataset.columnId).toBe("name");
    });
  });

  describe("under cell editing", () => {
    it("moves Tab from the spanning cell's editor past the columns it covers", async () => {
      const user = userEvent.setup();
      renderGridUi({
        columns: staticSpan,
        cellSelection: "single",
        editing: { mode: "cell" },
      });

      await user.dblClick(bodyCell("1", "name")!);
      const editor = screen.getByRole("textbox", { name: "Edit Name" });
      await user.clear(editor);
      await user.type(editor, "Annika");
      await user.keyboard("{Tab}");

      // Age is covered on this row; City is the next cell with an editor.
      expect(document.activeElement).toBe(bodyCell("1", "city"));
    });

    it("keeps the row's cells while an editor is open where a span would land", async () => {
      const user = userEvent.setup();
      const { result } = renderGrid({
        columns: openRowSpan,
        renderDetails: () => "panel",
        editing: { mode: "cell" },
      });
      renderWithMantine(
        <TMDataGrid {...result.current}>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>,
      );

      await user.dblClick(bodyCell("1", "age")!);
      const editor = screen.getByLabelText("Edit Age");

      // The row opens under the edit, from outside the grid: Name would now
      // cover Age, and the editor with it.
      act(() => result.current.table.getRow("1").toggleExpanded());
      expect(queryPart("details", { rowId: "1" })).toBeInTheDocument();
      expect(editor).toBeInTheDocument();
      expect(bodyCell("1", "name")).not.toHaveAttribute("aria-colspan");

      // The edit over, the span lands.
      await user.keyboard("{Escape}");
      expect(screen.queryByLabelText("Edit Age")).toBeNull();
      expect(bodyCell("1", "name")).toHaveAttribute("aria-colspan", "3");
      expect(bodyCell("1", "age")).toBeNull();
    });
  });
});
