---
name: xlsx
description: >
  Excel (.xlsx) export for TMDataGrid through the @jielga/tmdatagrid-xlsx addon.
  Covers why exceljs lives in a separate package, xlsxFormat() as a
  TMDataGridExportFormat, setting it as exportOptions.format or per menu item on
  TMDataGrid.Menu.Export and TMDataGrid.Menu.ExportSelected, how each value
  becomes a typed cell (numbers, dates with their number format, booleans,
  arrays, objects, empties), the bold header row under includeHeaders, and the
  sheetName and autoWidth options. Load when a grid should download a real
  workbook rather than a CSV, when an exported number or date arrives as text,
  or when naming or sizing the worksheet.
metadata:
  type: core
  library: '@jielga/tmdatagrid-xlsx'
  library_version: '2.4.0'
sources:
  - 'Jielga/react:packages/tmdatagrid-xlsx/docs/xlsx.md'
---

# TMDataGrid - Excel export (xlsx)

A real workbook rather than a CSV Excel can open. A typed cell carries no
separator, no decimal mark and no byte order mark, so the file reads the same
whatever locale the reader's Excel runs.

`exceljs` is the reason this is its own package: the grid never depends on a
spreadsheet writer.

```sh
npm install @jielga/tmdatagrid-xlsx
```

## Setting the format

`xlsxFormat()` returns a `TMDataGridExportFormat`, so it goes anywhere the grid
takes one.

```tsx
import { useTMDataGrid } from "@jielga/tmdatagrid";
import { xlsxFormat } from "@jielga/tmdatagrid-xlsx";

const grid = useTMDataGrid({
  data,
  columns,
  exportOptions: { format: xlsxFormat(), fileName: "employees" },
});
```

Each `TMDataGrid.Menu.Export` and `TMDataGrid.Menu.ExportSelected` item takes
its own `format`, which overrides `exportOptions` for that item alone - that is
how one menu offers both CSV and xlsx.

```tsx
<TMDataGrid.Menu>
  <TMDataGrid.Menu.Export />
  <TMDataGrid.Menu.Export format={xlsxFormat()} />
  <TMDataGrid.Menu.ExportSelected format={xlsxFormat()} />
</TMDataGrid.Menu>
```

## How values are written

| Value | Cell |
| --- | --- |
| `number`, finite | A number cell |
| `number`, `NaN` or infinite | Empty |
| `Date` at 00:00:00 | A date cell, `yyyy-mm-dd` |
| `Date` with a time | A date cell, `yyyy-mm-dd hh:mm` |
| `Date`, invalid | Empty |
| `boolean` | A boolean cell |
| `string` | Text |
| `null`, `undefined` | Empty |
| Array | Its elements as text, joined with `, ` |
| Any other object | `JSON.stringify` of it, empty when that throws |

`includeHeaders` (default `true`) writes the column labels as a bold first row.

## Common mistakes

### HIGH Expecting the grid to export xlsx on its own

The grid ships CSV, TSV and JSON only. Without `format: xlsxFormat()` the menu
item downloads the CSV default, whatever the file is called.

Source: `packages/tmdatagrid-xlsx/docs/xlsx.md`.

### MEDIUM Formatting a value before it reaches the export

A number turned into a string is written as text, and Excel will not sum it.
Leave the value alone, or use `meta.exportValue` to hand over a real number or
`Date`.

Source: `packages/tmdatagrid-xlsx/docs/xlsx.md` (How values are written).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `xlsxFormat` | Export | `(options?) => TMDataGridExportFormat` | – | The format. `id`, `extension` and the download's MIME type are all xlsx. |
| `sheetName` | Option | `string` | `"Sheet1"` | The worksheet's name. |
| `autoWidth` | Option | `boolean` | `true` | Column widths from the longest text, header included, between 10 and 60 characters. |
| `TMDataGridXlsxFormatOptions` | Export | type | – | The options object. |
| `@jielga/tmdatagrid` | Peer dependency | `^2.0.0-beta.14` | – | The two versions release together. |

See also: the `cell-selection` skill for the grid's own export options, the
clipboard and `exportGrid`.
