---
name: testing-editing
description: >
  Test TMDataGrid editing flows from Playwright: adding a row through the entry
  row, where its temporary id (__new__1) goes at commit and at save, finding an
  added row when the grid does not know the id the app gave it, asserting a
  failed validation on an entry row, cell and row edits, deletions, and the
  draft store (data-new, data-draft, data-dirty, data-deleted, row-state,
  save-all and data-draft-count). Load when writing or fixing a test that adds,
  edits, deletes or saves rows, or when a locator for a new row stops resolving
  after the row is committed.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.5.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/testing.md'
  - 'Jielga/react:packages/tmdatagrid/docs/editing.md'
  - 'Jielga/react:packages/tmdatagrid/docs/draft-store.md'
  - 'Jielga/react:packages/tmdatagrid/src/components/TMDataGridEntryRows.tsx'
  - 'Jielga/react:packages/tmdatagrid/src/components/TMDataGridEditColumn.tsx'
---

# TMDataGrid - Testing editing

Builds on the `testing` skill: parts are `[data-dg-part]`, coordinates are
`[data-row-id]` / `[data-column-id]`, and `DataGrid` is its page object, built
with `DataGrid.byTestId(page, "orders")` or `new DataGrid(rootLocator)`.

## The life of an added row

`edit.addRow()` opens an entry row keyed by a temporary id. What happens at ✓
depends on `editing.draft`, and that decides what a test can hold on to:

| Step | Without `draft` | With `draft: true` |
| --- | --- | --- |
| `addRow()` | `[data-dg-part="entry-row"][data-row-id="__new__1"]`; editors are `[data-dg-part="editor"][data-row-id="__new__1"][data-column-id="..."]` | Same |
| ✓ fails validation | Entry row stays; failing cells carry `data-invalid="true"` | Same |
| ✓ (`confirm-new-row`) | **Entry row removed, temp id gone.** `onRowAdd({ tempId, value })` runs in the app; the row exists again only when the app puts it in `data`, under the id the app's `getRowId` returns | Becomes a body row **still keyed by the temp id**: `[data-dg-part="row"][data-row-id="__new__1"][data-new="true"][data-draft="true"]`, lane shows `[data-dg-part="row-state"][data-state="new"]`, `[data-dg-part="save-all"]` counts it in `data-draft-count` |
| Save (`save-all`) | - | As ✓ without `draft`: temp id gone, row comes back through `data` under the app's id |
| `newRowsSticky: true` | - | The committed row stays an `entry-row` with `data-committed="true"`, outside `data-dg-row-count`, until Save |

The grid never learns the id the app assigns (a database id, a negative
counter, a uuid - whatever `onRowAdd` or `onSaveDrafts` does). The temp id →
real id mapping does not exist anywhere in the DOM.

## The rule: find an added row by content, not by id

Once `onRowAdd` or `saveDrafts` has run, the only thing the test knows about
the row is what it typed. Narrow the grid to a value unique to that row, assert
that exactly one row is left, read that row's cells:

```ts
async expectRowAdded(uniqueValue: string, cells: Record<string, string>) {
  await this.search(uniqueValue);   // or filterBy on a column when there is no quick search
  await this.expectRowCount(1);     // retries until the app has put the row in data
  const row = this.part("row");     // exactly one body row now
  for (const [columnId, text] of Object.entries(cells)) {
    await expect(
      row.locator(`[data-column-id="${columnId}"]:not([data-dg-part])`),
    ).toHaveText(text);
  }
  await this.search("");
}
```

- The `data-dg-row-count` assertion is the wait. Nothing else signals that
  `onRowAdd` finished: `aria-busy` reflects `meta.loading` only.
- Use a value no other row has - put a run id in the name. Two matches means
  `expectRowCount(1)` fails, correctly.
- Scoped to the grid and to one column: no `page.getByText`, no virtualization
  problem, no strict-mode ambiguity.

## Page object methods

Add these to the `DataGrid` class from the `testing` skill:

```ts
entryRow(): Locator {
  return this.part("entry-row");
}

/** Built-in editors of an open row: an entry row, or a row opened in row mode. */
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

/** Save in TMDataGrid.DraftActions, waited until the store is empty. */
async saveDrafts(): Promise<void> {
  await this.part("save-all").click();
  await expect(this.part("save-all")).toHaveAttribute("data-draft-count", "0");
}
```

`fillRow` covers the built-in editors. A column with `meta.edit.editor` renders
the app's own component inside the `editor` part; scope through
`part("editor", { rowId, columnId })` and fill whatever is inside. A built-in
editor rendered through `meta.edit.editor` with `inputProps` keeps
`editor-input`, so `fillRow` covers it.

## Recipes

### Add a row, without draft

```ts
await page.getByRole("button", { name: "Add row" }).click(); // the app's button → edit.addRow()
const tempId = (await grid.entryRow().getAttribute("data-row-id"))!;
await grid.fillRow(tempId, { name: "Nordkvist-4711", city: "Stockholm" });
await grid.commitEntryRow(tempId);

await expect(grid.entryRow()).toHaveCount(0);           // entry row gone; tempId is now meaningless
await grid.expectRowAdded("Nordkvist-4711", { name: "Nordkvist-4711", city: "Stockholm" });
```

### Add a row, with draft, then save

```ts
await grid.commitEntryRow(tempId);
const row = grid.part("row", { rowId: tempId });        // tempId is still the row's id
await expect(row).toHaveAttribute("data-new", "true");
await expect(row).toHaveAttribute("data-draft", "true");
await expect(grid.part("row-state", { rowId: tempId })).toHaveAttribute("data-state", "new");
await expect(grid.part("save-all")).toHaveAttribute("data-draft-count", "1");

await grid.saveDrafts();
await expect(row).toHaveCount(0);                       // tempId dies here
await grid.expectRowAdded("Nordkvist-4711", { city: "Stockholm" });
```

Reopening a committed draft row: `edit-row` (the lane's pencil) or a
double-click puts it back in the entry block, still under the temp id; ✕
(`discard-new-row`) removes it.

### A ✓ that fails validation

```ts
await grid.commitEntryRow(tempId);
await expect(grid.entryRow()).toHaveCount(1);           // still open
await expect(
  grid.entryRow().locator('[data-column-id="email"]:not([data-dg-part])'),
).toHaveAttribute("data-invalid", "true");
```

The cell and the open `editor` inside it share the column id, so the selector
leaves the editor out.

### Change a cell or a row

```ts
const cell = grid.cell({ rowId: "42", columnId: "salary" });
await cell.dblclick();                                  // cell mode: opens the editor
await grid.fillRow("42", { salary: "52000" });
await page.keyboard.press("Enter");                     // commits

// Without draft: onCommit ran, the app applied it, the grid holds nothing
await expect(cell).toHaveText("52 000");

// Under draft: the grid holds it until Save
await expect(cell).toHaveAttribute("data-dirty", "true");
await expect(grid.part("row", { rowId: "42" })).toHaveAttribute("data-dirty", "true");
await expect(grid.part("row-state", { rowId: "42" })).toHaveAttribute("data-state", "edited");
```

Row mode: `edit-row` opens the row, `fillRow` reaches its editors, `save-row`
commits, `cancel-row` discards. `cellConfirm` mode: `editor-confirm` /
`editor-cancel` beside the input, or Enter / Escape.

### Delete a row

```ts
const before = Number(await grid.grid.getAttribute("data-dg-row-count"));
await grid.part("delete-row", { rowId: "42" }).click();

// Without draft: onRowDelete ran, the app removed it from data
await grid.expectRowCount(before - 1);

// Under draft: marked until Save; restore-row undoes the mark
await expect(grid.part("row", { rowId: "42" })).toHaveAttribute("data-deleted", "true");
await grid.part("restore-row", { rowId: "42" }).click();
```

## Attribute values

A state attribute is present, with the value `"true"`, only while it applies:
`data-new`, `data-draft`, `data-dirty`, `data-deleted` on a body row,
`data-committed` on an entry row, `data-dirty`, `data-invalid`, `data-editing`
on a cell. `[data-new]` and `[data-new="true"]` match the same rows,
`toHaveAttribute("data-new")` and `toHaveAttribute("data-new", "true")` both
hold, and the negative is `not.toHaveAttribute("data-new")`.

## Common mistakes

### Looking for the new row's text on the page

`page.getByText("Nordkvist")` searches the whole document: other grids, the
toolbar, a toast. And the row may be virtualized out of the DOM, so the
locator fails or flakes depending on sort order and viewport. Narrow with
search or a filter, assert `data-dg-row-count` is 1, read that one row.

### Keeping the temp id after ✓ without draft

`grid.part("row", { rowId: "__new__1" })` never resolves: without `draft` the
grid drops the entry and the id at ✓, and the row's real id is the app's. Only
under `draft: true` does the temp id outlive ✓ - and only until Save.

### Waiting for the added row with a timeout

The app's `onRowAdd` may be async. `expectRowCount(1)` after narrowing retries
until the row is in `data`; a `waitForTimeout` either wastes time or is too
short on CI.

### Matching the editor with a cell selector

While a cell is open, `[data-row-id="42"][data-column-id="salary"]` matches
the cell and the `editor` part inside it, and strict mode fails on the pair.
`DataGrid.cell()` appends `:not([data-dg-part])`; a hand-written locator on a
row's cells needs the same.

### Asserting the negative with `"false"`

`toHaveAttribute("data-new", "false")` never passes: a state that does not
apply is an absent attribute, not `"false"`. Use
`not.toHaveAttribute("data-new")`, and `:not([data-new])` in CSS.

### Asserting a deletion with `toHaveCount(0)`

A row outside the viewport has no element either. Assert `data-dg-row-count`
dropped by one, or, under `draft`, `data-deleted="true"` on the row.

### Expecting the grid to show the change without draft

Without `draft: true` the grid holds nothing after a commit: no `data-dirty`,
no `row-state`, `save-all` stays disabled at `data-draft-count="0"`. The
assertion is the cell's text after the app has applied the change to `data`.
