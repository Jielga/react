import type { Locator } from "@playwright/test";
import { expect, test } from "../support/test";

async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("The element is not rendered.");
  return box.width;
}

test("resizes a column by dragging its separator, and autosizes it on double-click", async ({
  mount,
  page,
}) => {
  const component = await mount("Grid/Default");
  const header = component.locator(
    '[data-dg-part="header"][data-column-id="name"]',
  );
  const handle = component.locator(
    '[data-dg-part="header-resize"][data-column-id="name"]',
  );

  const before = await widthOf(header);
  const handleBox = await handle.boundingBox();
  if (handleBox === null) throw new Error("The resize handle is not rendered.");
  const startX = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 40, y);
  await page.mouse.move(startX + 80, y);
  await page.mouse.up();

  const dragged = await widthOf(header);
  expect(dragged - before).toBeGreaterThanOrEqual(78);
  expect(dragged - before).toBeLessThanOrEqual(82);

  await handle.dblclick();

  await expect.poll(() => widthOf(header)).not.toBe(dragged);
});
