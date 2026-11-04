import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("the menu's export item downloads a CSV", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/export",
    file: "data/Export.tsx",
  });

  await grid.part("menu-button").click();
  const download = page.waitForEvent("download");
  // The demo's menu holds three export items; the first uses the grid's
  // own exportOptions.
  await grid.menuPart("menu-export").first().click();

  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});
