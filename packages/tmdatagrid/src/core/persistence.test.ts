import { afterEach, describe, expect, it, vi } from "vitest";
import type { TableState } from "@tanstack/react-table";
import {
  collectLeafColumnIds,
  collectUrlExcludedColumnIds,
  DATA_STATE_SLICES,
  findOverlappingSlices,
  hasPersistenceKeys,
  PERSIST_PAYLOAD_VERSION,
  readPersistedState,
  SETTINGS_STATE_SLICES,
  type TMDataGridPersistence,
  type TMDataGridUrlStorage,
  writePersistedState,
} from "./persistence";
import type { TMDataGridFeatures } from "../useTMDataGrid";

type GridState = TableState<TMDataGridFeatures>;

/** A complete, valid state - tests narrow or corrupt it as needed. */
function gridState(overrides: Partial<GridState> = {}): GridState {
  return {
    columnFilters: [{ id: "name", value: { operator: "contains", value: "a" } }],
    globalFilter: "search",
    sorting: [{ id: "name", desc: true }],
    pagination: { pageIndex: 2, pageSize: 50 },
    expanded: { "city:Malmö": true },
    columnVisibility: { name: false },
    columnSizing: { name: 120 },
    columnOrder: ["name", "age"],
    columnPinning: { start: ["name"], end: [] },
    grouping: ["city"],
    ...overrides,
  } as GridState;
}

const stored = (key: string): Record<string, unknown> =>
  JSON.parse(window.localStorage.getItem(key) ?? "{}");

describe("hasPersistenceKeys", () => {
  it("is false without a usable key", () => {
    expect(hasPersistenceKeys(undefined)).toBe(false);
    expect(hasPersistenceKeys({})).toBe(false);
    // A key entry with an empty key name configures nothing.
    expect(hasPersistenceKeys({ dataKey: ["", ["sorting"]] })).toBe(false);
  });

  it("is true as soon as either key is set", () => {
    expect(hasPersistenceKeys({ dataKey: "d" })).toBe(true);
    expect(hasPersistenceKeys({ settingsKey: "s" })).toBe(true);
  });

  it("is true with only a urlKey", () => {
    expect(hasPersistenceKeys({ urlKey: "g" })).toBe(true);
    expect(hasPersistenceKeys({ urlKey: ["g", ["columnFilters"]] })).toBe(
      true,
    );
  });
});

describe("writePersistedState", () => {
  it("splits the slices across the two keys", () => {
    writePersistedState(gridState(), { dataKey: "d", settingsKey: "s" });

    expect(Object.keys(stored("d")).sort()).toEqual(
      ["__v", ...DATA_STATE_SLICES].sort(),
    );
    expect(Object.keys(stored("s")).sort()).toEqual(
      ["__v", ...SETTINGS_STATE_SLICES].sort(),
    );
  });

  it("writes only the listed slices when a key is narrowed", () => {
    writePersistedState(gridState(), { dataKey: ["d", ["sorting"]] });

    expect(Object.keys(stored("d"))).toEqual(["__v", "sorting"]);
  });

  it("stamps the payload version", () => {
    writePersistedState(gridState(), { dataKey: "d" });

    expect(stored("d").__v).toBe(PERSIST_PAYLOAD_VERSION);
  });

  it("writes nothing without a key", () => {
    writePersistedState(gridState(), {});

    expect(window.localStorage.length).toBe(0);
  });

  it("uses sessionStorage when asked", () => {
    writePersistedState(gridState(), {
      dataKey: "d",
      storageMode: "sessionStorage",
    });

    expect(window.sessionStorage.getItem("d")).not.toBeNull();
    expect(window.localStorage.getItem("d")).toBeNull();
  });

  it("swallows a storage failure", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() =>
      writePersistedState(gridState(), { dataKey: "d" }),
    ).not.toThrow();
  });

  it("honours a custom serializer", () => {
    const persist: TMDataGridPersistence = {
      dataKey: ["d", ["sorting"]],
      serialize: (value) => `custom:${JSON.stringify(value)}`,
    };
    writePersistedState(gridState(), persist);

    expect(window.localStorage.getItem("d")).toMatch(/^custom:/);
  });
});

describe("readPersistedState", () => {
  it("round-trips what was written", () => {
    const persist: TMDataGridPersistence = { dataKey: "d", settingsKey: "s" };
    const state = gridState();
    writePersistedState(state, persist);

    const restored = readPersistedState(persist);

    expect(restored.sorting).toEqual(state.sorting);
    expect(restored.pagination).toEqual(state.pagination);
    expect(restored.columnOrder).toEqual(state.columnOrder);
    expect(restored.columnPinning).toEqual(state.columnPinning);
  });

  it("returns nothing when no key is configured", () => {
    expect(readPersistedState(undefined)).toEqual({});
    expect(readPersistedState({})).toEqual({});
  });

  it("ignores a payload written before the selection was narrowed", () => {
    writePersistedState(gridState(), { dataKey: "d" });

    // Same key, but the caller has since opted out of everything but sorting.
    const restored = readPersistedState({ dataKey: ["d", ["sorting"]] });

    expect(restored.sorting).toBeDefined();
    expect(restored.pagination).toBeUndefined();
    expect(restored.columnFilters).toBeUndefined();
  });

  it("survives unparsable or non-object payloads", () => {
    window.localStorage.setItem("d", "{not json");
    expect(readPersistedState({ dataKey: "d" })).toEqual({});

    window.localStorage.setItem("d", '"a string"');
    expect(readPersistedState({ dataKey: "d" })).toEqual({});

    window.localStorage.setItem("d", "null");
    expect(readPersistedState({ dataKey: "d" })).toEqual({});
  });

  it("drops a payload without a version stamp - pre-1.0 layouts", () => {
    // A 0.x build wrote slices with no `__v`.
    window.localStorage.setItem("d", JSON.stringify(gridState()));

    expect(readPersistedState({ dataKey: "d" })).toEqual({});
  });

  it("drops a payload from a different version whole", () => {
    window.localStorage.setItem(
      "d",
      JSON.stringify({ __v: PERSIST_PAYLOAD_VERSION + 1, ...gridState() }),
    );

    expect(readPersistedState({ dataKey: "d" })).toEqual({});
  });

  it("honours a custom deserializer", () => {
    window.localStorage.setItem(
      "d",
      `custom:${JSON.stringify({ __v: PERSIST_PAYLOAD_VERSION, ...gridState() })}`,
    );

    const restored = readPersistedState({
      dataKey: "d",
      deserialize: (value) => JSON.parse(value.replace(/^custom:/, "")),
    });

    expect(restored.sorting).toEqual([{ id: "name", desc: true }]);
  });

  describe("shape guards", () => {
    /** Writes a raw payload past the serializer, the way a stale build would. */
    const write = (payload: Record<string, unknown>) =>
      window.localStorage.setItem(
        "k",
        JSON.stringify({ __v: PERSIST_PAYLOAD_VERSION, ...payload }),
      );

    const readAll = () =>
      readPersistedState({ dataKey: "k", settingsKey: "k" });

    it("drops a slice of the wrong shape and keeps the rest", () => {
      write({
        sorting: "descending",
        pagination: { pageIndex: 1, pageSize: 25 },
      });

      const restored = readAll();

      expect(restored.sorting).toBeUndefined();
      expect(restored.pagination).toEqual({ pageIndex: 1, pageSize: 25 });
    });

    it("rejects malformed sorting entries", () => {
      write({ sorting: [{ id: "name" }] });
      expect(readAll().sorting).toBeUndefined();

      write({ sorting: [{ id: 1, desc: true }] });
      expect(readAll().sorting).toBeUndefined();

      write({ sorting: [{ id: "name", desc: true }] });
      expect(readAll().sorting).toEqual([{ id: "name", desc: true }]);
    });

    it("rejects a pagination slice that could not index a page", () => {
      write({ pagination: { pageIndex: -1, pageSize: 25 } });
      expect(readAll().pagination).toBeUndefined();

      write({ pagination: { pageIndex: 0, pageSize: 0 } });
      expect(readAll().pagination).toBeUndefined();

      write({ pagination: { pageIndex: 0 } });
      expect(readAll().pagination).toBeUndefined();
    });

    it("rejects column records with the wrong value type", () => {
      write({ columnVisibility: { name: "yes" } });
      expect(readAll().columnVisibility).toBeUndefined();

      write({ columnSizing: { name: "120" } });
      expect(readAll().columnSizing).toBeUndefined();

      write({ columnOrder: ["a", 2] });
      expect(readAll().columnOrder).toBeUndefined();
    });

    it("requires both pinned lanes to be string arrays", () => {
      write({ columnPinning: { start: ["a"] } });
      expect(readAll().columnPinning).toBeUndefined();

      write({ columnPinning: { start: ["a"], end: [] } });
      expect(readAll().columnPinning).toEqual({ start: ["a"], end: [] });
    });

    it("migrates the physical pinning keys 1.x wrote", () => {
      write({ columnPinning: { left: ["a"], right: ["b"] } });
      expect(readAll().columnPinning).toEqual({ start: ["a"], end: ["b"] });
    });

    it("requires column filters to carry an id", () => {
      write({ columnFilters: [{ value: "x" }] });
      expect(readAll().columnFilters).toBeUndefined();

      write({ columnFilters: [{ id: "name", value: "x" }] });
      expect(readAll().columnFilters).toEqual([{ id: "name", value: "x" }]);
    });

    it("leaves the untyped global filter alone", () => {
      write({ globalFilter: { anything: true } });
      expect(readAll().globalFilter).toEqual({ anything: true });
    });
  });

  describe("realignment against the current columns", () => {
    const persist: TMDataGridPersistence = { dataKey: "d", settingsKey: "s" };

    it("drops entries naming columns that no longer exist", () => {
      // "name" survives the deploy, "age" and "city" do not.
      writePersistedState(gridState(), persist);

      const restored = readPersistedState(persist, ["name", "brandNew"]);

      expect(restored.columnOrder).toEqual(["name"]);
      expect(restored.columnVisibility).toEqual({ name: false });
      expect(restored.columnSizing).toEqual({ name: 120 });
      expect(restored.columnPinning).toEqual({ start: ["name"], end: [] });
      expect(restored.grouping).toEqual([]);
      expect(restored.sorting).toEqual([{ id: "name", desc: true }]);
      expect(restored.columnFilters).toHaveLength(1);
    });

    it("drops a sort and filter on a removed column - no invisible state", () => {
      writePersistedState(gridState(), persist);

      const restored = readPersistedState(persist, ["age"]);

      expect(restored.sorting).toEqual([]);
      expect(restored.columnFilters).toEqual([]);
    });

    it("leaves value-keyed slices alone", () => {
      // `expanded` keys group values, not column ids.
      writePersistedState(gridState(), persist);

      const restored = readPersistedState(persist, ["name"]);

      expect(restored.expanded).toEqual({ "city:Malmö": true });
      expect(restored.pagination).toEqual({ pageIndex: 2, pageSize: 50 });
    });

    it("changes nothing when no ids are given", () => {
      const state = gridState();
      writePersistedState(state, persist);

      const restored = readPersistedState(persist);

      expect(restored.columnOrder).toEqual(state.columnOrder);
      expect(restored.sorting).toEqual(state.sorting);
    });
  });
});

describe("collectLeafColumnIds", () => {
  it("derives ids the way TanStack does", () => {
    expect(
      collectLeafColumnIds([
        { id: "explicit", accessorKey: "ignored" },
        { accessorKey: "plain" },
        { accessorKey: "address.city" },
        { header: "From Header" },
        { header: 42 },
      ]),
    ).toEqual(["explicit", "plain", "address_city", "From Header"]);
  });

  it("recurses into header groups", () => {
    expect(
      collectLeafColumnIds([
        {
          header: "Person",
          columns: [{ accessorKey: "firstName" }, { accessorKey: "lastName" }],
        },
        { accessorKey: "age" },
      ]),
    ).toEqual(["firstName", "lastName", "age"]);
  });
});

describe("collectUrlExcludedColumnIds", () => {
  it("collects the leaf columns with meta.filter.url false", () => {
    expect(
      collectUrlExcludedColumnIds([
        { accessorKey: "name", meta: { filter: { url: false } } },
        { accessorKey: "age", meta: { filter: { url: true } } },
        { accessorKey: "city", meta: { filter: {} } },
        {
          header: "Address",
          columns: [
            { accessorKey: "address.street", meta: { filter: { url: false } } },
          ],
        },
      ]),
    ).toEqual(["name", "address_street"]);
  });
});

describe("urlKey", () => {
  /** A URL param store held in memory, the shape a router adapter has. */
  function fakeUrl(initial: Record<string, string> = {}) {
    const params = new Map(Object.entries(initial));
    const urlStorage: TMDataGridUrlStorage = {
      get: (name) => params.get(name) ?? null,
      set: (name, value) => {
        if (value === null) params.delete(name);
        else params.set(name, value);
      },
    };
    return { params, urlStorage };
  }

  const param = (params: Map<string, string>, name: string) =>
    JSON.parse(params.get(name) ?? "null") as Record<string, unknown> | null;

  /** The state a grid without any `initialState` starts in. */
  const defaults: Partial<GridState> = {
    columnFilters: [],
    globalFilter: undefined,
    sorting: [],
    pagination: { pageIndex: 0, pageSize: 25 },
    expanded: {},
  };

  const filters = (
    ...entries: Array<[id: string, value: string]>
  ): GridState["columnFilters"] =>
    entries.map(([id, value]) => ({
      id,
      value: { operator: "contains", value },
    }));

  describe("writing", () => {
    it("writes the slices that differ from the baseline, without a version stamp", () => {
      const { params, urlStorage } = fakeUrl();

      writePersistedState(
        gridState(),
        { urlKey: ["g", ["columnFilters", "globalFilter"]], urlStorage },
        { baseline: defaults },
      );

      expect(param(params, "g")).toEqual({
        columnFilters: gridState().columnFilters,
        globalFilter: "search",
      });
    });

    it("leaves out a slice that equals its initial value", () => {
      const { params, urlStorage } = fakeUrl();

      writePersistedState(
        gridState({ globalFilter: undefined }),
        { urlKey: ["g", ["columnFilters", "globalFilter"]], urlStorage },
        { baseline: defaults },
      );

      expect(Object.keys(param(params, "g") ?? {})).toEqual(["columnFilters"]);
    });

    it("removes the param when nothing differs from the baseline", () => {
      const { params, urlStorage } = fakeUrl({ g: '{"sorting":[]}' });

      writePersistedState(
        gridState({ columnFilters: [], globalFilter: undefined }),
        { urlKey: ["g", ["columnFilters", "globalFilter"]], urlStorage },
        { baseline: defaults },
      );

      expect(params.has("g")).toBe(false);
    });

    it("writes an empty filter list when the user cleared an initial filter", () => {
      const { params, urlStorage } = fakeUrl();

      writePersistedState(
        gridState({ columnFilters: [] }),
        { urlKey: ["g", ["columnFilters"]], urlStorage },
        { baseline: { ...defaults, columnFilters: filters(["name", "a"]) } },
      );

      expect(param(params, "g")).toEqual({ columnFilters: [] });
    });

    it("takes every data slice from a bare key", () => {
      const { params, urlStorage } = fakeUrl();

      writePersistedState(gridState(), { urlKey: "g", urlStorage }, {
        baseline: defaults,
      });

      expect(Object.keys(param(params, "g") ?? {}).sort()).toEqual(
        [...DATA_STATE_SLICES].sort(),
      );
    });

    it("keeps the filter of a column opted out with meta.filter.url false", () => {
      const { params, urlStorage } = fakeUrl();
      const persist: TMDataGridPersistence = {
        urlKey: ["g", ["columnFilters"]],
        urlStorage,
      };

      writePersistedState(
        gridState({ columnFilters: filters(["name", "a"], ["city", "M"]) }),
        persist,
        { baseline: defaults, excludedFilterColumnIds: ["city"] },
      );
      expect(param(params, "g")).toEqual({
        columnFilters: filters(["name", "a"]),
      });

      // A filter on the opted-out column alone is no reason for a param.
      writePersistedState(
        gridState({ columnFilters: filters(["city", "M"]) }),
        persist,
        { baseline: defaults, excludedFilterColumnIds: ["city"] },
      );
      expect(params.has("g")).toBe(false);
    });

    it("writes only the column filters that narrow the rows", () => {
      const { params, urlStorage } = fakeUrl();

      writePersistedState(
        gridState({
          columnFilters: [
            // A row the filter panel seeded, not filled in yet.
            { id: "name", value: { operator: "contains", value: "" } },
            // An operator that needs no value is active as it is.
            { id: "city", value: { operator: "isEmpty" } },
          ],
        }),
        { urlKey: ["g", ["columnFilters"]], urlStorage },
        { baseline: defaults },
      );
      expect(param(params, "g")).toEqual({
        columnFilters: [{ id: "city", value: { operator: "isEmpty" } }],
      });

      // Only an inactive filter: nothing differs from the baseline.
      writePersistedState(
        gridState({
          columnFilters: [
            { id: "name", value: { operator: "contains", value: "" } },
          ],
        }),
        { urlKey: ["g", ["columnFilters"]], urlStorage },
        { baseline: defaults },
      );
      expect(params.has("g")).toBe(false);
    });

    it("leaves the URL alone under writeUrl false, and still writes storage", () => {
      const { params, urlStorage } = fakeUrl();

      writePersistedState(
        gridState(),
        {
          dataKey: ["d", ["sorting"]],
          urlKey: ["g", ["columnFilters"]],
          urlStorage,
        },
        { baseline: defaults, writeUrl: false },
      );

      expect(params.has("g")).toBe(false);
      expect(stored("d").sorting).toEqual(gridState().sorting);
    });

    it("honours a custom serializer", () => {
      const { params, urlStorage } = fakeUrl();

      writePersistedState(
        gridState(),
        {
          urlKey: ["g", ["sorting"]],
          urlStorage,
          serialize: (value) => `custom:${JSON.stringify(value)}`,
        },
        { baseline: defaults },
      );

      expect(params.get("g")).toBe(
        `custom:${JSON.stringify({ sorting: [{ id: "name", desc: true }] })}`,
      );
    });

    it("swallows a url storage failure", () => {
      const urlStorage: TMDataGridUrlStorage = {
        get: () => null,
        set: () => {
          throw new Error("SecurityError");
        },
      };

      expect(() =>
        writePersistedState(gridState(), { urlKey: "g", urlStorage }),
      ).not.toThrow();
    });
  });

  describe("reading", () => {
    it("round-trips what was written", () => {
      const { urlStorage } = fakeUrl();
      const persist: TMDataGridPersistence = {
        urlKey: ["g", ["columnFilters", "sorting"]],
        urlStorage,
      };
      writePersistedState(gridState(), persist, { baseline: defaults });

      const restored = readPersistedState(persist);

      expect(restored).toEqual({
        columnFilters: gridState().columnFilters,
        sorting: gridState().sorting,
      });
    });

    it("needs no version stamp, and tolerates one", () => {
      const persistWith = (
        urlStorage: TMDataGridUrlStorage,
      ): TMDataGridPersistence => ({ urlKey: ["g", ["sorting"]], urlStorage });

      const plain = fakeUrl({ g: '{"sorting":[{"id":"name","desc":true}]}' });
      expect(readPersistedState(persistWith(plain.urlStorage))).toEqual({
        sorting: [{ id: "name", desc: true }],
      });

      // A stamp from any version is ignored, not checked.
      const stamped = fakeUrl({
        g: JSON.stringify({
          __v: PERSIST_PAYLOAD_VERSION + 1,
          sorting: [{ id: "name", desc: true }],
        }),
      });
      expect(readPersistedState(persistWith(stamped.urlStorage))).toEqual({
        sorting: [{ id: "name", desc: true }],
      });
    });

    it("reads nothing for a missing param or a missing slice", () => {
      const { urlStorage } = fakeUrl({ g: '{"sorting":[]}' });

      expect(
        readPersistedState({ urlKey: ["other", ["sorting"]], urlStorage }),
      ).toEqual({});
      expect(
        readPersistedState({ urlKey: ["g", ["columnFilters"]], urlStorage }),
      ).toEqual({});
    });

    it("has no storage fallback for a url slice", () => {
      // A stored copy from before the slice moved to the URL stays unread.
      window.localStorage.setItem(
        "d",
        JSON.stringify({ __v: PERSIST_PAYLOAD_VERSION, ...gridState() }),
      );
      const { urlStorage } = fakeUrl();

      const restored = readPersistedState({
        dataKey: "d",
        urlKey: ["g", ["columnFilters"]],
        urlStorage,
      });

      expect(restored.columnFilters).toBeUndefined();
      expect(restored.sorting).toEqual(gridState().sorting);
    });

    it("ignores a bad or non-JSON param", () => {
      for (const raw of ["{not json", '"a string"', "null", "%7B"]) {
        const { urlStorage } = fakeUrl({ g: raw });
        expect(readPersistedState({ urlKey: "g", urlStorage })).toEqual({});
      }
    });

    it("drops a slice of the wrong shape and keeps the rest", () => {
      const { urlStorage } = fakeUrl({
        g: JSON.stringify({
          columnFilters: [{ value: "x" }],
          sorting: [{ id: "name", desc: false }],
        }),
      });

      expect(readPersistedState({ urlKey: "g", urlStorage })).toEqual({
        sorting: [{ id: "name", desc: false }],
      });
    });

    it("drops the filter of a column opted out with meta.filter.url false", () => {
      const { urlStorage } = fakeUrl({
        g: JSON.stringify({
          columnFilters: filters(["name", "a"], ["city", "M"]),
        }),
      });

      const restored = readPersistedState(
        { urlKey: ["g", ["columnFilters"]], urlStorage },
        undefined,
        { excludedFilterColumnIds: ["city"] },
      );

      expect(restored.columnFilters).toEqual(filters(["name", "a"]));
    });

    it("keeps the initial filter of an opted-out column next to the link's", () => {
      const { urlStorage } = fakeUrl({
        g: JSON.stringify({ columnFilters: filters(["name", "a"]) }),
      });

      const restored = readPersistedState(
        { urlKey: ["g", ["columnFilters"]], urlStorage },
        undefined,
        {
          // `initialState.columnFilters` filters the opted-out city column.
          baseline: { ...defaults, columnFilters: filters(["city", "M"]) },
          excludedFilterColumnIds: ["city"],
        },
      );

      expect(restored.columnFilters).toEqual(
        filters(["city", "M"], ["name", "a"]),
      );
    });

    it("drops a filter on a column that no longer exists", () => {
      const { urlStorage } = fakeUrl({
        g: JSON.stringify({
          columnFilters: filters(["name", "a"], ["removed", "x"]),
          sorting: [{ id: "removed", desc: true }],
        }),
      });

      const restored = readPersistedState({ urlKey: "g", urlStorage }, [
        "name",
        "age",
      ]);

      expect(restored.columnFilters).toEqual(filters(["name", "a"]));
      expect(restored.sorting).toEqual([]);
    });

    it("honours a custom deserializer", () => {
      const { urlStorage } = fakeUrl({
        g: `custom:${JSON.stringify({ sorting: [{ id: "name", desc: true }] })}`,
      });

      const restored = readPersistedState({
        urlKey: "g",
        urlStorage,
        deserialize: (value) => JSON.parse(value.replace(/^custom:/, "")),
      });

      expect(restored.sorting).toEqual([{ id: "name", desc: true }]);
    });
  });

  describe("a slice listed by dataKey and urlKey", () => {
    function setup() {
      const url = fakeUrl();
      const persist: TMDataGridPersistence = {
        dataKey: ["d", ["columnFilters", "sorting"]],
        urlKey: ["g", ["columnFilters"]],
        urlStorage: url.urlStorage,
      };
      return { ...url, persist };
    }

    it("is reported", () => {
      expect(findOverlappingSlices(setup().persist)).toEqual(["columnFilters"]);
      expect(
        findOverlappingSlices({ dataKey: "d", urlKey: ["g", ["sorting"]] }),
      ).toEqual(["sorting"]);
      expect(
        findOverlappingSlices({
          dataKey: ["d", ["sorting"]],
          urlKey: ["g", ["columnFilters"]],
        }),
      ).toEqual([]);
    });

    it("is written to the URL only", () => {
      const { params, persist } = setup();

      writePersistedState(gridState(), persist, { baseline: defaults });

      expect(stored("d")).toEqual({
        __v: PERSIST_PAYLOAD_VERSION,
        sorting: gridState().sorting,
      });
      expect(param(params, "g")).toEqual({
        columnFilters: gridState().columnFilters,
      });
    });

    it("is read from the URL only", () => {
      const { params, persist } = setup();
      window.localStorage.setItem(
        "d",
        JSON.stringify({ __v: PERSIST_PAYLOAD_VERSION, ...gridState() }),
      );
      params.set("g", JSON.stringify({ columnFilters: filters(["age", "3"]) }));

      const restored = readPersistedState(persist);

      expect(restored.columnFilters).toEqual(filters(["age", "3"]));
      expect(restored.sorting).toEqual(gridState().sorting);
    });
  });

  describe("the default url storage", () => {
    afterEach(() => {
      window.history.replaceState(null, "", "/");
    });

    const persist: TMDataGridPersistence = { urlKey: ["g", ["sorting"]] };
    const sorted = gridState({ sorting: [{ id: "name", desc: true }] });

    it("writes the param with replaceState and keeps the rest of the URL", () => {
      const routerState = { key: "router-entry" };
      window.history.replaceState(routerState, "", "/page?tab=2#section");
      const replaceState = vi.spyOn(window.history, "replaceState");
      const pushState = vi.spyOn(window.history, "pushState");

      writePersistedState(sorted, persist, { baseline: defaults });

      expect(replaceState).toHaveBeenCalledTimes(1);
      expect(pushState).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe("/page");
      expect(window.location.hash).toBe("#section");
      const search = new URLSearchParams(window.location.search);
      expect(search.get("tab")).toBe("2");
      expect(JSON.parse(search.get("g") ?? "null")).toEqual({
        sorting: [{ id: "name", desc: true }],
      });
      expect(window.history.state).toEqual(routerState);
    });

    it("reads the param from location.search", () => {
      writePersistedState(sorted, persist, { baseline: defaults });

      expect(readPersistedState(persist).sorting).toEqual([
        { id: "name", desc: true },
      ]);
    });

    it("does not touch history when the URL would not change", () => {
      writePersistedState(sorted, persist, { baseline: defaults });
      const replaceState = vi.spyOn(window.history, "replaceState");

      writePersistedState(sorted, persist, { baseline: defaults });

      expect(replaceState).not.toHaveBeenCalled();
    });

    it("removes the param and keeps the other params", () => {
      window.history.replaceState(null, "", "/page?tab=2");
      writePersistedState(sorted, persist, { baseline: defaults });

      writePersistedState(gridState({ sorting: [] }), persist, {
        baseline: defaults,
      });

      expect(window.location.search).toBe("?tab=2");
    });
  });
});
