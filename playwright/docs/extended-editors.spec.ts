import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("an extended number editor commits through its inputProps", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editors",
    file: "editing/ExtendedEditors.tsx",
  });
  const cell = grid.cell({ rowId: "1", columnId: "price" });

  await cell.dblclick();
  await grid.fillRow("1", { price: "499" });
  await page.keyboard.press("Enter");

  await expect(cell).toHaveText("499");
});

test("an extended select keeps its dropdown inside the cell", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editors",
    file: "editing/ExtendedEditors.tsx",
  });
  const cell = grid.cell({ rowId: "1", columnId: "category" });

  await cell.dblclick();
  const select = grid
    .part("editor", { rowId: "1", columnId: "category" })
    .locator('[data-dg-part="editor-input"]');
  await select.click();
  const listboxId = await select.getAttribute("aria-controls");
  if (listboxId === null) throw new Error("The select has no listbox.");

  // The demo passes its own comboboxProps; the grid still renders the
  // dropdown in the cell, so picking an option is not a click away from it.
  const listbox = cell.locator(`[id="${listboxId}"]`);
  await expect(listbox).toBeVisible();
  await listbox.locator('[role="option"][value="Cables"]').click();

  await expect(cell).toHaveText("Cables");
});
