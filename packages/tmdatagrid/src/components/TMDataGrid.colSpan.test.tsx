import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  part,
  queryPart,
  renderGridUi,
  type TestRow,
} from "../../test/gridHarness";
import {
  createTMDataGridColumnHelper,
  type TMDataGridColumnMeta,
} from "../useTMDataGrid";
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

    it("selects the spanning cell when a range reaches into it", async () => {
      const user = userEvent.setup();
      renderGridUi({ columns: secondRowSpan, cellSelection: "range" });

      await user.click(bodyCell("1", "age")!);
      await user.keyboard("{Shift>}{ArrowDown}{/Shift}");

      const name = bodyCell("2", "name")!;
      expect(name).toHaveAttribute("data-selected", "true");
      // The rectangle is the Age column alone; both its sides fall inside
      // the spanning cell.
      expect(name).toHaveAttribute("data-edge-left", "true");
      expect(name).toHaveAttribute("data-edge-right", "true");
    });
  });
});
