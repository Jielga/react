import { Menu } from "@mantine/core";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  part,
  parts,
  queryPart,
  renderGrid,
  renderWithMantine,
  testColumns,
  testRows,
  visibleColumnIds,
  type TestRow,
} from "../../test/gridHarness";
import { TMDATAGRID_LABELS_SV } from "../core/labelsSv";
import {
  createLocalStorageViewStore,
  isViewModified,
  VIEW_PAYLOAD_VERSION,
  type TMDataGridViewPreset,
  type TMDataGridViewsOptions,
} from "../core/views";
import { useTMDataGrid, type UseTMDataGridOptions } from "../useTMDataGrid";
import { TMDataGrid } from "./TMDataGrid";

const PRESETS: TMDataGridViewPreset[] = [
  { id: "noAge", name: "Without age", state: { columnVisibility: { age: false } } },
  { id: "cityFirst", name: "City first", state: { columnOrder: ["city", "id", "name", "age"] } },
];

/** A grid whose toolbar holds whatever the test passes. */
function ViewsGrid({
  children,
  options,
}: {
  children: ReactNode;
  options?: Partial<UseTMDataGridOptions<TestRow>>;
}) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row) => String(row.id),
    enableRowSelection: false,
    ...options,
  });
  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Toolbar>{children}</TMDataGrid.Toolbar>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>
  );
}

const renderMenu = (views: TMDataGridViewsOptions | undefined, extra = {}) =>
  renderWithMantine(
    <ViewsGrid options={{ views, ...extra }}>
      <TMDataGrid.Menu>
        <TMDataGrid.Menu.Columns />
      </TMDataGrid.Menu>
    </ViewsGrid>,
  );

const openMenu = async (user: UserEvent, part_ = "menu-button") => {
  await user.click(part(part_));
  await screen.findByRole("menu");
};

/** Opens the burger, then its Views submenu. */
const openViews = async (user: UserEvent) => {
  await openMenu(user);
  await user.hover(part("views-submenu"));
  await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(2));
};

/**
 * A click inside the Views submenu. Not `user.click`: jsdom has no layout, so
 * floating-ui's safe polygon closes the submenu the moment the pointer leaves
 * its trigger, before the click lands. Playwright covers the pointer path.
 */
const clickInSub = (element: HTMLElement) => fireEvent.click(element);

/** The visible data columns, the checkbox lane left out. */
const dataColumnIds = (api: Parameters<typeof visibleColumnIds>[0]) =>
  visibleColumnIds(api).filter((id) => !id.startsWith("__"));

const headerIds = () =>
  parts("header").map((header) => header.dataset.columnId);

describe("grid.views", () => {
  it("is off without the views option", () => {
    const { result } = renderGrid();
    expect(result.current.views.enabled).toBe(false);
    expect(result.current.views.list).toEqual([]);
  });

  it("applies a preset and remembers it as selected", () => {
    const { result } = renderGrid({ views: { presets: PRESETS } });
    act(() => result.current.views.select("noAge"));
    expect(dataColumnIds(result.current)).not.toContain("age");
    expect(result.current.views.activeId).toBe("noAge");
  });

  it("leaves a slice the view does not hold as it is", () => {
    const { result } = renderGrid({ views: { presets: PRESETS } });
    act(() => result.current.views.select("noAge"));
    act(() => result.current.views.select("cityFirst"));
    // City first holds only the order, so Age stays hidden.
    expect(dataColumnIds(result.current)).toEqual(["city", "id", "name"]);
  });

  it("applies only the slices the views option lists", () => {
    const { result } = renderGrid({
      views: { presets: PRESETS, slices: ["columnVisibility"] },
    });
    act(() => result.current.views.select("cityFirst"));
    expect(dataColumnIds(result.current)).toEqual(["id", "name", "age", "city"]);
  });

  it("reports a layout change as modified, and selecting again discards it", () => {
    const { result } = renderGrid({ views: { presets: PRESETS } });
    expect(result.current.views.modified).toBe(false);
    act(() => result.current.views.select("noAge"));
    expect(result.current.views.modified).toBe(false);

    act(() => result.current.table.getColumn("age")?.toggleVisibility(true));
    expect(result.current.views.modified).toBe(true);

    act(() => result.current.views.select("noAge"));
    expect(dataColumnIds(result.current)).not.toContain("age");
    expect(result.current.views.modified).toBe(false);
  });

  it("is no longer modified once a change is undone by hand", () => {
    const { result } = renderGrid({ views: { presets: PRESETS } });
    act(() => result.current.views.select("noAge"));
    act(() => result.current.table.getColumn("city")?.toggleVisibility(false));
    expect(result.current.views.modified).toBe(true);
    act(() => result.current.table.getColumn("city")?.toggleVisibility(true));
    expect(result.current.views.modified).toBe(false);
  });

  it("counts only the slices the view holds, and never sorting", () => {
    const { result } = renderGrid({ views: { presets: PRESETS } });
    // Without age holds the visibility alone.
    act(() => result.current.views.select("noAge"));
    act(() => result.current.table.setColumnOrder(["city", "id"]));
    act(() => result.current.table.setSorting([{ id: "name", desc: true }]));
    expect(result.current.views.modified).toBe(false);
  });

  it("drops the ids of columns that no longer exist", () => {
    const { result } = renderGrid({
      views: {
        presets: [
          {
            id: "old",
            name: "Old",
            state: { columnOrder: ["gone", "city"], columnVisibility: { gone: false, age: false } },
          },
        ],
      },
    });
    act(() => result.current.views.select("old"));
    expect(dataColumnIds(result.current)).toEqual(["city", "id", "name"]);
    expect(result.current.table.store.state.columnOrder).toEqual(["city"]);
  });

  it("starts a first visit on defaultView", () => {
    const { result } = renderGrid({
      views: { presets: PRESETS, defaultView: "noAge" },
    });
    expect(dataColumnIds(result.current)).not.toContain("age");
    expect(result.current.views.activeId).toBe("noAge");
  });

  it("does not apply defaultView over a layout restored from storage", () => {
    window.localStorage.setItem(
      "settings",
      JSON.stringify({ __v: 1, columnVisibility: { city: false } }),
    );
    const { result } = renderGrid({
      persist: { settingsKey: "settings" },
      views: { presets: PRESETS, defaultView: "noAge" },
    });
    expect(dataColumnIds(result.current)).toEqual(["id", "name", "age"]);
    expect(result.current.views.activeId).toBeNull();
  });

  it("saves the current layout as a user view and selects it", async () => {
    const { result } = renderGrid({ views: {} });
    act(() => result.current.table.getColumn("city")?.toggleVisibility(false));
    let saved: Awaited<ReturnType<typeof result.current.views.saveAs>> | undefined;
    await act(async () => {
      saved = await result.current.views.saveAs("  No city ");
    });
    expect(saved?.ok).toBe(true);
    expect(result.current.views.list).toEqual([
      {
        id: result.current.views.activeId,
        name: "No city",
        source: "user",
        state: expect.objectContaining({ columnVisibility: { city: false } }),
      },
    ]);
  });

  it("refuses a duplicate name, presets included", async () => {
    const { result } = renderGrid({ views: { presets: PRESETS } });
    let saved: Awaited<ReturnType<typeof result.current.views.saveAs>> | undefined;
    await act(async () => {
      saved = await result.current.views.saveAs("without AGE");
    });
    expect(saved).toEqual({ ok: false, error: "duplicate" });
  });

  it("saves nothing when user views are off", async () => {
    const { result } = renderGrid({
      views: { presets: PRESETS, allowUserViews: false },
    });
    let saved: Awaited<ReturnType<typeof result.current.views.saveAs>> | undefined;
    await act(async () => {
      saved = await result.current.views.saveAs("Mine");
    });
    expect(saved).toEqual({ ok: false, error: "notAllowed" });
  });

  it("overwrites and removes only the user's own views", async () => {
    const { result } = renderGrid({ views: { presets: PRESETS } });
    act(() => result.current.views.select("noAge"));
    let overwritten: boolean | undefined;
    let removed: boolean | undefined;
    await act(async () => {
      overwritten = await result.current.views.overwrite();
      removed = await result.current.views.remove("noAge");
    });
    expect(overwritten).toBe(false);
    expect(removed).toBe(false);
    expect(result.current.views.list).toHaveLength(2);
  });

  it("overwrites the selected user view with the current layout", async () => {
    const { result } = renderGrid({ views: {} });
    await act(async () => {
      await result.current.views.saveAs("Mine");
    });
    act(() => result.current.table.getColumn("age")?.toggleVisibility(false));
    await act(async () => {
      await result.current.views.overwrite();
    });
    expect(result.current.views.active?.state.columnVisibility).toEqual({ age: false });
  });

  it("loads user views from the store and applies the stored selection", async () => {
    const store = createLocalStorageViewStore("views");
    await store.save({
      id: "u1",
      name: "No city",
      version: VIEW_PAYLOAD_VERSION,
      state: { columnVisibility: { city: false } },
    });
    await store.setActiveId("u1");

    const { result } = renderGrid({ views: { store } });
    expect(result.current.views.status).toBe("loading");
    await waitFor(() => expect(result.current.views.status).toBe("ready"));
    expect(result.current.views.activeId).toBe("u1");
    expect(dataColumnIds(result.current)).toEqual(["id", "name", "age"]);
  });

  it("forgets a stored selection that names a view that is gone", async () => {
    const store = createLocalStorageViewStore("views");
    await store.setActiveId("removedPreset");
    const { result } = renderGrid({ views: { store, presets: PRESETS } });
    await waitFor(() => expect(result.current.views.status).toBe("ready"));
    expect(result.current.views.activeId).toBeNull();
  });

  it("writes saves, the selection and deletes through to the store", async () => {
    const store = createLocalStorageViewStore("views");
    const { result } = renderGrid({ views: { store } });
    await waitFor(() => expect(result.current.views.status).toBe("ready"));

    await act(async () => {
      await result.current.views.saveAs("Mine");
    });
    const id = result.current.views.activeId;
    expect((await store.list()).map((view) => view.name)).toEqual(["Mine"]);
    expect(await store.getActiveId()).toBe(id);

    await act(async () => {
      await result.current.views.remove(id ?? "");
    });
    expect(await store.list()).toEqual([]);
    expect(result.current.views.activeId).toBeNull();
  });

  it("reports a store that rejects", async () => {
    const store = {
      ...createLocalStorageViewStore("views"),
      list: () => Promise.reject(new Error("offline")),
    };
    const { result } = renderGrid({ views: { store } });
    await waitFor(() => expect(result.current.views.status).toBe("error"));
  });
});

describe("the views menu items", () => {
  it("are absent without the views option", async () => {
    const user = userEvent.setup();
    renderMenu(undefined);
    await openMenu(user);
    expect(queryPart("views-item")).toBeNull();
    expect(queryPart("views-save-as")).toBeNull();
  });

  it("list presets alone under one heading, with no lock and no save", async () => {
    const user = userEvent.setup();
    renderMenu({ presets: PRESETS, allowUserViews: false });
    await openViews(user);

    expect(screen.getAllByText("Views")).toHaveLength(2);
    expect(parts("views-item").map((item) => item.textContent)).toEqual([
      "Without age",
      "City first",
    ]);
    expect(screen.queryByLabelText("Preset, can't be changed")).toBeNull();
    expect(queryPart("views-save-as")).toBeNull();
  });

  it("apply a view on click and mark it checked", async () => {
    const user = userEvent.setup();
    renderMenu({ presets: PRESETS, allowUserViews: false });
    await openViews(user);
    clickInSub(screen.getByRole("menuitemradio", { name: "Without age" }));

    expect(headerIds()).not.toContain("age");
    await openViews(user);
    expect(
      screen.getByRole("menuitemradio", { name: "Without age" }),
    ).toHaveAttribute("aria-checked", "true");
    // A preset has nothing to overwrite or delete.
    expect(queryPart("views-overwrite")).toBeNull();
    expect(queryPart("views-delete")).toBeNull();
  });

  it("save a new view from the name field", async () => {
    const user = userEvent.setup();
    renderMenu({ presets: PRESETS });
    await openViews(user);
    clickInSub(part("views-save-as"));
    await user.type(part("views-name"), "Mine");
    clickInSub(part("views-save"));

    await waitFor(() =>
      expect(screen.getByRole("menuitemradio", { name: "Mine" })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    // Both kinds now: one heading each, and a lock on the presets.
    expect(screen.getByText("Presets")).toBeInTheDocument();
    expect(screen.getByText("My views")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Preset, can't be changed")).toHaveLength(2);
    // Nothing to save into a view that matches the layout.
    expect(queryPart("views-overwrite")).toBeNull();
    expect(part("views-delete")).toHaveAccessibleName("Delete view");
  });

  it("mark the selected view modified, offer to save it, and discard on click", async () => {
    const user = userEvent.setup();
    const { container } = renderMenu({ presets: PRESETS });
    await openViews(user);
    clickInSub(part("views-save-as"));
    await user.type(part("views-name"), "Mine{Enter}");
    await screen.findByRole("menuitemradio", { name: "Mine" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await openMenu(user);
    await user.click(part("columns-toggle", { columnId: "city" }));
    expect(part("views-submenu")).toHaveTextContent("Mine");
    expect(screen.getByRole("img", { name: "modified" })).toBeInTheDocument();
    await user.hover(part("views-submenu"));
    const mine = await screen.findByRole("menuitemradio", { name: /^Mine/ });
    expect(mine).toHaveAttribute("data-modified");
    expect(mine).toHaveTextContent("Minemodified");
    expect(part("views-overwrite")).toHaveAccessibleName("Save changes to view");

    clickInSub(mine);
    expect(headerIds()).toContain("city");
    expect(container.ownerDocument.querySelector("[data-modified]")).toBeNull();
  });

  it("block a taken name with a message under the field", async () => {
    const user = userEvent.setup();
    renderMenu({ presets: PRESETS });
    await openViews(user);
    clickInSub(part("views-save-as"));
    await user.type(part("views-name"), "city FIRST");

    expect(screen.getByText("A view with that name already exists")).toBeInTheDocument();
    expect(part("views-save")).toBeDisabled();
  });

  it("hide Overwrite and Delete while a preset is selected", async () => {
    const user = userEvent.setup();
    renderMenu({ presets: PRESETS, defaultView: "noAge" });
    await openViews(user);
    expect(part("views-save-as")).toBeInTheDocument();
    expect(queryPart("views-overwrite")).toBeNull();
    expect(queryPart("views-delete")).toBeNull();
  });

  it("delete the selected user view", async () => {
    const user = userEvent.setup();
    renderMenu({});
    await openViews(user);
    clickInSub(part("views-save-as"));
    await user.type(part("views-name"), "Mine{Enter}");
    await screen.findByRole("menuitemradio", { name: "Mine" });

    clickInSub(part("views-delete"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await openViews(user);
    expect(screen.queryByRole("menuitemradio", { name: "Mine" })).toBeNull();
    expect(screen.getByText("No saved views")).toBeInTheDocument();
  });

  it("are left out of Menu.Columns with views={false}", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <ViewsGrid options={{ views: { presets: PRESETS } }}>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns views={false} />
        </TMDataGrid.Menu>
      </ViewsGrid>,
    );
    await openMenu(user);
    expect(queryPart("views-submenu")).toBeNull();
  });

  it("work as Menu.Views in a menu of your own", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <ViewsGrid options={{ views: { presets: PRESETS } }}>
        <Menu>
          <Menu.Target>
            <button type="button">Mine</button>
          </Menu.Target>
          <Menu.Dropdown>
            <TMDataGrid.Menu.Views />
          </Menu.Dropdown>
        </Menu>
      </ViewsGrid>,
    );
    await user.click(screen.getByRole("button", { name: "Mine" }));
    // The lock on a preset is part of the item's name.
    await user.click(
      await screen.findByRole("menuitemradio", { name: /^Without age/ }),
    );
    expect(headerIds()).not.toContain("age");
  });

  it("speak Swedish with the Swedish labels", async () => {
    const user = userEvent.setup();
    renderMenu({ presets: PRESETS }, { labels: TMDATAGRID_LABELS_SV });
    await openViews(user);
    expect(part("views-submenu")).toHaveTextContent("Vyer");
    expect(part("views-save-as")).toHaveTextContent(
      "Spara nuvarande layout som ny vy",
    );
  });
});

describe("TMDataGrid.ViewsMenu", () => {
  it("renders nothing without the views option", () => {
    renderWithMantine(
      <ViewsGrid>
        <TMDataGrid.ViewsMenu />
      </ViewsGrid>,
    );
    expect(queryPart("views-button")).toBeNull();
  });

  it("opens the views and Reset layout from a button of its own", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <ViewsGrid options={{ views: { presets: PRESETS } }}>
        <TMDataGrid.ViewsMenu />
      </ViewsGrid>,
    );
    expect(part("views-button")).toHaveAccessibleName("Views");
    await openMenu(user, "views-button");
    expect(parts("views-item")).toHaveLength(2);
    expect(part("columns-reset")).toBeInTheDocument();
  });

  it("leaves Reset layout out with withResetLayout={false}", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <ViewsGrid options={{ views: { presets: PRESETS } }}>
        <TMDataGrid.ViewsMenu withResetLayout={false} />
      </ViewsGrid>,
    );
    await openMenu(user, "views-button");
    expect(queryPart("columns-reset")).toBeNull();
  });
});

describe("TMDataGrid.ColumnsPanel views", () => {
  it("shows the picker, and Discard changes once the layout moves away", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <ViewsGrid options={{ views: { presets: PRESETS, defaultView: "noAge" } }}>
        <TMDataGrid.ColumnsPanel />
      </ViewsGrid>,
    );
    expect(part("views-select")).toHaveValue("Without age");
    expect(queryPart("views-discard")).toBeNull();
    expect(queryPart("views-overwrite")).toBeNull();
    expect(part("views-name")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "City" }));
    expect(screen.getByText("modified")).toBeInTheDocument();
    await user.click(part("views-discard"));
    expect(headerIds()).toContain("city");
    expect(queryPart("views-discard")).toBeNull();
  });

  it("are left out with views={false}", () => {
    renderWithMantine(
      <ViewsGrid options={{ views: { presets: PRESETS } }}>
        <TMDataGrid.ColumnsPanel views={false} />
      </ViewsGrid>,
    );
    expect(queryPart("views-panel")).toBeNull();
  });
});

describe("isViewModified", () => {
  const ids = ["__select__", "id", "name", "age", "city"];

  it("compares visibility by effect: no entry is shown", () => {
    expect(
      isViewModified(
        { columnVisibility: { age: false } },
        { columnVisibility: { age: false, city: true } },
        ids,
      ),
    ).toBe(false);
    expect(
      isViewModified({ columnVisibility: { age: false } }, { columnVisibility: {} }, ids),
    ).toBe(true);
  });

  it("compares order by effect: unlisted columns follow in definition order", () => {
    expect(
      isViewModified(
        { columnOrder: ["city"] },
        { columnOrder: ["__select__", "city", "id", "name", "age"] },
        ids,
      ),
    ).toBe(false);
    expect(isViewModified({ columnOrder: [] }, { columnOrder: ["name"] }, ids)).toBe(
      true,
    );
  });

  it("ignores the generated lanes and the ids of columns that are gone", () => {
    expect(
      isViewModified(
        { columnPinning: { start: ["gone", "id"], end: [] } },
        { columnPinning: { start: ["__select__", "id"], end: [] } },
        ids,
      ),
    ).toBe(false);
  });

  it("leaves out a slice the slices option does not list", () => {
    expect(
      isViewModified(
        { grouping: ["city"], columnVisibility: {} },
        { grouping: [], columnVisibility: {} },
        ids,
        ["columnVisibility"],
      ),
    ).toBe(false);
  });
});
