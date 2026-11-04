import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";

/** A fingerprint of the canvas: the pixel colors, sampled */
async function canvasHash(canvas: Locator): Promise<string> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    const { data } = context?.getImageData(0, 0, element.width, element.height) ?? { data: new Uint8ClampedArray() };
    let hash = 0;
    for (let index = 0; index < data.length; index += 4 * 7) {
      hash = (hash * 31 + (data[index] ?? 0) + (data[index + 1] ?? 0) * 3 + (data[index + 2] ?? 0) * 7) | 0;
    }
    return String(hash);
  });
}

async function firstMap(page: Page): Promise<Locator> {
  await page.goto("/");
  const block = page.locator('[data-demo="getting-started/FirstMap.tsx"]');
  await expect(block.getByRole("status", { name: "Loading map" })).toHaveCount(0, { timeout: 15_000 });
  return block;
}

test("turning off Places in the navigation changes the demo map, and stays off after a reload", async ({ page }) => {
  const block = await firstMap(page);
  const canvas = block.locator("canvas");
  const panel = page.locator("[data-demo-map-panel]");
  const places = panel.getByRole("switch", { name: "Places", exact: true });
  await expect(places).toBeChecked();
  const before = await canvasHash(canvas);

  await places.uncheck();
  await expect.poll(() => canvasHash(canvas)).not.toBe(before);

  await page.reload();
  await expect(block.getByRole("status", { name: "Loading map" })).toHaveCount(0, { timeout: 15_000 });
  await expect(panel.getByRole("switch", { name: "Places", exact: true })).not.toBeChecked();
});

test("the panel is on the docs pages only, and the playground keeps its own switches", async ({ page }) => {
  await firstMap(page);
  const panel = page.locator("[data-demo-map-panel]");
  await panel.getByRole("switch", { name: "Roads", exact: true }).uncheck();
  // Road signs show only where roads show, so their switch is off and disabled
  await expect(panel.getByRole("switch", { name: "Road signs", exact: true })).toBeDisabled();

  await page.getByRole("link", { name: /^Playground/ }).click();
  await expect(page.getByRole("application")).toBeVisible();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Roads", exact: true })).toBeChecked();
});
