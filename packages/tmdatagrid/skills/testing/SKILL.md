---
name: testing
description: >
  Write tests against TMDataGrid from a consuming app - Playwright or React
  Testing Library. Covers the data-dg-part contract, data-row-id/data-column-id
  coordinates, naming a grid with data-testid, the roles and ARIA the grid
  publishes, the cell/gridcell role flip under cell selection, the surfaces that
  render in a portal (the menu, the export picker, Select listboxes), reaching
  rows past virtualization with data-dg-row-count, scrollToRow and
  data-dg-scroll-container, waiting on aria-busy, and the DataGrid page object.
  Load when writing or fixing tests that drive a grid, or when a selector for a
  row, cell or control does not resolve.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.2.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/testing.md'
  - 'Jielga/react:playwright/support/DataGrid.ts'
  - 'Jielga/react:packages/tmdatagrid/src/components/TMDataGrid.tsx'
  - 'Jielga/react:packages/tmdatagrid/src/components/TMDataGridTable.tsx'
---

# TMDataGrid - Testing

The grid names its own pieces so a suite can be written against structure
rather than against copy or class names. Three hooks carry it:

- **`data-dg-part`** - *what* an element is (`"row"`, `"filter-button"`)
- **`data-row-id` / `data-column-id`** - *which* one, using your own ids
- **roles and ARIA** - framework-neutral, and what a screen reader reads

Selectors compose: `[data-dg-part="save-row"][data-row-id="42"]`.

The grid mints no `data-testid` of its own - that attribute belongs to the app,
and Playwright's `testIdAttribute` is configurable. `@mantine/core` and
`@tanstack/*` ship none either.

Adding, changing and deleting rows, the draft store, and where a new row's
temporary id goes at commit are in the `testing-editing` skill. Running the grid
in a real browser through Playwright's `mount` fixture - virtualization, resize,
drag, pinning, clipboard - is in the `testing-components` skill.

## Naming a grid

Parts repeat across grids on a page. Name the grid, scope through it:

```tsx
<TMDataGrid {...grid} data-testid="orders">
  <TMDataGrid.Table<Order> aria-label="Orders" />
</TMDataGrid>
```

`data-testid` and `id` go on the root (which also carries `data-dg-root`);
`aria-label` or `aria-labelledby` goes on `TMDataGrid.Table`, because the
accessible name belongs to the element carrying the `grid` role.

## Roles

| Element | Role | Key attributes |
| --- | --- | --- |
| Grid | `table`, or `grid` under cell selection | `aria-rowcount`, `aria-colcount`, `aria-busy`, `data-dg-row-count` |
| Scroll container | - | `data-dg-scroll-container` - the element to scroll |
| Body row | `row` | `data-row-id`, `aria-rowindex`, `data-selected`, `data-highlighted`, `data-grouped`, `data-pinned`, `data-deleted` |
| Body cell | `cell`, or `gridcell` under cell selection | `data-row-id`, `data-column-id`, `data-editing`, `data-dirty`, `data-invalid`, `data-focused` |
| Header cell | `columnheader` | `data-column-id`, `aria-sort` |

Body cells carry no `data-dg-part` - the coordinate pair already names them.
The `editor` part of an open cell carries the same pair, so a cell locator is
`[data-row-id="42"][data-column-id="total"]:not([data-dg-part])`; without the
exclusion it matches two elements while the cell is being edited.

State attributes are present only while they apply: `data-selected`,
`data-new`, `data-invalid` and the rest are rendered as `"true"` while the
state holds and omitted otherwise, so `[data-new]` and `[data-new="true"]`
match the same rows, and the negative is `:not([data-new])` in CSS and
`not.toHaveAttribute("data-new")` in a test.

## Parts

**Whole-grid** (unique, no coordinate needed): `toolbar`, `summary-count`,
`loading`, `search`, `search-clear`, `filter-button`, `filter-panel`,
`filter-popup`, `filter-sidebar`, `filter-panel-close`, `filter-add`,
`filter-clear-all`, `filter-pills`, `header-filter-row`,
`menu-button`, `menu-export`, `menu-export-selected`, `export-picker`,
`export-picker-search`, `export-picker-hint`, `export-picker-count`,
`export-column-all`, `export-picker-confirm`, `export-picker-cancel`,
`columns-panel`, `columns-search`, `columns-toggle-all`,
`columns-reset`, `footer`, `page-size`, `page-range`, `page-number`,
`page-prev`, `page-next`, `summary-row`, `pinned-top`, `pinned-bottom`,
`select-all`, `details-toggle-all`, `save-all`, `discard-all`,
`editor-confirm`, `editor-cancel`, `editor-input`, `sort-index`, `tab-guard`.

**Keyed by `data-row-id`**: `row`, `entry-row`, `details`, `select-row`,
`details-toggle`, `group-toggle`, `edit-row`, `delete-row`, `save-row`,
`cancel-row`, `row-state`, `revert-row`, `restore-row`, `confirm-new-row`,
`discard-new-row`, `open-rows-note`.

**Keyed by `data-column-id`**: `header`, `header-sort`, `header-menu`,
`header-resize` (the resize handle; present only when the column can resize),
`header-filter` (absent under `filters.inHeader`), `header-filter-cell`,
`header-filter-operator`, `filter-row`, `filter-pill`, `columns-toggle`,
`export-column`.

**Keyed by both**: `editor`.

**The generated lanes** are columns with exported ids: `ROW_NUMBER_COLUMN_ID`
(`__rowNumber__`), `SELECT_COLUMN_ID` (`__select__`), `GROUP_COLUMN_ID`
(`__group__`), `DETAILS_COLUMN_ID` (`__details__`) and `EDIT_COLUMN_ID`
(`__edit__`). A lane's header is
`[data-dg-part="header"][data-column-id="__select__"]`, a lane cell
`[data-row-id="42"][data-column-id="__select__"]:not([data-dg-part])`, and the
control inside it has a row-keyed part: `select-row`, `details-toggle`,
`group-toggle`, the edit lane's buttons. `select-all` and `details-toggle-all`
sit in the lane headers. The checkbox parts are on the `<input>` itself, so
`check()` works on them directly. There is no `data-testid`.

Inside a `filter-row` the controls are `filter-column`, `filter-operator` and
`filter-value` - or `filter-value-from` / `filter-value-to` for `between` - and
`filter-remove` is its ✕. None of them carries `data-column-id`; scope through
the row. Inside a `filter-pill`, `filter-pill-remove` is the ✕.
`TMDataGridFilterPills` renders where you place it; outside the root, scope
through its own container rather than through the grid.

A column declaring `meta.filter.control` or `meta.edit.editor` renders your own
component in that slot, so `filter-value` and `editor-input` cover the built-ins
only. `filter-row` and `editor` still hold; scope through them.

Sorting: click `header`. `header-sort` is hidden until the header is hovered;
it shows the state, and `aria-sort` on the header is the assertion.

## Portals

These surfaces render at the end of `<body>`, outside the grid's root, so a
locator scoped to the root never finds them:

- the `TMDataGrid.Menu` dropdown - `page.getByRole("menu")`, holding
  `columns-toggle`, `columns-toggle-all`, `columns-reset`, `menu-export`,
  `menu-export-selected`
- a column's menu, opened by `header-menu` (hover the header first) or a right
  click on the header - `page.getByRole("menu")`; its items (sort, filter,
  group, pin, hide) carry no part, so reach one by role and label,
  `menu.getByRole("menuitem", { name: "Group by Location" })` - a translated
  label
- the `header-filter-operator` menu - `page.getByRole("menu")`
- the export column picker - `page.getByRole("dialog")`, holding the
  `export-*` parts
- the listbox of every `Select` or `MultiSelect` the grid renders -
  `page-size`, `filter-column`, `filter-operator`, and the `filter-value` of a
  boolean or select-type filter - the element named by the input's
  `aria-controls`; each option carries its value in `value`

One menu or dialog is open at a time, so the page-level locator is unambiguous.
`filter-popup` and `filter-sidebar` render inside the root.

## A page object

The full class is on the Testing docs page and in the repository at
`playwright/support/DataGrid.ts`; it is the one the grid's own suite runs
against the docs demos. The shape:

```ts
import { type Locator, type Page, expect } from "@playwright/test";

type PartKey = { rowId?: string; columnId?: string };

export class DataGrid {
  readonly page: Page;
  readonly root: Locator;
  readonly grid: Locator;

  /** `root` is the element carrying `data-dg-root`. */
  constructor(root: Locator) {
    this.page = root.page();
    this.root = root;
    this.grid = root.getByRole("table").or(root.getByRole("grid"));
  }

  static byTestId(page: Page, testId: string): DataGrid {
    return new DataGrid(page.getByTestId(testId));
  }

  part(name: string, key: PartKey = {}): Locator {
    return this.root.locator(partSelector(name, key));
  }

  /** A part inside the open menu dropdown, which renders in a portal. */
  menuPart(name: string, key: PartKey = {}): Locator {
    return this.page.getByRole("menu").locator(partSelector(name, key));
  }

  cell({ rowId, columnId }: { rowId: string; columnId: string }): Locator {
    return this.root.locator(
      `[data-row-id="${rowId}"][data-column-id="${columnId}"]:not([data-dg-part])`,
    );
  }

  async sortBy(columnId: string): Promise<void> {
    await this.part("header", { columnId }).click();
  }

  async expectRowCount(count: number): Promise<void> {
    await expect(this.grid).toHaveAttribute("data-dg-row-count", String(count));
  }

  async expectSettled(): Promise<void> {
    await expect(this.grid).not.toHaveAttribute("aria-busy");
  }
}
```

The full class adds `search`, `filterBy` (adds a filter row for the column
when the panel has none; fills the built-in text and number inputs, so a
select-type filter takes `chooseOption` on its `filter-value` instead),
`toggleColumn`, `openColumnMenu` (hovers the header, clicks `header-menu`,
returns the menu), `chooseOption` (an option of a portaled `Select`, by value),
and the editing methods of the `testing-editing` skill.

## Recipes

`grid` is a `DataGrid`; the parts are the steps, the attributes are the proof.

| Interaction | Steps | Assertion |
| --- | --- | --- |
| Quick search | `grid.search("Cecilia")`; `search-clear` | `grid.expectRowCount(10)`, then the full count |
| Sort | `grid.sortBy("lastName")` once, then again | `aria-sort` on `header`: `ascending`, then `descending` |
| Filter | `grid.filterBy({ columnId, value })`; `filter-clear-all` | `grid.expectRowCount(n)`, then the full count |
| Remove a filter | `filter-remove` in its `filter-row`, or `filter-pill-remove` in its `filter-pill` | the `filter-pill` has count 0; the row count |
| Hide a column | `grid.toggleColumn("location")`; `grid.menuPart("columns-reset")` | the `header` has count 0, then is visible |
| Page | `page-next`; `grid.chooseOption({ select: grid.part("page-size"), value: "50" })` | `page-range` text changes, first `row` has a new `data-row-id`; `grid.expectRowCount(50)` |
| Select rows | `select-row` of a row; `select-all` | `data-selected="true"` on the `row`; `[data-dg-part="row"]:not([data-selected])` has count 0 |
| Group | `grid.openColumnMenu("location")`, the "Group by" item; `group-toggle` of a group row | rows carry `data-grouped`; `data-dg-row-count` grows on expand, shrinks on collapse |
| Load more | scroll `data-dg-scroll-container` to `scrollHeight` | `data-dg-row-count` grows; `grid.expectSettled()` |
| Export | `menu-button`, then `menu-export` in the menu | `page.waitForEvent("download")`, `download.suggestedFilename()` |
| Edit a cell | `grid.cell(...).dblclick()`, `grid.fillRow(rowId, { columnId: value })`, Enter | the cell's text; Escape instead of Enter leaves it unchanged |

## Virtualization

Only the rows in the viewport plus overscan are in the DOM. A row at index 500
has no element, and Playwright cannot scroll to what it cannot find.

**Count rows off the grid.** `data-dg-row-count` is the body rows the grid is
showing - the current page under pagination, everything the filters left
otherwise. (`aria-rowcount` also counts the header and summary rows.)

**Reach a row by narrowing to it** - filter or search. Faster, more stable, and
what a user would do. Where the row must be reached in place,
`grid.scrollToRow({ rowId, align })` moves the virtualizer and answers whether
the row was reachable; from Playwright that needs the app to expose the api on
`window`. Scrolling the element carrying `data-dg-scroll-container` moves the
virtualizer without it, and is also how an infinite-scroll grid is made to
load its next page.

## Waiting

`meta.loading` sets `aria-busy` on the grid whether or not the body has rows, so
a refetch over existing rows is visible to a test. Quick search debounces
(250 ms by default). Assert on `data-dg-row-count` and let Playwright retry
rather than adding a timeout.

## Common mistakes

### Selecting a control by its aria-label

Every icon-only control has one, but they come from `labels` and are translated.
A suite written on `getByRole("button", { name: "Filters" })` breaks as soon as
the grid renders in Swedish, and again on any copy change. Use the part.

### Counting row elements

`expect(rows).toHaveLength(50)` fails at any real row count, because
virtualization mounts a couple of dozen. Under jsdom it is worse: there is no
layout, so the count depends on the stubbed element size. Assert
`data-dg-row-count`.

### getByRole("cell") on a grid with cell selection

`cellSelection` turns every `cell` into a `gridcell`, and the grid's `table`
into a `grid`. Tests written on the role break when the feature is switched on. Query cells by
`[data-row-id][data-column-id]` instead.

### Matching a cell while it is edited

`[data-row-id="42"][data-column-id="total"]` matches the cell and the `editor`
inside it once the cell is open, and strict mode fails on the pair. Add
`:not([data-dg-part])`.

### Clicking header-sort to sort

The arrow is `display: none` until the header is hovered, so the click waits
for visibility and times out. Click `header`; `aria-sort` on it is the result.

### Reaching the menu through the root

`orders.locator('[data-dg-part="columns-toggle"]')` never resolves: the
dropdown renders in a portal at the end of `<body>`. Use
`page.getByRole("menu")` after `menu-button` is clicked. The same goes for the
export picker (`dialog`) and every `Select` listbox (`aria-controls`).

### Expecting a row far down the list to exist

`[data-row-id="450"]` has no element until it is scrolled to, so the locator times out
with no useful message. Filter or search down to it first, or scroll
`data-dg-scroll-container`.

### Unscoped parts with two grids on a page

`page.locator('[data-dg-part="row"]')` matches both grids and Playwright's
strict mode fails on the ambiguity. Give each grid a `data-testid` and scope
every query through it.

### Adding data-testid and expecting the grid to honour it

`data-testid` on `<TMDataGrid>` lands on the root element only; it is not a
prefix that propagates to the parts inside. Scope through the root instead of
looking for `orders-row-42`.

### Asserting on a column's cells through nth-child

Column order changes with pinning, reordering and the generated lanes
(checkbox, tree, details, row numbers, edit), so a positional index points at a
different column than it did. Use `[data-column-id]`.

### Waiting on the toolbar spinner

`data-dg-part="loading"` only renders where `TMDataGrid.LoadingIndicator` was
placed, and only while `meta.loading` is true. `aria-busy` on the grid is set
regardless of whether that component is rendered.