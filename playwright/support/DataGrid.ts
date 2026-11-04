import { type Locator, type Page, expect } from "@playwright/test";

type PartKey = { rowId?: string; columnId?: string };

/**
 * A page object for one TMDataGrid, written against the grid's published
 * test contract only: `data-dg-part`, `data-row-id` / `data-column-id`, roles
 * and ARIA. It imports nothing but `@playwright/test`, so it can be copied
 * into any app's suite as it is.
 */
export class DataGrid {
  readonly page: Page;
  readonly root: Locator;
  readonly grid: Locator;

  /** `root` is the grid's root element, the one carrying `data-dg-root`. */
  constructor(root: Locator) {
    this.page = root.page();
    this.root = root;
    // Cell selection flips the role from `table` to `grid`.
    this.grid = root.getByRole("table").or(root.getByRole("grid"));
  }

  /** The grid whose `<TMDataGrid data-testid>` is `testId`. */
  static byTestId(page: Page, testId: string): DataGrid {
    return new DataGrid(page.getByTestId(testId));
  }

  /** A named part, narrowed by row or column when the part repeats. */
  part(name: string, key: PartKey = {}): Locator {
    return this.root.locator(partSelector(name, key));
  }

  /**
   * A part inside the open `TMDataGrid.Menu` dropdown. The dropdown renders
   * in a portal at the end of `<body>`, outside the grid's root, so it cannot
   * be reached through `part()`.
   */
  menuPart(name: string, key: PartKey = {}): Locator {
    return this.page.getByRole("menu").locator(partSelector(name, key));
  }

  /**
   * A body cell by its coordinates. `:not([data-dg-part])` leaves out the
   * `editor` part inside an open cell, which carries the same pair.
   */
  cell({ rowId, columnId }: { rowId: string; columnId: string }): Locator {
    return this.root.locator(
      `[data-row-id="${rowId}"][data-column-id="${columnId}"]:not([data-dg-part])`,
    );
  }

  async search(text: string): Promise<void> {
    await this.part("search").fill(text);
  }

  /**
   * Clicks a sortable header once. Each click steps the sort: off, first
   * direction, the other direction, off. The first direction is ascending for
   * text and descending for numbers, unless the column sets `sortDescFirst`.
   */
  async sortBy(columnId: string): Promise<void> {
    // The header, not its `header-sort` arrow: the arrow is display: none
    // until the header is hovered, and a click on it also reaches the
    // header's own sort handler, so it advances the sort two steps.
    await this.part("header", { columnId }).click();
  }

  /**
   * Opens the filter panel and types `value` into the filter row of
   * `columnId`, adding that row when there is none. Covers the built-in text
   * and number inputs; a boolean or select-type filter renders a `Select` in
   * `filter-value`, which takes `chooseOption` instead.
   */
  async filterBy({
    columnId,
    value,
  }: {
    columnId: string;
    value: string;
  }): Promise<void> {
    const panel = this.part("filter-panel");
    if (!(await panel.isVisible())) {
      await this.part("filter-button").click();
    }
    await expect(panel).toBeVisible();

    const row = this.part("filter-row", { columnId });
    // Opening the panel seeds a row on the first filterable column only. Any
    // other column gets a row of its own: "Add filter" appends one on the next
    // unused column, which is then pointed at `columnId`. A seeded row left
    // without a value filters nothing.
    if ((await row.count()) === 0) {
      const rows = this.part("filter-row");
      const before = await rows.count();
      await this.part("filter-add").click();
      await expect(rows).toHaveCount(before + 1);
      // Re-pointing a row at the column it is already on would remove it.
      if ((await row.count()) === 0) {
        await this.chooseOption({
          select: rows.last().locator('[data-dg-part="filter-column"]'),
          value: columnId,
        });
      }
    }
    await row.locator('[data-dg-part="filter-value"]').fill(value);
  }

  /** Shows or hides a column through the column items of `TMDataGrid.Menu`. */
  async toggleColumn(columnId: string): Promise<void> {
    const toggle = this.menuPart("columns-toggle", { columnId });
    if (!(await toggle.isVisible())) {
      await this.part("menu-button").click();
    }
    await toggle.click();
  }

  /**
   * Opens the column menu of `columnId` and returns it. The `header-menu`
   * button shows only while its header is hovered, so the header is hovered
   * first. The menu renders in a portal, and its items carry no part: reach
   * them by role and label, `menu.getByRole("menuitem", { name: "Filter" })`.
   */
  async openColumnMenu(columnId: string): Promise<Locator> {
    await this.part("header", { columnId }).hover();
    await this.part("header-menu", { columnId }).click();
    const menu = this.page.getByRole("menu");
    await expect(menu).toBeVisible();
    return menu;
  }

  /**
   * Picks an option of a Mantine `Select` the grid renders (`page-size`,
   * `filter-column`, `filter-operator`). Its listbox renders in a portal, so
   * it is found through the input's `aria-controls`, and the option by its
   * value: a column id or a page size, never a translated label.
   */
  async chooseOption({
    select,
    value,
  }: {
    select: Locator;
    value: string;
  }): Promise<void> {
    await select.click();
    await expect(select).toHaveAttribute("aria-expanded", "true");
    const listboxId = await select.getAttribute("aria-controls");
    if (listboxId === null) {
      throw new Error("The select has no listbox: aria-controls is missing.");
    }
    await this.page
      .locator(`[id="${listboxId}"] [role="option"][value="${value}"]`)
      .click();
  }

  /** The entry row opened by `edit.addRow()`; `data-row-id` is its temp id. */
  entryRow(): Locator {
    return this.part("entry-row");
  }

  /**
   * Types into the built-in editors of an open row: an entry row, or a row
   * opened in row mode.
   */
  async fillRow(rowId: string, values: Record<string, string>): Promise<void> {
    for (const [columnId, value] of Object.entries(values)) {
      await this.part("editor", { rowId, columnId })
        .locator('[data-dg-part="editor-input"]')
        .fill(value);
    }
  }

  async commitEntryRow(rowId: string): Promise<void> {
    await this.part("confirm-new-row", { rowId }).click();
  }

  /** Presses Save in `TMDataGrid.DraftActions` and waits for the store to empty. */
  async saveDrafts(): Promise<void> {
    await this.part("save-all").click();
    await expect(this.part("save-all")).toHaveAttribute(
      "data-draft-count",
      "0",
    );
  }

  /**
   * Finds a row the test added by a value unique to it, since the grid does
   * not know the id the app gave the row. Retries until the app has put the
   * row in `data`.
   */
  async expectRowAdded(
    uniqueValue: string,
    cells: Record<string, string>,
  ): Promise<void> {
    await this.search(uniqueValue);
    await this.expectRowCount(1);
    const row = this.part("row");
    for (const [columnId, text] of Object.entries(cells)) {
      await expect(
        row.locator(`[data-column-id="${columnId}"]:not([data-dg-part])`),
      ).toHaveText(text);
    }
    await this.search("");
  }

  async expectRowCount(count: number): Promise<void> {
    await expect(this.grid).toHaveAttribute(
      "data-dg-row-count",
      String(count),
    );
  }

  async expectSettled(): Promise<void> {
    await expect(this.grid).not.toHaveAttribute("aria-busy");
  }
}

function partSelector(name: string, key: PartKey): string {
  return (
    `[data-dg-part="${name}"]` +
    (key.rowId === undefined ? "" : `[data-row-id="${key.rowId}"]`) +
    (key.columnId === undefined ? "" : `[data-column-id="${key.columnId}"]`)
  );
}
