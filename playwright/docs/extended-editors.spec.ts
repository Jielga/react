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

test("an extended select commits a pick", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editors",
    file: "editing/ExtendedEditors.tsx",
  });
  const cell = grid.cell({ rowId: "1", columnId: "category" });

  await cell.dblclick();
  await grid.chooseOption({
    select: grid
      .part("editor", { rowId: "1", columnId: "category" })
      .locator('[data-dg-part="editor-input"]'),
    value: "Cables",
  });

  await expect(cell).toHaveText("Cables");
});
