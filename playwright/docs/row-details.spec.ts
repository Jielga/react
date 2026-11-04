import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("the chevron opens a panel under its row, and only that row", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/row-details",
    file: "rows/DetailsPanel.tsx",
  });
  await expect(grid.part("details", { rowId: "2" })).toHaveCount(0);

  await grid.part("details-toggle", { rowId: "2" }).click();
  await expect(grid.part("details", { rowId: "2" })).toBeVisible();
  // The panel is a cell inside the row, not a row: the count is unchanged.
  await expect(grid.part("details")).toHaveCount(1);

  await grid.part("details-toggle", { rowId: "2" }).click();
  await expect(grid.part("details", { rowId: "2" })).toHaveCount(0);
});

test("the header control opens every panel and closes them again", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/row-details",
    file: "rows/DetailsPanel.tsx",
  });
  const rows = grid.part("row");
  await expect(rows.first()).toBeVisible();

  await grid.part("details-toggle-all").click();
  // Only the rendered rows exist to check; the rest are virtualized.
  await expect(
    grid.root.locator('[data-dg-part="row"]:not(:has([data-dg-part="details"]))'),
  ).toHaveCount(0);

  await grid.part("details-toggle-all").click();
  await expect(grid.part("details")).toHaveCount(0);
});

test('the lane sits at the right edge under detailsColumnPosition: "right"', async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/row-details",
    file: "rows/DetailsPanelRight.tsx",
  });
  const row = grid.part("row", { rowId: "1" });
  // DETAILS_COLUMN_ID: the last cell of the row is the chevron lane.
  await expect(row.locator("[data-column-id]").last()).toHaveAttribute(
    "data-column-id",
    "__details__",
  );

  await grid.part("details-toggle", { rowId: "1" }).click();
  await expect(grid.part("details", { rowId: "1" })).toBeVisible();
});

test("grouping a details grid renders its group rows", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/row-details",
    file: "rows/DetailsPanel.tsx",
  });
  const menu = await grid.openColumnMenu("department");
  await menu.getByRole("menuitem", { name: "Group by Department" }).click();

  const groupRows = grid.root.locator('[data-dg-part="row"][data-grouped]');
  await expect(groupRows.first()).toBeVisible();
});
