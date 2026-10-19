# Export

Downloads the grid as a file: every filtered and sorted row across every page, or the selected rows, in the format the grid is configured with.
`TMDataGrid.Menu.Export` and `TMDataGrid.Menu.ExportSelected` are the built-in entry points; `useTMDataGridExport` is the same export as click handlers for a control of your own.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer />
  <TMDataGrid.Menu>
    <TMDataGrid.Menu.Export />
    <TMDataGrid.Menu.ExportSelected />
    <Menu.Divider />
    <TMDataGrid.Menu.Columns />
  </TMDataGrid.Menu>
</TMDataGrid.Toolbar>
```

```demo
file: data/Export.tsx
hint: Tick a few rows, then open the menu. The Excel CSV opens straight into columns.
```

## What is written

By default the columns are the visible data columns in render order, so a hidden column is not exported and a pinned one keeps its place.
`columns` on `exportOptions`, on the menu items and on the functions picks another set:

- `"visible"` - the data columns on screen. The default.
- `"all"` - every exportable column, hidden ones in the place they would take if shown.
- a list of column ids - those columns, in render order.

The generated lanes (checkbox, details, edit, row numbers) are never exported, whichever is asked for.
Set `meta.enableExport: false` to leave a column of your own out the same way:

```tsx
columnHelper.display({
  id: "actions",
  cell: ActionsCell,
  meta: { enableExport: false },
});
```

The rows are every row after filtering and sorting, across every page.
On a grouped grid the records under every group are written, whether the group is open or not, and the group rows are not.

Each cell is written as its **value**, `row.getValue(column.id)`, not as what the cell renders.
A cell showing `32 000 kr` exports `32000`; a select column exports the option's `value`.
Set `meta.exportValue` to write something else:

```tsx
columnHelper.accessor("status", {
  meta: {
    type: "select",
    options: STATUS_OPTIONS,
    exportValue: ({ value }) => STATUS_LABELS[value as EmployeeStatus],
  },
});
```

`exportValue` receives `{ value, row, column }` and returns the value the format writes.
Both meta fields also apply to Ctrl+C under [cell selection](/docs/cell-selection#copy-and-export).

## The exportOptions option

`exportOptions` on `useTMDataGrid` sets the format, the file name and whether the column labels go in as the first row:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  exportOptions: { format: csvFormat(), fileName: "employees" },
});
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | `TMDataGridExportFormat` | `csvExcelFormat()` | The file format. See [Formats](#formats). |
| `fileName` | `string` | `"export"` | The file name without extension; the format adds its own. |
| `includeHeaders` | `boolean` | `true` | Determines whether the column labels are written as the first row. |
| `columns` | `"visible" \| "all" \| Array<string>` | `"visible"` | Which columns are written. See [What is written](#what-is-written). |

The option is read field by field, so an inline object literal needs no `useMemo`.
Every export of the grid reads it: the menu items, the hook, and the export item of the cell-range menu.

## Formats

A format is a `TMDataGridExportFormat`, and the package ships four factories:

| Factory | File | Writes |
| --- | --- | --- |
| `csvExcelFormat()` | `.csv` | A CSV Excel opens straight into columns: UTF-8 BOM, a `sep=;` first line, CRLF endings, `;` between fields, `,` as the decimal mark. |
| `csvFormat()` | `.csv` | CSV as RFC 4180 has it: `,` between fields, `.` as the decimal mark, CRLF, a UTF-8 BOM, no `sep=` line. |
| `tsvFormat()` | `.tsv` | Tab-separated text, the clipboard shape as a file. |
| `jsonFormat()` | `.json` | An array with one object per row, keyed by column label, values as the data holds them. |

Excel xlsx is a separate package, since it needs a spreadsheet library the grid should not carry: see [Excel export (xlsx)](/docs/xlsx).

By default the grid writes `csvExcelFormat()` with the Nordic conventions, because an Excel running a Swedish, Norwegian, Danish or Finnish locale reads `;` as its list separator and `,` as its decimal mark, and a file written the other way opens as one column of text.
To write for an English-locale Excel, set the separator and the decimal mark on the format:

```tsx
exportOptions: { format: csvExcelFormat({ separator: ",", decimalComma: false }) }
```

The `sep=` line is Excel's alone; Google Sheets and Numbers show it as a first row.
Use `csvFormat()` for a file that goes there.

`csvExcelFormat`, `csvFormat` and `tsvFormat` write values through `formatExportValue`: numbers with the format's decimal mark, dates in the `sv-SE` form (`2026-07-31 14:05:00`, which Excel reads as a date), booleans as `true` / `false`, arrays joined with `, `, and any other object as JSON.
`jsonFormat` writes numbers as numbers, dates as ISO strings, and `undefined` as `null`.

| Option | Formats | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `separator` | csvExcel, csv | `string` | `";"` for csvExcel, `","` for csv | The character between fields. |
| `decimalComma` | csvExcel, csv, tsv | `boolean` | `true` for csvExcel and tsv, `false` for csv | Determines whether numbers are written as `1,5` rather than `1.5`. |
| `escapeFormulas` | csvExcel, csv, tsv | `boolean` | `true` | Determines whether text a spreadsheet would run as a formula is prefixed. See [Formula guard](#formula-guard). |
| `space` | json | `number` | `2` | Indentation passed to `JSON.stringify`. |

### Formula guard

Excel and Google Sheets run a cell that starts with `=`, `+`, `-` or `@` as a formula, so text one user typed into the grid would run in another user's spreadsheet when the file is opened.
By default the text formats prefix such a value with an apostrophe, which every spreadsheet reads as "text follows" and shows.
Text that parses as a number (`-5`, `+4670123456`) is not prefixed; a phone number written with spaces (`+46 70 123 45 67`) is.
To write every value as it is, set `escapeFormulas: false` on the format:

```tsx
exportOptions: { format: csvExcelFormat({ escapeFormulas: false }) }
```

`guardFormula(text)` is the rule as a function, for a format of your own.

## TMDataGrid.Menu.Export

A menu item that downloads every filtered and sorted row, all pages, in the grid's format.
It needs a Mantine `Menu` around it and reads the grid from context, so it works in `TMDataGrid.Menu` and in any Mantine menu rendered inside `TMDataGrid`.
Its props override `exportOptions` for this item alone, which is how one menu offers two formats:

```tsx
<TMDataGrid.Menu>
  <TMDataGrid.Menu.Export />
  <TMDataGrid.Menu.Export
    format={csvFormat()}
    fileName="employees-plain"
    label="Export all rows as plain CSV"
  />
</TMDataGrid.Menu>
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | `TMDataGridExportFormat` | `exportOptions.format` | The file format for this item. |
| `fileName` | `string` | `exportOptions.fileName` | The file name for this item. |
| `includeHeaders` | `boolean` | `exportOptions.includeHeaders` | Determines whether this item writes the header row. |
| `columns` | `"visible" \| "all" \| Array<string> \| "custom"` | `exportOptions.columns` | Which columns the item writes. `"custom"` opens the column picker. |
| `label` | `ReactNode` | `labels.exportAll` | The item's text. |

### The column picker

`columns="custom"` opens a dialog instead of downloading, titled with the format ("Export as CSV"): every exportable column as a checkbox, the visible ones ticked and the hidden ones marked **Hidden**, and an Export button that downloads the ticked columns in render order.
The line under the title names the selected rows when the item is `ExportSelected`.
A select-all row heads the list with a count of the ticked columns, a search box appears once there are six columns, and the list scrolls inside the dialog past half the viewport.
Under a search, select all ticks the matches and leaves the rest as they are.
Cancel closes it with no download.
The dialog follows the grid's `size`: its width, title and controls step with the toolbar's.

```tsx
<TMDataGrid.Menu.Export columns="custom" label="Export all rows, choose columns" />
```

The picker is rendered by the `TMDataGrid` root and driven by `ui.state.exportPicker`, which holds `{ rows, options }` while it is open and `null` otherwise.
`ui.actions.openExportPicker({ rows: "all", options })` opens it from a control of your own; `getExportableColumns(table)` is the list it shows.

## TMDataGrid.Menu.ExportSelected

A menu item that downloads the selected rows of the current view, in grid order, with the same props as `TMDataGrid.Menu.Export`.
By default its text carries the count (`Export 3 selected rows`); `label` replaces it.
It is disabled while nothing is selected.
It renders nothing when row selection is off (`selectionMode: "highlight"` or `enableRowSelection: false`).

A selected row the filters have since hidden is not written and not counted.

## useTMDataGridExport

The export as click handlers, for a button or an item of your own anywhere inside `TMDataGrid`:

```tsx
import { useTMDataGridExport } from "@jielga/tmdatagrid";

function ExportButtons() {
  const { exportAll, exportSelected, selectedCount, canExportSelected } =
    useTMDataGridExport();

  return (
    <>
      <Button size="xs" onClick={() => void exportAll()}>
        Export
      </Button>
      {canExportSelected && (
        <Button size="xs" disabled={selectedCount === 0} onClick={() => void exportSelected()}>
          Export {selectedCount} selected
        </Button>
      )}
    </>
  );
}
```

It takes a `TMDataGridExportOptions` argument, folded over the grid's `exportOptions` for this caller.
`exportAll` and `exportSelected` take one more, folded over both for that call, which is how a control passes a chosen set of columns.

| Field | Type | Description |
| --- | --- | --- |
| `exportAll` | `(overrides?) => Promise<void>` | Downloads every filtered and sorted row, all pages. |
| `exportSelected` | `(overrides?) => Promise<void>` | Downloads the selected rows of the current view. Resolves without a download when none is selected. |
| `selectedCount` | `number` | How many rows `exportSelected` would write. Subscribes to the selection. |
| `canExportSelected` | `boolean` | `true` while row selection is on. |

## Exporting from outside the grid

`exportGrid` is the same export for code that holds the table and nothing else:

```tsx
import { exportGrid, jsonFormat } from "@jielga/tmdatagrid";

await exportGrid({ table: grid.table, rows: "selected", options: { format: jsonFormat() } });
```

`rows` is `"all"` (the default), `"selected"`, or an array of TanStack rows of your own; `options.columns` picks the columns.
`buildExportData({ table, rows, columns })` is the step before the file: the columns, their labels and the raw values as a `TMDataGridExportData`, for a format or a post-processing step of your own.
`writeExportFile(data, settings)` writes and downloads it.

## Writing your own format

A format is an object with an id, a file extension, a MIME type and a `write` function.
`write` receives the `TMDataGridExportData` and `{ includeHeaders }`, and returns the file as a string or a `Blob`, or a promise of either:

```tsx
import type { TMDataGridExportFormat } from "@jielga/tmdatagrid";

export function markdownFormat(): TMDataGridExportFormat {
  return {
    id: "markdown",
    extension: "md",
    mimeType: "text/markdown",
    write: ({ headers, rows }, { includeHeaders }) => {
      const line = (cells: Array<unknown>) => `| ${cells.map(String).join(" | ")} |`;
      const head = includeHeaders
        ? [line(headers), line(headers.map(() => "---"))]
        : [];
      return [...head, ...rows.map(line)].join("\n");
    },
  };
}
```

Set `decimalComma` on the format when it writes text with a decimal mark, so Ctrl+C writes the same mark.
`formatExportValue(value, { decimalComma })` is the grid's own text rule, for a format that wants it.

## Copy and the cell-range menu

Under `cellSelection: "range"`, Ctrl+C and the **Export cells** item of the right-click menu write the selected rectangle through the same `exportOptions`, column meta and format.
See [Copy and export](/docs/cell-selection#copy-and-export).

## Labels

| Label | Default | Used by |
| --- | --- | --- |
| `exportAll` | `"Export all rows"` | `TMDataGrid.Menu.Export` |
| `exportSelected` | `(count) => "Export 3 selected rows"` | `TMDataGrid.Menu.ExportSelected` |
| `exportCells` | `"Export cells"` | The cell-range menu |
| `exportPickerTitle` | `` (format) => `Export as ${format}` `` | The column picker; `format` is the extension in upper case |
| `exportPickerHint` | `(selected) => "Select the columns to export"`, or `… for the ${selected} selected rows` | The line under the picker's title |
| `exportPickerConfirm` | `"Export"` | The column picker |
| `exportPickerCancel` | `"Cancel"` | The column picker |
| `exportPickerSelectAll` | `"Select all"` | The column picker |
| `exportPickerCount` | `` (checked, total) => `${checked} of ${total}` `` | The column picker |
| `exportPickerHidden` | `"Hidden"` | The column picker, on a column the grid hides |

See [Localization](/docs/localization).

## Testing

`TMDataGrid.Menu.Export` is `data-dg-part="menu-export"` and `TMDataGrid.Menu.ExportSelected` is `data-dg-part="menu-export-selected"`.
The column picker is `export-picker`, its checkboxes `export-column` with `data-column-id`, its select-all row `export-column-all` with the count `export-picker-count`, its search box `export-picker-search`, the line under the title `export-picker-hint`, and its buttons `export-picker-confirm` and `export-picker-cancel`.
The search box and the picker share `columnsSearchPlaceholder` and `columnsNoMatch` with the column chooser.
A download is an anchor with an object URL, clicked; a jsdom test stubs `URL.createObjectURL` and `HTMLAnchorElement.prototype.click` to read the file back.
See [Testing](/docs/testing).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `exportOptions` | Option | `TMDataGridExportOptions` | `csvExcelFormat()`, `"export"`, headers on, `"visible"` columns | Format, file name and header row for every export of the grid. |
| `meta.enableExport` | Column meta | `boolean` | `true` | `false` leaves the column out of every export and of Ctrl+C. |
| `meta.exportValue` | Column meta | `({ value, row, column }) => unknown` | – | The value written in place of `row.getValue`. |
| `TMDataGridExportValueGetter` | Type | – | – | The type of `meta.exportValue`. |
| `TMDataGrid.Menu.Export` | Component | `TMDataGridMenuExportProps` | – | Menu item: every filtered row. `columns="custom"` opens the picker. |
| `TMDataGrid.Menu.ExportSelected` | Component | `TMDataGridMenuExportProps` | – | Menu item: the selected rows. Renders nothing when row selection is off. |
| `ui.state.exportPicker` | UI state | `{ rows, options } \| null` | `null` | The column picker while open. |
| `TMDataGridExportPickerRequest` | Type | `{ rows, options }` | – | The value of `ui.state.exportPicker` while the picker is open. |
| `ui.actions.openExportPicker` · `closeExportPicker` | UI actions | – | – | Open the picker from your own code. |
| `getExportableColumns` | Function | `(table) => Array<Column>` | – | Every column an export could take, hidden ones included. |
| `useTMDataGridExport` | Hook | `(overrides?) => TMDataGridExportApi` | – | `exportAll`, `exportSelected`, `selectedCount`, `canExportSelected`. |
| `exportGrid` | Function | `({ table, rows?, options? }) => Promise<void>` | – | Downloads the grid from outside a component. |
| `ExportGridArgs` | Type | `{ table, rows?, options? }` | – | What `exportGrid` takes. |
| `buildExportData` | Function | `({ table, rows?, columns?, bounds? }) => TMDataGridExportData` | – | The columns, labels and values a format writes. |
| `BuildExportDataArgs` | Type | `{ table, rows?, columns?, bounds? }` | – | What `buildExportData` takes. |
| `TMDataGridExportColumns` | Type | `"visible" \| "all" \| ReadonlyArray<string>` | – | Which columns an export takes. Generated lanes and `meta.enableExport: false` columns are never taken. |
| `writeExportFile` | Function | `(data, settings) => Promise<void>` | – | Writes export data in a format and downloads it. |
| `csvExcelFormat` · `csvFormat` · `tsvFormat` · `jsonFormat` | Functions | `(options?) => TMDataGridExportFormat` | – | The built-in formats. |
| `TMDataGridCsvFormatOptions` · `TMDataGridTsvFormatOptions` · `TMDataGridJsonFormatOptions` | Types | – | – | The options of `csvExcelFormat` and `csvFormat`, of `tsvFormat`, and of `jsonFormat`. |
| `TMDataGridExportWriteOptions` | Type | `{ includeHeaders }` | – | The second argument of a format's `write`. |
| `guardFormula` · `formatExportValue` | Functions | – | – | The formula guard and the text rule, for a format of your own. |
| `resolveExportOptions` | Function | `(...overrides) => TMDataGridExportSettings` | – | The defaults with overrides folded over, `undefined` fields skipped. |
| `countSelectedExportRows` | Function | `(table) => number` | – | How many rows `"selected"` would write. |
| `downloadFile` | Function | `({ fileName, content, mimeType }) => void` | – | Downloads a string or a `Blob`. |
| `DEFAULT_EXPORT_OPTIONS` | Constant | `TMDataGridExportSettings` | – | `csvExcelFormat()`, `"export"`, `true`. |
| `TMDataGridExportFormat` · `TMDataGridExportData` · `TMDataGridExportOptions` · `TMDataGridExportSettings` · `TMDataGridExportRows` · `TMDataGridExportApi` | Types | – | – | The export types. |
| `data-dg-part` | Data attribute | `menu-export`, `menu-export-selected` | – | On the menu items. |
