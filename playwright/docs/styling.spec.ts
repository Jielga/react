import { DataGrid } from "../support/DataGrid";
import { openDemo } from "../support/docsSite";
import { expect, test } from "../support/test";

const fontSize = (el: HTMLElement) => parseFloat(getComputedStyle(el).fontSize);

test("the header follows the cell font size until --dg-header-font-size is set", async ({
  page,
}) => {
  const demo = await openDemo(page, {
    route: "/docs/styling",
    file: "customization/Styling.tsx",
  });
  const grid = new DataGrid(demo.locator("[data-dg-root]"));
  const header = grid.part("header", { columnId: "firstName" });
  const cell = grid.cell({ rowId: "1", columnId: "firstName" });
  await expect(cell).toBeVisible();

  expect(await header.evaluate(fontSize)).toBe(await cell.evaluate(fontSize));

  // The demo's switch sets `--dg-header-font-size` on the grid element.
  await demo.getByRole("switch", { name: "Bigger header text" }).check();
  expect(await header.evaluate(fontSize)).toBeGreaterThan(
    await cell.evaluate(fontSize),
  );
});
