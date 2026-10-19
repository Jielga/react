import type { Locator } from "@playwright/test";
import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

const box = async (locator: Locator) => {
  const rect = await locator.boundingBox();
  if (rect === null) throw new Error("not rendered");
  return rect;
};

test("an open row's spanning cell is one box over the columns it covers", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/columns",
    file: "columns/SpanningCells.tsx",
  });
  // Row 2 starts open; its Name cell runs from Name's left edge to Salary's
  // right edge, and the cells in between are not rendered.
  const span = grid.cell({ rowId: "2", columnId: "name" });
  await expect(span).toHaveAttribute("aria-colspan", "4");
  await expect(grid.cell({ rowId: "2", columnId: "department" })).toHaveCount(0);

  const spanBox = await box(span);
  const firstHeader = await box(grid.part("header", { columnId: "name" }));
  const lastHeader = await box(grid.part("header", { columnId: "salary" }));
  expect(spanBox.x).toBeCloseTo(firstHeader.x, 0);
  expect(spanBox.x + spanBox.width).toBeCloseTo(
    lastHeader.x + lastHeader.width,
    0,
  );

  // A closed row keeps its cells, aligned under their own headers.
  const department = grid.cell({ rowId: "1", columnId: "department" });
  expect((await box(department)).x).toBeCloseTo(
    (await box(grid.part("header", { columnId: "department" }))).x,
    0,
  );
});

test("closing the row brings its cells back", async ({ page }) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/columns",
    file: "columns/SpanningCells.tsx",
  });
  await expect(grid.part("details", { rowId: "2" })).toBeVisible();

  await grid.part("details-toggle", { rowId: "2" }).click();

  await expect(grid.cell({ rowId: "2", columnId: "name" })).not.toHaveAttribute(
    "aria-colspan",
  );
  await expect(grid.cell({ rowId: "2", columnId: "department" })).toHaveCount(1);
  await expect(grid.part("details", { rowId: "2" })).toHaveCount(0);
});
