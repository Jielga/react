import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("a shift-click selects the block between two cells", async ({
  page,
}) => {
  // The demo starts in range mode.
  const grid = await openDemoGrid(page, {
    route: "/docs/cell-selection",
    file: "cells/CellSelection.tsx",
  });
  await expect(grid.root.getByRole("grid")).toBeVisible();
  const corner = grid.cell({ rowId: "2", columnId: "firstName" });
  await expect(corner).toHaveRole("gridcell");

  await corner.click();
  await grid
    .cell({ rowId: "4", columnId: "department" })
    .click({ modifiers: ["Shift"] });

  for (const rowId of ["2", "3", "4"]) {
    for (const columnId of ["firstName", "lastName", "department"]) {
      await expect(grid.cell({ rowId, columnId })).toHaveAttribute(
        "data-selected",
        "true",
      );
    }
  }
  for (const outside of [
    { rowId: "1", columnId: "firstName" },
    { rowId: "5", columnId: "lastName" },
    { rowId: "3", columnId: "salary" },
  ]) {
    await expect(grid.cell(outside)).not.toHaveAttribute("data-selected");
  }
});

test("Tab out of the body and back returns to a cell scrolled far down", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, {
    route: "/docs/cell-selection",
    file: "cells/CellSelection.tsx",
  });
  await grid.cell({ rowId: "2", columnId: "firstName" }).click();
  // The last cell of the last row, far below the first screenful.
  await page.keyboard.press("Control+End");
  const last = grid.cell({ rowId: "200", columnId: "open" });
  await expect(last).toBeFocused();

  // Out past the trailing edge and back in.
  await page.keyboard.press("Tab");
  await expect(last).not.toBeFocused();
  await page.keyboard.press("Shift+Tab");
  // An arrow key moving the cursor proves the focus stayed in the body.
  await page.keyboard.press("ArrowUp");
  const above = grid.cell({ rowId: "199", columnId: "open" });
  await expect(above).toBeFocused();

  // Out past the leading edge and back in.
  await page.keyboard.press("Shift+Tab");
  await expect(above).not.toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowDown");
  await expect(last).toBeFocused();
});
