import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("Enter commits a cell edit", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editing",
    file: "editing/CellEditing.tsx",
  });
  const cell = grid.cell({ rowId: "1", columnId: "salary" });

  await cell.dblclick();
  await grid.fillRow("1", { salary: "52000" });
  await page.keyboard.press("Enter");

  // The demo's onCommit writes the value back into its data.
  await expect(cell).toHaveText("52 000 kr");
});

test("Escape discards a cell edit", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editing",
    file: "editing/CellEditing.tsx",
  });
  const cell = grid.cell({ rowId: "1", columnId: "lastName" });
  const before = await cell.textContent();

  await cell.dblclick();
  await grid.fillRow("1", { lastName: "Nordkvist" });
  await page.keyboard.press("Escape");

  await expect(grid.part("editor")).toHaveCount(0);
  await expect(cell).toHaveText(before ?? "");
});
