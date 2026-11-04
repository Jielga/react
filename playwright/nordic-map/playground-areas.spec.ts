import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";

async function mapLoaded(page: Page) {
  await expect(page.getByRole("application")).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading map" })).toHaveCount(0, { timeout: 15_000 });
}

test("the playground shows the areas saved in the area editor", async ({ page }) => {
  await page.goto("/editor");
  await mapLoaded(page);
  const box = await page.getByRole("application").boundingBox();
  if (!box) {
    throw new Error("The map has no box");
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.getByRole("button", { name: "New area" }).click();
  for (const [dx, dy] of [
    [-30, -30],
    [30, -30],
    [30, 30],
  ] as const) {
    await page.mouse.click(x + dx, y + dy);
  }
  await page.keyboard.press("Enter");

  await page.getByRole("link", { name: /^Playground/ }).click();
  await mapLoaded(page);
  const mine = page.getByRole("switch", { name: /^My areas/ });
  await expect(mine).toBeEnabled();
  await expect(page.getByText("1 area from the")).toBeVisible();
  await mine.check();
  await expect(mine).toBeChecked();
});

test("the playground imports areas from JSON and shows them", async ({ page }) => {
  await page.goto("/playground");
  await mapLoaded(page);
  await expect(page.getByRole("switch", { name: /^My areas/ })).toBeDisabled();

  // Inland Lapland, away from the playground's city pins
  const area = {
    id: "lapland",
    label: "Lapland test area",
    fill: "rgba(214, 51, 108, 0.35)",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [15.2, 64.6],
          [15.8, 64.6],
          [15.8, 64.9],
          [15.2, 64.9],
          [15.2, 64.6],
        ],
      ],
    },
  };
  await page.getByRole("button", { name: "Import areas" }).click();
  const dialog = page.getByRole("dialog", { name: "Import areas" });
  await dialog.getByRole("textbox", { name: "Areas to import" }).fill(JSON.stringify([area]));
  await dialog.getByRole("button", { name: "Add areas" }).click();
  await expect(page.getByText("1 imported")).toBeVisible();

  // The map fits the imported area, so its middle is under the middle of the map
  const box = await page.getByRole("application").boundingBox();
  if (!box) {
    throw new Error("The map has no box");
  }
  await expect
    .poll(
      async () => {
        await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        return page.getByText("Lapland test area").count();
      },
      { timeout: 5_000 },
    )
    .toBe(1);

  await page.getByRole("button", { name: "Clear", exact: true }).first().click();
  await expect(page.getByText("1 imported")).toHaveCount(0);
});

test("the area selection switch works with multiple selection only", async ({ page }) => {
  await page.goto("/playground");
  await mapLoaded(page);
  await page.getByRole("tab", { name: "Pins" }).click();
  const byArea = page.getByRole("switch", { name: /^Click an area to select its pins/ });
  await byArea.check();
  await expect(byArea).toBeChecked();
  await page.getByText("Single", { exact: true }).click();
  await expect(byArea).toBeDisabled();
  await expect(byArea).not.toBeChecked();
});

test("the playground settings are still set after a reload", async ({ page }) => {
  await page.goto("/playground");
  await mapLoaded(page);
  await page.getByRole("switch", { name: "Roads", exact: true }).uncheck();
  await page.getByRole("switch", { name: "Counties", exact: true }).check();
  await page.getByRole("tab", { name: "Pins" }).click();
  await page.getByRole("switch", { name: "Cluster close pins", exact: true }).check();
  await page.getByText("Single", { exact: true }).click();

  await page.reload();
  await mapLoaded(page);
  await expect(page.getByRole("switch", { name: "Roads", exact: true })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Place names", exact: true })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Counties", exact: true })).toBeChecked();
  await page.getByRole("tab", { name: "Pins" }).click();
  await expect(page.getByRole("switch", { name: "Cluster close pins", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Single" })).toBeChecked();
});
