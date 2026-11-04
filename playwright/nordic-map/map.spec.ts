import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";

/** A demo block on a docs page, once its map has left the loader */
async function demo(page: Page, path: string, file: string): Promise<Locator> {
  await page.goto(path);
  const block = page.locator(`[data-demo="${file}"]`);
  await block.scrollIntoViewIfNeeded();
  await expect(block.getByRole("application")).toBeVisible();
  await expect(block.getByRole("status", { name: "Loading map" })).toHaveCount(0, { timeout: 15_000 });
  return block;
}

test("the map draws its cells on the canvas", async ({ page }) => {
  const cell = page.waitForResponse((response) => /cells\/0-0-0\.json/.test(response.url()) && response.ok());
  const block = await demo(page, "/", "getting-started/FirstMap.tsx");
  await cell;
  // Sea, land and roads: a drawn map has many colors, an empty canvas one
  const colors = await block.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    const { data } = context?.getImageData(0, 0, canvas.width, canvas.height) ?? { data: [] };
    const seen = new Set<number>();
    for (let index = 0; index < data.length; index += 4 * 97) {
      seen.add((data[index] << 16) | (data[index + 1] << 8) | data[index + 2]);
    }
    return seen.size;
  });
  expect(colors).toBeGreaterThan(10);
});

test("a drag selects the pins in its box, and a click on the empty sea clears them", async ({ page }) => {
  const block = await demo(page, "/docs/clusters", "clusters/Clusters.tsx");
  const map = block.getByRole("application");
  const box = await map.boundingBox();
  if (!box) {
    throw new Error("The map has no box");
  }
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, { steps: 5 });
  await page.mouse.up();
  await expect(block.getByText("2000 stores selected")).toBeVisible();

  // The top left corner is the sea of Norway's coast
  await page.mouse.click(box.x + 8, box.y + 8);
  await expect(block.getByText("0 stores selected")).toBeVisible();
});

test("Enter on a cluster zooms in on its pins", async ({ page }) => {
  const block = await demo(page, "/docs/clusters", "clusters/Clusters.tsx");
  const zoomOut = block.getByRole("button", { name: "Zoom out" });
  await expect(zoomOut).toBeDisabled();
  await block.getByRole("button", { name: /^\d+ pins$/ }).first().focus();
  await page.keyboard.press("Enter");
  await expect(zoomOut).toBeEnabled();
});

test("Tab reaches the pins, and Space selects one", async ({ page }) => {
  const block = await demo(page, "/docs/selection", "selection/SingleSelection.tsx");
  await block.getByRole("application").focus();
  await page.keyboard.press("Tab");
  const pin = page.locator(":focus");
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Space");
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await expect(block.getByText(/inhabitants$/)).toBeVisible();
});

test("a click on a county reports it", async ({ page }) => {
  const counties = page.waitForResponse((response) => /sweden-counties\.json/.test(response.url()) && response.ok());
  const block = await demo(page, "/docs/areas", "areas/CountyChoropleth.tsx");
  await counties;
  const box = await block.getByRole("application").boundingBox();
  if (!box) {
    throw new Error("The map has no box");
  }
  // The middle of the view at zoom 1 is inland Sweden
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(block.getByText(/län: .* inhabitants$/)).toBeVisible();
});

test("flyTo moves the camera", async ({ page }) => {
  const block = await demo(page, "/docs/camera", "camera/MoveTheMap.tsx");
  await block.getByRole("button", { name: "Fly to Stockholm" }).click();
  await expect(block.getByText(/^Zoom 12\.0×, center 59\.33° N 18\.07° E$/)).toBeVisible();
});

test("a click on a county selects its cities, and Shift + click adds and removes", async ({ page }) => {
  const counties = page.waitForResponse((response) => /sweden-counties\.json/.test(response.url()) && response.ok());
  const block = await demo(page, "/docs/selection", "selection/SelectByCounty.tsx");
  await counties;
  const box = await block.getByRole("application").boundingBox();
  if (!box) {
    throw new Error("The map has no box");
  }
  const status = block.getByText(/^(\d+) selected: |^No cities selected$/);
  const count = async () => {
    const text = (await status.textContent()) ?? "";
    return Number(/^(\d+) selected/.exec(text)?.[1] ?? 0);
  };
  const x = box.x + box.width / 2;

  // Sweden runs top to bottom through the middle of the view at zoom 1. Some counties have no city of the list.
  let first = 0;
  for (const share of [0.3, 0.4, 0.5, 0.6]) {
    await page.mouse.click(x, box.y + box.height * share);
    first = await count();
    if (first > 0) {
      break;
    }
  }
  expect(first).toBeGreaterThan(0);

  // Southern Sweden, away from the first county. A county without a city of the list adds nothing.
  await page.keyboard.down("Shift");
  let added: { x: number; y: number } | null = null;
  for (const [dx, dy] of [
    [-0.04, 0.9],
    [-0.08, 0.82],
    [-0.02, 0.78],
    [-0.1, 0.74],
  ] as const) {
    const point = { x: x + box.width * dx, y: box.y + box.height * dy };
    await page.mouse.click(point.x, point.y);
    if ((await count()) > first) {
      added = point;
      break;
    }
  }
  expect(added).not.toBeNull();
  // Its cities are all selected now, so a second Shift + click removes them
  if (added) {
    await page.mouse.click(added.x, added.y);
  }
  await page.keyboard.up("Shift");
  await expect.poll(count).toBe(first);
});
