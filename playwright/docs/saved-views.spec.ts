import type { Page } from "@playwright/test";
import type { DataGrid } from "../support/DataGrid";
import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

const DEMO = { route: "/docs/saved-views", file: "data/SavedViews.tsx" };

/** One view in the open menu, by its id. */
const viewItem = (page: Page, viewId: string) =>
  page
    .getByRole("menu")
    .locator(`[data-dg-part="views-item"][data-view-id="${viewId}"]`);

/** The selected view in the open menu. */
const selectedView = (page: Page) =>
  page
    .getByRole("menu")
    .locator('[data-dg-part="views-item"][aria-checked="true"]');

/** Opens the burger if it is closed, then the Views submenu beside it. */
async function openViews(grid: DataGrid) {
  const views = grid.menuPart("views-submenu");
  if (!(await views.isVisible())) await grid.part("menu-button").click();
  await views.hover();
}

/** Saves the current layout under `name` from the Views submenu. */
async function saveView(grid: DataGrid, name: string) {
  await openViews(grid);
  await grid.menuPart("views-save-as").click();
  await grid.menuPart("views-name").fill(name);
  await grid.menuPart("views-save").click();
}

test("a preset applies its layout, and picking it again discards changes", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, DEMO);
  const salary = grid.part("header", { columnId: "salary" });
  await expect(salary).toBeVisible();

  await openViews(grid);
  await viewItem(page, "contact").click();
  await expect(salary).toHaveCount(0);
  // Picking a view closes the menu; let it finish before opening it again.
  await expect(page.getByRole("menu")).toHaveCount(0);

  await grid.toggleColumn("salary");
  await expect(salary).toBeVisible();

  await openViews(grid);
  await expect(selectedView(page)).toHaveAttribute("data-modified", "true");
  await selectedView(page).click();
  await expect(salary).toHaveCount(0);
});

test("a saved view comes back selected after a reload", async ({ page }) => {
  const grid = await openDemoGrid(page, DEMO);
  const location = grid.part("header", { columnId: "location" });

  await grid.toggleColumn("location");
  await expect(location).toHaveCount(0);
  await saveView(grid, "No location");
  // The name is the user's own text, not a translated label.
  await expect(selectedView(page)).toHaveText("No location");

  await page.reload();
  const again = await openDemoGrid(page, DEMO);
  await expect(again.part("header", { columnId: "location" })).toHaveCount(0);
  await openViews(again);
  await expect(selectedView(page)).toHaveText("No location");
});

test("Save changes to view shows only while the layout has changed", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, DEMO);
  await saveView(grid, "Mine");
  await expect(grid.menuPart("views-delete")).toBeVisible();
  await expect(grid.menuPart("views-overwrite")).toHaveCount(0);

  await grid.toggleColumn("status");
  await openViews(grid);
  await grid.menuPart("views-overwrite").click();
  await expect(page.getByRole("menu")).toHaveCount(0);

  await openViews(grid);
  await expect(selectedView(page)).not.toHaveAttribute("data-modified");
  await expect(grid.part("header", { columnId: "status" })).toHaveCount(0);
});

test("a taken name cannot be saved", async ({ page }) => {
  const grid = await openDemoGrid(page, DEMO);
  await openViews(grid);
  await grid.menuPart("views-save-as").click();
  await grid.menuPart("views-name").fill("contact");
  await expect(grid.menuPart("views-save")).toBeDisabled();
});
