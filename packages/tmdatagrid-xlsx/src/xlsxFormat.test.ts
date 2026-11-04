import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { TMDataGridExportData } from "@jielga/tmdatagrid";
import { xlsxFormat } from "./xlsxFormat";

const DATA: TMDataGridExportData = {
  columnIds: ["amount", "name", "day", "moment", "active", "note", "tags"],
  headers: ["Amount", "Name", "Day", "Moment", "Active", "Note", "Tags"],
  rows: [
    [
      42.5,
      "Ada Lovelace",
      new Date(2026, 0, 2),
      new Date(2026, 0, 2, 14, 5),
      true,
      null,
      ["alpha", "beta"],
    ],
  ],
};

/** The written workbook, read back the way a spreadsheet would read the file. */
async function writeAndRead(
  format = xlsxFormat(),
  includeHeaders = true,
): Promise<ExcelJS.Workbook> {
  const blob = await format.write(DATA, { includeHeaders });
  expect(blob).toBeInstanceOf(Blob);
  const buffer = await (blob as Blob).arrayBuffer();
  return await new ExcelJS.Workbook().xlsx.load(buffer);
}

describe("xlsxFormat", () => {
  it("describes itself as the xlsx format", () => {
    const format = xlsxFormat();

    expect(format.id).toBe("xlsx");
    expect(format.extension).toBe("xlsx");
    expect(format.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(format.decimalComma).toBeUndefined();
  });

  it("writes the headers as a bold first row", async () => {
    const workbook = await writeAndRead();
    const sheet = workbook.worksheets[0];
    const header = sheet.getRow(1);

    expect(header.getCell(1).value).toBe("Amount");
    expect(header.getCell(7).value).toBe("Tags");
    expect(header.getCell(1).font?.bold).toBe(true);
  });

  it("puts the first data row in row 1 without headers", async () => {
    const workbook = await writeAndRead(xlsxFormat(), false);
    const sheet = workbook.worksheets[0];

    expect(sheet.getRow(1).getCell(2).value).toBe("Ada Lovelace");
  });

  it("writes a number as a number", async () => {
    const workbook = await writeAndRead();
    const cell = workbook.worksheets[0].getRow(2).getCell(1);

    expect(cell.value).toBe(42.5);
    expect(typeof cell.value).toBe("number");
  });

  it("writes dates as dates, dated or timed by their time part", async () => {
    const workbook = await writeAndRead();
    const row = workbook.worksheets[0].getRow(2);
    const day = row.getCell(3);
    const moment = row.getCell(4);

    expect(day.value).toBeInstanceOf(Date);
    expect(day.numFmt).toBe("yyyy-mm-dd");
    expect(moment.value).toBeInstanceOf(Date);
    expect(moment.numFmt).toBe("yyyy-mm-dd hh:mm");
  });

  it("writes a boolean as a boolean", async () => {
    const workbook = await writeAndRead();

    expect(workbook.worksheets[0].getRow(2).getCell(5).value).toBe(true);
  });

  it("leaves a null cell empty", async () => {
    const workbook = await writeAndRead();

    expect(workbook.worksheets[0].getRow(2).getCell(6).value).toBeNull();
  });

  it("joins an array into one text cell", async () => {
    const workbook = await writeAndRead();

    expect(workbook.worksheets[0].getRow(2).getCell(7).value).toBe(
      "alpha, beta",
    );
  });

  it("names the worksheet", async () => {
    const workbook = await writeAndRead(xlsxFormat({ sheetName: "Employees" }));

    expect(workbook.worksheets[0].name).toBe("Employees");
  });

  it("sizes the columns from their longest text", async () => {
    const workbook = await writeAndRead();
    const sheet = workbook.worksheets[0];

    // "Ada Lovelace" is 12 characters, plus the two of padding.
    expect(sheet.getColumn(2).width).toBe(14);
    // "Amount" is shorter than the floor, so the floor wins.
    expect(sheet.getColumn(1).width).toBe(10);
  });

  it("leaves the widths unset under autoWidth: false", async () => {
    const workbook = await writeAndRead(xlsxFormat({ autoWidth: false }));
    const sheet = workbook.worksheets[0];

    expect(sheet.getColumn(1).width).toBeUndefined();
    expect(sheet.getColumn(2).width).toBeUndefined();
  });
});
