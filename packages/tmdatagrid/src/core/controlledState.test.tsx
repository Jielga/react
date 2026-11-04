import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useCreateAtom } from "@tanstack/react-store";
import { describe, expect, it, vi } from "vitest";
import type {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnVisibilityState,
  GroupingState,
  SortingState,
} from "@tanstack/react-table";
import {
  MantineWrapper,
  renderedHeaderIds,
  renderGrid,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { TMDataGrid } from "../components/TMDataGrid";
import { type TMDataGridApi, useTMDataGrid } from "../index";
import {
  findFrozenStateSlices,
  sameStateValue,
  stabilizeControlledState,
  withoutUndefinedSlices,
} from "./controlledState";

describe("sameStateValue", () => {
  it("sees through a fresh object literal", () => {
    expect(sameStateValue({ city: false }, { city: false })).toBe(true);
    expect(
      sameStateValue(
        [{ id: "name", value: { operator: "contains", value: "a" } }],
        [{ id: "name", value: { operator: "contains", value: "a" } }],
      ),
    ).toBe(true);
  });

  it("compares the maps table-core builds, which have no prototype", () => {
    const map = Object.assign(Object.create(null) as ColumnVisibilityState, {
      city: false,
    });
    expect(sameStateValue(map, { city: false })).toBe(true);
  });

  it("separates values that differ", () => {
    expect(sameStateValue({ city: false }, { city: true })).toBe(false);
    expect(sameStateValue({ city: false }, { city: false, age: false })).toBe(
      false,
    );
    expect(sameStateValue([{ id: "a" }], [{ id: "b" }])).toBe(false);
    expect(sameStateValue(["a"], ["a", "b"])).toBe(false);
  });

  it("compares Dates by time - the grid's date filters hold them", () => {
    expect(sameStateValue(new Date(0), new Date(0))).toBe(true);
    expect(sameStateValue(new Date(0), new Date(1))).toBe(false);
    expect(sameStateValue(new Date(0), 0)).toBe(false);
    expect(
      sameStateValue(
        [{ id: "hired", value: { operator: "after", value: new Date(0) } }],
        [{ id: "hired", value: { operator: "after", value: new Date(0) } }],
      ),
    ).toBe(true);
  });

  it("compares class instances by identity", () => {
    const map = new Map([["a", 1]]);
    expect(sameStateValue(map, map)).toBe(true);
    expect(sameStateValue(map, new Map([["a", 1]]))).toBe(false);
  });
});

describe("withoutUndefinedSlices", () => {
  it("drops keys whose value is undefined", () => {
    expect(
      withoutUndefinedSlices({ columnVisibility: undefined, sorting: [] }),
    ).toEqual({ sorting: [] });
  });

  it("keeps identity when there is nothing to drop", () => {
    const state = { sorting: [] };
    expect(withoutUndefinedSlices(state)).toBe(state);
    expect(withoutUndefinedSlices(undefined)).toBeUndefined();
  });
});

describe("stabilizeControlledState", () => {
  it("keeps last render's object when every slice says the same thing", () => {
    const previous = { columnVisibility: { city: false }, sorting: [] };
    expect(
      stabilizeControlledState({ columnVisibility: { city: false }, sorting: [] }, previous),
    ).toBe(previous);
  });

  it("keeps the unchanged slices when one of them moves", () => {
    const previous = {
      columnVisibility: { city: false },
      sorting: [{ id: "name", desc: false }],
    };
    const next = stabilizeControlledState(
      {
        columnVisibility: { city: false },
        sorting: [{ id: "name", desc: true }],
      },
      previous,
    );

    expect(next).not.toBe(previous);
    expect(next?.columnVisibility).toBe(previous.columnVisibility);
    expect(next?.sorting).toEqual([{ id: "name", desc: true }]);
  });

  it("publishes a slice that appears or disappears", () => {
    const previous = { columnVisibility: { city: false } };
    expect(
      stabilizeControlledState(
        { columnVisibility: { city: false }, sorting: [] },
        previous,
      ),
    ).not.toBe(previous);
    expect(stabilizeControlledState({}, previous)).not.toBe(previous);
  });

  it("passes the first render through", () => {
    const first = { columnVisibility: { city: false } };
    expect(stabilizeControlledState(first, undefined)).toBe(first);
    expect(stabilizeControlledState(undefined, first)).toBeUndefined();
  });
});

describe("findFrozenStateSlices", () => {
  it("names a controlled slice with no callback behind it", () => {
    expect(
      findFrozenStateSlices({
        state: { columnVisibility: { city: false }, sorting: [] },
      }),
    ).toEqual([
      { slice: "columnVisibility", handler: "onColumnVisibilityChange" },
      { slice: "sorting", handler: "onSortingChange" },
    ]);
  });

  it("is quiet about a slice the consumer holds", () => {
    expect(
      findFrozenStateSlices({
        state: { columnVisibility: { city: false } },
        onColumnVisibilityChange: () => {},
      }),
    ).toEqual([]);
    // An external atom outranks `state` and takes the writes itself.
    expect(
      findFrozenStateSlices({
        state: { columnVisibility: { city: false } },
        atoms: { columnVisibility: {} },
      }),
    ).toEqual([]);
  });

  it("is quiet with nothing controlled", () => {
    expect(findFrozenStateSlices({})).toEqual([]);
    // A key set to undefined is scrubbed before the table sees it.
    expect(
      findFrozenStateSlices({ state: { columnVisibility: undefined } }),
    ).toEqual([]);
  });
});

/**
 * Options and `state` built in the render body, as a consumer writes them.
 * This rendered forever before the fix for #39.
 */
function ControlledGrid({
  onRender,
  columnVisibility,
  onColumnVisibilityChange,
  onReady,
}: {
  onRender: () => void;
  columnVisibility: ColumnVisibilityState;
  onColumnVisibilityChange?: (updater: unknown) => void;
  onReady?: (api: TMDataGridApi<TestRow>) => void;
}) {
  onRender();
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row: TestRow) => String(row.id),
    state: { columnVisibility },
    onColumnVisibilityChange,
  } as never);
  onReady?.(grid);

  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>
  );
}

describe("controlled state on the grid", () => {
  it("does not re-render itself forever (#39)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let renders = 0;
    let api: TMDataGridApi<TestRow> | null = null;

    render(
      <ControlledGrid
        onRender={() => {
          renders += 1;
          if (renders > 20) throw new Error(`render loop at ${renders}`);
        }}
        columnVisibility={{ city: false }}
        onReady={(grid) => {
          api = grid;
        }}
      />,
      { wrapper: MantineWrapper },
    );

    const mounted = renders;
    // A state change re-renders the consumer and rebuilds the `state` object;
    // the loop started here before the fix.
    act(() => api!.table.setSorting([{ id: "name", desc: true }]));

    expect(renders - mounted).toBeLessThanOrEqual(3);
    expect(renderedHeaderIds()).not.toContain("city");
    warn.mockRestore();
  });

  it("warns about a slice nothing can write back to", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderGrid({ state: { columnVisibility: { city: false } } } as never);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "state.columnVisibility is controlled but no onColumnVisibilityChange",
      ),
    );
    warn.mockRestore();
  });

  it("holds the value the consumer publishes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let api: TMDataGridApi<TestRow> | null = null;

    function Controlled() {
      const [columnVisibility, setColumnVisibility] =
        useState<ColumnVisibilityState>({ city: false });
      return (
        <ControlledGrid
          onRender={() => {}}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={(updater) =>
            setColumnVisibility((old) =>
              typeof updater === "function"
                ? (updater(old) as ColumnVisibilityState)
                : (updater as ColumnVisibilityState),
            )
          }
          onReady={(grid) => {
            api = grid;
          }}
        />
      );
    }

    render(<Controlled />, { wrapper: MantineWrapper });
    expect(renderedHeaderIds()).not.toContain("city");

    act(() => api!.table.getColumn("city")!.toggleVisibility(true));
    expect(renderedHeaderIds()).toContain("city");

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the tree lane on while a controlled visibility map is in play", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let api: TMDataGridApi<TestRow> | null = null;

    function Controlled() {
      const [columnVisibility, setColumnVisibility] =
        useState<ColumnVisibilityState>({ city: false });
      return (
        <ControlledGrid
          onRender={() => {}}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={(updater) =>
            setColumnVisibility((old) =>
              typeof updater === "function"
                ? (updater(old) as ColumnVisibilityState)
                : (updater as ColumnVisibilityState),
            )
          }
          onReady={(grid) => {
            api = grid;
          }}
        />
      );
    }

    render(<Controlled />, { wrapper: MantineWrapper });
    expect(renderedHeaderIds()).not.toContain("__group__");

    // The tree column's entry lives in a map the consumer owns; without
    // re-application the options sync would drop it.
    act(() => api!.table.setGrouping(["age"]));
    expect(renderedHeaderIds()).toContain("__group__");

    act(() => api!.table.setGrouping([]));
    expect(renderedHeaderIds()).not.toContain("__group__");

    warn.mockRestore();
  });

  it("hides the tree lane when an atom owns the visibility map", () => {
    let api: TMDataGridApi<TestRow> | null = null;

    function AtomOwned() {
      // The atoms route: the table writes through the atom, no callback, and
      // `initialState` never reaches the slice.
      const columnVisibility = useCreateAtom<ColumnVisibilityState>({
        city: false,
      });
      const grid = useTMDataGrid<TestRow>({
        data: testRows,
        columns: testColumns,
        getRowId: (row: TestRow) => String(row.id),
        atoms: { columnVisibility },
      } as never);
      api = grid;

      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }

    render(<AtomOwned />, { wrapper: MantineWrapper });
    expect(renderedHeaderIds()).not.toContain("__group__");
    expect(renderedHeaderIds()).not.toContain("city");

    act(() => api!.table.setGrouping(["age"]));
    expect(renderedHeaderIds()).toContain("__group__");
  });

  it("does not loop when grouping and visibility are both controlled at mount", () => {
    // Regression: the ref feeding the tree column's injected visibility entry
    // read only persisted/initial state, so a controlled grouping active at
    // mount looped - the mount seed and the render injection wrote opposite
    // values.
    let renders = 0;
    let api: TMDataGridApi<TestRow> | null = null;

    function Controlled() {
      renders += 1;
      if (renders > 25) throw new Error(`render loop at ${renders}`);
      const [grouping, setGrouping] = useState<GroupingState>(["age"]);
      const [columnVisibility, setColumnVisibility] =
        useState<ColumnVisibilityState>({ city: false });
      const grid = useTMDataGrid<TestRow>({
        data: testRows,
        columns: testColumns,
        getRowId: (row: TestRow) => String(row.id),
        state: { grouping, columnVisibility },
        onGroupingChange: setGrouping,
        onColumnVisibilityChange: setColumnVisibility,
      } as never);
      api = grid;
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }

    render(<Controlled />, { wrapper: MantineWrapper });
    expect(renderedHeaderIds()).toContain("__group__");

    // A later change re-syncs the options; the loop opened on that render.
    act(() => api!.table.setSorting([{ id: "name", desc: true }]));
    expect(renders).toBeLessThan(25);
    expect(renderedHeaderIds()).toContain("__group__");
  });

  it("removes the second grouped column with order and visibility controlled", () => {
    // The grouping workaround republishes columnOrder and columnVisibility
    // with the same contents to repair table-core's missing memo deps.
    // Stabilization must not cancel those writes when the slices round-trip
    // through the consumer's handlers.
    let api: TMDataGridApi<TestRow> | null = null;

    function Controlled() {
      const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
      const [columnVisibility, setColumnVisibility] =
        useState<ColumnVisibilityState>({});
      const grid = useTMDataGrid<TestRow>({
        data: testRows,
        columns: testColumns,
        getRowId: (row: TestRow) => String(row.id),
        state: { columnOrder, columnVisibility },
        onColumnOrderChange: setColumnOrder,
        onColumnVisibilityChange: setColumnVisibility,
      } as never);
      api = grid;
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }

    render(<Controlled />, { wrapper: MantineWrapper });

    act(() => api!.table.setGrouping(["age"]));
    expect(renderedHeaderIds()).not.toContain("age");

    act(() => api!.table.setGrouping(["age", "city"]));
    expect(renderedHeaderIds()).not.toContain("city");
  });

  it("does not loop on a Date built inline in a controlled filter value", () => {
    let renders = 0;
    let api: TMDataGridApi<TestRow> | null = null;

    function Controlled() {
      renders += 1;
      if (renders > 25) throw new Error(`render loop at ${renders}`);
      const [, setColumnFilters] = useState<ColumnFiltersState>([]);
      const grid = useTMDataGrid<TestRow>({
        data: testRows,
        columns: testColumns,
        getRowId: (row: TestRow) => String(row.id),
        // Built inline on purpose: a fresh Date every render must compare by
        // time, not identity. Manual filtering keeps the client filter fn out
        // of it - the harness has no date column, and the loop under test is
        // in the options sync, not the filter.
        manualFiltering: true,
        state: {
          columnFilters: [
            { id: "name", value: { operator: "after", value: new Date(0) } },
          ],
        },
        onColumnFiltersChange: setColumnFilters,
      } as never);
      api = grid;
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<TestRow> />
        </TMDataGrid>
      );
    }

    render(<Controlled />, { wrapper: MantineWrapper });
    act(() => api!.table.setSorting([{ id: "name", desc: true }]));
    expect(renders).toBeLessThan(25);
  });

  it("mounts with an undefined-valued state key - conditionally controlled", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ControlledGrid
        onRender={() => {}}
        columnVisibility={undefined as never}
      />,
      { wrapper: MantineWrapper },
    );

    // The slice is uncontrolled: the grid mounts, default visibility applies
    // and no warning is logged.
    expect(renderedHeaderIds()).toContain("city");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the control lanes out of a controlled visibility map", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ControlledGrid
        onRender={() => {}}
        columnVisibility={{ __select__: false, city: false }}
      />,
      { wrapper: MantineWrapper },
    );

    expect(renderedHeaderIds()).toContain("__select__");
    warn.mockRestore();
  });
});

/**
 * The shape every server-side grid has: state the consumer owns, chrome that
 * subscribes to the table store, and `manualSorting` so a header click is a
 * round trip through the consumer's setState.
 */
function ServerSideGrid() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row: TestRow) => String(row.id),
    manualSorting: true,
    state: { sorting },
    onSortingChange: setSorting,
  } as never);

  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<TestRow> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}

describe("the controlled-state sync's publish", () => {
  it("does not reach subscribers while the consumer is rendering", async () => {
    const errors: Array<string> = [];
    const error = vi
      .spyOn(console, "error")
      .mockImplementation((...args: Array<unknown>) => {
        errors.push(String(args[0]));
      });
    const user = userEvent.setup();

    render(<ServerSideGrid />, { wrapper: MantineWrapper });
    // The sort lands in the consumer's state, comes back as `options.state`
    // and is synced into the atoms from `useTable`'s render body. Publishing
    // from there made React report "Cannot update a component (…) while
    // rendering a different component (…)" against the consumer's component.
    await user.click(screen.getByRole("columnheader", { name: /Name/ }));

    expect(errors).toEqual([]);
    error.mockRestore();
  });
});
