import { expect, test } from "../support/test";

type ScrollToRowArgs = { rowId: string; align?: "start" | "center" | "end" };

declare global {
  interface Window {
    /** What the `Grid/Virtualized` story puts on `window`. */
    __grid: { scrollToRow: (args: ScrollToRowArgs) => boolean };
  }
}

test("mounts a window of rows and scrolls the rest into it", async ({
  mount,
  page,
}) => {
  const component = await mount("Grid/Virtualized");
  const grid = component.getByRole("table");

  await expect(grid).toHaveAttribute("data-dg-row-count", "5000");
  // The one place a count of row elements is the claim: virtualization is
  // what keeps it far below the data.
  expect(await component.locator('[data-dg-part="row"]').count()).toBeLessThan(
    200,
  );
  await expect(component.locator('[data-row-id="4500"]')).toHaveCount(0);

  const found = await page.evaluate(() =>
    window.__grid.scrollToRow({
      rowId: "4500",
      align: "center",
    }),
  );
  expect(found).toBe(true);
  await expect(
    component.locator('[data-dg-part="row"][data-row-id="4500"]'),
  ).toBeVisible();

  const unknown = await page.evaluate(() =>
    window.__grid.scrollToRow({ rowId: "no-such-row" }),
  );
  expect(unknown).toBe(false);

  await component
    .locator("[data-dg-scroll-container]")
    .evaluate((container) => {
      container.scrollTop = container.scrollHeight;
    });
  await expect(
    component.locator('[data-dg-part="row"][data-row-id="5000"]'),
  ).toBeVisible();
});
