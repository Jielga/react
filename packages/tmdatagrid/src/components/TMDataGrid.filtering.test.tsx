import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  erased,
  gridRowCount,
  header,
  part,
  queryPart,
  renderedRowIds,
  renderGrid,
  renderGridUi,
  renderWithMantine,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import type { TMDataGridFilterControlComponent } from "../core/filterControls";
import {
  type TMDataGridFilterFn,
  tmDataGridFilterFn,
} from "../core/filterOperators";
import { TMDataGrid } from "./TMDataGrid";
import { DgAutocompleteFilter } from "./filters/DgAutocompleteFilter";
import { DgDateRangeFilter } from "./filters/DgDateRangeFilter";
import { DgRangeSliderFilter } from "./filters/DgRangeSliderFilter";
import { DgTriStateFilter } from "./filters/DgTriStateFilter";
import {
  createTMDataGridColumnHelper,
  openColumnFilter,
  useTMDataGrid,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";

/**
 * Everything that narrows the row set: the filter panel and its typed
 * controls, the pills, and the quick search. Split from TMDataGrid.test.tsx
 * for worker parallelism; the shared scaffolding lives in the harness.
 */
describe("filtering", () => {
  it("filters the rows down through the filter panel", async () => {
    const user = userEvent.setup();
    renderGridUi();
    expect(renderedRowIds().length).toBe(testRows.length);

    // The button seeds a filter on the first filterable column - "id", whose
    // numeric default operator is "equals".
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");

    expect(renderedRowIds()).toEqual(["3"]);
  });

  it("clears the filter again when its value is removed", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const value = screen.getByLabelText("Value");
    await user.type(value, "3");
    expect(renderedRowIds()).toEqual(["3"]);

    await user.clear(value);

    // A half-typed filter stays in state but must not narrow the rows.
    expect(renderedRowIds().length).toBe(testRows.length);
  });

  it("hides the filter button when filtering is off", () => {
    renderGridUi({ enableColumnFilters: false });

    expect(
      screen.queryByRole("button", { name: "Filters" }),
    ).not.toBeInTheDocument();
  });

  it("hides the panel from its close button, keeping the filter", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");
    await user.click(screen.getByRole("button", { name: "Close filters" }));

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    expect(renderedRowIds()).toEqual(["3"]);
  });

  it("hides the panel on a click away", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");
    await user.click(header("name"));

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    expect(renderedRowIds()).toEqual(["3"]);
  });

  it("keeps the toolbar button a toggle, not a reopen", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const filterButton = screen.getByRole("button", { name: "Filters" });

    await user.click(filterButton);
    expect(screen.getByLabelText("Value")).toBeInTheDocument();

    // The click-away handler fires on this button too - if it closed the panel
    // there, the button's own click would open it straight back up.
    await user.click(filterButton);

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
  });

  it("drops every filter and the panel from Clear all", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");
    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    expect(renderedRowIds().length).toBe(testRows.length);
  });

  it("hands a column's own filterFn the { operator, value } envelope", async () => {
    const user = userEvent.setup();
    const filterFn = vi.fn<TMDataGridFilterFn<TestRow>>(
      (row, columnId, filter) => tmDataGridFilterFn(row, columnId, filter),
    );
    const helper = createTMDataGridColumnHelper<TestRow>();
    // "id" is not filterable, so the Filters button seeds the filter on
    // "name", whose default operator is "contains".
    const columns = helper.columns([
      helper.accessor("id", { header: "ID", enableColumnFilter: false }),
      helper.accessor("name", { header: "Name", filterFn }),
    ]);
    renderGridUi({ columns });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "a");

    expect(filterFn.mock.calls.at(-1)?.[1]).toBe("name");
    expect(filterFn.mock.calls.at(-1)?.[2]).toEqual({
      operator: "contains",
      value: "a",
    });
    // The delegation matched: every name but "Erik" holds an "a", and the
    // fixture rows hold three Eriks.
    expect(gridRowCount()).toBe(testRows.length - 3);
  });
});

describe("filter pills", () => {
  it("names the active filters and clears one from its pill", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");

    // "equals" is the numeric default, so the operator stays implicit.
    expect(screen.getByText("ID: 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear ID filter" }));

    expect(screen.queryByText("ID: 3")).not.toBeInTheDocument();
    expect(renderedRowIds().length).toBe(testRows.length);
  });

  it("clears a filter through the pill's filter-pill-remove part", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.type(screen.getByLabelText("Value"), "3");
    expect(gridRowCount()).toBe(1);

    await user.click(part("filter-pill-remove", { columnId: "id" }));

    expect(queryPart("filter-pill", { columnId: "id" })).not.toBeInTheDocument();
    expect(gridRowCount()).toBe(testRows.length);
  });

  it("shows no pill for a filter that is not narrowing yet", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(
      screen.queryByRole("group", { name: "Active filters" }),
    ).not.toBeInTheDocument();
  });
});

describe("Search", () => {
  function SearchGrid(options: Partial<UseTMDataGridOptions<TestRow>> = {}) {
    const grid = useTMDataGrid<TestRow>({
      data: testRows,
      columns: testColumns,
      getRowId: (row) => String(row.id),
      ...options,
    } as UseTMDataGridOptions<TestRow>);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.Search debounce={0} />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>
    );
  }

  it("narrows the rows across every column as it is typed", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SearchGrid />);
    expect(gridRowCount()).toBe(testRows.length);

    await user.type(screen.getByRole("textbox", { name: "Search rows" }), "Anna");

    const matches = testRows.filter((row) => row.name === "Anna").length;
    expect(gridRowCount()).toBe(matches);
  });

  it("clears through the clear button and restores every row", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SearchGrid />);

    await user.type(screen.getByRole("textbox", { name: "Search rows" }), "Anna");
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(gridRowCount()).toBe(testRows.length);
    expect(screen.getByRole("textbox", { name: "Search rows" })).toHaveValue("");
  });

  it("mirrors an external globalFilter write into the input", async () => {
    const { result } = renderGrid();
    renderWithMantine(
      <TMDataGrid {...erased(result.current)}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.Search />
        </TMDataGrid.Toolbar>
      </TMDataGrid>,
    );

    result.current.table.setGlobalFilter("Erik");

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Search rows" }),
      ).toHaveValue("Erik"),
    );
  });

  it("renders nothing under enableGlobalFilter: false", () => {
    renderWithMantine(<SearchGrid enableGlobalFilter={false} />);
    expect(
      screen.queryByRole("textbox", { name: "Search rows" }),
    ).not.toBeInTheDocument();
  });
});

describe("typed columns in the filter panel", () => {
  type TypedRow = { id: number; status: string; active: boolean; hired: string };

  const typedRows: TypedRow[] = [
    { id: 1, status: "Paid", active: true, hired: "2026-01-15" },
    { id: 2, status: "Pending", active: false, hired: "2026-03-01" },
    { id: 3, status: "Overdue", active: true, hired: "2025-11-20" },
    { id: 4, status: "Paid", active: false, hired: "2026-06-05" },
  ];

  const typedColumns = (() => {
    const helper = createTMDataGridColumnHelper<TypedRow>();
    return helper.columns([
      helper.accessor("id", {
        header: "Id",
        meta: { type: "number", filter: { defaultOperator: "between" } },
      }),
      helper.accessor("status", {
        header: "Status",
        meta: { type: "select", options: "faceted" },
      }),
      helper.accessor("active", {
        header: "Active",
        meta: { type: "boolean" },
        cell: (info) => (info.getValue() ? "yes" : "no"),
      }),
      helper.accessor("hired", { header: "Hired", meta: { type: "date" } }),
    ]);
  })();

  function TypedGrid({ filterColumnId }: { filterColumnId: string }) {
    const grid = useTMDataGrid<TypedRow>({
      data: typedRows,
      columns: typedColumns,
      getRowId: (row) => String(row.id),
    });
    return (
      <>
        {/* Seeds the column's default operator and opens the panel on it -
            the same path the header menu's Filter item takes. */}
        <button
          type="button"
          onClick={() => openColumnFilter(grid, filterColumnId)}
        >
          open filter
        </button>
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<TypedRow> />
        </TMDataGrid>
      </>
    );
  }

  const openFilter = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "open filter" }));
  };

  it("filters a select column through a multi-select of its faceted values", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TypedGrid filterColumnId="status" />);
    expect(gridRowCount()).toBe(typedRows.length);

    await openFilter(user);
    // The type's default operator, seeded by openColumnFilter.
    expect(screen.getByDisplayValue("is any of")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Value" }));
    await user.click(await screen.findByRole("option", { name: "Paid" }));

    expect(gridRowCount()).toBe(2);
  });

  it("filters a boolean column through the Yes/No dropdown", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TypedGrid filterColumnId="active" />);

    await openFilter(user);
    await user.click(screen.getByRole("combobox", { name: "Value" }));
    await user.click(await screen.findByRole("option", { name: "Yes" }));

    expect(gridRowCount()).toBe(2);
  });

  it("filters through a between pair, seeded by meta.filter.defaultOperator", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TypedGrid filterColumnId="id" />);

    await openFilter(user);
    // The column's own default, not the number type's "equals".
    expect(screen.getByDisplayValue("is between")).toBeInTheDocument();

    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    expect(from).toHaveAttribute("type", "number");

    fireEvent.change(from, { target: { value: "2" } });
    expect(gridRowCount()).toBe(3);

    fireEvent.change(to, { target: { value: "3" } });
    expect(gridRowCount()).toBe(2);

    // An emptied end reopens that side of the interval.
    fireEvent.change(from, { target: { value: "" } });
    expect(gridRowCount()).toBe(3);
  });

  it("filters a date column by calendar day through a date input", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TypedGrid filterColumnId="hired" />);

    await openFilter(user);
    // Switch the seeded "equals" to an ordering operator first.
    await user.click(screen.getByRole("combobox", { name: "Operator" }));
    await user.click(await screen.findByRole("option", { name: "is before" }));

    const input = screen.getByLabelText("Value");
    expect(input).toHaveAttribute("type", "date");
    fireEvent.change(input, { target: { value: "2026-01-01" } });

    expect(gridRowCount()).toBe(1);
  });
});

describe("filter controls", () => {
  type ControlRow = { id: number; status: string; active: boolean; hired: string };

  const controlRows: ControlRow[] = [
    { id: 1, status: "Paid", active: true, hired: "2026-01-15" },
    { id: 2, status: "Pending", active: false, hired: "2026-03-01" },
    { id: 3, status: "Overdue", active: true, hired: "2025-11-20" },
    { id: 4, status: "Paid", active: false, hired: "2026-06-05" },
  ];

  // A custom control sees only the bare value; the grid wraps it with the
  // current operator on the way into filter state.
  const StatusPicker: TMDataGridFilterControlComponent = ({ value, onChange }) => (
    <input
      aria-label="Status picker"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );

  const controlColumns = (() => {
    const helper = createTMDataGridColumnHelper<ControlRow>();
    return helper.columns([
      helper.accessor("id", {
        header: "Id",
        meta: {
          type: "number",
          filter: { defaultOperator: "between", control: DgRangeSliderFilter },
        },
      }),
      helper.accessor("status", {
        header: "Status",
        meta: { filter: { control: DgAutocompleteFilter } },
      }),
      helper.accessor("active", {
        header: "Active",
        meta: { type: "boolean", filter: { control: DgTriStateFilter } },
        cell: (info) => (info.getValue() ? "yes" : "no"),
      }),
      helper.accessor("hired", {
        header: "Hired",
        meta: {
          type: "date",
          filter: { defaultOperator: "between", control: DgDateRangeFilter },
        },
      }),
    ]);
  })();

  function ControlGrid({
    filterColumnId,
    columns = controlColumns,
  }: {
    filterColumnId: string;
    columns?: UseTMDataGridOptions<ControlRow>["columns"];
  }) {
    const grid = useTMDataGrid<ControlRow>({
      data: controlRows,
      columns,
      getRowId: (row) => String(row.id),
    });
    return (
      <>
        <button
          type="button"
          onClick={() => openColumnFilter(grid, filterColumnId)}
        >
          open filter
        </button>
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<ControlRow> />
        </TMDataGrid>
      </>
    );
  }

  const openFilter = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "open filter" }));
  };

  it("hands meta.filter.control the bare value and wraps what it writes", async () => {
    const helper = createTMDataGridColumnHelper<ControlRow>();
    const customColumns = helper.columns([
      helper.accessor("status", {
        header: "Status",
        meta: { filter: { control: StatusPicker } },
      }),
    ]);

    const user = userEvent.setup();
    renderWithMantine(
      <ControlGrid filterColumnId="status" columns={customColumns} />,
    );
    expect(gridRowCount()).toBe(controlRows.length);

    await openFilter(user);
    // The custom control replaced the built-in value input entirely.
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Status picker"), "Paid");
    // Written as the bare value, matched under the seeded "contains".
    expect(gridRowCount()).toBe(2);
  });

  it("filters booleans through DgTriStateFilter's segments", async () => {
    const user = userEvent.setup();
    renderWithMantine(<ControlGrid filterColumnId="active" />);

    await openFilter(user);
    await user.click(screen.getByRole("radio", { name: "Yes" }));
    expect(gridRowCount()).toBe(2);

    await user.click(screen.getByRole("radio", { name: "No" }));
    expect(gridRowCount()).toBe(2);

    // All clears the value - an inactive filter matches every row.
    await user.click(screen.getByRole("radio", { name: "All" }));
    expect(gridRowCount()).toBe(controlRows.length);
  });

  it("filters numbers through DgRangeSliderFilter, seeded from the data", async () => {
    renderWithMantine(<ControlGrid filterColumnId="id" />);

    fireEvent.click(screen.getByRole("button", { name: "open filter" }));
    const fromThumb = screen.getByRole("slider", { name: "From" });
    // Bounds came from the faceted values: 1–4.
    expect(fromThumb).toHaveAttribute("aria-valuemin", "1");
    expect(fromThumb).toHaveAttribute("aria-valuemax", "4");

    fireEvent.keyDown(fromThumb, { key: "ArrowRight" });
    // The pair became ["2", "4"] - ids 2, 3 and 4 remain.
    expect(gridRowCount()).toBe(3);
  });

  it("filters dates through DgDateRangeFilter's From/To pair", async () => {
    const user = userEvent.setup();
    renderWithMantine(<ControlGrid filterColumnId="hired" />);

    await openFilter(user);
    const from = screen.getByLabelText("From");
    expect(from).toHaveAttribute("type", "date");

    fireEvent.change(from, { target: { value: "2026-01-01" } });
    expect(gridRowCount()).toBe(3);

    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-03-31" },
    });
    expect(gridRowCount()).toBe(2);
  });

  it("suggests the faceted values through DgAutocompleteFilter", async () => {
    const user = userEvent.setup();
    renderWithMantine(<ControlGrid filterColumnId="status" />);

    await openFilter(user);
    const input = screen.getByRole("combobox", { name: "Value" });
    await user.type(input, "Pa");
    // The data's own values as suggestions…
    await user.click(await screen.findByRole("option", { name: "Paid" }));
    // …and the picked one filters under "contains".
    expect(gridRowCount()).toBe(2);
  });
});

/**
 * The attributes a consumer's own suite is written against - see the Testing
 * docs page. They are a published contract, so they get tests of their own
 * rather than being covered incidentally by whatever else queries them.
 */
