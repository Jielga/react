import { openDemoGrid } from "../support/docsSite";
import { test } from "../support/test";

test("quick search narrows the rows and clearing restores them", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/quick-search",
    file: "data/QuickSearch.tsx",
  });
  await grid.expectRowCount(200);

  // First names cycle every 20 rows, so one name is 10 of the 200.
  await grid.search("Cecilia");
  await grid.expectRowCount(10);

  await grid.part("search-clear").click();
  await grid.expectRowCount(200);
});
