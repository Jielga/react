import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("scrolling to the end loads the next page", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/server-side",
    file: "data/InfiniteScroll.tsx",
  });
  // The demo loads 100 rows a page, the first one on mount.
  await grid.expectRowCount(100);
  await grid.expectSettled();
  const before = Number(await grid.grid.getAttribute("data-dg-row-count"));

  await grid.root
    .locator("[data-dg-scroll-container]")
    .evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

  await expect
    .poll(async () => {
      return Number(await grid.grid.getAttribute("data-dg-row-count"));
    })
    .toBeGreaterThan(before);
  await grid.expectSettled();
});
