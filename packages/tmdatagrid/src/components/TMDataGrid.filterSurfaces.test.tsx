import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  gridRowCount,
  header,
  part,
  parts,
  queryPart,
  renderGridUi,
  renderWithMantine,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { TMDataGrid } from "./TMDataGrid";
import { SELECT_COLUMN_ID } from "./TMDataGridSelectColumn";
import {
  createTMDataGridColumnHelper,
  openColumnFilter,
  useTMDataGrid,
} from "../useTMDataGrid";
import type { TMDataGridFiltersOptions } from "../core/filterSurface";

/**
 * Where the filter controls render - the `filters` option. What a filter *is*
 * is covered by TMDataGrid.filtering.test.tsx; this file only asks which
 * surface owns it.
 */
describe("filters.surface", () => {
  it("floats the panel over the rows by default, and dismisses it on a click away", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(part("filter-popup")).toBeInTheDocument();
    expect(queryPart("filter-sidebar")).not.toBeInTheDocument();

    await user.click(header("name"));
    expect(queryPart("filter-popup")).not.toBeInTheDocument();
  });

  it("seeds a blank row only when the panel is empty", async () => {
    const user = userEvent.setup();
    renderGridUi();

    // An empty panel opens with one seeded row to type into.
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(parts("filter-row")).toHaveLength(1);
    await user.type(part("filter-value"), "3");

    // Toggled shut and open again over that filter, it shows the filter and
    // nothing else - no second blank row stacked on the first filterable
    // column.
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(queryPart("filter-popup")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(parts("filter-row")).toHaveLength(1);
    expect(part("filter-value")).toHaveValue(3);
  });

  it("does not treat a press inside a portalled overlay as a click away", async () => {
    const user = userEvent.setup();
    renderGridUi();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(part("filter-popup")).toBeInTheDocument();

    // The panel's dropdowns render `withinPortal`, outside the popup in the
    // DOM, so the grid frame cannot clip them - which makes this exemption
    // load-bearing: without it, picking an option would close the popup.
    // Mantine stamps `data-portal` on every portal node; under the harness's
    // `env="test"` portals render inline, so the node is built by hand.
    const portal = document.createElement("div");
    portal.setAttribute("data-portal", "true");
    const option = document.createElement("button");
    portal.appendChild(option);
    document.body.appendChild(portal);
    try {
      await user.click(option);
      expect(part("filter-popup")).toBeInTheDocument();
    } finally {
      portal.remove();
    }

    // A press outside any portal still dismisses it.
    await user.click(header("name"));
    expect(queryPart("filter-popup")).not.toBeInTheDocument();
  });

  it("puts the panel beside the rows under sidebar, and leaves it open on a click away", async () => {
    const user = userEvent.setup();
    // A sidebar is a layout choice, so it starts open without being asked.
    renderGridUi({ filters: { surface: "sidebar" } });

    expect(part("filter-sidebar")).toHaveAttribute("data-side", "right");
    expect(queryPart("filter-popup")).not.toBeInTheDocument();

    // A click in the table is a click on the rows the sidebar is filtering.
    await user.click(header("name"));
    expect(part("filter-sidebar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(queryPart("filter-sidebar")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(part("filter-sidebar")).toBeInTheDocument();
  });

  it("starts the sidebar closed when asked, and the popup open", () => {
    const closed = renderGridUi({
      filters: { surface: "sidebar", defaultOpen: false },
    });
    expect(queryPart("filter-sidebar")).not.toBeInTheDocument();
    closed.unmount();

    renderGridUi({ filters: { surface: "popup", defaultOpen: true } });
    expect(part("filter-popup")).toBeInTheDocument();
  });

  it("places the sidebar on the side and at the width it is given", () => {
    renderGridUi({
      filters: { surface: "sidebar", sidebarSide: "left", sidebarWidth: "20rem" },
    });

    const sidebar = part("filter-sidebar");
    expect(sidebar).toHaveAttribute("data-side", "left");
    expect(sidebar).toHaveStyle({ width: "20rem" });
  });

  it("closes the popup and the sidebar on Escape", async () => {
    const user = userEvent.setup();
    const popup = renderGridUi({ filters: { defaultOpen: true } });
    await user.click(part("filter-add"));
    await user.keyboard("{Escape}");
    expect(queryPart("filter-popup")).not.toBeInTheDocument();
    popup.unmount();

    renderGridUi({ filters: { surface: "sidebar" } });
    await user.click(part("filter-add"));
    await user.keyboard("{Escape}");
    expect(queryPart("filter-sidebar")).not.toBeInTheDocument();
  });

  it("stacks the panel's fields in the sidebar and lines them up in the popup", async () => {
    const user = userEvent.setup();
    const sidebar = renderGridUi({ filters: { surface: "sidebar" } });
    await user.click(part("filter-add"));
    expect(part("filter-panel")).toHaveAttribute("data-layout", "stacked");
    // Stacked still labels its fields, unlike a header cell.
    expect(screen.getByLabelText("Value")).toBeInTheDocument();
    sidebar.unmount();

    renderGridUi({ filters: { defaultOpen: true } });
    await user.click(part("filter-add"));
    expect(part("filter-panel")).toHaveAttribute("data-layout", "row");
  });

  it("renders no surface and no button under none", () => {
    renderGridUi({ filters: { surface: "none" } });

    expect(
      screen.queryByRole("button", { name: "Filters" }),
    ).not.toBeInTheDocument();
    expect(queryPart("filter-popup")).not.toBeInTheDocument();
    expect(queryPart("filter-sidebar")).not.toBeInTheDocument();
    expect(queryPart("filter-panel")).not.toBeInTheDocument();
  });

  it("shows a hand-placed panel with no open state and no close button", async () => {
    const user = userEvent.setup();

    function ManualGrid() {
      const grid = useTMDataGrid({
        data: testRows,
        columns: twoColumns,
        getRowId: (row) => String(row.id),
        filters: { surface: "none" },
      });
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.FilterPanel />
          <TMDataGrid.Table />
        </TMDataGrid>
      );
    }
    renderWithMantine(<ManualGrid />);

    // Mounted is shown - nothing had to open it.
    expect(part("filter-panel")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close filters" }),
    ).not.toBeInTheDocument();

    await user.click(part("filter-add"));
    await user.type(screen.getByLabelText("Value"), "3");
    expect(gridRowCount()).toBe(1);

    // Emptying it closes nothing: there is no surface to close.
    await user.click(part("filter-clear-all"));
    expect(part("filter-panel")).toBeInTheDocument();
    expect(gridRowCount()).toBe(testRows.length);
  });
});

const twoColumns = (() => {
  const helper = createTMDataGridColumnHelper<{
    id: number;
    name: string;
    age: number;
    city: string;
  }>();
  return helper.columns([
    helper.accessor("id", { header: "ID", meta: { type: "number" } }),
    helper.accessor("name", { header: "Name" }),
  ]);
})();

describe("filters.inHeader", () => {
  const renderHeaderFilters = (
    filters: TMDataGridFiltersOptions = {},
    options: Parameters<typeof renderGridUi>[0] = {},
  ) => renderGridUi({ filters: { inHeader: true, ...filters }, ...options });

  // Module scope: `useTMDataGrid` memoizes on the columns reference.
  const narrowedColumns = (() => {
    const helper = createTMDataGridColumnHelper<TestRow>();
    return helper.columns([
      helper.accessor("id", { header: "ID", meta: { type: "number" } }),
      helper.accessor("age", {
        header: "Age",
        meta: { type: "number", filter: { operators: ["greaterThan", "lessThan"] } },
      }),
    ]);
  })();

  it("filters from a control in the header row", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();
    expect(gridRowCount()).toBe(testRows.length);

    const cell = part("header-filter-cell", { columnId: "id" });
    await user.type(cell.querySelector("input")!, "3");

    expect(gridRowCount()).toBe(1);
  });

  it("drops the filter again once the control is emptied", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    const input = part("header-filter-cell", { columnId: "id" }).querySelector(
      "input",
    )!;
    await user.type(input, "3");
    expect(gridRowCount()).toBe(1);

    // Unlike a panel row, a header control has nothing to keep alive - so an
    // empty one leaves no entry in columnFilters behind.
    await user.clear(input);
    expect(gridRowCount()).toBe(testRows.length);
    expect(queryPart("filter-pill", { columnId: "id" })).not.toBeInTheDocument();
  });

  it("offers only meta.filter.operators from the funnel, and opens on the first of them", async () => {
    const user = userEvent.setup();
    renderHeaderFilters({}, { columns: narrowedColumns });

    await user.click(part("header-filter-operator", { columnId: "age" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "is greater than",
      "is less than",
    ]);
    await user.keyboard("{Escape}");

    // `equals`, the type's default, is not offered - so a typed value filters
    // on the first operator the column does offer.
    await user.type(
      part("header-filter-cell", { columnId: "age" }).querySelector("input")!,
      "40",
    );
    expect(gridRowCount()).toBe(testRows.filter((row) => row.age > 40).length);
  });

  it("changes one column's operator from its funnel button", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    await user.click(part("header-filter-operator", { columnId: "age" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "is greater than" }),
    );
    await user.type(
      part("header-filter-cell", { columnId: "age" }).querySelector("input")!,
      "40",
    );

    expect(gridRowCount()).toBe(
      testRows.filter((row) => row.age > 40).length,
    );
  });

  it("leaves a non-filterable column's header cell empty", () => {
    renderHeaderFilters();
    const cell = part("header-filter-cell", { columnId: SELECT_COLUMN_ID });
    expect(cell.querySelector("input")).toBeNull();
    // Nothing to filter on, so not named as if there were.
    expect(cell).not.toHaveAttribute("aria-label");
  });

  it("takes the Filter menu item and the funnel indicator off the header", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    await user.type(
      part("header-filter-cell", { columnId: "name" }).querySelector("input")!,
      "Anna",
    );
    // The filled-in control is the indicator now.
    expect(queryPart("header-filter", { columnId: "name" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Name column menu" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: "Filter" }),
    ).not.toBeInTheDocument();
  });

  it("counts the filter row in aria-rowcount and pushes the body rows down", () => {
    renderHeaderFilters();
    const grid = screen.getByRole("table");
    expect(document.querySelectorAll("[data-dg-header-row]").length).toBe(2);
    expect(Number(grid.getAttribute("aria-rowcount"))).toBe(
      testRows.length + 2,
    );
    expect(
      document.querySelector('[data-dg-part="row"]')?.getAttribute("aria-rowindex"),
    ).toBe("3");
  });

  it("renders no filter row when nothing can be filtered", () => {
    renderGridUi({ filters: { inHeader: true }, enableColumnFilters: false });
    expect(queryPart("header-filter-row")).not.toBeInTheDocument();
  });

  it("keeps a value the user typed even when it does not narrow anything", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    const input = part("header-filter-cell", { columnId: "name" }).querySelector(
      "input",
    )!;
    // A lone space narrows nothing, but dropping the filter for it would take
    // the character straight back out of the input.
    await user.type(input, " ");
    expect(input).toHaveValue(" ");
    expect(gridRowCount()).toBe(testRows.length);
  });

  it("keeps an operator the user picked even with the value emptied", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    await user.click(part("header-filter-operator", { columnId: "age" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "is greater than" }),
    );
    const input = () =>
      part("header-filter-cell", { columnId: "age" }).querySelector("input")!;
    await user.type(input(), "40");
    await user.clear(input());
    await user.type(input(), "40");

    // The chosen operator is the part of the filter an empty control cannot
    // show, so it survives the value going away. Had the entry been dropped,
    // the retyped 40 would have come back on the numeric default, `equals`,
    // and matched nothing.
    expect(gridRowCount()).toBe(testRows.filter((row) => row.age > 40).length);
  });

  it("resets the value across an operator shape boundary, and keeps it within one", async () => {
    const user = userEvent.setup();
    renderHeaderFilters();

    const cell = part("header-filter-cell", { columnId: "name" });
    await user.type(cell.querySelector("input")!, "Anna");

    // contains -> equals is scalar to scalar: the needle survives.
    await user.click(part("header-filter-operator", { columnId: "name" }));
    await user.click(await screen.findByRole("menuitem", { name: "equals" }));
    expect(
      part("header-filter-cell", { columnId: "name" }).querySelector("input"),
    ).toHaveValue("Anna");

    // equals -> is empty takes no value at all.
    await user.click(part("header-filter-operator", { columnId: "name" }));
    await user.click(await screen.findByRole("menuitem", { name: "is empty" }));
    expect(
      part("header-filter-cell", { columnId: "name" }).querySelector("input"),
    ).toHaveValue("");
  });

  it("leaves a showing panel alone when openColumnFilter points at the header", async () => {
    const user = userEvent.setup();

    function BothSurfaces() {
      const grid = useTMDataGrid({
        data: testRows,
        columns: twoColumns,
        getRowId: (row) => String(row.id),
        // The combination the docs advertise: header controls with a panel
        // beside them. Both are on screen, and only one may take the caret.
        filters: { inHeader: true, surface: "sidebar" },
      });
      return (
        <>
          <button type="button" onClick={() => openColumnFilter(grid, "name")}>
            filter name
          </button>
          <TMDataGrid {...grid}>
            <TMDataGrid.Table />
          </TMDataGrid>
        </>
      );
    }
    renderWithMantine(<BothSurfaces />);
    expect(part("filter-sidebar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "filter name" }));

    // The header control wins: it is the one the user can already see.
    expect(
      part("header-filter-cell", { columnId: "name" }).querySelector("input"),
    ).toHaveFocus();
  });

  it("sends openColumnFilter to the header control instead of a panel", async () => {
    const user = userEvent.setup();

    function HeaderGrid() {
      const grid = useTMDataGrid({
        data: testRows,
        columns: twoColumns,
        getRowId: (row) => String(row.id),
        filters: { inHeader: true },
      });
      return (
        <>
          <button type="button" onClick={() => openColumnFilter(grid, "name")}>
            filter name
          </button>
          <TMDataGrid {...grid}>
            <TMDataGrid.Table />
          </TMDataGrid>
        </>
      );
    }
    renderWithMantine(<HeaderGrid />);

    await user.click(screen.getByRole("button", { name: "filter name" }));

    expect(queryPart("filter-popup")).not.toBeInTheDocument();
    expect(
      part("header-filter-cell", { columnId: "name" }).querySelector("input"),
    ).toHaveFocus();
  });
});

/**
 * The header filter row is a header row like the group rows above it, so the
 * two have to stack rather than pin to the same edge - which is what surfaced
 * the group headers' missing column span.
 */
describe("the header rows stack", () => {
  const groupedColumns = (() => {
    const helper = createTMDataGridColumnHelper<{
      id: number;
      name: string;
      age: number;
      city: string;
    }>();
    return helper.columns([
      helper.group({
        id: "person",
        header: "Person",
        columns: helper.columns([
          helper.accessor("name", { header: "Name" }),
          helper.accessor("age", { header: "Age", meta: { type: "number" } }),
          helper.accessor("city", { header: "City" }),
        ]),
      }),
    ]);
  })();

  function GroupedGrid({
    inHeader,
    flat = false,
  }: {
    inHeader: boolean;
    flat?: boolean;
  }) {
    const grid = useTMDataGrid({
      data: testRows,
      columns: flat ? twoColumns : groupedColumns,
      getRowId: (row) => String(row.id),
      filters: { inHeader },
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table />
      </TMDataGrid>
    );
  }

  it("spans a group header across the leaves under it", () => {
    renderWithMantine(<GroupedGrid inHeader={false} />);

    // Without the span the group would sit in one track and leave the rest of
    // its width with no cell at all, which the body then scrolls up through.
    expect(part("header", { columnId: "person" })).toHaveStyle({
      gridColumn: "span 3",
    });
  });

  it("puts the filter row below the group rows, not on top of them", () => {
    renderWithMantine(<GroupedGrid inHeader />);

    const rows = headerRows();
    expect(rows).toHaveLength(3);
    // jsdom lays nothing out, so every row measures zero and the insets all
    // land on 0. What is testable here is that each row was given one at all -
    // that the header stack is measured rather than left to pin to the top.
    expect(rows.every((row) => row.style.top !== "")).toBe(true);
    expect(rows.at(-1)).toHaveAttribute("data-dg-part", "header-filter-row");
  });

  it("re-measures when the columns grow a group level", () => {
    const { rerender } = renderWithMantine(<GroupedGrid inHeader flat />);
    expect(headerRows()).toHaveLength(2);

    // The rows are found by query, once, so a header that gets deeper has to
    // put the effect round again - otherwise the new row keeps the
    // stylesheet's `top: 0` and pins on top of the row above it.
    rerender(<GroupedGrid inHeader />);
    const rows = headerRows();
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.style.top !== "")).toBe(true);
  });

  it("moves the scrolled-under shadow onto the filter row", () => {
    const withFilters = renderWithMantine(<GroupedGrid inHeader />);
    // Exactly one header row carries the boundary, and it is the last one -
    // the filter row here, the last group row without it.
    const shadowed = headerRows().filter((row) =>
      row.className.includes("headerBoundary"),
    );
    expect(shadowed).toHaveLength(1);
    expect(shadowed[0]).toHaveAttribute("data-dg-part", "header-filter-row");
    withFilters.unmount();

    renderWithMantine(<GroupedGrid inHeader={false} />);
    const plain = headerRows().filter((row) =>
      row.className.includes("headerBoundary"),
    );
    expect(plain).toHaveLength(1);
    expect(plain[0]).toBe(headerRows().at(-1));
  });
});

const headerRows = () => [
  ...document.querySelectorAll<HTMLElement>("[data-dg-header-row]"),
];
