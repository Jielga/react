import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  renderGrid,
  testColumns,
  type TestRow,
} from "../../test/gridHarness";

/**
 * Names chosen so one needle separates the ranking tiers: against "sven",
 * "Sven" is an exact (case-insensitive) match, "Svensson" starts with it,
 * "Asvenna" merely contains it, and "Berit" misses entirely.
 */
const searchRows: Array<TestRow> = [
  { id: 1, name: "Asvenna", age: 30, city: "Malmö" },
  { id: 2, name: "Svensson", age: 31, city: "Umeå" },
  { id: 3, name: "Sven", age: 32, city: "Lund" },
  { id: 4, name: "Berit", age: 33, city: "Kiruna" },
];

const names = (grid: ReturnType<typeof renderGrid>) =>
  grid.result.current.table
    .getPrePaginatedRowModel()
    .rows.map((row) => row.original.name);

describe("fuzzy quick search", () => {
  it("is the default and orders by match quality, best first", () => {
    const grid = renderGrid({ data: searchRows });

    act(() => grid.result.current.table.setGlobalFilter("sven"));

    expect(names(grid)).toEqual(["Sven", "Svensson", "Asvenna"]);
  });

  it("forgives a missing character", () => {
    const grid = renderGrid({ data: searchRows });

    // "Svnsson" - the e dropped. Substring matching finds nothing.
    act(() => grid.result.current.table.setGlobalFilter("Svnsson"));

    expect(names(grid)).toEqual(["Svensson"]);
  });

  it("suspends the ranking while the user sorts", () => {
    const grid = renderGrid({ data: searchRows });

    act(() => {
      grid.result.current.table.setGlobalFilter("sven");
      grid.result.current.table.setSorting([{ id: "name", desc: false }]);
    });

    expect(names(grid)).toEqual(["Asvenna", "Sven", "Svensson"]);
  });

  it("suspends the ranking while grouped, keeping the tree intact", () => {
    const grid = renderGrid({ data: searchRows });

    act(() => {
      grid.result.current.table.setGlobalFilter("sven");
      grid.result.current.table.getColumn("city")?.toggleGrouping();
    });

    const rows = grid.result.current.table.getPrePaginatedRowModel().rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.getIsGrouped()).toBe(true);
  });

  it("quickSearchMode contains restores plain substring matching", () => {
    const grid = renderGrid({ data: searchRows, quickSearchMode: "contains" });

    act(() => grid.result.current.table.setGlobalFilter("Svnsson"));
    expect(names(grid)).toEqual([]);

    // And no ranking: matches keep the data order.
    act(() => grid.result.current.table.setGlobalFilter("sven"));
    expect(names(grid)).toEqual(["Asvenna", "Svensson", "Sven"]);
  });

  it("an explicit globalFilterFn overrides mode and ranking both", () => {
    const grid = renderGrid({
      data: searchRows,
      globalFilterFn: "includesString",
    });

    act(() => grid.result.current.table.setGlobalFilter("sven"));

    expect(names(grid)).toEqual(["Asvenna", "Svensson", "Sven"]);
  });
});

describe("which columns the quick search reads", () => {
  type NoteRow = TestRow & { note: string | null };
  const noteRows = (notes: Array<string | null>): Array<NoteRow> =>
    notes.map((note, index) => ({
      id: index + 1,
      name: `Name ${index + 1}`,
      age: 30,
      city: "Lund",
      note,
    }));
  const noteColumns = [
    ...testColumns,
    { accessorKey: "note", header: "Note" },
    { id: "actions", header: "", cell: () => null },
  ];
  const canSearch = (grid: ReturnType<typeof renderGrid>, id: string) =>
    grid.result.current.table.getColumn(id)?.getCanGlobalFilter();

  it("reads a column by its first non-empty value", () => {
    const grid = renderGrid({
      data: noteRows([null, null, "late"]),
      columns: noteColumns,
    } as never);

    expect(canSearch(grid, "note")).toBe(true);
    expect(canSearch(grid, "name")).toBe(true);
    expect(canSearch(grid, "actions")).toBe(false);
  });

  it("skips a column empty in every row until the data fills it", () => {
    const grid = renderGrid({
      data: noteRows([null, null]),
      columns: noteColumns,
    } as never);
    expect(canSearch(grid, "note")).toBe(false);

    grid.rerender();
    act(() => {
      grid.result.current.table.setOptions((previous) => ({
        ...previous,
        data: noteRows([null, "filled"]),
      }));
    });

    expect(canSearch(grid, "note")).toBe(true);
  });

  it("reads any column that sets enableGlobalFilter: true", () => {
    const grid = renderGrid({
      data: noteRows([null]),
      columns: [
        ...testColumns,
        { accessorKey: "note", header: "Note", enableGlobalFilter: true },
      ],
    } as never);

    expect(canSearch(grid, "note")).toBe(true);
  });
});
