---
"@jielga/tmdatagrid": minor
---

Control what leaves the grid, for a file and for the clipboard.

- `enableDownload: false` hides every built-in download item: the cell-range menu's download item and Include headers toggle, `TMDataGrid.Menu.Export` and `TMDataGrid.Menu.ExportSelected`. Copy and Ctrl+C stay. `useTMDataGridExport` gains `canDownload`.
- `mapExportData(data, { target, rows })` changes or cancels what every export writes, Ctrl+C and Copy included. Return the data, or `null` to cancel.
- The cell-range menu item now reads "Download as CSV" ("Ladda ner som CSV"), naming the format's extension. `labels.exportCells` accepts `(format) => string`; a string still works.
