# Testing

The grid publishes a fixed set of roles, ARIA attributes and `data-*` hooks so
that you can write tests against structure rather than against copy or class
names. Everything on this page is supported. Anything else in the
DOM is internal and may change without notice.

> Renaming or dropping anything on this page is a breaking change, so it moves
> only with a major version.

## Selector attributes

The grid publishes three kinds of selector, and no `data-testid` of its own:

- `data-dg-part` - what an element is (`"row"`, `"filter-button"`)
- `data-row-id` and `data-column-id` - which one, using your own ids
- roles and ARIA - the same thing a screen reader reads

`data-testid` is left to your suite, whose `testIdAttribute` may be `data-qa` or
`data-cy` rather than `data-testid`. The one exception is
`<TMDataGrid data-testid>`, which sets the value you pass.

## Naming a grid

Parts repeat across grids on the same page. Name the grid and scope through it:

```tsx
<TMDataGrid {...grid} data-testid="orders">
  <TMDataGrid.Table<Order> aria-label="Orders" />
</TMDataGrid>
```

```ts
const orders = page.getByTestId("orders");
await expect(orders.locator('[data-dg-part="row"][data-row-id="42"]')).toBeVisible();
```

`data-testid` and `id` go on the root element (which also carries
`data-dg-root`); `aria-label` (or `aria-labelledby`) goes on
`TMDataGrid.Table`, because the accessible name belongs to the element carrying
the `grid` role.

## Structure

| Element | Role | Attributes |
| --- | --- | --- |
| Root | - | `data-dg-root`, `data-size` |
| Grid | `table`, or `grid` under cell selection | `aria-rowcount`, `aria-colcount`, `aria-busy`, `data-dg-row-count` |
| Scroll container | - | `data-dg-scroll-container` |
| Header row | `row` | `data-dg-header-row`, `aria-rowindex` |
| Header cell | `columnheader` | `data-dg-part="header"`, `data-column-id`, `aria-sort`, `data-active` |
| Body row | `row` | `data-dg-part="row"`, `data-row-id`, `aria-rowindex`, `data-selected`, `data-highlighted`, `data-grouped`, `data-depth`, `data-pinned`, `data-deleted`, `data-dirty`, `data-draft`, `data-new`, `data-striped` |
| Body cell | `cell`, or `gridcell` under cell selection | `data-row-id`, `data-column-id`, `data-align`, `data-editing`, `data-dirty`, `data-invalid`, `data-focused`, `data-selected` |

**The role changes with cell selection.** `cellSelection` turns the grid's
`table` into a `grid` and every `cell` into a `gridcell`, so a suite written on
`getByRole("cell")` breaks when the feature is switched on. Query cells by their
coordinates instead:

```ts
const cell = orders.locator(
  '[data-row-id="42"][data-column-id="total"]:not([data-dg-part])',
);
```

Body cells carry no `data-dg-part`; the coordinate pair identifies them.
The `editor` part of an open cell carries the same pair, so `:not([data-dg-part])` keeps the locator on the cell while the cell is being edited.

The generated lanes are columns like any other, with exported ids:

| Constant | `data-column-id` | Lane |
| --- | --- | --- |
| `ROW_NUMBER_COLUMN_ID` | `__rowNumber__` | Row numbers |
| `SELECT_COLUMN_ID` | `__select__` | Selection checkboxes |
| `GROUP_COLUMN_ID` | `__group__` | The grouping tree |
| `DETAILS_COLUMN_ID` | `__details__` | Details toggles |
| `EDIT_COLUMN_ID` | `__edit__` | Row editing |

A lane's header is `[data-dg-part="header"][data-column-id="__select__"]` and
a lane cell `[data-row-id="42"][data-column-id="__select__"]:not([data-dg-part])`.
The control inside a lane cell has a part of its own, keyed by the row:
`select-row`, `details-toggle`, `group-toggle` and the edit lane's buttons (see
[Keyed by `data-row-id`](#keyed-by-data-row-id)); `select-all` and
`details-toggle-all` sit in the lane headers. The checkbox parts are on the
`<input>` itself, so `check()` works on them directly.

**The body scrolls inside the scroll container.** The element carrying
`data-dg-scroll-container` is the one to scroll in a test, whether to load the
next page of an infinite-scroll grid or to move the virtualizer without the api:

```ts
await orders.locator("[data-dg-scroll-container]").evaluate((element) => {
  element.scrollTop = element.scrollHeight;
});
```

**State attributes are present only while they apply.** A boolean attribute
such as `data-selected`, `data-new` or `data-invalid` is rendered with the
value `"true"` while its state holds and omitted otherwise.
`[data-new]` and `[data-new="true"]` match the same elements; to test the negative, assert that the attribute is absent:

```ts
const drafts = orders.locator('[data-dg-part="row"][data-draft]');
await expect(drafts.first()).not.toHaveAttribute("data-deleted");
```

## Parts

Row and column ids come from your data (`getRowId` and the column definitions),
so a part that repeats is addressed by adding the coordinate.

### Whole-grid

| `data-dg-part` | What it is |
| --- | --- |
| `toolbar` | The toolbar row |
| `summary-count` | The visible/total count |
| `loading` | The toolbar spinner |
| `search`, `search-clear` | Quick search input and its ✕ |
| `filter-button` | The funnel toggle |
| `filter-panel` | The panel of filter rows, wherever it is rendered |
| `filter-popup`, `filter-sidebar` | The surface holding it, under `filters.surface` |
| `filter-panel-close` | The surface's ✕; absent on a hand-placed panel |
| `filter-add`, `filter-clear-all` | The panel's footer buttons |
| `header-filter-row` | The header filter row, under `filters.inHeader` |
| `filter-pills` | The active-filter pill group. `TMDataGridFilterPills` renders where you place it, inside or outside the root; outside, scope through its own container |
| `menu-button` | The burger, `TMDataGrid.Menu` |
| `menu-export`, `menu-export-selected` | `TMDataGrid.Menu.Export` and `TMDataGrid.Menu.ExportSelected`, in the menu dropdown |
| `export-picker` | The export column picker, in a dialog. Holds `export-picker-search`, `export-picker-hint`, `export-column-all` with the count `export-picker-count`, and the buttons `export-picker-confirm` and `export-picker-cancel` |
| `columns-panel`, `columns-search` | The column chooser panel, and the search box in the panel or in `TMDataGrid.Menu.Columns` |
| `columns-toggle-all`, `columns-reset` | Show/hide all and Reset layout, in the panel or in the menu |
| `views-button` | The `TMDataGrid.ViewsMenu` trigger |
| `views-submenu` | The Views item of `TMDataGrid.Menu.Columns`, which opens the views in a submenu |
| `views-item` | One saved view in a menu. Carries `data-view-id`; the selected one has `aria-checked="true"`, and `data-modified="true"` once the layout has moved away from it |
| `views-none` | The text shown in place of the list when there is no view |
| `views-overwrite`, `views-delete` | The actions on the selected view, in a menu or in the panel |
| `views-discard` | The panel's Discard changes button |
| `views-save-as` | The menu item that turns into the name field |
| `views-save-form`, `views-name`, `views-save` | The name form, its field and its button |
| `views-panel`, `views-select` | The panel's views row and its view picker |
| `footer` | The pager row |
| `page-size`, `page-range`, `page-number`, `page-prev`, `page-next` | The pager |
| `summary-row` | The footer summary row |
| `pinned-top`, `pinned-bottom` | The pinned-row edge blocks |
| `select-all` | The header select-all checkbox |
| `details-toggle-all` | Expand/collapse every detail panel |
| `save-all`, `discard-all` | `TMDataGrid.DraftActions`. `save-all` carries `data-draft-count` - the rows the save will send |
| `editor-confirm`, `editor-cancel` | `cellConfirm`'s ✓ and ✕ |
| `editor-input` | The input inside a built-in editor |
| `sort-index` | A column's position in a multi-column sort |
| `tab-guard` | The body's tab stop under [cell selection](/docs/cell-selection); `data-guard` is `leading` (before the rows) or `trailing` (after them). Zero-size, and focusing one puts the cursor on a cell |

### Keyed by `data-row-id`

| `data-dg-part` | What it is |
| --- | --- |
| `row` | A body row, pinned or not. A committed new row is one of them, marked `data-new` |
| `entry-row` | An entry row being typed into. Carries `data-new`, and `data-committed` / `data-draft` once committed, which is where a committed row stays under `editing.newRowsSticky`. Its cells carry `data-column-id` and, on a failed ✓, `data-invalid` |
| `details` | A row's detail panel |
| `select-row` | Its selection checkbox |
| `details-toggle`, `group-toggle` | Its detail and tree chevrons |
| `edit-row`, `delete-row` | The edit lane, idle. `edit-row` also reopens an entered new row |
| `save-row`, `cancel-row` | The edit lane's Save and Cancel on an open row |
| `row-state` | The draft store's change marker; `data-state` is `new`, `edited` or `deleted` |
| `revert-row` | Drops a committed row's draft |
| `restore-row` | Undo a deletion mark |
| `confirm-new-row`, `discard-new-row` | An entry row's ✓ (commit) and ✕ |
| `open-rows-note` | `DraftActions`' count of rows still open. Carries `data-open-count`; absent while there are none |

### Keyed by `data-column-id`

| `data-dg-part` | What it is |
| --- | --- |
| `header` | A column header. A click sorts a sortable column; `aria-sort` holds the result |
| `header-sort`, `header-menu`, `header-filter` | Its three action buttons. `header-sort` and `header-menu` are hidden until the header is hovered or holds focus: sort through `header`, and hover `header` before clicking `header-menu`. `header-filter` is absent under `filters.inHeader`, where the control below is the indicator |
| `header-resize` | The resize handle at the column's edge; present only when the column can resize. Drag it to resize, double-click it to fit the column to its content |
| `header-filter-cell`, `header-filter-operator` | One column's header filter control and its operator button |
| `filter-row` | One row of the filter panel |
| `filter-pill` | One active-filter pill. Holds a label button and `filter-pill-remove`, its ✕ |
| `columns-toggle` | The checkbox of one column, in the panel or in the menu |
| `export-column` | The checkbox of one column in the export picker |

### Keyed by both

| `data-dg-part` | What it is |
| --- | --- |
| `editor` | An open cell editor |

Within a filter row the three controls are `filter-column`,
`filter-operator` and `filter-value` (or `filter-value-from` /
`filter-value-to` for `between`), and `filter-remove` is the row's ✕.
None of them carries `data-column-id`; scope through the row.

A column declaring `meta.filter.control` or `meta.edit.editor` renders your component
in that slot, so `filter-value` and `editor-input` cover the built-ins only.
`filter-row` and `editor` still apply; scope your own queries through them.
A built-in editor extended through `inputProps` keeps `editor-input`.

`editor-input` is also where the grid puts the caret when an editor opens. An
editor that does not publish it is focused on the first focusable element inside
its `editor` instead, so a custom editor needs the attribute only to name which
of several inputs the caret should land in.

Every icon-only control also carries an `aria-label` drawn from `labels`. Those
are translated, so they make brittle selectors. Prefer the parts above unless
your grid runs in one language.

## Portals

These surfaces render in a portal at the end of `<body>`, outside the grid's root, so a locator scoped to the root does not reach them:

- the dropdown of `TMDataGrid.Menu` - `page.getByRole("menu")`; holds `columns-toggle`, `columns-toggle-all`, `columns-reset`, `menu-export`, `menu-export-selected` and `views-submenu`; the Views submenu is a second `menu` that holds the other `views-*` items
- the dropdown of `TMDataGrid.ViewsMenu` - `page.getByRole("menu")`; holds the `views-*` items and `columns-reset`
- a column's menu, opened by `header-menu` or by a right click on the header - `page.getByRole("menu")`; its items (sort, filter, group, pin, hide) carry no part, so reach one by role and label, `menu.getByRole("menuitem", { name: "Group by Location" })`, and note that the label is translated
- the `header-filter-operator` menu - `page.getByRole("menu")`
- the export column picker - `page.getByRole("dialog")`; holds the `export-*` parts
- the listbox of every `Select` or `MultiSelect` the grid renders: `page-size`, `filter-column`, `filter-operator`, and the `filter-value` of a boolean or select-type filter - the element named by the input's `aria-controls`; each option carries its value in `value`, a Mantine detail the page object below relies on

One menu or dialog is open at a time, so the page-level locator is unambiguous.
`filter-popup` and `filter-sidebar` render inside the root.

## Virtualization

The grid is always virtualized: only the rows in the viewport plus overscan are
in the DOM. A row at index 500 has no element, and Playwright cannot scroll to
what it cannot find.

**Count rows off the grid, not off the DOM.** `aria-rowcount` includes every
header row - stacked column groups and the `filters.inHeader` row among them -
and the summary row, so how many it adds is a function of the grid's
configuration. `data-dg-row-count` counts the body rows alone: the current page
under pagination, or everything the filters left otherwise. Assert on that one.

```ts
const grid = orders.getByRole("table");
await expect(grid).toHaveAttribute("data-dg-row-count", "3");
```

**Reach a row by narrowing to it.** Filtering or searching is faster and more
stable than scrolling:

```ts
await orders.locator('[data-dg-part="search"]').fill("Nordkvist");
await expect(orders.locator('[data-row-id="42"]').first()).toBeVisible();
```

**Or scroll to it.** When the row must be reached in place, such as when testing
the scroll itself, `scrollToRow` moves the virtualizer:

```ts
const found = api.scrollToRow({ rowId: "42", align: "center" });
```

It returns `false` when the row is not in the current view (filtered out, on
another page, or an unknown id) and scrolls nothing. From a Playwright test it
has to be called through the page, since the API lives in React:

```ts
await page.evaluate(() => window.__ordersGrid.scrollToRow({ rowId: "42" }));
```

which requires the app to expose the grid on `window`. Narrowing needs no such
hook, and scrolling the element carrying `data-dg-scroll-container` moves the virtualizer without it.

## Waiting

`meta.loading` sets `aria-busy` on the grid whether or not the body has rows, so
a refetch over existing rows is still visible to a test:

```ts
await expect(grid).toHaveAttribute("aria-busy", "true");
await expect(grid).not.toHaveAttribute("aria-busy");
```

Quick search debounces (250 ms by default, `debounce` on `TMDataGrid.Search`).
Assert on `data-dg-row-count` rather than adding a timeout. Playwright retries
the assertion until the debounce lands.

## A page object

The class below is the one the grid's own Playwright suite runs against the demos on this site.
Copy it as it is; it depends on `@playwright/test` and on the contract on this page only.

<!-- source: playwright/support/DataGrid.ts -->
```ts
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
```

```ts
test("filters to one employee", async ({ page }) => {
  await page.goto("/employees");
  const grid = DataGrid.byTestId(page, "employees");
  await grid.expectSettled();

  await grid.filterBy({ columnId: "lastName", value: "Nordkvist" });
  await grid.expectRowCount(1);
  await expect(grid.cell({ rowId: "42", columnId: "city" })).toHaveText(
    "Stockholm",
  );
});
```

## Recipes

Each row names the parts a step uses and the attribute that proves it; `grid` is a `DataGrid`.

| Interaction | Steps | Assertion |
| --- | --- | --- |
| Quick search | `grid.search("Cecilia")`; `search-clear` | `grid.expectRowCount(10)`, then the full count again |
| Sort | `grid.sortBy("lastName")` once, then again | `aria-sort` on the `header` is `ascending`, then `descending` |
| Filter | `grid.filterBy({ columnId, value })`; `filter-clear-all` | `grid.expectRowCount(n)`, then the full count again |
| Remove a filter | `filter-remove` inside its `filter-row`, or `filter-pill-remove` inside its `filter-pill` | the `filter-pill` has count 0; the row count |
| Hide a column | `grid.toggleColumn("location")`; `grid.menuPart("columns-reset")` | the `header` has count 0, then is visible again |
| Page | `page-next`; `grid.chooseOption({ select: grid.part("page-size"), value: "50" })` | the `page-range` text changes and the first `row` has a new `data-row-id`; `grid.expectRowCount(50)` |
| Select rows | `select-row` of a row; `select-all` | `data-selected="true"` on the `row`; `[data-dg-part="row"]:not([data-selected])` has count 0 |
| Group | `grid.openColumnMenu("location")`, then the "Group by" item; `group-toggle` of a group row | rows carry `data-grouped`; `data-dg-row-count` grows when the group expands and shrinks when it collapses |
| Load more | scroll `data-dg-scroll-container` to its `scrollHeight` | `data-dg-row-count` grows, then `grid.expectSettled()` |
| Export | `menu-button`, then `menu-export` in the menu | `page.waitForEvent("download")` and `download.suggestedFilename()` |
| Edit a cell | `grid.cell({ rowId, columnId }).dblclick()`, `grid.fillRow(rowId, { columnId: value })`, Enter | the cell's text; after Escape instead of Enter, the text is unchanged |

## Editing

### Adding a row

[`edit.addRow()`](/docs/editing) opens an entry row, `data-dg-part="entry-row"`,
keyed by a temporary id (`__new__1`, `__new__2`, …). Its editors are `editor`
parts keyed by that id and the column. What ✓ does with the row depends on
`editing.draft`:

| Step | Without `draft` | With `draft: true` |
| --- | --- | --- |
| `addRow()` | `entry-row[data-row-id="__new__1"]` | Same |
| ✓ fails validation | The entry row stays; the failing cells carry `data-invalid` | Same |
| ✓ (`confirm-new-row`) | The entry row is removed and the temp id is gone. `onRowAdd` receives the values, and the row exists again only once your app puts it in `data`, under the id your `getRowId` returns | The row becomes a body row, still keyed by the temp id: `row[data-row-id="__new__1"][data-new="true"][data-draft="true"]`, with `row-state[data-state="new"]` in its lane and `save-all[data-draft-count]` counting it |
| Save (`save-all`) | - | As ✓ without `draft`: the temp id is gone, and the row comes back through `data` under your id |

The grid never learns which id your app gave the row, so once `onRowAdd` or
`saveDrafts` has run, the row cannot be addressed by id. Find it by its content
instead: narrow the grid to a value unique to the row, assert that one row is
left, and read that row's cells. The row-count assertion is also the wait,
since it retries until the app has put the row in `data`:

```ts
test("adds an employee", async ({ page }) => {
  await page.goto("/employees");
  const grid = DataGrid.byTestId(page, "employees");
  await grid.expectSettled();

  // The app's own button, calling edit.addRow()
  await page.getByRole("button", { name: "Add row" }).click();
  const tempId = (await grid.entryRow().getAttribute("data-row-id"))!;
  await grid.fillRow(tempId, { name: "Nordkvist-4711", city: "Stockholm" });
  await grid.commitEntryRow(tempId);

  await expect(grid.entryRow()).toHaveCount(0);
  await grid.expectRowAdded("Nordkvist-4711", {
    name: "Nordkvist-4711",
    city: "Stockholm",
  });
});
```

Use a value no other row has, such as a name with a run id in it, so that the
search leaves one row. If the grid has no quick search, narrow with `filterBy`
on a column instead.

Under `draft: true` the temp id stays valid until Save, so the committed row is
asserted directly, and the content-based check applies after the save:

```ts
await grid.commitEntryRow(tempId);
const row = grid.part("row", { rowId: tempId });
await expect(row).toHaveAttribute("data-new", "true");
await expect(grid.part("row-state", { rowId: tempId })).toHaveAttribute(
  "data-state",
  "new",
);
await expect(grid.part("save-all")).toHaveAttribute("data-draft-count", "1");

await grid.saveDrafts();
await expect(row).toHaveCount(0);
await grid.expectRowAdded("Nordkvist-4711", { city: "Stockholm" });
```

Under `newRowsSticky: true` the committed row stays in the entry block instead,
as `entry-row[data-row-id="__new__1"][data-committed="true"]`, outside
`data-dg-row-count`, until the save.

A ✓ that fails validation keeps the entry row open, with `data-invalid` on the
failing cells. The cell and its open editor share the column id, so the
selector leaves the editor out:

```ts
await grid.commitEntryRow(tempId);
await expect(grid.entryRow()).toHaveCount(1);
await expect(
  grid.entryRow().locator('[data-column-id="email"]:not([data-dg-part])'),
).toHaveAttribute("data-invalid", "true");
```

### Changing a row

Without `draft`, a commit goes to `onCommit` and the grid keeps nothing of it, so
the assertion is the cell's text once your app has applied the change. Under
`draft: true` the change stays in the grid until Save, marked on the cell, the
row and the lane:

```ts
const cell = grid.cell({ rowId: "42", columnId: "salary" });
await cell.dblclick();
await grid.fillRow("42", { salary: "52000" });
await page.keyboard.press("Enter");

// Without draft: the app applied it
await expect(cell).toHaveText("52 000");

// Under draft: the grid holds it
await expect(cell).toHaveAttribute("data-dirty", "true");
await expect(grid.part("row", { rowId: "42" })).toHaveAttribute("data-dirty", "true");
await expect(grid.part("row-state", { rowId: "42" })).toHaveAttribute(
  "data-state",
  "edited",
);
```

In row mode, `edit-row` opens the row, `save-row` commits it and `cancel-row`
discards it; `fillRow` reaches the open row's editors the same way.

### Deleting a row

`delete-row` calls `onRowDelete` at once, or marks the row under `draft: true`:

```ts
const before = Number(await grid.grid.getAttribute("data-dg-row-count"));
await grid.part("delete-row", { rowId: "42" }).click();

// Without draft: the app removed it from data
await grid.expectRowCount(before - 1);

// Under draft: marked until Save, and Restore undoes the mark
await expect(grid.part("row", { rowId: "42" })).toHaveAttribute("data-deleted", "true");
await grid.part("restore-row", { rowId: "42" }).click();
```

Assert a deletion on `data-dg-row-count`, not on the row's element: a row
outside the viewport has no element either, so `toHaveCount(0)` passes for it
whether or not it was deleted.

## Component tests

Playwright 1.62 and later mount a component in a real browser through the `mount` fixture of `@playwright/test`.
A `*.story.tsx` file exports one component per scenario, a gallery page served by your dev server renders a story by id, and the test drives the result with the same locators as a page test.
What the gallery page must expose, and a React gallery of a few dozen lines, are in [Component testing](https://playwright.dev/docs/test-components).
A real browser covers what jsdom cannot: virtualization, column resize and reorder, sticky pinned columns, and the clipboard.

The project points `baseURL` at the gallery and starts its dev server:

```ts
projects: [
  {
    name: "components",
    testDir: "tests/components",
    use: {
      baseURL: "http://localhost:5274/",
      serviceWorkers: "block",
      permissions: ["clipboard-read", "clipboard-write"],
    },
  },
],
webServer: [{ command: "npm run gallery", url: "http://localhost:5274/" }],
```

A story owns everything the grid needs.
Render it inside `<MantineProvider env="test">`, in the gallery or in the story, which turns Mantine's transitions off.
Put the grid in a flex column of fixed height with `flex: 1` and `minHeight: 0` on the grid itself, as on the [Styling](/docs/styling) page; a plain block container grows with the rows and nothing virtualizes.
Expose the api on `window` in the story where a test needs `scrollToRow`:

```tsx
// Orders.story.tsx
declare global {
  interface Window {
    __grid?: TMDataGridApi<Order>;
  }
}

export const Virtualized = () => {
  const grid = useTMDataGrid<Order>({
    data: orders, // 5000 rows
    columns,
    getRowId: (row) => row.id,
  });
  useEffect(() => {
    window.__grid = grid;
  }, [grid]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: 400 }}>
      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }} data-testid="orders">
        <TMDataGrid.Table<Order> />
      </TMDataGrid>
    </div>
  );
};
```

`mount` returns the gallery root; the page object takes the grid's root inside it.
The spec is typechecked apart from the story, so it declares `__grid` on `Window` as well:

```ts
test("reaches a row past the viewport", async ({ mount, page }) => {
  const component = await mount("Orders/Virtualized");
  const grid = new DataGrid(component.locator("[data-dg-root]"));
  await grid.expectRowCount(5000);
  await expect(grid.part("row", { rowId: "4500" })).toHaveCount(0);

  const found = await page.evaluate(() => {
    return window.__grid!.scrollToRow({ rowId: "4500", align: "center" });
  });
  expect(found).toBe(true);
  await expect(grid.part("row", { rowId: "4500" })).toBeVisible();
});
```

A story id is a string: `mount` accepts any id, and a renamed story fails at run time.
To get completion and prop checking, register the ids in Playwright's `Stories` interface:

```ts
declare module "@playwright/test" {
  interface Stories {
    "Orders/Virtualized": typeof Virtualized;
  }
}
```

A clipboard test needs `cellSelection` on in the story and the `permissions` above in the project; it selects a range, presses `Control+C` and reads `navigator.clipboard.readText()` through `page.evaluate`.
The copied text separates cells with a tab and rows with `\r\n`.

The grid's own component suite is written this way: the stories, the gallery and the specs are in the [repository](https://github.com/Jielga/react/tree/main/playwright).

## React Testing Library

Under jsdom there is no layout, so the virtualizer mounts a handful of rows
whatever the data says. Assert on the grid's own counts rather than on the
number of row elements:

```tsx
const rowCount = Number(
  screen.getByRole("table").getAttribute("data-dg-row-count"),
);
expect(rowCount).toBe(3);
```

Mantine's transitions never settle under jsdom, so a Popover's dropdown mounts
empty, including the filter and column panels. Render inside
`<MantineProvider env="test">`.
