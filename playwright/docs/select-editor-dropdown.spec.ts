import type { Page } from "@playwright/test";
import type { DataGrid } from "../support/DataGrid";
import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

/**
 * The select editors' dropdowns render in a portal, outside the cell, so the
 * grid's scroll area cannot clip them. A press in the dropdown still belongs
 * to the editor: a pick must not read as a click away in any edit mode.
 */

/**
 * Opens the editor's dropdown and returns its listbox. Mantine's
 * `MultiSelect` sets no `aria-controls` on its input, so the listbox is found
 * on the page: one editor is open, so one listbox is.
 */
async function openListbox(
  page: Page,
  grid: DataGrid,
  key: { rowId: string; columnId: string },
) {
  await grid
    .part("editor", key)
    .locator('[data-dg-part="editor-input"]')
    .click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  return listbox;
}

test("a select editor in a low row shows every option", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editors",
    file: "editing/ExtendedEditors.tsx",
  });
  const key = { rowId: "3", columnId: "category" };
  const cell = grid.cell(key);

  await cell.dblclick();
  const listbox = await openListbox(page, grid, key);
  const options = listbox.locator('[role="option"]');
  await expect(options).toHaveCount(5);
  for (const option of await options.all()) {
    await expect(option).toBeInViewport({ ratio: 1 });
  }

  // Under "cell", the pick is the edit: it commits and closes the editor.
  await listbox.locator('[role="option"][value="Cables"]').click();
  await expect(grid.part("editor")).toHaveCount(0);
  await expect(cell).toHaveText("Cables");
});

test("a click away with the dropdown open commits and removes the dropdown", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editors",
    file: "editing/ExtendedEditors.tsx",
  });
  const key = { rowId: "1", columnId: "category" };

  await grid.cell(key).dblclick();
  const listbox = await openListbox(page, grid, key);
  await grid.cell({ rowId: "2", columnId: "sku" }).click();

  await expect(grid.part("editor")).toHaveCount(0);
  await expect(listbox).toHaveCount(0);
});

test("a pick under cellConfirm keeps the draft open for its confirm", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editors",
    file: "editing/EditorsAndValidation.tsx",
  });
  const key = { rowId: "1", columnId: "department" };
  const cell = grid.cell(key);

  await cell.dblclick();
  const listbox = await openListbox(page, grid, key);
  await listbox.locator('[role="option"][value="Finance"]').click();

  await expect(grid.part("editor", key)).toHaveCount(1);
  // The ✓ carries no coordinates of its own; it sits inside the editor.
  await grid
    .part("editor", key)
    .locator('[data-dg-part="editor-confirm"]')
    .click();
  await expect(grid.part("editor")).toHaveCount(0);
  await expect(cell).toHaveText("Finance");
});

test("a multi-select editor keeps picking from its dropdown until Enter", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editors",
    file: "editing/EditorsAndValidation.tsx",
  });
  const key = { rowId: "1", columnId: "skills" };
  const cell = grid.cell(key);

  await cell.dblclick();
  const listbox = await openListbox(page, grid, key);
  await listbox.locator('[role="option"][value="SQL"]').click();
  await listbox.locator('[role="option"][value="Figma"]').click();

  await expect(grid.part("editor", key)).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(grid.part("editor")).toHaveCount(0);
  await expect(cell).toContainText("SQL");
  await expect(cell).toContainText("Figma");
});

test("a pick in row mode leaves the row open", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editing",
    file: "editing/RowEditing.tsx",
  });
  const key = { rowId: "1001", columnId: "department" };

  await grid.part("edit-row", { rowId: "1001" }).click();
  const listbox = await openListbox(page, grid, key);
  await listbox.locator('[role="option"][value="Finance"]').click();

  await expect(grid.part("editor", key)).toHaveCount(1);
  await grid.part("save-row", { rowId: "1001" }).click();
  await expect(grid.part("editor", { rowId: "1001" })).toHaveCount(0);
  await expect(grid.cell(key)).toHaveText("Finance");
});
