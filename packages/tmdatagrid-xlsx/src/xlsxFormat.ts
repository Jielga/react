import ExcelJS from "exceljs";
import type {
  TMDataGridExportData,
  TMDataGridExportFormat,
  TMDataGridExportWriteOptions,
} from "@jielga/tmdatagrid";

/**
 * How wide a column may get from `autoWidth`. A long free-text cell would
 * otherwise push a column past the width of the window, and a column nobody
 * can see past is worse than one that clips.
 */
const MAX_COLUMN_WIDTH = 60;

/** Narrow columns still need room for their header and the filter arrow. */
const MIN_COLUMN_WIDTH = 10;

/** Excel measures a column in characters, and a cell needs a little padding. */
const WIDTH_PADDING = 2;

const MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** A date at midnight is a date; anything else is a moment in time. */
function isMidnight(value: Date): boolean {
  return (
    value.getHours() === 0 &&
    value.getMinutes() === 0 &&
    value.getSeconds() === 0 &&
    value.getMilliseconds() === 0
  );
}

function dateNumberFormat(value: Date): string {
  return isMidnight(value) ? "yyyy-mm-dd" : "yyyy-mm-dd hh:mm";
}

/** The date as its number format renders it, for a width and for a joined array. */
function dateText(value: Date): string {
  const text = value.toLocaleString("sv-SE");
  return isMidnight(value) ? text.slice(0, 10) : text.slice(0, 16);
}

/**
 * A value as text, for the cells a spreadsheet has no type for and for the
 * width measurement.
 *
 * Deliberately not `formatExportValue` from the grid: that one writes a
 * decimal comma and an `sv-SE` date, both of which would be wrong here. A
 * typed cell carries the value itself and Excel renders it in the reader's own
 * locale, so only the untypable values reach this.
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : dateText(value);
  }
  // A multiSelect cell holds an array of values; a spreadsheet cell holds one
  // string, so the elements are joined the way they read on screen.
  if (Array.isArray(value)) {
    return value.map((entry) => cellText(entry)).join(", ");
  }
  // An object in a cell is a shape the addon cannot know. JSON at least keeps
  // what was there, where `String(value)` would write "[object Object]".
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

/**
 * What goes into the worksheet cell: a number, a date, a boolean or a string.
 *
 * `null` for everything empty, which is what exceljs writes as a blank cell -
 * an empty string would be a cell holding text of length zero, and a formula
 * counting it would count it.
 */
function cellValue(value: unknown): number | Date | boolean | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "boolean") return value;
  return cellText(value);
}

export type TMDataGridXlsxFormatOptions = {
  /** Worksheet name. Defaults to `"Sheet1"`. */
  sheetName?: string;
  /** Column widths from the longest text in each column, capped at 60 characters. Defaults to `true`. */
  autoWidth?: boolean;
};

/**
 * A real Excel workbook rather than a CSV that Excel can open.
 *
 * That is the whole reason the format exists: a typed cell needs no separator,
 * no decimal mark and no BOM to survive the trip, so nothing depends on the
 * reader's locale. Numbers arrive as numbers, dates as dates with a number
 * format, booleans as booleans, and a text cell can hold a semicolon or a
 * newline without ending the row.
 *
 * `exceljs` is why this is a separate package: it is a large dependency, and a
 * grid that exports CSV should not carry a spreadsheet writer.
 */
export function xlsxFormat({
  sheetName = "Sheet1",
  autoWidth = true,
}: TMDataGridXlsxFormatOptions = {}): TMDataGridExportFormat {
  return {
    id: "xlsx",
    extension: "xlsx",
    mimeType: MIME_TYPE,
    write: async (
      data: TMDataGridExportData,
      { includeHeaders }: TMDataGridExportWriteOptions,
    ): Promise<Blob> => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(sheetName);

      // The longest text seen per column, header included, for `autoWidth`.
      const widths = data.headers.map((header) =>
        includeHeaders ? header.length : 0,
      );

      if (includeHeaders) {
        const headerRow = sheet.addRow(data.headers);
        headerRow.font = { bold: true };
      }

      for (const row of data.rows) {
        const added = sheet.addRow(row.map((value) => cellValue(value)));
        row.forEach((value, index) => {
          if (value instanceof Date && !Number.isNaN(value.getTime())) {
            added.getCell(index + 1).numFmt = dateNumberFormat(value);
          }
          const length = cellText(value).length;
          if (length > (widths[index] ?? 0)) widths[index] = length;
        });
      }

      if (autoWidth) {
        widths.forEach((width, index) => {
          sheet.getColumn(index + 1).width = Math.min(
            MAX_COLUMN_WIDTH,
            Math.max(MIN_COLUMN_WIDTH, width + WIDTH_PADDING),
          );
        });
      }

      return new Blob([await workbook.xlsx.writeBuffer()], { type: MIME_TYPE });
    },
  };
}
