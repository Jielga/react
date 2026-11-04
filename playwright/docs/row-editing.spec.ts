import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("Save commits an open row", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editing",
    file: "editing/RowEditing.tsx",
  });
  const cell = grid.cell({ rowId: "1001", columnId: "salary" });

  await grid.part("edit-row", { rowId: "1001" }).click();
  await grid.fillRow("1001", { salary: "52000" });
  await grid.part("save-row", { rowId: "1001" }).click();

  await expect(grid.part("editor", { rowId: "1001" })).toHaveCount(0);
  await expect(cell).toHaveText("52 000 kr");
});

test("Cancel discards an open row", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/editing",
    file: "editing/RowEditing.tsx",
  });
  const cell = grid.cell({ rowId: "1001", columnId: "lastName" });
  const before = await cell.textContent();

  await grid.part("edit-row", { rowId: "1001" }).click();
  await grid.fillRow("1001", { lastName: "Nordkvist" });
  await grid.part("cancel-row", { rowId: "1001" }).click();

  await expect(grid.part("editor", { rowId: "1001" })).toHaveCount(0);
  await expect(cell).toHaveText(before ?? "");
});
