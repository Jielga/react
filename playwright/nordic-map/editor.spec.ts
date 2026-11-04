import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";

type Box = { x: number; y: number; width: number; height: number };

/** The area editor, once its map has left the loader, and the map's box on the page */
async function editor(page: Page): Promise<{ map: Locator; box: Box }> {
  await page.goto("/editor");
  const map = page.getByRole("application", { name: "Map of Sweden" });
  await expect(map).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading map" })).toHaveCount(0, { timeout: 15_000 });
  const box = await map.boundingBox();
  if (!box) {
    throw new Error("The map has no box");
  }
  return { map, box };
}

/** Draws a square of `size` pixels around the middle of the map, which is inland Sweden at zoom 1 */
async function drawSquare({ page, box, size = 60 }: { page: Page; box: Box; size?: number }) {
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.getByRole("button", { name: "New area" }).click();
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    await page.mouse.click(x + (dx * size) / 2, y + (dy * size) / 2);
  }
  await page.keyboard.press("Enter");
}

async function exported(page: Page): Promise<unknown> {
  await page.getByRole("button", { name: "Export" }).click();
  const dialog = page.getByRole("dialog", { name: "Export areas" });
  await dialog.getByText("MapArea JSON").click();
  const text = await dialog.getByRole("textbox", { name: "Exported areas" }).inputValue();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  return JSON.parse(text);
}

test("draws an area, exports it, and undoes it", async ({ page }) => {
  const { box } = await editor(page);
  await drawSquare({ page, box });
  const panel = page.getByRole("complementary", { name: "Area editor" });
  await expect(panel.getByRole("button", { name: /Area 1/ })).toBeVisible();

  const [area] = (await exported(page)) as { id: string; geometry: { type: string; coordinates: number[][][] } }[];
  expect(area?.id).toBe("area-1");
  expect(area?.geometry.type).toBe("Polygon");
  // Four points and the closing copy of the first
  expect(area?.geometry.coordinates[0]).toHaveLength(5);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(panel.getByText("No areas yet. Start with New area.")).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(panel.getByRole("button", { name: /Area 1/ })).toBeVisible();
});

test("a dragged point moves, and the areas are still there after a reload", async ({ page }) => {
  const { box } = await editor(page);
  await drawSquare({ page, box });
  const before = (await exported(page)) as { geometry: { coordinates: number[][][] } }[];

  const vertex = page.locator('[data-editor-part="vertex"]').first();
  const handle = await vertex.boundingBox();
  if (!handle) {
    throw new Error("The point has no box");
  }
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 40, handle.y + handle.height / 2 - 30, { steps: 5 });
  await page.mouse.up();

  const after = (await exported(page)) as { geometry: { coordinates: number[][][] } }[];
  expect(after[0]?.geometry.coordinates[0]?.[0]).not.toEqual(before[0]?.geometry.coordinates[0]?.[0]);

  await page.reload();
  await expect(page.getByRole("complementary", { name: "Area editor" }).getByRole("button", { name: /Area 1/ })).toBeVisible();
  expect(await exported(page)).toEqual(after);
});

test("selected counties become one area", async ({ page }) => {
  const { box } = await editor(page);
  await page.getByText("Counties", { exact: true }).click();
  // Enabled once the counties are loaded
  const selectRegions = page.getByRole("button", { name: "Select regions" });
  await expect(selectRegions).toBeEnabled({ timeout: 15_000 });
  await selectRegions.click();
  const panel = page.getByRole("complementary", { name: "Area editor" });

  // Inland Sweden, and a point well south of it: two different counties
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await expect(panel.getByText(/^1 selected: /)).toBeVisible();
  // A second click unselects
  await page.mouse.click(x, y);
  await expect(panel.getByText("No regions selected.")).toBeVisible();
  await page.mouse.click(x, y);
  await page.mouse.click(x, y + box.height * 0.15);
  await expect(panel.getByText(/^2 selected: /)).toBeVisible();

  await panel.getByRole("button", { name: "Create area" }).click();
  await expect(panel.getByRole("button", { name: /Area 1/ })).toBeVisible();
  const [area] = (await exported(page)) as { label: string; geometry: { type: string } }[];
  expect(area?.label).toBe("Area 1");
  expect(["Polygon", "MultiPolygon"]).toContain(area?.geometry.type);
});

test("a drawn point snaps to the border while the border shows", async ({ page }) => {
  const { box } = await editor(page);
  await page.getByRole("button", { name: "New area" }).click();
  const snap = page.locator('[data-editor-part="snap"]');
  // A sweep from the Norwegian Sea to inland Sweden crosses the coast or the border with Norway
  const sweep = async () => {
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 4, y);
    for (let x = box.x + 4; x < box.x + box.width / 2; x += 3) {
      await page.mouse.move(x, y);
      if ((await snap.count()) > 0) {
        return true;
      }
    }
    return false;
  };
  await expect.poll(sweep, { timeout: 15_000 }).toBe(true);

  await page.keyboard.press("Escape");
  const panel = page.getByRole("complementary", { name: "Area editor" });
  await panel.getByRole("switch", { name: "Coast and border", exact: true }).uncheck();
  await page.getByRole("button", { name: "New area" }).click();
  expect(await sweep()).toBe(false);
});

test("an exported file imports again", async ({ page }) => {
  const { box } = await editor(page);
  await drawSquare({ page, box });
  await page.getByRole("button", { name: "Export" }).click();
  const exportDialog = page.getByRole("dialog", { name: "Export areas" });
  await exportDialog.getByText("GeoJSON").click();
  const geojson = await exportDialog.getByRole("textbox", { name: "Exported areas" }).inputValue();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Import" }).click();
  const importDialog = page.getByRole("dialog", { name: "Import areas" });
  await importDialog.getByRole("textbox", { name: "Areas to import" }).fill(geojson);
  await importDialog.getByRole("button", { name: "Add areas" }).click();
  await expect(page.getByText("Added 1 area.")).toBeVisible();
  // The id was taken, so the copy gets a number
  await expect(page.getByRole("complementary", { name: "Area editor" }).getByText("area-1-2")).toBeVisible();
});

test("place names and roads start hidden, and switch on", async ({ page }) => {
  await editor(page);
  const panel = page.getByRole("complementary", { name: "Area editor" });
  await expect(panel.getByRole("switch", { name: "Place names", exact: true })).not.toBeChecked();
  await expect(panel.getByRole("switch", { name: "Roads", exact: true })).not.toBeChecked();
  // The map shows road signs only where it shows roads
  await expect(panel.getByRole("switch", { name: "Road signs", exact: true })).toBeDisabled();
  await expect(panel.getByRole("switch", { name: "Coast and border", exact: true })).toBeChecked();

  await panel.getByRole("switch", { name: "Roads", exact: true }).check();
  await expect(panel.getByRole("switch", { name: "Roads", exact: true })).toBeChecked();
  await expect(panel.getByRole("switch", { name: "Road signs", exact: true })).toBeEnabled();
});

test("Delete removes the selected point, and then the selected area", async ({ page }) => {
  const { box } = await editor(page);
  await drawSquare({ page, box });
  const vertices = page.locator('[data-editor-part="vertex"]');
  await expect(vertices).toHaveCount(4);
  await vertices.first().click();
  await page.keyboard.press("Delete");
  await expect(vertices).toHaveCount(3);

  // No point is selected now, so Delete takes the area
  await page.keyboard.press("Delete");
  const panel = page.getByRole("complementary", { name: "Area editor" });
  await expect(panel.getByText("No areas yet. Start with New area.")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(panel.getByRole("button", { name: /Area 1/ })).toBeVisible();
});

test("the layer, region and snap settings are still set after a reload", async ({ page }) => {
  await editor(page);
  const panel = page.getByRole("complementary", { name: "Area editor" });
  await panel.getByRole("switch", { name: "Roads", exact: true }).check();
  await panel.getByRole("switch", { name: "Coast and border", exact: true }).uncheck();
  await panel.getByRole("switch", { name: /^Snap to points and edges/ }).uncheck();
  await panel.getByText("Counties", { exact: true }).click();

  await page.reload();
  await expect(panel.getByRole("switch", { name: "Roads", exact: true })).toBeChecked();
  await expect(panel.getByRole("switch", { name: "Place names", exact: true })).not.toBeChecked();
  await expect(panel.getByRole("switch", { name: "Coast and border", exact: true })).not.toBeChecked();
  await expect(panel.getByRole("switch", { name: /^Snap to points and edges/ })).not.toBeChecked();
  await expect(panel.getByRole("radio", { name: "Counties" })).toBeChecked();
});
