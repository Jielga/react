import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gridRowCount, renderGrid, renderGridUi } from "../../test/gridHarness";
import { testColumns, type TestRow } from "../../test/fixtures";
import { createTMDataGridColumnHelper } from "../useTMDataGrid";
import {
  createTMDataGridUrlState,
  type TMDataGridUrlPayload,
  type TMDataGridUrlSearchStorage,
} from "./urlState";

type Person = {
  id: number;
  name: string;
  status: "Active" | "On leave";
  tags: Array<"vip" | "new">;
  salary: number;
  hired: string;
  active: boolean;
  address: { city: string };
  email: string;
};

const helper = createTMDataGridColumnHelper<Person>();

const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("status", { header: "Status", meta: { type: "select" } }),
  helper.accessor("tags", { header: "Tags", meta: { type: "multiSelect" } }),
  helper.accessor("salary", {
    header: "Salary",
    meta: { type: "number", filter: { operators: ["between", "greaterThan"] } },
  }),
  helper.accessor("hired", { header: "Hired", meta: { type: "date" } }),
  helper.accessor("active", { header: "Active", meta: { type: "boolean" } }),
  helper.accessor("address.city", { header: "City" }),
  helper.accessor((row) => row.name.length, {
    id: "nameLength",
    header: "Name length",
    meta: { type: "number" },
  }),
  helper.accessor((row) => row.email.toLowerCase(), { header: "No id" }),
  helper.accessor("id", { header: "ID", enableColumnFilter: false, enableSorting: false }),
  helper.accessor("email", { header: "Email", meta: { filter: { url: false } } }),
  helper.group({
    id: "group",
    header: "Group",
    columns: helper.columns([
      helper.accessor("name", { id: "groupedName", header: "Grouped name" }),
    ]),
  }),
]);

const people = createTMDataGridUrlState({ key: "people", columns });

describe("createTMDataGridUrlState - payload", () => {
  it("writes each filter in the grid's envelope, every value a string", () => {
    expect(
      people.payload({
        filters: {
          name: { operator: "contains", value: "an" },
          status: { operator: "isAnyOf", value: ["Active"] },
          tags: { operator: "isNoneOf", value: ["vip"] },
          salary: { operator: "between", value: [null, 50_000] },
          hired: { operator: "onOrAfter", value: new Date(2022, 0, 31) },
          active: { operator: "equals", value: true },
          address_city: { operator: "isEmpty" },
          nameLength: { operator: "greaterThan", value: 3 },
        },
      }),
    ).toEqual({
      columnFilters: [
        { id: "name", value: { operator: "contains", value: "an" } },
        { id: "status", value: { operator: "isAnyOf", value: ["Active"] } },
        { id: "tags", value: { operator: "isNoneOf", value: ["vip"] } },
        { id: "salary", value: { operator: "between", value: ["", "50000"] } },
        { id: "hired", value: { operator: "onOrAfter", value: "2022-01-31" } },
        { id: "active", value: { operator: "equals", value: "true" } },
        { id: "address_city", value: { operator: "isEmpty", value: "" } },
        { id: "nameLength", value: { operator: "greaterThan", value: "3" } },
      ],
    } satisfies TMDataGridUrlPayload);
  });

  it("cuts a date column's timestamp to the day the date controls write", () => {
    expect(
      people.payload({ filters: { hired: { operator: "before", value: "2024-05-06T23:00:00Z" } } }),
    ).toEqual({
      columnFilters: [{ id: "hired", value: { operator: "before", value: "2024-05-06" } }],
    });
  });

  it("writes sorting, the search and the page in the grid's state shape", () => {
    expect(
      people.payload({
        sorting: [{ id: "salary", desc: true }, { id: "name" }],
        globalFilter: "anna",
        pagination: { pageIndex: 2, pageSize: 50 },
      }),
    ).toEqual({
      sorting: [
        { id: "salary", desc: true },
        { id: "name", desc: false },
      ],
      globalFilter: "anna",
      pagination: { pageIndex: 2, pageSize: 50 },
    });
  });

  it("returns undefined for an input that sets nothing", () => {
    expect(people.payload({})).toBeUndefined();
    expect(people.payload({ filters: {}, sorting: [], globalFilter: "" })).toBeUndefined();
    expect(people.search({})).toEqual({ people: undefined });
    expect(people.searchParams({}).toString()).toBe("");
  });

  it("leaves out a slice the definition does not carry, even from an untyped caller", () => {
    const filtersOnly = createTMDataGridUrlState({
      key: "f",
      columns,
      slices: ["columnFilters"],
    });
    const untyped = { sorting: [{ id: "name" }], globalFilter: "x" } as Parameters<
      typeof filtersOnly.payload
    >[0];
    expect(filtersOnly.payload(untyped)).toBeUndefined();
  });
});

describe("createTMDataGridUrlState - links", () => {
  it("names the param urlKey takes: a bare key, or a tuple when slices are given", () => {
    expect(people.urlKey).toBe("people");
    const subset = createTMDataGridUrlState({ key: "s", columns, slices: ["sorting"] });
    expect(subset.urlKey).toEqual(["s", ["sorting"]]);
    expect(subset.persist()).toEqual({ urlKey: ["s", ["sorting"]] });
  });

  it("builds a router search object and plain search params", () => {
    const input = { filters: { name: { operator: "equals", value: "Anna" } } } as const;
    expect(people.search(input)).toEqual({ people: people.payload(input) });
    expect(people.searchParams(input).get("people")).toBe(
      JSON.stringify(people.payload(input)),
    );
    expect(
      people.searchParams(input, { serialize: () => "custom" }).get("people"),
    ).toBe("custom");
  });

  it("validates a route search: an object is kept, anything else dropped", () => {
    const payload = { sorting: [{ id: "name", desc: false }] };
    expect(people.validateSearch({ people: payload, other: 1 })).toEqual({ people: payload });
    expect(people.validateSearch({ people: "text" })).toEqual({});
    expect(people.validateSearch({ people: [] })).toEqual({});
    expect(people.validateSearch({})).toEqual({});
  });
});

describe("createTMDataGridUrlState - persist(storage)", () => {
  const storageOver = (search: Record<string, unknown>) => {
    const storage: TMDataGridUrlSearchStorage = {
      get: (name) => search[name],
      set: vi.fn((name: string, value: TMDataGridUrlPayload | undefined) => {
        search[name] = value;
      }),
    };
    return storage;
  };

  it("hands the grid the router's object as the string it would have written", () => {
    const payload = { sorting: [{ id: "name", desc: true }] };
    const { urlStorage } = people.persist(storageOver({ people: payload }));
    expect(urlStorage?.get("people")).toBe(JSON.stringify(payload));
    expect(urlStorage?.get("missing")).toBeNull();
  });

  it("passes a value the router left as text through unchanged", () => {
    const { urlStorage } = people.persist(storageOver({ people: '{"globalFilter":"x"}' }));
    expect(urlStorage?.get("people")).toBe('{"globalFilter":"x"}');
  });

  it("writes the grid's string to the router as an object, and removes it on null", () => {
    const storage = storageOver({});
    const { urlStorage } = people.persist(storage);
    urlStorage?.set("people", '{"globalFilter":"x"}');
    expect(storage.set).toHaveBeenLastCalledWith("people", { globalFilter: "x" });
    urlStorage?.set("people", null);
    expect(storage.set).toHaveBeenLastCalledWith("people", undefined);
  });
});

describe("createTMDataGridUrlState - with the grid", () => {
  const rows = createTMDataGridUrlState({ key: "rows", columns: testColumns });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the grid on the filter a link names", () => {
    const search: Record<string, unknown> = rows.search({
      filters: { name: { operator: "equals", value: "Anna" } },
    });
    renderGridUi({
      persist: rows.persist({ get: (name) => search[name], set: () => {} }),
    });
    // Names cycle through five values, so "Anna" is rows 1, 6 and 11 of 12.
    expect(gridRowCount()).toBe(3);
  });

  it("writes a change back to the router's search as an object", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const search: Record<string, unknown> = {};
    const { result } = renderGrid({
      persist: rows.persist({
        get: (name) => search[name],
        set: (name, value) => {
          search[name] = value;
        },
      }),
    });

    act(() => result.current.table.setSorting([{ id: "age", desc: true }]));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(search.rows).toEqual(rows.payload({ sorting: [{ id: "age", desc: true }] }));
  });
});

/**
 * Compile-time rules. Each `@ts-expect-error` fails the typecheck when the
 * line under it compiles. The calls also run, which proves nothing beyond
 * "does not throw"; the typecheck is the assertion.
 */
describe("createTMDataGridUrlState - what a link may name", () => {
  it("accepts the grid's filterable columns with their own operators and values", () => {
    people.payload({
      filters: {
        status: { operator: "isAnyOf", value: ["Active", "On leave"] },
        tags: { operator: "isAnyOf", value: ["vip"] },
        salary: { operator: "greaterThan", value: 1 },
        address_city: { operator: "startsWith", value: "S" },
        nameLength: { operator: "between", value: [1, null] },
        groupedName: { operator: "endsWith", value: "a" },
      },
      sorting: [{ id: "address_city" }, { id: "groupedName", desc: true }],
    });
  });

  it("rejects what the grid's columns do not offer", () => {
    // @ts-expect-error - a field of the row with no column
    people.payload({ filters: { phone: { operator: "contains", value: "1" } } });
    // @ts-expect-error - enableColumnFilter: false
    people.payload({ filters: { id: { operator: "equals", value: 1 } } });
    // @ts-expect-error - meta.filter.url: false
    people.payload({ filters: { email: { operator: "contains", value: "a" } } });
    // @ts-expect-error - the dotted key's id has an underscore
    people.payload({ filters: { "address.city": { operator: "contains", value: "a" } } });
    // @ts-expect-error - an accessor function without an id cannot be named
    people.payload({ filters: { "No id": { operator: "contains", value: "a" } } });
    // @ts-expect-error - "contains" is not a select operator
    people.payload({ filters: { status: { operator: "contains", value: "A" } } });
    // @ts-expect-error - meta.filter.operators offers only between and greaterThan
    people.payload({ filters: { salary: { operator: "lessThan", value: 1 } } });
    // @ts-expect-error - not one of the status values
    people.payload({ filters: { status: { operator: "isAnyOf", value: ["Retired"] } } });
    // @ts-expect-error - a number column takes a number
    people.payload({ filters: { salary: { operator: "greaterThan", value: "1" } } });
    // @ts-expect-error - a valueless operator takes no value
    people.payload({ filters: { name: { operator: "isEmpty", value: "x" } } });
    // @ts-expect-error - enableSorting: false
    people.payload({ sorting: [{ id: "id" }] });
    // @ts-expect-error - a slice the definition does not carry
    createTMDataGridUrlState({ key: "f", columns, slices: ["sorting"] }).payload({ globalFilter: "x" });
    expect(true).toBe(true);
  });

  it("names nothing for columns built without the helper", () => {
    const untyped = createTMDataGridUrlState({
      key: "u",
      columns: [{ accessorKey: "name", header: "Name" }],
    });
    // @ts-expect-error - a plain column definition carries no column info
    untyped.payload({ filters: { name: { operator: "contains", value: "a" } } });
    expect(untyped.payload({})).toBeUndefined();
  });

  it("types the grid's TestRow columns too", () => {
    const typed = createTMDataGridUrlState({ key: "t", columns: testColumns });
    typed.payload({ filters: { age: { operator: "between", value: [20, 30] } } });
    // @ts-expect-error - "age" is a number column
    typed.payload({ filters: { age: { operator: "contains", value: "2" } } });
    const row: TestRow | undefined = undefined;
    expect(row).toBeUndefined();
  });
});
