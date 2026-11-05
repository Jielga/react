import type { Column, Row, RowData } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";
import type { TMDataGridRangeBounds } from "./cellRange";
import { getColumnLabel, isGeneratedColumn } from "./columnUtils";
import { isRowMarkedDeleted } from "./deletedRows";

/**
 * The byte order mark Excel looks for before it will read a file as UTF-8.
 * Built from its code point rather than pasted in, because a literal BOM is
 * invisible in a source file and easily deleted by accident.
 */
const UTF8_BOM = String.fromCharCode(0xfeff);

type ErasedRow = Row<TMDataGridFeatures, TMDataGridRowData>;
type ErasedColumn = Column<TMDataGridFeatures, TMDataGridRowData, unknown>;
type ErasedTable = TMDataGridTable<TMDataGridRowData>;

/**
 * What an export writes: the exported columns in render order, their labels,
 * and one array of raw values per row.
 *
 * Raw values rather than text, so a format decides how a number, a date or an
 * array is written - JSON keeps a number a number, and a spreadsheet format
 * can write a typed cell.
 */
export type TMDataGridExportData = {
  columnIds: Array<string>;
  /** `getColumnLabel` per column: `meta.label`, a string header, or the id. */
  headers: Array<string>;
  rows: Array<Array<unknown>>;
};

export type TMDataGridExportWriteOptions = {
  /** Whether the format writes the column labels as its first row. */
  includeHeaders: boolean;
};

/**
 * A file format an export can be written in.
 *
 * The grid ships `csvExcelFormat`, `csvFormat`, `tsvFormat` and `jsonFormat`;
 * an addon package or your own code adds one by implementing this shape.
 * `write` may be async and may answer a `Blob`, which is what a binary format
 * such as xlsx needs.
 */
export type TMDataGridExportFormat = {
  /** Identifies the format, for a menu or a test. */
  id: string;
  /** File extension without the dot, appended to the file name. */
  extension: string;
  /** The `Blob` type the download is served under. */
  mimeType: string;
  /**
   * The decimal mark this format writes, when it writes text. Ctrl+C follows
   * it, so what is copied matches what is exported. Unset means the Nordic
   * default, a comma.
   */
  decimalComma?: boolean;
  write: (
    data: TMDataGridExportData,
    options: TMDataGridExportWriteOptions,
  ) => string | Blob | Promise<string | Blob>;
};

/**
 * Which columns an export takes: the visible ones, every exportable column
 * hidden or not, or a list of column ids. The generated lanes and columns
 * with `meta.enableExport: false` are never taken, whatever is asked for.
 */
export type TMDataGridExportColumns = "visible" | "all" | ReadonlyArray<string>;

/** How the grid exports: the format, the file name and whether headers go in. */
export type TMDataGridExportOptions = {
  /** Defaults to `csvExcelFormat()`. */
  format?: TMDataGridExportFormat;
  /** Without extension. Defaults to `"export"`. */
  fileName?: string;
  /** Column labels as the first row. Defaults to `true`. */
  includeHeaders?: boolean;
  /** Defaults to `"visible"`. See {@link TMDataGridExportColumns}. */
  columns?: TMDataGridExportColumns;
};

/**
 * What the column picker was opened for: which rows, and the options of the
 * item that opened it. Held in `ui.state.exportPicker` while it is open.
 */
export type TMDataGridExportPickerRequest = {
  rows: "all" | "selected";
  options: TMDataGridExportOptions;
};

/** `TMDataGridExportOptions` with every default filled in. */
export type TMDataGridExportSettings = Required<TMDataGridExportOptions>;

/**
 * The value written for a cell, in place of `row.getValue(column.id)`. See
 * `meta.exportValue`.
 */
export type TMDataGridExportValueGetter = (args: {
  value: unknown;
  row: ErasedRow;
  column: ErasedColumn;
}) => unknown;

/**
 * Which rows an export takes: every filtered and sorted row across all pages,
 * the selected ones among those, or a list of your own.
 */
export type TMDataGridExportRows<TData extends RowData> =
  "all" | "selected" | ReadonlyArray<Row<TMDataGridFeatures, TData>>;

/** Where an export goes: a downloaded file, or the clipboard (Ctrl+C and Copy). */
export type TMDataGridExportTarget = "file" | "clipboard";

/** What `mapExportData` is told about the export it receives. */
export type TMDataGridExportContext = {
  target: TMDataGridExportTarget;
  /**
   * Which rows were taken: `"range"` the cell-range selection, `"all"` every
   * filtered and sorted row, `"selected"` the selected ones among those,
   * `"list"` a list of rows passed to `exportGrid`.
   */
  rows: "range" | "all" | "selected" | "list";
};

/**
 * The `mapExportData` option: receives what an export would write and returns
 * what it writes instead, or `null` to cancel it.
 */
export type TMDataGridExportDataMapper = (
  data: TMDataGridExportData,
  context: TMDataGridExportContext,
) => TMDataGridExportData | null;

/**
 * One value as text.
 *
 * Deliberately not the rendered cell: what a cell renders is React, and often a
 * badge, a link or an icon rather than the value. The value is what a
 * spreadsheet wants, and it is the one thing every column is guaranteed to
 * have. `meta.exportValue` is where a column substitutes something else.
 */
export function formatExportValue(
  value: unknown,
  { decimalComma }: { decimalComma: boolean },
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    const text = String(value);
    return decimalComma ? text.replace(".", ",") : text;
  }
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  // A multiSelect cell holds an array of values; a spreadsheet cell holds one
  // string, so the elements are joined the way they read on screen.
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatExportValue(entry, { decimalComma }))
      .join(", ");
  }
  // `sv-SE` is ISO-shaped (2026-07-31, 2026-07-31 14:05:00), which is both the
  // Nordic form and the one Excel parses as a date rather than as text.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toLocaleString("sv-SE");
  }
  // An object in a cell is a shape the grid cannot know. JSON at least keeps
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

const FORMULA_LEADS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Keeps a spreadsheet from running a cell as a formula.
 *
 * Excel and Sheets evaluate a cell that starts with `=`, `+`, `-` or `@`, so a
 * value one user typed into the grid would run in another user's spreadsheet
 * when the file is opened. The defence is the standard one: a leading
 * apostrophe, which every spreadsheet reads as "text follows".
 *
 * Text that parses as a number is left alone - `-5` and `+4670123456` are
 * numbers to the spreadsheet too, and an apostrophe would turn them into text.
 * A phone number written with spaces (`+46 70 123 45 67`) does not parse and
 * is prefixed; `escapeFormulas: false` on the format is the way out for a grid
 * whose data is trusted.
 */
export function guardFormula(text: string): string {
  if (!FORMULA_LEADS.has(text.charAt(0))) return text;
  const trimmed = text.trim();
  if (trimmed !== "" && Number.isFinite(Number(trimmed))) return text;
  return `'${text}`;
}

type TextCellOptions = { decimalComma: boolean; escapeFormulas: boolean };

/**
 * A value as the text a delimited format writes. Numbers skip the formula
 * guard: `-1,5` does not parse as a number, but it is one, and the guard is
 * about strings that came from the data.
 */
function textCell(value: unknown, options: TextCellOptions): string {
  const text = formatExportValue(value, { decimalComma: options.decimalComma });
  if (!options.escapeFormulas || typeof value === "number") return text;
  return guardFormula(text);
}

function textRows(
  data: TMDataGridExportData,
  { includeHeaders }: TMDataGridExportWriteOptions,
  options: TextCellOptions,
): Array<Array<string>> {
  const lines: Array<Array<string>> = [];
  if (includeHeaders) {
    lines.push(
      data.headers.map((header) =>
        options.escapeFormulas ? guardFormula(header) : header,
      ),
    );
  }
  for (const row of data.rows) {
    lines.push(row.map((value) => textCell(value, options)));
  }
  return lines;
}

/**
 * Quotes a field when it holds something that would otherwise end it early.
 * Doubling the quote is how both CSV and Excel's own clipboard format escape
 * one, so the same rule serves both.
 */
function escapeField(value: string, separator: string): string {
  const needsQuotes =
    value.includes(separator) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");
  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Rows of text as lines, `separator` between fields and CRLF between rows. */
function toDelimited(lines: Array<Array<string>>, separator: string): string {
  return lines
    .map((row) =>
      row.map((value) => escapeField(value, separator)).join(separator),
    )
    .join("\r\n");
}

export type TMDataGridCsvFormatOptions = {
  /** Between fields. `csvExcelFormat` defaults to `";"`, `csvFormat` to `","`. */
  separator?: string;
  /** Write numbers as `1,5` rather than `1.5`. `csvExcelFormat` defaults to `true`, `csvFormat` to `false`. */
  decimalComma?: boolean;
  /** Prefix text that a spreadsheet would run as a formula. Defaults to `true`. See {@link guardFormula}. */
  escapeFormulas?: boolean;
};

/**
 * A CSV that opens straight into columns in Excel.
 *
 * Three things make that true, and all three are needed:
 *
 * | Part | Why |
 * | ---- | --- |
 * | `sep=;` first line | Excel's own directive - it stops guessing and uses this |
 * | UTF-8 BOM | without it Excel reads the file as ANSI, and å ä ö arrive broken |
 * | CRLF line endings | what Excel writes, and what its importer is happiest with |
 *
 * The defaults are the Nordic ones, because they are the ones that need
 * choosing: an Excel running a Swedish, Norwegian, Danish or Finnish locale
 * reads `;` as its list separator and `,` as its decimal mark, and a file
 * written the other way opens as one column of text.
 *
 * The `sep=` line is Excel's alone; Sheets and Numbers show it as a first row.
 * `csvFormat` is the one for them.
 */
export function csvExcelFormat({
  separator = ";",
  decimalComma = true,
  escapeFormulas = true,
}: TMDataGridCsvFormatOptions = {}): TMDataGridExportFormat {
  return {
    id: "csvExcel",
    extension: "csv",
    mimeType: "text/csv;charset=utf-8",
    decimalComma,
    write: (data, options) => {
      const lines = textRows(data, options, { decimalComma, escapeFormulas });
      return `${UTF8_BOM}sep=${separator}\r\n${toDelimited(lines, separator)}\r\n`;
    },
  };
}

/**
 * Plain CSV as RFC 4180 has it: commas, a dot as the decimal mark, CRLF, and a
 * UTF-8 BOM so that Excel too reads it as UTF-8. No `sep=` line, so Google
 * Sheets, Numbers and every tool that reads CSV take it as is.
 */
export function csvFormat({
  separator = ",",
  decimalComma = false,
  escapeFormulas = true,
}: TMDataGridCsvFormatOptions = {}): TMDataGridExportFormat {
  return {
    id: "csv",
    extension: "csv",
    mimeType: "text/csv;charset=utf-8",
    decimalComma,
    write: (data, options) => {
      const lines = textRows(data, options, { decimalComma, escapeFormulas });
      return `${UTF8_BOM}${toDelimited(lines, separator)}\r\n`;
    },
  };
}

export type TMDataGridTsvFormatOptions = Omit<
  TMDataGridCsvFormatOptions,
  "separator"
>;

/**
 * Tab-separated text, the clipboard shape as a file: tabs between fields, CRLF
 * between rows, a UTF-8 BOM. Every spreadsheet opens it into columns without
 * a separator to guess.
 */
export function tsvFormat({
  decimalComma = true,
  escapeFormulas = true,
}: TMDataGridTsvFormatOptions = {}): TMDataGridExportFormat {
  return {
    id: "tsv",
    extension: "tsv",
    mimeType: "text/tab-separated-values;charset=utf-8",
    decimalComma,
    write: (data, options) => {
      const lines = textRows(data, options, { decimalComma, escapeFormulas });
      return `${UTF8_BOM}${toDelimited(lines, "\t")}\r\n`;
    },
  };
}

export type TMDataGridJsonFormatOptions = {
  /** Indentation passed to `JSON.stringify`. Defaults to `2`. */
  space?: number;
};

/** A value as JSON keeps it: dates as ISO strings, the unrepresentable as `null`. */
function jsonValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  return value;
}

/**
 * An array with one object per row, keyed by the column labels, values as the
 * data holds them. Two columns with the same label collapse into one key, the
 * later column winning. `includeHeaders` has no meaning here and is ignored.
 */
export function jsonFormat({
  space = 2,
}: TMDataGridJsonFormatOptions = {}): TMDataGridExportFormat {
  return {
    id: "json",
    extension: "json",
    mimeType: "application/json",
    write: (data) => {
      const records = data.rows.map((row) =>
        Object.fromEntries(
          row.map((value, index) => [data.headers[index], jsonValue(value)]),
        ),
      );
      return JSON.stringify(records, null, space);
    },
  };
}

export const DEFAULT_EXPORT_OPTIONS: TMDataGridExportSettings = {
  format: csvExcelFormat(),
  fileName: "export",
  includeHeaders: true,
  columns: "visible",
};

/**
 * The defaults with each override folded over them in turn. Field by field,
 * so an override that spells a field as `undefined` leaves the earlier value
 * rather than blanking it.
 */
export function resolveExportOptions(
  ...overrides: Array<TMDataGridExportOptions | undefined>
): TMDataGridExportSettings {
  const resolved = { ...DEFAULT_EXPORT_OPTIONS };
  for (const override of overrides) {
    if (!override) continue;
    if (override.format !== undefined) resolved.format = override.format;
    if (override.fileName !== undefined) resolved.fileName = override.fileName;
    if (override.includeHeaders !== undefined) {
      resolved.includeHeaders = override.includeHeaders;
    }
    if (override.columns !== undefined) resolved.columns = override.columns;
  }
  return resolved;
}

/**
 * Every leaf column in render order - left, center, right - hidden ones in
 * the place they would take if shown. `getAllLeafColumns` is definition
 * order, which pinning and reordering have long since left behind.
 */
function allLeafColumns(table: ErasedTable): Array<ErasedColumn> {
  const ordered = [
    ...table.getStartLeafColumns(),
    ...table.getCenterLeafColumns(),
    ...table.getEndLeafColumns(),
  ];
  const seen = new Set(ordered.map((column) => column.id));
  // The flat list rather than `getAllLeafColumns`: that one runs through the
  // ordering step too, which is where `groupedColumnMode: "remove"` drops a
  // grouped column, so it is the only list that still holds one.
  const missing = table
    .getAllFlatColumns()
    .filter((column) => column.columns.length === 0 && !seen.has(column.id));
  if (missing.length === 0) return ordered;
  // A removed grouped column goes first, where the tree lane showing its
  // value sits. Anything else the lanes left out goes last.
  const grouping = table.store.state.grouping;
  const grouped = grouping.flatMap((id) =>
    missing.filter((column) => column.id === id),
  );
  const rest = missing.filter((column) => !grouping.includes(column.id));
  return [...grouped, ...ordered, ...rest];
}

/**
 * Every column an export could take, in render order: the data columns minus
 * the generated lanes and `meta.enableExport: false`, hidden ones included.
 * What the column picker lists; `column.getIsVisible()` says which of them a
 * `"visible"` export would take.
 */
export function getExportableColumns<TData extends RowData>(
  table: TMDataGridTable<TData>,
): Array<Column<TMDataGridFeatures, TData, unknown>> {
  const erased = table as unknown as ErasedTable;
  return allLeafColumns(erased).filter(isExportedColumn) as unknown as Array<
    Column<TMDataGridFeatures, TData, unknown>
  >;
}

/** The columns `columns` names, in render order. */
function selectColumns(
  table: ErasedTable,
  columns: TMDataGridExportColumns,
): Array<ErasedColumn> {
  const all = allLeafColumns(table).filter(isExportedColumn);
  if (columns === "all") return all;
  if (columns === "visible")
    return all.filter((column) => column.getIsVisible());
  const wanted = new Set(columns);
  return all.filter((column) => wanted.has(column.id));
}

/**
 * The generated lanes - the checkbox, the details chevron, the edit lane, the
 * row numbers, the tree lane - hold controls rather than data, so a column of
 * empty strings is all they could contribute, and pasting one into a
 * spreadsheet only shifts everything to its right. The tree lane is a display
 * column with no accessor, so on a grouped grid the value it shows lives in
 * the grouped column, which stays exportable even while `groupedColumnMode`
 * has taken it off the screen. `meta.enableExport: false` is the consumer's
 * way of saying the same about a column of their own.
 */
function isExportedColumn(column: ErasedColumn): boolean {
  if (isGeneratedColumn(column.id)) return false;
  return column.columnDef.meta?.enableExport !== false;
}

/**
 * Every data row in render order, all pages.
 *
 * The sorted model: after filtering, grouping and sorting, before expansion
 * and paging - so a paged grid exports the whole filtered set, and a grouped
 * grid exports the records under every group whether or not it is open.
 *
 * Walked by hand rather than taken from `flatRows`: in table-core
 * 9.0.0-beta.21 the grouped model lists every leaf twice there (once as a
 * leaf row, once re-parented under its group), and its order puts the
 * groups last. Depth-first over `rows` is exactly render order, once each.
 */
function leafRows(table: ErasedTable): Array<ErasedRow> {
  const rows: Array<ErasedRow> = [];
  const walk = (list: ReadonlyArray<ErasedRow>) => {
    for (const row of list) {
      if (row.getIsGrouped()) walk(row.subRows);
      // A row marked for deletion under `editing.draft` is left out: the
      // export is the data as the user means it, and they deleted that row.
      else if (!isRowMarkedDeleted(table, row.id)) rows.push(row);
    }
  };
  walk(table.getSortedRowModel().rows);
  return rows;
}

/**
 * How many rows `rows: "selected"` would export: the ticked rows of the
 * current view. Not the size of the selection map, which keeps rows the
 * filters have since hidden. Free while nothing is selected.
 */
export function countSelectedExportRows<TData extends RowData>(
  table: TMDataGridTable<TData>,
): number {
  const erased = table as unknown as ErasedTable;
  if (Object.keys(erased.store.state.rowSelection).length === 0) return 0;
  return leafRows(erased).filter((row) => row.getIsSelected()).length;
}

function collectExportData(
  rows: ReadonlyArray<ErasedRow>,
  columns: ReadonlyArray<ErasedColumn>,
): TMDataGridExportData {
  return {
    columnIds: columns.map((column) => column.id),
    headers: columns.map((column) => getColumnLabel(column)),
    rows: rows.map((row) =>
      columns.map((column) => {
        const value = row.getValue(column.id);
        const exportValue = column.columnDef.meta?.exportValue;
        return exportValue ? exportValue({ value, row, column }) : value;
      }),
    ),
  };
}

export type BuildExportDataArgs<TData extends RowData> = {
  table: TMDataGridTable<TData>;
  /** Defaults to `"all"`. */
  rows?: TMDataGridExportRows<TData>;
  /** Defaults to `"visible"`. Ignored under `bounds`. */
  columns?: TMDataGridExportColumns;
  /**
   * A rectangle over `rows` and the visible columns, both by index - the
   * cell-range path. `rows` is then the list the indices refer to, usually
   * the displayed rows.
   */
  bounds?: TMDataGridRangeBounds;
};

/**
 * What an export writes, before any format touches it.
 *
 * Columns are `"visible"` (the data columns on screen, in render order),
 * `"all"` (every exportable column, hidden or not) or a list of ids; the
 * generated lanes and any column with `meta.enableExport: false` are left out
 * whichever is asked for. Rows are `"all"` (every filtered and sorted row
 * across every page, group rows flattened to their records), `"selected"`
 * (those of them the user has ticked, in the same order - the selection map
 * is walked through the row list rather than the other way round, because
 * TanStack's selected row models ignore filtering and sorting), or a list of
 * your own.
 */
export function buildExportData<TData extends RowData>({
  table,
  rows = "all",
  columns: which = "visible",
  bounds,
}: BuildExportDataArgs<TData>): TMDataGridExportData {
  // The same erasure the context provider performs: this only ever reads
  // generic row and column APIs.
  const erased = table as unknown as ErasedTable;
  // The bounds index into every visible column, lanes included, so under
  // them the slice comes before the filter.
  const columns = bounds
    ? [
        ...erased.getStartVisibleLeafColumns(),
        ...erased.getCenterVisibleLeafColumns(),
        ...erased.getEndVisibleLeafColumns(),
      ]
        .slice(bounds.left, bounds.right + 1)
        .filter(isExportedColumn)
    : selectColumns(erased, which);
  if (columns.length === 0) return { columnIds: [], headers: [], rows: [] };

  let list: ReadonlyArray<ErasedRow>;
  if (rows === "all") list = leafRows(erased);
  else if (rows === "selected") {
    list = leafRows(erased).filter((row) => row.getIsSelected());
  } else list = rows as unknown as ReadonlyArray<ErasedRow>;
  if (bounds) list = list.slice(bounds.top, bounds.bottom + 1);

  return collectExportData(list, columns);
}

/**
 * Writes `data` in the format and downloads it. Awaits the format, since a
 * binary format builds its file asynchronously.
 */
export async function writeExportFile(
  data: TMDataGridExportData,
  { format, fileName, includeHeaders }: TMDataGridExportSettings,
): Promise<void> {
  const content = await format.write(data, { includeHeaders });
  downloadFile({
    fileName: `${fileName}.${format.extension}`,
    content,
    mimeType: format.mimeType,
  });
}

export type ExportGridArgs<TData extends RowData> = {
  table: TMDataGridTable<TData>;
  /** Defaults to `"all"`. See {@link TMDataGridExportRows}. */
  rows?: TMDataGridExportRows<TData>;
  /** Merged over `DEFAULT_EXPORT_OPTIONS`. */
  options?: TMDataGridExportOptions;
};

/**
 * Downloads the grid as a file: {@link buildExportData} through the format's
 * `write` and a download.
 *
 * Inside the grid, `useTMDataGridExport` and the `TMDataGrid.Menu.Export*`
 * items call this with the grid's own `exportOptions`; this is the entry point
 * for code that holds the table and nothing else.
 *
 * The grid's `mapExportData` runs over the data before the format writes it,
 * as it does for the grid's own exports. `enableDownload: false` does not stop
 * this call: it hides what the user can reach, and this is your own code.
 *
 * Nothing is downloaded when no column is exportable. A grid with no rows
 * still downloads its header row, since an empty file is the honest answer to
 * an empty view.
 *
 * Async because a format may be. Safari refuses a download that starts after
 * the click gesture has ended, which a format that takes long enough to build
 * can run into; the text formats resolve synchronously and never do.
 */
export async function exportGrid<TData extends RowData>({
  table,
  rows = "all",
  options,
}: ExportGridArgs<TData>): Promise<void> {
  const resolved = resolveExportOptions(options);
  const data = buildExportData({ table, rows, columns: resolved.columns });
  if (data.columnIds.length === 0) return;
  const mapped = applyExportDataMapper(table, data, {
    target: "file",
    rows: typeof rows === "string" ? rows : "list",
  });
  if (mapped === null) return;
  await writeExportFile(mapped, resolved);
}

// Keyed on the store for the same reason as the deletion marks: every copy of
// the table `useTable` hands out shares it. Registered rather than read from
// context so that `exportGrid`, which holds the table and nothing else, runs
// the same mapper as the grid's own exports.
const exportDataMappers = new WeakMap<object, TMDataGridExportDataMapper>();

/**
 * Registers the grid's `mapExportData` for one table; returns the unregister.
 *
 * @internal
 */
export function registerExportDataMapper<TData extends RowData>(
  table: TMDataGridTable<TData>,
  mapper: TMDataGridExportDataMapper,
): () => void {
  exportDataMappers.set(table.store, mapper);
  return () => {
    if (exportDataMappers.get(table.store) === mapper) {
      exportDataMappers.delete(table.store);
    }
  };
}

/**
 * Runs the table's `mapExportData` over `data`. `null` means the export is
 * cancelled, and so does a result with no columns, since there is nothing left
 * to write.
 *
 * @internal
 */
export function applyExportDataMapper<TData extends RowData>(
  table: TMDataGridTable<TData>,
  data: TMDataGridExportData,
  context: TMDataGridExportContext,
): TMDataGridExportData | null {
  const mapper = exportDataMappers.get(table.store);
  const mapped = mapper ? mapper(data, context) : data;
  return mapped === null || mapped.columnIds.length === 0 ? null : mapped;
}

export type TMDataGridClipboardTextOptions = {
  /** Defaults to `true`, the Nordic mark. */
  decimalComma?: boolean;
  /** Defaults to `true`. See {@link guardFormula}. */
  escapeFormulas?: boolean;
};

/**
 * The clipboard format spreadsheets read: tab between cells, CRLF between rows,
 * values only.
 *
 * Tabs rather than commas because that is what Excel, Sheets and Numbers all
 * put on the clipboard themselves - paste it and the cells land in cells. A
 * comma-separated string pastes into a single column, which is the thing this
 * exists to avoid. No header row: Excel's own copy carries none either, and a
 * header pasted into the middle of a sheet is a row of text where numbers
 * were expected.
 *
 * Also accepts an already-formatted string matrix, written as is.
 */
export function toClipboardText(
  data: TMDataGridExportData | Array<Array<string>>,
  {
    decimalComma = true,
    escapeFormulas = true,
  }: TMDataGridClipboardTextOptions = {},
): string {
  const lines = Array.isArray(data)
    ? data
    : textRows(
        data,
        { includeHeaders: false },
        { decimalComma, escapeFormulas },
      );
  return toDelimited(lines, "\t");
}

/**
 * Puts text on the clipboard, reporting whether it landed.
 *
 * The async clipboard API only resolves for a document that has the focus and a
 * user gesture behind it - both true when this runs off Ctrl+C or a menu item.
 * It is still allowed to reject (a permissions policy, a page that lost focus
 * mid-copy), so the result is a boolean the caller can act on.
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Downloads a file, through the one mechanism a library can use: an anchor
 * with an object URL behind it, clicked. Revoked on the next frame -
 * immediately would race the browser's own read of it.
 */
export function downloadFile({
  fileName,
  content,
  mimeType,
}: {
  fileName: string;
  content: string | Blob;
  mimeType: string;
}): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
