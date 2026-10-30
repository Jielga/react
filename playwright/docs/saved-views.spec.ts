import type { Page } from "@playwright/test";
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

test("a preset applies its layout and Restore brings it back", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, DEMO);
  const salary = grid.part("header", { columnId: "salary" });
  await expect(salary).toBeVisible();

  await grid.part("menu-button").click();
  await viewItem(page, "contact").click();
  await expect(salary).toHaveCount(0);
  // Picking a view closes the menu; let it finish before opening it again.
  await expect(page.getByRole("menu")).toHaveCount(0);

  await grid.toggleColumn("salary");
  await expect(salary).toBeVisible();

  await grid.menuPart("views-restore").click();
  await expect(salary).toHaveCount(0);
});

test("a saved view comes back selected after a reload", async ({ page }) => {
  const grid = await openDemoGrid(page, DEMO);
  const location = grid.part("header", { columnId: "location" });

  await grid.toggleColumn("location");
  await expect(location).toHaveCount(0);

  await grid.menuPart("views-save-as").click();
  await grid.menuPart("views-name").fill("No location");
  await grid.menuPart("views-save").click();
  // The name is the user's own text, not a translated label.
  await expect(selectedView(page)).toHaveText("No location");

  await page.reload();
  const again = await openDemoGrid(page, DEMO);
  await expect(again.part("header", { columnId: "location" })).toHaveCount(0);
  await again.part("menu-button").click();
  await expect(selectedView(page)).toHaveText("No location");
});

test("a taken name cannot be saved", async ({ page }) => {
  const grid = await openDemoGrid(page, DEMO);
  await grid.part("menu-button").click();
  await grid.menuPart("views-save-as").click();
  await grid.menuPart("views-name").fill("contact");
  await expect(grid.menuPart("views-save")).toBeDisabled();
});
