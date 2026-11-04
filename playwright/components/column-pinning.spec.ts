import type { Locator } from "@playwright/test";
import { expect, test } from "../support/test";

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("The element is not rendered.");
  return box;
}

test("holds pinned columns in place while the body scrolls sideways", async ({
  mount,
}) => {
  const component = await mount("Grid/Pinned");
  const container = component.locator("[data-dg-scroll-container]");
  const header = (columnId: string) =>
    component.locator(`[data-dg-part="header"][data-column-id="${columnId}"]`);

  const idBefore = await boxOf(header("id"));
  const emailBefore = await boxOf(header("email"));

  await container.evaluate((element) => {
    element.scrollLeft = 300;
  });
  await expect
    .poll(() => container.evaluate((element) => element.scrollLeft))
    .toBe(300);

  const idAfter = await boxOf(header("id"));
  expect(idAfter.x).toBe(idBefore.x);
  expect((await boxOf(header("email"))).x).toBeLessThan(emailBefore.x);

  // The right edge of the scrollport: the container's box minus its
  // vertical scrollbar.
  const viewportRight = await container.evaluate((element) => {
    return element.getBoundingClientRect().left + element.clientLeft + element.clientWidth;
  });
  const status = await boxOf(header("status"));
  expect(status.x + status.width).toBeCloseTo(viewportRight, 0);

  const idCell = component
    .locator('[data-dg-part="row"]')
    .first()
    .locator('[data-column-id="id"]');
  expect((await boxOf(idCell)).x).toBe(idAfter.x);

  expect(
    await header("id").evaluate((element) => getComputedStyle(element).position),
  ).toBe("sticky");
});

test("keeps the generated lanes pinned, with the edge band, when column pinning is off", async ({
  mount,
}) => {
  const component = await mount("Grid/PinningOff");
  const container = component.locator("[data-dg-scroll-container]");
  // DETAILS_COLUMN_ID: the innermost generated lane, so it carries the band.
  const details = component.locator(
    '[data-dg-part="header"][data-column-id="__details__"]',
  );
  const before = await boxOf(details);

  await container.evaluate((element) => {
    element.scrollLeft = 300;
  });
  await expect
    .poll(() => container.evaluate((element) => element.scrollLeft))
    .toBe(300);

  expect((await boxOf(details)).x).toBe(before.x);
  await expect
    .poll(() =>
      details.evaluate((element) =>
        Number(getComputedStyle(element, "::after").opacity),
      ),
    )
    .toBe(1);
});
