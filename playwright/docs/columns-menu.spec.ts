import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("the menu hides a column and Reset layout brings it back", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/menu",
    file: "customization/GridMenu.tsx",
  });
  const header = grid.part("header", { columnId: "location" });
  await expect(header).toBeVisible();

  await grid.toggleColumn("location");
  await expect(header).toHaveCount(0);

  await grid.menuPart("columns-reset").click();
  await expect(header).toBeVisible();
});
