import { expect, test } from "../support/test";

test("copies a selected range as tab-separated rows", async ({
  mount,
  page,
}) => {
  const component = await mount("Grid/CellSelection");
  const cell = (rowId: string, columnId: string) =>
    component.locator(
      `[role="gridcell"][data-row-id="${rowId}"][data-column-id="${columnId}"]`,
    );

  await cell("2", "name").click();
  await cell("4", "age").click({ modifiers: ["Shift"] });
  await page.keyboard.press("Control+C");

  // Values only and no header row, tab between cells and CRLF between rows -
  // the format spreadsheets put on the clipboard themselves.
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("Erik\t27\r\nMaria\t34\r\nLars\t41");
});
