import { describe, expect, it, vi } from "vitest";
import { SELECT_COLUMN_ID } from "../components/TMDataGridSelectColumn";
import { GROUP_COLUMN_ID } from "../components/TMDataGridGroupColumn";
import {
  captureViewState,
  createLocalStorageViewStore,
  normalizeView,
  pickViewSlices,
  validateViewName,
  VIEW_PAYLOAD_VERSION,
  type TMDataGridView,
} from "./views";

const view = (id: string, name: string): TMDataGridView => ({
  id,
  name,
  version: VIEW_PAYLOAD_VERSION,
  state: { columnVisibility: { age: false } },
});

describe("captureViewState", () => {
  const state = {
    columnVisibility: { age: false, [SELECT_COLUMN_ID]: true, [GROUP_COLUMN_ID]: false },
    columnSizing: { name: 200, [SELECT_COLUMN_ID]: 40 },
    columnOrder: [SELECT_COLUMN_ID, "city", "name"],
    columnPinning: { start: [SELECT_COLUMN_ID, "name"], end: [] },
    grouping: ["city"],
    sorting: [{ id: "name", desc: false }],
  };

  it("takes every settings slice and leaves the generated lanes out", () => {
    expect(captureViewState(state)).toEqual({
      columnVisibility: { age: false },
      columnSizing: { name: 200 },
      columnOrder: ["city", "name"],
      columnPinning: { start: ["name"], end: [] },
      grouping: ["city"],
    });
  });

  it("takes only the listed slices", () => {
    expect(captureViewState(state, ["columnVisibility"])).toEqual({
      columnVisibility: { age: false },
    });
  });

  it("never takes a data slice", () => {
    expect(captureViewState(state)).not.toHaveProperty("sorting");
  });
});

describe("pickViewSlices", () => {
  it("drops slices outside the list and slices the view does not hold", () => {
    expect(
      pickViewSlices(
        { columnVisibility: { age: false }, columnOrder: ["city"] },
        ["columnVisibility", "grouping"],
      ),
    ).toEqual({ columnVisibility: { age: false } });
  });
});

describe("normalizeView", () => {
  it("keeps a well-formed view", () => {
    expect(normalizeView(view("a", "Finance"))).toEqual(view("a", "Finance"));
  });

  it("brings a view without a version to the current one", () => {
    expect(
      normalizeView({ id: "a", name: "Old", state: { grouping: ["city"] } }),
    ).toEqual({
      id: "a",
      name: "Old",
      version: VIEW_PAYLOAD_VERSION,
      state: { grouping: ["city"] },
    });
  });

  it("drops a slice that fails its guard and keeps the rest", () => {
    expect(
      normalizeView({
        id: "a",
        name: "Mixed",
        state: { columnOrder: "city", grouping: ["city"] },
      })?.state,
    ).toEqual({ grouping: ["city"] });
  });

  it("rewrites the 1.x pinning keys", () => {
    expect(
      normalizeView({
        id: "a",
        name: "Pinned",
        state: { columnPinning: { left: ["name"], right: [] } },
      })?.state,
    ).toEqual({ columnPinning: { start: ["name"], end: [] } });
  });

  it.each([null, "view", { name: "No id" }, { id: "a" }, { id: "a", name: "  " }])(
    "rejects %j",
    (value) => {
      expect(normalizeView(value)).toBeNull();
    },
  );
});

describe("validateViewName", () => {
  const views = [view("a", "Finance"), view("b", "Wide")];

  it("accepts a new name", () => {
    expect(validateViewName("Compact", views)).toBeNull();
  });

  it("rejects an empty or blank name", () => {
    expect(validateViewName("", views)).toBe("empty");
    expect(validateViewName("   ", views)).toBe("empty");
  });

  it("compares trimmed and case-insensitively", () => {
    expect(validateViewName("  finance ", views)).toBe("duplicate");
  });

  it("does not compare a view with itself", () => {
    expect(validateViewName("Finance", views, "a")).toBeNull();
  });
});

describe("createLocalStorageViewStore", () => {
  it("round-trips views and the selected id", async () => {
    const store = createLocalStorageViewStore("views");
    await store.save(view("a", "Finance"));
    await store.save(view("b", "Wide"));
    await store.setActiveId("b");

    const again = createLocalStorageViewStore("views");
    expect((await again.list()).map((entry) => entry.name)).toEqual([
      "Finance",
      "Wide",
    ]);
    expect(await again.getActiveId()).toBe("b");
  });

  it("replaces a view saved under the same id", async () => {
    const store = createLocalStorageViewStore("views");
    await store.save(view("a", "Finance"));
    await store.save({ ...view("a", "Finance"), state: { grouping: ["city"] } });
    expect(await store.list()).toEqual([
      { ...view("a", "Finance"), state: { grouping: ["city"] } },
    ]);
  });

  it("clears the selection when the selected view is removed", async () => {
    const store = createLocalStorageViewStore("views");
    await store.save(view("a", "Finance"));
    await store.setActiveId("a");
    await store.remove("a");
    expect(await store.list()).toEqual([]);
    expect(await store.getActiveId()).toBeNull();
  });

  it("reads a payload that does not parse as nothing", async () => {
    window.localStorage.setItem("views", "{not json");
    const store = createLocalStorageViewStore("views");
    expect(await store.list()).toEqual([]);
    expect(await store.getActiveId()).toBeNull();
  });

  it("drops a stored entry that is not a view and keeps the others", async () => {
    window.localStorage.setItem(
      "views",
      JSON.stringify({ views: [{ id: 1 }, view("a", "Finance")], activeId: "a" }),
    );
    const store = createLocalStorageViewStore("views");
    expect(await store.list()).toEqual([view("a", "Finance")]);
  });

  it("rejects a write storage refuses", async () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const store = createLocalStorageViewStore("views");
    await expect(store.save(view("a", "Finance"))).rejects.toThrow();
  });

  it("writes to sessionStorage when asked", async () => {
    const store = createLocalStorageViewStore("views", {
      storageMode: "sessionStorage",
    });
    await store.save(view("a", "Finance"));
    expect(window.sessionStorage.getItem("views")).not.toBeNull();
    expect(window.localStorage.getItem("views")).toBeNull();
  });

  it("uses serialize and deserialize", async () => {
    const store = createLocalStorageViewStore("views", {
      serialize: (value) => `custom:${JSON.stringify(value)}`,
      deserialize: (value) => JSON.parse(value.replace(/^custom:/, "")),
    });
    await store.save(view("a", "Finance"));
    expect(window.localStorage.getItem("views")).toMatch(/^custom:/);
    expect(await store.list()).toEqual([view("a", "Finance")]);
  });

  it("reports a change to its key from another tab", () => {
    const store = createLocalStorageViewStore("views");
    const onChange = vi.fn();
    const unsubscribe = store.subscribe?.(onChange);

    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(onChange).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent("storage", { key: "views" }));
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe?.();
    window.dispatchEvent(new StorageEvent("storage", { key: "views" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
