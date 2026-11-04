# Excel export (xlsx)

`@jielga/tmdatagrid-xlsx` adds a real Excel workbook to the grid's [export formats](/docs/export).
It is a separate package because it is built on `exceljs`, and the grid never depends on a spreadsheet writer: a grid that exports CSV should not pay for one.

```sh
npm install @jielga/tmdatagrid-xlsx
```

The package declares `@jielga/tmdatagrid` as a peer dependency, so the two versions stay in step.

## xlsxFormat

`xlsxFormat()` returns a `TMDataGridExportFormat`, which is what `exportOptions.format` takes.
Set it once and every export of that grid writes a workbook.

```tsx
import { useTMDataGrid } from "@jielga/tmdatagrid";
import { xlsxFormat } from "@jielga/tmdatagrid-xlsx";

const grid = useTMDataGrid({
  data,
  columns,
  exportOptions: { format: xlsxFormat(), fileName: "employees" },
});
```

Every `TMDataGrid.Menu.Export` item takes its own `format`, so one menu can offer both.
The item without a `format` writes the grid's own, the CSV default here.

```tsx
<TMDataGrid.Menu>
  <TMDataGrid.Menu.Export />
  <TMDataGrid.Menu.Export format={xlsxFormat()} label="Export all rows as xlsx" />
</TMDataGrid.Menu>
```

A typed cell needs no separator, no decimal mark and no byte order mark to survive the trip, so an xlsx file reads the same whatever locale the reader's Excel runs.
That is what it buys over [`csvExcelFormat`](/docs/export).

Values are written like this:

| Value | Cell |
| --- | --- |
| `number`, finite | A number cell |
| `number`, `NaN` or infinite | Empty |
| `Date` at 00:00:00 | A date cell, number format `yyyy-mm-dd` |
| `Date` with a time | A date cell, number format `yyyy-mm-dd hh:mm` |
| `Date`, invalid | Empty |
| `boolean` | A boolean cell |
| `string` | Text |
| `null`, `undefined` | Empty |
| Array | Its elements as text, joined with `, ` |
| Any other object | `JSON.stringify` of it, empty when that throws |

`includeHeaders` writes the column labels as a bold first row.
It defaults to `true`, and `exportOptions.includeHeaders` is where you turn it off.

The format's `write` is async and answers a `Blob`.
Safari refuses a download that starts after the click gesture has ended, so a grid of hundreds of thousands of rows may need its own button rather than the menu item.

```demo
file: data/ExportXlsx.tsx
hint: The grid menu has an xlsx item beside the CSV one.
```

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `sheetName` | `string` | `"Sheet1"` | The worksheet's name. |
| `autoWidth` | `boolean` | `true` | Sets each column's width from its longest text, header included, between 10 and 60 characters. Off leaves the widths unset, and Excel uses its own default. |
