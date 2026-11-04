import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("the pager moves pages and changes the page size", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/pagination",
    file: "data/Pagination.tsx",
  });
  const range = grid.part("page-range");
  const firstRow = grid.part("row").first();
  await grid.expectRowCount(25);
  await expect(firstRow).toHaveAttribute("data-row-id", "1");
  const firstRange = await range.textContent();

  await grid.part("page-next").click();
  await expect(range).not.toHaveText(firstRange ?? "");
  await expect(firstRow).toHaveAttribute("data-row-id", "26");

  await grid.chooseOption({ select: grid.part("page-size"), value: "50" });
  await grid.expectRowCount(50);
});
