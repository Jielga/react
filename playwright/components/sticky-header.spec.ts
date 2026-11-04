import type { Locator } from "@playwright/test";
import { expect, test } from "../support/test";

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("The element is not rendered.");
  return box;
}

function isInside(inner: Box, outer: Box): boolean {
  return (
    inner.y >= outer.y && inner.y + inner.height <= outer.y + outer.height
  );
}

test("keeps the header and the summary row on screen while the body scrolls", async ({
  mount,
}) => {
  const component = await mount("Grid/WithSummary");
  const container = component.locator("[data-dg-scroll-container]");
  const headerRow = component.locator("[data-dg-header-row]");
  const summaryRow = component.locator('[data-dg-part="summary-row"]');

  const headerBefore = await boxOf(headerRow);
  const summaryBefore = await boxOf(summaryRow);

  await container.evaluate((element) => {
    element.scrollTop = 1500;
  });
  await expect
    .poll(() => container.evaluate((element) => element.scrollTop))
    .toBe(1500);

  const containerBox = await boxOf(container);
  const headerAfter = await boxOf(headerRow);
  const summaryAfter = await boxOf(summaryRow);

  expect(headerAfter.y).toBe(headerBefore.y);
  expect(summaryAfter.y).toBe(summaryBefore.y);
  expect(isInside(headerAfter, containerBox)).toBe(true);
  expect(isInside(summaryAfter, containerBox)).toBe(true);
});
