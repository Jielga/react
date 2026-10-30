import { Button, Menu } from "@mantine/core";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  header,
  openColumnMenu,
  part,
  parts,
  queryPart,
  renderGridUi,
  renderWithMantine,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import { captureDownloads } from "../../test/downloadStub";
import { jsonFormat } from "../core/export";
import { TMDATAGRID_LABELS_EN } from "../core/labels";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";
import { TMDataGrid } from "./TMDataGrid";

/** Every hideable column of the harness grid, in render order. */
const HIDEABLE = ["id", "name", "age", "city"];

const toggledColumnIds = () =>
  parts("columns-toggle").map((item) => item.dataset.columnId);

type MenuGridOptions = Partial<UseTMDataGridOptions<TestRow>>;

const wide = createTMDataGridColumnHelper<TestRow>();

/** Six columns: the length from which a chooser shows its search box. */
const wideColumns = wide.columns([
  ...testColumns,
  wide.accessor("name", { id: "nameAgain", header: "Name again" }),
  wide.accessor("city", { id: "cityAgain", header: "City again" }),
]);

/**
 * A grid whose toolbar is whatever the test passes. The harness toolbar is
 * fixed, and these cases are about what a consumer puts in the menu.
 */
function MenuGrid({
  children,
  options,
}: {
  children: ReactNode;
  options?: MenuGridOptions;
}) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row) => String(row.id),
    ...options,
  });

  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Toolbar>{children}</TMDataGrid.Toolbar>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>
  );
}

describe("TMDataGrid.Menu", () => {
  it("opens from the burger and lists a consumer's own item", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid>
        <TMDataGrid.Menu>
          <Menu.Item>Export CSV</Menu.Item>
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

    await user.click(part("menu-button"));

    expect(
      screen.getByRole("menuitem", { name: "Export CSV" }),
    ).toBeInTheDocument();
  });

  it("states on the burger that it opened the menu, and which one", async () => {
    const user = userEvent.setup();
    renderGridUi();
    const button = part("menu-button");

    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute(
      "aria-controls",
      screen.getByRole("menu").id,
    );
  });

  it("lists one checkbox item per hideable column", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));

    expect(toggledColumnIds()).toEqual(HIDEABLE);
    expect(part("columns-toggle", { columnId: "city" })).toHaveAttribute(
      "role",
      "menuitemcheckbox",
    );

    await user.click(part("columns-toggle", { columnId: "city" }));

    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
    // A checkbox item is not a command, so the menu is still open behind it.
    expect(toggledColumnIds()).toEqual(HIDEABLE);
  });

  it("shows the search box from six columns", async () => {
    const user = userEvent.setup();
    const { unmount } = renderGridUi();

    await user.click(part("menu-button"));
    expect(queryPart("columns-search")).not.toBeInTheDocument();
    expect(toggledColumnIds()).toEqual(HIDEABLE);
    unmount();

    renderWithMantine(
      <MenuGrid options={{ columns: wideColumns }}>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );
    await user.click(part("menu-button"));
    expect(part("columns-search")).toBeInTheDocument();
  });

  it("shows the search box from the number of columns `searchable` names", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithMantine(
      <MenuGrid options={{ columns: wideColumns }}>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns searchable={7} />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

    await user.click(part("menu-button"));
    expect(queryPart("columns-search")).not.toBeInTheDocument();
    unmount();

    renderWithMantine(
      <MenuGrid>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns searchable={4} />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );
    await user.click(part("menu-button"));
    expect(part("columns-search")).toBeInTheDocument();
  });

  it("narrows the list from the search box", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns searchable />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

    await user.click(part("menu-button"));
    await user.type(part("columns-search"), "ci");

    expect(toggledColumnIds()).toEqual(["city"]);

    await user.clear(part("columns-search"));
    await user.type(part("columns-search"), "zzz");

    expect(toggledColumnIds()).toEqual([]);
    expect(
      screen.getByText(TMDATAGRID_LABELS_EN.columnsNoMatch("zzz")),
    ).toBeInTheDocument();
  });

  it("shows and hides every listed column from one item", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle-all"));

    for (const columnId of HIDEABLE) {
      expect(queryPart("header", { columnId })).not.toBeInTheDocument();
    }

    await user.click(part("columns-toggle-all"));

    for (const columnId of HIDEABLE) {
      expect(header(columnId)).toBeInTheDocument();
    }
  });

  it("shows all from a partial state rather than hiding the rest", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle", { columnId: "city" }));

    // Some shown but not all: an indeterminate box, and the click completes
    // the set.
    expect(part("columns-toggle-all")).toHaveAttribute("aria-checked", "mixed");

    await user.click(part("columns-toggle-all"));

    for (const columnId of HIDEABLE) {
      expect(header(columnId)).toBeInTheDocument();
    }
  });

  it("Reset layout brings a hidden column back", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await user.click(part("menu-button"));
    await user.click(part("columns-toggle", { columnId: "city" }));
    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();

    await user.click(part("columns-reset"));

    expect(header("city")).toBeInTheDocument();
  });

  it("offers no toggles on a grid where nothing can be hidden", async () => {
    const user = userEvent.setup();
    renderGridUi({ enableHiding: false });

    await user.click(part("menu-button"));

    expect(screen.queryAllByRole("menuitemcheckbox")).toHaveLength(0);
  });

  it("works inside a consumer's own Mantine menu", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid>
        <Menu>
          <Menu.Target>
            <Button>View</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <TMDataGrid.Menu.ColumnToggles />
          </Menu.Dropdown>
        </Menu>
      </MenuGrid>,
    );

    await user.click(screen.getByRole("button", { name: "View" }));
    expect(toggledColumnIds()).toEqual(HIDEABLE);

    await user.click(part("columns-toggle", { columnId: "city" }));

    expect(queryPart("header", { columnId: "city" })).not.toBeInTheDocument();
  });

  it("moves ArrowDown from the search to the first column, past items above", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid>
        <TMDataGrid.Menu>
          <Menu.Item>Export CSV</Menu.Item>
          <TMDataGrid.Menu.Columns searchable />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

    await user.click(part("menu-button"));
    await user.click(part("columns-search"));
    await user.keyboard("{ArrowDown}");

    // Mantine's own walk would have started at "Export CSV", the dropdown's
    // first item, and Enter would have run it.
    expect(part("columns-toggle", { columnId: "id" })).toHaveFocus();
  });

  it("hangs the chooser off the header menu's Manage columns submenu", async () => {
    const user = userEvent.setup();
    renderGridUi();

    await openColumnMenu(user, "City");
    // `Menu.Sub` opens on hover or on ArrowRight, never on a click.
    await user.hover(screen.getByRole("menuitem", { name: "Manage columns" }));

    await waitFor(() => expect(toggledColumnIds()).toEqual(HIDEABLE));

    // Not `user.click`: it moves the pointer off the sub target first, and the
    // submenu's safe-polygon guard has no geometry to work with under jsdom,
    // so it closes the dropdown before the click can land.
    fireEvent.click(part("columns-toggle", { columnId: "name" }));

    expect(queryPart("header", { columnId: "name" })).not.toBeInTheDocument();
  });
});

describe("TMDataGrid.Menu.Export", () => {
  const exportMenu = (options?: MenuGridOptions) =>
    renderWithMantine(
      <MenuGrid options={options}>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Export />
          <TMDataGrid.Menu.ExportSelected />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

  it("downloads every row in the grid's format", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    exportMenu({ exportOptions: { fileName: "people" } });

    await user.click(part("menu-button"));
    await user.click(part("menu-export"));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]?.fileName).toBe("people.csv");
    const text = (await downloads[0]?.text()) ?? "";
    expect(text).toContain("sep=;\r\nID;Name;Age;City\r\n");
    // Every row, not the handful the virtualizer mounts.
    expect(text.trim().split("\r\n")).toHaveLength(testRows.length + 2);
  });

  it("lets an item override the grid's format and file name", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Export format={jsonFormat()} fileName="rows" />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

    await user.click(part("menu-button"));
    await user.click(part("menu-export"));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]?.fileName).toBe("rows.json");
    const records: unknown = JSON.parse((await downloads[0]?.text()) ?? "[]");
    expect(Array.isArray(records) && records[0]).toEqual({
      ID: 1,
      Name: "Anna",
      Age: 20,
      City: "Stockholm",
    });
  });

  it("exports the selected rows once some are ticked, in grid order", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    exportMenu();

    await user.click(part("menu-button"));
    expect(part("menu-export-selected")).toBeDisabled();
    expect(part("menu-export-selected")).toHaveTextContent(
      "Export 0 selected rows",
    );
    await user.keyboard("{Escape}");

    await user.click(part("select-row", { rowId: "2" }));
    await user.click(part("select-row", { rowId: "1" }));

    await user.click(part("menu-button"));
    expect(part("menu-export-selected")).toHaveTextContent(
      "Export 2 selected rows",
    );
    await user.click(part("menu-export-selected"));

    await waitFor(() => expect(downloads).toHaveLength(1));
    const text = (await downloads[0]?.text()) ?? "";
    expect(text).toContain("1;Anna;20;Stockholm\r\n2;Erik;27;Göteborg\r\n");
    expect(text.trim().split("\r\n")).toHaveLength(4);
  });

  it("has no selected-rows item when nothing can be selected", async () => {
    const user = userEvent.setup();
    exportMenu({ selectionMode: "highlight" });

    await user.click(part("menu-button"));

    expect(part("menu-export")).toBeInTheDocument();
    expect(queryPart("menu-export-selected")).not.toBeInTheDocument();
  });
});

describe("TMDataGrid.Menu.Export columns", () => {
  const customMenu = (options?: MenuGridOptions) =>
    renderWithMantine(
      <MenuGrid options={options}>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Export columns="custom" />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

  it('"all" writes hidden columns too, straight from the click', async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    renderWithMantine(
      <MenuGrid options={{ initialState: { columnVisibility: { city: false } } }}>
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Export columns="all" />
        </TMDataGrid.Menu>
      </MenuGrid>,
    );

    await user.click(part("menu-button"));
    await user.click(part("menu-export"));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(await downloads[0]?.text()).toContain("ID;Name;Age;City\r\n");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it('"custom" opens a picker with the visible columns ticked and writes the ticked ones', async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    customMenu();

    await user.click(part("menu-button"));
    await user.click(part("menu-export"));

    const dialog = await screen.findByRole("dialog");
    expect(downloads).toHaveLength(0);
    expect(part("export-column", { columnId: "city" }, dialog)).toBeChecked();

    await user.click(part("export-column", { columnId: "city" }, dialog));
    await user.click(part("export-picker-confirm", undefined, dialog));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(await downloads[0]?.text()).toContain("ID;Name;Age\r\n1;Anna;20\r\n");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("offers a hidden column in the picker, unticked", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    customMenu({ initialState: { columnVisibility: { city: false } } });

    await user.click(part("menu-button"));
    await user.click(part("menu-export"));

    const dialog = await screen.findByRole("dialog");
    expect(part("export-column", { columnId: "city" }, dialog)).not.toBeChecked();

    await user.click(part("export-column", { columnId: "city" }, dialog));
    await user.click(part("export-picker-confirm", undefined, dialog));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(await downloads[0]?.text()).toContain("ID;Name;Age;City\r\n");
  });

  it("select all ticks every exportable column and unticks them again", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    customMenu({ initialState: { columnVisibility: { city: false } } });

    await user.click(part("menu-button"));
    await user.click(part("menu-export"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(TMDATAGRID_LABELS_EN.exportPickerTitle("CSV"));
    expect(part("export-picker-hint", undefined, dialog)).toHaveTextContent(
      TMDATAGRID_LABELS_EN.exportPickerHint(null),
    );
    expect(part("export-picker-count", undefined, dialog)).toHaveTextContent(
      "3 of 4",
    );
    expect(
      screen.getByText(TMDATAGRID_LABELS_EN.exportPickerHidden),
    ).toBeInTheDocument();
    // Four columns: no search box.
    expect(queryPart("export-picker-search")).not.toBeInTheDocument();

    const all = part("export-column-all", undefined, dialog);
    expect(all).not.toBeChecked();
    expect(all).toBePartiallyChecked();

    await user.click(all);
    expect(all).toBeChecked();
    expect(part("export-column", { columnId: "city" }, dialog)).toBeChecked();

    await user.click(all);
    expect(part("export-column", { columnId: "id" }, dialog)).not.toBeChecked();
    expect(part("export-picker-confirm", undefined, dialog)).toBeDisabled();

    await user.click(all);
    await user.click(part("export-picker-confirm", undefined, dialog));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(await downloads[0]?.text()).toContain("ID;Name;Age;City\r\n");
  });

  it("select all under a search ticks the matches only", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    customMenu({
      columns: wideColumns,
      initialState: { columnVisibility: { nameAgain: false, cityAgain: false } },
    });

    await user.click(part("menu-button"));
    await user.click(part("menu-export"));

    const dialog = await screen.findByRole("dialog");
    await user.type(part("export-picker-search", undefined, dialog), "again");
    expect(
      parts("export-column", undefined, dialog).map((item) => item.dataset.columnId),
    ).toEqual(["nameAgain", "cityAgain"]);

    const all = part("export-column-all", undefined, dialog);
    expect(all).not.toBeChecked();
    expect(all).not.toBePartiallyChecked();
    await user.click(all);
    expect(part("export-picker-count", undefined, dialog)).toHaveTextContent(
      "6 of 6",
    );

    await user.clear(part("export-picker-search", undefined, dialog));
    await user.click(part("export-column", { columnId: "city" }, dialog));
    await user.click(part("export-picker-confirm", undefined, dialog));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(await downloads[0]?.text()).toContain(
      "ID;Name;Age;Name again;City again\r\n",
    );
  });

  it("cancel closes the picker without a download", async () => {
    const downloads = captureDownloads();
    const user = userEvent.setup();
    customMenu();

    await user.click(part("menu-button"));
    await user.click(part("menu-export"));
    const dialog = await screen.findByRole("dialog");
    await user.click(part("export-picker-cancel", undefined, dialog));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(downloads).toHaveLength(0);
  });
});
