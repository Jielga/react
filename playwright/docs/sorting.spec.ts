import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("a header sort toggles ascending then descending", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/sorting",
    file: "columns/Sorting.tsx",
  });
  const header = grid.part("header", { columnId: "lastName" });
  const firstLastName = grid
    .part("row")
    .first()
    .locator('[data-column-id="lastName"]');

  await grid.sortBy("lastName");
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(firstLastName).toHaveText("Gustafsson");

  await grid.sortBy("lastName");
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(firstLastName).toHaveText("Persson");
});
