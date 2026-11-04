import { openDemo } from "../support/docsSite";
import { DataGrid } from "../support/DataGrid";
import { expect, test } from "../support/test";

test("an added row is a draft until Save", async ({ page }) => {
  // The Add row button renders in the demo, outside the grid.
  const demo = await openDemo(page, {
    route: "/docs/draft-store",
    file: "editing/DraftEditing.tsx",
  });
  const grid = new DataGrid(demo.locator("[data-dg-root]"));

  await demo.getByRole("button", { name: "Add row", exact: true }).click();
  const tempId = (await grid.entryRow().getAttribute("data-row-id")) ?? "";
  await grid.fillRow(tempId, { firstName: "Testa", lastName: "Nordkvist-4711" });
  await grid.commitEntryRow(tempId);

  const row = grid.part("row", { rowId: tempId });
  await expect(row).toHaveAttribute("data-new", "true");
  await expect(row).toHaveAttribute("data-draft", "true");
  await expect(grid.part("row-state", { rowId: tempId })).toHaveAttribute(
    "data-state",
    "new",
  );
  await expect(grid.part("save-all")).toHaveAttribute("data-draft-count", "1");

  await grid.saveDrafts();
  await expect(row).toHaveCount(0);

  // The demo has no quick search and no filter button, so the saved row is
  // found through the column menu's Filter item instead of expectRowAdded.
  const menu = await grid.openColumnMenu("lastName");
  await menu.getByRole("menuitem", { name: "Filter" }).click();
  await grid.filterBy({ columnId: "lastName", value: "Nordkvist-4711" });
  await grid.expectRowCount(1);
  await expect(
    grid.part("row").locator('[data-column-id="firstName"]:not([data-dg-part])'),
  ).toHaveText("Testa");
});

test("a changed row is marked until Save", async ({ page }) => {
  const demo = await openDemo(page, {
    route: "/docs/draft-store",
    file: "editing/DraftEditing.tsx",
  });
  const grid = new DataGrid(demo.locator("[data-dg-root]"));
  const cell = grid.cell({ rowId: "2001", columnId: "salary" });

  await cell.dblclick();
  await grid.fillRow("2001", { salary: "52000" });
  await page.keyboard.press("Enter");

  await expect(cell).toHaveAttribute("data-dirty", "true");
  await expect(grid.part("row", { rowId: "2001" })).toHaveAttribute(
    "data-dirty",
    "true",
  );
  await expect(grid.part("row-state", { rowId: "2001" })).toHaveAttribute(
    "data-state",
    "edited",
  );
});

test("a deleted row is marked until Save, and Restore undoes it", async ({
  page,
}) => {
  const demo = await openDemo(page, {
    route: "/docs/draft-store",
    file: "editing/DraftEditing.tsx",
  });
  const grid = new DataGrid(demo.locator("[data-dg-root]"));
  const row = grid.part("row", { rowId: "2001" });

  await grid.part("delete-row", { rowId: "2001" }).click();
  await expect(row).toHaveAttribute("data-deleted", "true");
  await expect(grid.part("save-all")).toHaveAttribute("data-draft-count", "1");

  await grid.part("restore-row", { rowId: "2001" }).click();
  await expect(row).not.toHaveAttribute("data-deleted");
  await expect(grid.part("save-all")).toHaveAttribute("data-draft-count", "0");
});
