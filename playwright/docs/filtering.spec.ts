import { openDemo, openDemoGrid } from "../support/docsSite";
import { DataGrid } from "../support/DataGrid";
import { expect, test } from "../support/test";

test("a panel filter narrows the rows and Clear all restores them", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/filtering",
    file: "columns/Filtering.tsx",
  });
  await grid.expectRowCount(200);

  // Last names cycle through five values, so one of them is 40 of the 200.
  await grid.filterBy({ columnId: "lastName", value: "Holm" });
  await grid.expectRowCount(40);

  await grid.part("filter-clear-all").click();
  await grid.expectRowCount(200);
});

test("removing a filter removes its pill", async ({ page }) => {
  // The pills render outside the grid, so they are reached through the demo.
  const demo = await openDemo(page, {
    route: "/docs/filtering",
    file: "columns/FilterPills.tsx",
  });
  const grid = new DataGrid(demo.locator("[data-dg-root]"));
  const pill = demo.locator(
    '[data-dg-part="filter-pill"][data-column-id="lastName"]',
  );
  await expect(pill).toBeVisible();
  // Sales is 25 of the 200 rows, and 20 of those have a last name in -son.
  await grid.expectRowCount(20);

  await grid.part("filter-button").click();
  await grid
    .part("filter-row", { columnId: "lastName" })
    .locator('[data-dg-part="filter-remove"]')
    .click();

  await expect(pill).toHaveCount(0);
  // One department in eight is Sales.
  await grid.expectRowCount(25);
});
