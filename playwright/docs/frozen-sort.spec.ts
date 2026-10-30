import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("a frozen sort holds an edited row until Sort again", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/sorting",
    file: "columns/FrozenSort.tsx",
  });
  const firstRow = grid.part("row").first();
  const firstId = await firstRow.getAttribute("data-row-id");
  const secondId = await grid.part("row").nth(1).getAttribute("data-row-id");
  if (firstId === null || secondId === null) throw new Error("No rows");
  const sortAgain = grid.part("sort-again", { columnId: "salary" });
  await expect(sortAgain).toHaveCount(0);

  // Sorted by salary, ascending: the highest salary belongs last.
  await grid.cell({ rowId: firstId, columnId: "salary" }).dblclick();
  await grid.fillRow(firstId, { salary: "99999999" });
  await page.keyboard.press("Enter");

  await expect(firstRow).toHaveAttribute("data-row-id", firstId);
  await expect(sortAgain).toBeVisible();

  // An edit still open when the button is pressed commits first, and the
  // press still lands.
  await grid.cell({ rowId: secondId, columnId: "salary" }).dblclick();
  await grid.fillRow(secondId, { salary: "99999998" });
  await sortAgain.click();

  await expect(grid.part("editor")).toHaveCount(0);
  await expect(sortAgain).toHaveCount(0);
  await expect(firstRow).not.toHaveAttribute("data-row-id", firstId);
  await expect(firstRow).not.toHaveAttribute("data-row-id", secondId);
  await expect(grid.part("header", { columnId: "salary" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});

test("Sort again in the column menu re-sorts a frozen sort", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/sorting",
    file: "columns/FrozenSort.tsx",
  });
  const firstRow = grid.part("row").first();
  const firstId = await firstRow.getAttribute("data-row-id");
  if (firstId === null) throw new Error("No rows");

  await grid.cell({ rowId: firstId, columnId: "salary" }).dblclick();
  await grid.fillRow(firstId, { salary: "99999999" });
  await page.keyboard.press("Enter");
  await expect(firstRow).toHaveAttribute("data-row-id", firstId);

  const menu = await grid.openColumnMenu("salary");
  await menu.getByRole("menuitem", { name: "Sort again" }).click();

  await expect(firstRow).not.toHaveAttribute("data-row-id", firstId);
});
