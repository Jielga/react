import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderGrid, testRows, type TestRow } from "../../test/gridHarness";
import { captureDownloads } from "../../test/downloadStub";
import { createTMDataGridColumnHelper } from "../useTMDataGrid";
import {
  formatExportValue,
  toClipboardText,
  buildExportData,
  countSelectedExportRows,
  csvExcelFormat,
  csvFormat,
  DEFAULT_EXPORT_OPTIONS,
  exportGrid,
  getExportableColumns,
  guardFormula,
  jsonFormat,
  resolveExportOptions,
  tsvFormat,
  type TMDataGridExportContext,
  type TMDataGridExportData,
} from "./export";

const nordic = { decimalComma: true };

describe("formatExportValue", () => {
  it("writes numbers with the decimal mark the separator implies", () => {
    expect(formatExportValue(12.5, nordic)).toBe("12,5");
    expect(formatExportValue(12.5, { decimalComma: false })).toBe("12.5");
    expect(formatExportValue(42, nordic)).toBe("42");
  });

  it("writes an empty cell for nothing, and for a number that is not one", () => {
    expect(formatExportValue(null, nordic)).toBe("");
    expect(formatExportValue(undefined, nordic)).toBe("");
    expect(formatExportValue(Number.NaN, nordic)).toBe("");
    expect(formatExportValue(Number.POSITIVE_INFINITY, nordic)).toBe("");
  });

  it("writes dates in the ISO-shaped Nordic form Excel parses", () => {
    expect(formatExportValue(new Date(2026, 6, 31), nordic)).toMatch(
      /^2026-07-31/,
    );
    expect(formatExportValue(new Date(Number.NaN), nordic)).toBe("");
  });

  it("keeps what an object held rather than stringifying it to nothing", () => {
    expect(formatExportValue({ a: 1 }, nordic)).toBe('{"a":1}');
    expect(formatExportValue(true, nordic)).toBe("true");
  });

  it("joins a multiSelect cell's array the way it reads on screen", () => {
    expect(formatExportValue(["Paid", "Pending"], nordic)).toBe("Paid, Pending");
    // Elements go through the same formatting as scalar cells.
    expect(formatExportValue([1.5, 2], nordic)).toBe("1,5, 2");
    expect(formatExportValue([], nordic)).toBe("");
  });
});

describe("toClipboardText", () => {
  it("separates cells with tabs and rows with CRLF", () => {
    expect(
      toClipboardText([
        ["Anna", "34"],
        ["Erik", "41"],
      ]),
    ).toBe("Anna\t34\r\nErik\t41");
  });

  it("quotes a value that would otherwise end the cell early", () => {
    expect(toClipboardText([["a\tb", 'say "hi"', "one\ntwo"]])).toBe(
      '"a\tb"\t"say ""hi"""\t"one\ntwo"',
    );
  });
});

const sample: TMDataGridExportData = {
  columnIds: ["name", "amount", "note"],
  headers: ["Name", "Amount", "Note"],
  rows: [
    ["Anna", 12.5, "=SUM(A1)"],
    ["Erik", -5, null],
  ],
};

describe("buildExportData", () => {
  it("collects raw values, labels and ids for every filtered row", () => {
    const { result } = renderGrid();

    const data = buildExportData({ table: result.current.table });

    expect(data.columnIds).toEqual(["id", "name", "age", "city"]);
    expect(data.headers).toEqual(["ID", "Name", "Age", "City"]);
    expect(data.rows).toHaveLength(testRows.length);
    expect(data.rows[0]).toEqual([1, "Anna", 20, "Stockholm"]);
  });

  it("takes all pages of a paginated grid, not the one on screen", () => {
    const { result } = renderGrid({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    });

    const data = buildExportData({ table: result.current.table });

    expect(data.rows).toHaveLength(testRows.length);
  });

  it("takes the selected rows in grid order, whatever order they were ticked in", () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.setRowSelection({ "3": true, "1": true });
      result.current.table.setSorting([{ id: "id", desc: true }]);
    });

    const data = buildExportData({
      table: result.current.table,
      rows: "selected",
    });

    expect(data.rows.map((row) => row[0])).toEqual([3, 1]);
  });

  it("drops a column under enableExport: false and writes exportValue instead of the value", () => {
    const helper = createTMDataGridColumnHelper<TestRow>();
    const columns = helper.columns([
      helper.accessor("id", { header: "ID" }),
      helper.accessor("name", {
        header: "Name",
        meta: { exportValue: ({ value }) => String(value).toUpperCase() },
      }),
      helper.accessor("city", { header: "City", meta: { enableExport: false } }),
    ]);
    const { result } = renderGrid({ columns });

    const data = buildExportData({ table: result.current.table });

    expect(data.columnIds).toEqual(["id", "name"]);
    expect(data.rows[0]).toEqual([1, "ANNA"]);
  });

  it("counts the ticked rows of the view rather than the selection map", () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.setRowSelection({ "1": true, "2": true });
      result.current.table.setColumnFilters([
        { id: "name", value: { operator: "equals", value: "Anna" } },
      ]);
    });

    // Row 2 is Erik: filtered out, still in the map, not in the export.
    expect(countSelectedExportRows(result.current.table)).toBe(1);
    expect(
      buildExportData({ table: result.current.table, rows: "selected" }).rows,
    ).toHaveLength(1);
  });
});

describe("the text formats", () => {
  it("csvExcelFormat writes the Excel dialect and guards formulas", async () => {
    const text = await csvExcelFormat().write(sample, { includeHeaders: true });

    expect(text).toBe(
      "﻿sep=;\r\nName;Amount;Note\r\nAnna;12,5;'=SUM(A1)\r\nErik;-5;\r\n",
    );
  });

  it("csvExcelFormat names its separator and quotes a value holding it", async () => {
    const data: TMDataGridExportData = {
      columnIds: ["name", "city"],
      headers: ["Name", "City"],
      rows: [["Lindqvist, Anna", "Malmö"]],
    };
    const text = await csvExcelFormat({ separator: "," }).write(data, {
      includeHeaders: false,
    });

    expect(text).toBe('﻿sep=,\r\n"Lindqvist, Anna",Malmö\r\n');
  });

  it("csvFormat writes RFC 4180 with a dot decimal and no directive", async () => {
    const text = await csvFormat().write(sample, { includeHeaders: false });

    expect(text).toBe("﻿Anna,12.5,'=SUM(A1)\r\nErik,-5,\r\n");
  });

  it("tsvFormat writes tabs", async () => {
    const text = await tsvFormat().write(sample, { includeHeaders: true });

    expect(text).toBe(
      "﻿Name\tAmount\tNote\r\nAnna\t12,5\t'=SUM(A1)\r\nErik\t-5\t\r\n",
    );
  });

  it("escapeFormulas: false writes the text as it is", async () => {
    const text = await csvFormat({ escapeFormulas: false }).write(sample, {
      includeHeaders: false,
    });

    expect(text).toContain(",=SUM(A1)\r\n");
  });

  it("jsonFormat keeps numbers as numbers and dates as ISO strings", async () => {
    const when = new Date(Date.UTC(2026, 6, 31, 12));
    const text = await jsonFormat().write(
      {
        columnIds: ["n", "w", "x"],
        headers: ["N", "When", "X"],
        rows: [[1.5, when, undefined]],
      },
      { includeHeaders: true },
    );

    expect(JSON.parse(String(text))).toEqual([
      { N: 1.5, When: "2026-07-31T12:00:00.000Z", X: null },
    ]);
  });
});

describe("guardFormula", () => {
  it("prefixes text a spreadsheet would run", () => {
    expect(guardFormula("=1+1")).toBe("'=1+1");
    expect(guardFormula("@cmd")).toBe("'@cmd");
    expect(guardFormula("-")).toBe("'-");
    expect(guardFormula("+46 70 123 45 67")).toBe("'+46 70 123 45 67");
  });

  it("leaves numbers and plain text alone", () => {
    expect(guardFormula("-5")).toBe("-5");
    expect(guardFormula("+4670123")).toBe("+4670123");
    expect(guardFormula("hello")).toBe("hello");
    expect(guardFormula("")).toBe("");
  });
});

describe("toClipboardText over export data", () => {
  it("writes values only, with the decimal mark it is given", () => {
    expect(toClipboardText(sample, { decimalComma: false })).toBe(
      "Anna\t12.5\t'=SUM(A1)\r\nErik\t-5\t",
    );
  });
});

describe("exportGrid", () => {
  it("downloads the grid under the format's extension", async () => {
    const downloads = captureDownloads();
    const { result } = renderGrid();

    await exportGrid({
      table: result.current.table,
      options: { fileName: "people", format: csvFormat() },
    });

    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.fileName).toBe("people.csv");
    expect(await downloads[0]?.text()).toContain(
      "﻿ID,Name,Age,City\r\n1,Anna,20,Stockholm\r\n",
    );
  });

  it("downloads nothing when no column can be exported", async () => {
    const downloads = captureDownloads();
    const helper = createTMDataGridColumnHelper<TestRow>();
    const { result } = renderGrid({
      columns: helper.columns([
        helper.accessor("id", { header: "ID", meta: { enableExport: false } }),
      ]),
    });

    await exportGrid({ table: result.current.table });

    expect(downloads).toHaveLength(0);
  });

  it("runs the grid's mapExportData", async () => {
    const downloads = captureDownloads();
    const contexts: Array<TMDataGridExportContext> = [];
    const { result } = renderGrid({
      mapExportData: (data, context) => {
        contexts.push(context);
        return { ...data, rows: data.rows.slice(0, 1) };
      },
    });

    await exportGrid({
      table: result.current.table,
      options: { format: csvFormat() },
    });
    await exportGrid({
      table: result.current.table,
      rows: result.current.table.getRowModel().rows.slice(1, 3),
      options: { format: csvFormat() },
    });

    expect(await downloads[0]?.text()).toBe(
      "﻿ID,Name,Age,City\r\n1,Anna,20,Stockholm\r\n",
    );
    expect(contexts).toEqual([
      { target: "file", rows: "all" },
      { target: "file", rows: "list" },
    ]);
  });

  it("downloads nothing when mapExportData returns null", async () => {
    const downloads = captureDownloads();
    const { result } = renderGrid({ mapExportData: () => null });

    await exportGrid({ table: result.current.table });

    expect(downloads).toHaveLength(0);
  });

  it("still downloads under enableDownload: false", async () => {
    const downloads = captureDownloads();
    const { result } = renderGrid({ enableDownload: false });

    await exportGrid({ table: result.current.table });

    expect(downloads).toHaveLength(1);
  });
});

describe("resolveExportOptions", () => {
  it("folds overrides over the defaults, skipping undefined fields", () => {
    const format = jsonFormat();

    const resolved = resolveExportOptions(
      { fileName: "a" },
      { fileName: undefined, format },
      undefined,
    );

    expect(resolved).toEqual({
      format,
      fileName: "a",
      includeHeaders: true,
      columns: "visible",
    });
    expect(resolveExportOptions()).toEqual(DEFAULT_EXPORT_OPTIONS);
  });
});

describe("column selection", () => {
  it('takes hidden columns under "all" and leaves them out under "visible"', () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.getColumn("city")?.toggleVisibility(false);
    });

    expect(buildExportData({ table: result.current.table }).columnIds).toEqual([
      "id",
      "name",
      "age",
    ]);
    expect(
      buildExportData({ table: result.current.table, columns: "all" }).columnIds,
    ).toEqual(["id", "name", "age", "city"]);
  });

  it("takes a list of ids in render order, unknown ones ignored", () => {
    const { result } = renderGrid();

    const data = buildExportData({
      table: result.current.table,
      columns: ["city", "nope", "id"],
    });

    expect(data.columnIds).toEqual(["id", "city"]);
    expect(data.rows[0]).toEqual([1, "Stockholm"]);
  });

  it("lists every exportable column for the picker, lanes left out", () => {
    const { result } = renderGrid();

    expect(
      getExportableColumns(result.current.table).map((column) => column.id),
    ).toEqual(["id", "name", "age", "city"]);
  });
});

describe("a grouped grid", () => {
  it("writes the grouped column and never the tree lane", () => {
    const { result } = renderGrid();
    act(() => {
      result.current.table.setGrouping(["city"]);
    });

    const data = buildExportData({ table: result.current.table });

    // The tree lane is a display column with nothing to read; the city it
    // shows is the city column's, which `groupedColumnMode: "remove"` only
    // took off the screen.
    expect(data.columnIds).not.toContain("__group__");
    expect(data.columnIds).toContain("city");
    expect(data.rows).toHaveLength(testRows.length);
  });
});
