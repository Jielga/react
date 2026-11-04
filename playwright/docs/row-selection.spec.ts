import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("a row checkbox selects its row", async ({ page }) => {
  // The demo starts in checkbox mode.
  const grid = await openDemoGrid(page, {
    route: "/docs/row-selection",
    file: "rows/SelectionModes.tsx",
  });
  const row = grid.part("row", { rowId: "2" });
  await expect(row).not.toHaveAttribute("data-selected");

  await grid.part("select-row", { rowId: "2" }).click();
  await expect(row).toHaveAttribute("data-selected", "true");

  await grid.part("select-row", { rowId: "2" }).click();
  await expect(row).not.toHaveAttribute("data-selected");
});

test("select-all selects every row and a second click clears them", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/row-selection",
    file: "rows/SelectionModes.tsx",
  });
  const rows = grid.part("row");
  const selected = grid.root.locator('[data-dg-part="row"][data-selected]');
  await expect(rows.first()).toBeVisible();

  await grid.part("select-all").click();
  // Only the rendered rows exist to check; the rest are virtualized.
  await expect(
    grid.root.locator('[data-dg-part="row"]:not([data-selected])'),
  ).toHaveCount(0);
  await expect(selected).toHaveCount(await rows.count());

  await grid.part("select-all").click();
  await expect(selected).toHaveCount(0);
});
