import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("the column menu groups rows and a group toggle collapses one", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/grouping",
    file: "rows/Grouping.tsx",
  });
  const groupRows = grid.root.locator('[data-dg-part="row"][data-grouped]');

  // The demo starts grouped by department. Grouping takes the column out of
  // the grid, so its Ungroup item is on the menu of the tree column.
  const treeMenu = await grid.openColumnMenu("__group__");
  await treeMenu
    .getByRole("menuitem", { name: "Ungroup Department" })
    .click();
  await expect(groupRows).toHaveCount(0);

  const menu = await grid.openColumnMenu("location");
  await menu.getByRole("menuitem", { name: "Group by Location" }).click();
  // Four locations, each group collapsed.
  await grid.expectRowCount(4);
  await expect(groupRows).toHaveCount(4);

  const toggle = grid.part("group-toggle", { rowId: "location:Stockholm" });
  await toggle.click();
  // One location in four: 50 of the 200 rows.
  await grid.expectRowCount(54);

  await toggle.click();
  await grid.expectRowCount(4);
});
