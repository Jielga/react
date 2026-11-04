import type { Locator } from "@playwright/test";
import { DataGrid } from "../support/DataGrid";
import { openDemo } from "../support/docsSite";
import { expect, test } from "../support/test";

const route = "/docs/typed-deep-links";

const gridIn = (block: Locator) => new DataGrid(block.locator("[data-dg-root]"));

/** The demo router's address, as its address bar shows it. */
const addressOf = (block: Locator) => block.locator("[data-address]");

test("a typed link opens the grid on its filters and sort, through the router", async ({
  page,
}) => {
  const block = await openDemo(page, { route, file: "recipes/RouterDeepLinks.tsx" });
  await gridIn(block).expectRowCount(200);

  await block.locator('[data-link="home"]').click();
  // Departments cycle through eight values, so two of them are 50 of the 200.
  await block.locator('[data-link="departments"]').click();
  const grid = gridIn(block);
  await grid.expectRowCount(50);
  await expect(addressOf(block)).toContainText("/employees?emp=");

  await block.locator('[data-link="home"]').click();
  await block.locator('[data-link="salary"]').click();
  await expect(grid.part("header", { columnId: "salary" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );

  // The grid writes back through the router: the demo's address follows,
  // the docs page's own URL does not.
  await grid.search("anna");
  await expect(addressOf(block)).toContainText("globalFilter");
  expect(new URL(page.url()).search).toBe("");
});

test("each link keeps its own state when the grid is left and reopened", async ({
  page,
}) => {
  const block = await openDemo(page, { route, file: "recipes/RouterDeepLinks.tsx" });
  await block.locator('[data-link="home"]').click();
  await block.locator('[data-link="departments"]').click();
  await gridIn(block).expectRowCount(50);

  await block.locator('[data-link="home"]').click();
  await block.locator('[data-link="none"]').click();
  await gridIn(block).expectRowCount(200);
});

test("a JSURL2 router writes the param without percent escapes", async ({ page }) => {
  const block = await openDemo(page, { route, file: "recipes/ReadableSearch.tsx" });
  await block.locator('[data-link="home"]').click();
  await block.locator('[data-link="departments"]').click();
  await gridIn(block).expectRowCount(50);

  const address = (await addressOf(block).textContent()) ?? "";
  expect(address).toContain("emp=(columnFilters~");
  expect(address).not.toContain("%");

  // The grid's own write goes through the same serializer.
  await gridIn(block).search("anna");
  await expect(addressOf(block)).toContainText("globalFilter~anna");
  await expect(addressOf(block)).not.toContainText("%");
});

test("a plain link opens the grid from the browser's URL", async ({ page }) => {
  const block = await openDemo(page, { route, file: "recipes/PlainLinks.tsx" });
  await gridIn(block).expectRowCount(200);

  await block.locator('[data-link="design"]').click();
  await page.waitForURL(/[?&]emp=/);
  const opened = await openDemo(page, {
    route: page.url(),
    file: "recipes/PlainLinks.tsx",
  });
  const grid = gridIn(opened);
  await grid.expectRowCount(25);
  await expect(grid.part("header", { columnId: "fullName" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});
