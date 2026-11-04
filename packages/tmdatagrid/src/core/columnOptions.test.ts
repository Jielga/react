import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MantineWrapper } from "../../test/gridHarness";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridRowData,
} from "../index";
import { optionsToComboboxData, resolveColumnOptions } from "./columnOptions";

type Order = {
  id: number;
  status: string;
  city: string;
  tags: Array<string>;
};

const helper = createTMDataGridColumnHelper<Order>();

const STATUS_OPTIONS = [
  "Pending",
  { value: "Paid", label: "Paid in full", color: "green" },
] as const;

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
const columns = helper.columns([
  helper.accessor("status", {
    header: "Status",
    meta: { type: "select", options: STATUS_OPTIONS },
  }),
  helper.accessor("city", {
    header: "City",
    meta: { type: "select", options: "faceted" },
  }),
  helper.accessor("tags", {
    header: "Tags",
    meta: { type: "multiSelect", options: "faceted" },
  }),
  helper.accessor("id", {
    header: "ID",
    meta: {
      type: "select",
      options: ({ row }) =>
        row === undefined ? ["for-filter"] : [`for-row-${String(row.id)}`],
    },
  }),
  // A select column that never declared options - what the resolver's
  // fallback parameter exists for.
  helper.accessor("city", {
    id: "bareCity",
    header: "Bare city",
    meta: { type: "select" },
  }),
]);

const rows: Array<Order> = [
  { id: 1, status: "Paid", city: "Malmö", tags: ["red", "blue"] },
  { id: 2, status: "Pending", city: "Stockholm", tags: ["blue"] },
  { id: 3, status: "Paid", city: "Stockholm", tags: [] },
];

function renderOrderGrid(options: { manualPagination?: boolean } = {}) {
  const { result } = renderHook(
    () =>
      useTMDataGrid<Order>({
        data: rows,
        columns,
        getRowId: (row) => String(row.id),
        ...options,
      }),
    { wrapper: MantineWrapper },
  );
  // The same erasure the context provider performs.
  return result.current as unknown as TMDataGridApi<TMDataGridRowData>;
}

function column(api: TMDataGridApi<TMDataGridRowData>, id: string) {
  const found = api.table.getColumn(id);
  if (!found) throw new Error(`no column ${id}`);
  return found;
}

describe("resolveColumnOptions", () => {
  it("normalises a static list, keeping option fields and lifting strings", () => {
    const api = renderOrderGrid();
    expect(
      resolveColumnOptions({ table: api.table, column: column(api, "status") }),
    ).toEqual([
      { value: "Pending" },
      { value: "Paid", label: "Paid in full", color: "green" },
    ]);
  });

  it("reads faceted options from the values present, sorted", () => {
    const api = renderOrderGrid();
    expect(
      resolveColumnOptions({ table: api.table, column: column(api, "city") }),
    ).toEqual([{ value: "Malmö" }, { value: "Stockholm" }]);
  });

  it("flattens array cells into their elements for faceted options", () => {
    const api = renderOrderGrid();
    expect(
      resolveColumnOptions({ table: api.table, column: column(api, "tags") }),
    ).toEqual([{ value: "blue" }, { value: "red" }]);
  });

  it("passes the row through to a function source, when there is one", () => {
    const api = renderOrderGrid();
    const idColumn = column(api, "id");
    expect(
      resolveColumnOptions({ table: api.table, column: idColumn }),
    ).toEqual([{ value: "for-filter" }]);
    expect(
      resolveColumnOptions({
        table: api.table,
        column: idColumn,
        row: api.table.getRow("2"),
      }),
    ).toEqual([{ value: "for-row-2" }]);
  });

  it("is empty without a declaration, unless a fallback is given", () => {
    const api = renderOrderGrid();
    const bare = column(api, "bareCity");
    expect(resolveColumnOptions({ table: api.table, column: bare })).toEqual(
      [],
    );
    expect(
      resolveColumnOptions({ table: api.table, column: bare, fallback: "faceted" }),
    ).toEqual([{ value: "Malmö" }, { value: "Stockholm" }]);
  });
});

describe("optionsToComboboxData", () => {
  it("fills labels from values and keeps disabled", () => {
    expect(
      optionsToComboboxData([
        { value: "a" },
        { value: "b", label: "B!", disabled: true },
      ]),
    ).toEqual([
      { value: "a", label: "a" },
      { value: "b", label: "B!", disabled: true },
    ]);
  });

  it("folds group fields into Mantine group entries, ungrouped first", () => {
    expect(
      optionsToComboboxData([
        { value: "x", group: "Late" },
        { value: "a" },
        { value: "y", group: "Late" },
        { value: "z", group: "Early" },
      ]),
    ).toEqual([
      { value: "a", label: "a" },
      {
        group: "Late",
        items: [
          { value: "x", label: "x" },
          { value: "y", label: "y" },
        ],
      },
      { group: "Early", items: [{ value: "z", label: "z" }] },
    ]);
  });
});

describe("faceted options where the server owns the rows", () => {
  it("warns once per column, and still resolves", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const api = renderOrderGrid({ manualPagination: true });

    const options = resolveColumnOptions({
      table: api.table,
      column: column(api, "city"),
    });
    // The facets of one page are still what the panel has to show; the
    // warning says they are not the facets of the result set.
    expect(options).toEqual([{ value: "Malmö" }, { value: "Stockholm" }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('column "city" resolves faceted options'),
    );

    resolveColumnOptions({ table: api.table, column: column(api, "city") });
    expect(warn).toHaveBeenCalledTimes(1);

    resolveColumnOptions({ table: api.table, column: column(api, "tags") });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("is quiet on a client-side grid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const api = renderOrderGrid();

    resolveColumnOptions({ table: api.table, column: column(api, "city") });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("stays warned across re-renders, which hand out a new table object", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result, rerender } = renderHook(
      () =>
        useTMDataGrid<Order>({
          data: rows,
          columns,
          getRowId: (row) => String(row.id),
          manualPagination: true,
        }),
      { wrapper: MantineWrapper },
    );
    const api = () =>
      result.current as unknown as TMDataGridApi<TMDataGridRowData>;
    const first = api().table;

    resolveColumnOptions({ table: first, column: column(api(), "city") });
    rerender();
    // `useTable` rebuilds the returned table every render; only the store
    // keeps its identity, which is why the store is the guard's key. Keyed on
    // the table, the filter panel warned once per keystroke.
    expect(api().table).not.toBe(first);
    resolveColumnOptions({ table: api().table, column: column(api(), "city") });

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
