# Migrating from the 2.0 beta

2.0.0 removes every name deprecated during the 2.0 beta, stops exporting a set of internal helpers, and changes what three edit calls resolve.
This page lists each change and the code that replaces it, from any `2.0.0-beta` release.

## Read the batch edit results

`edit.commitAll()` and `edit.saveDrafts()` resolve an object instead of a `boolean`:

| Call | Resolves |
| --- | --- |
| `edit.commitAll()` | `{ ok, committed, open }` |
| `edit.saveDrafts()` | `{ ok, saved, kept, reopened }` |
| `edit.addRows(rows, options)` | `{ ok, committed, open }` - `ok` is new |

Important: a check on the old `boolean` still compiles and is now always true.
Search your code for `commitAll()` and `saveDrafts()` and read `ok`:

```tsx
// beta
if (await grid.edit.saveDrafts()) notify("Saved");

// 2.0.0
const { ok, kept, reopened } = await grid.edit.saveDrafts();
if (ok) notify("Saved");
else notify(`${kept.length + reopened.length} rows need attention`);
```

Each list holds row ids, and temp ids for new rows.
`ok` is `true` when `open` is empty, or, for `saveDrafts()`, when `kept` and `reopened` are both empty.
See [Saving the store](/docs/draft-store#saving-the-store) for what each list means.

The `actions.save` and `actions.commitAll` that `TMDataGrid.DraftActions` passes to a custom slot resolve the same objects.

`edit.commit(rowId)` still resolves a `boolean`.

## Rename the onSaveDrafts return type

The type of what `editing.onSaveDrafts` may return is renamed `TMDataGridSaveDraftsResponse`.
`TMDataGridSaveDraftsResult` is now the type `edit.saveDrafts()` resolves, so code that kept the old name for the callback fails to compile:

```tsx
// beta
import type { TMDataGridSaveDraftsResult } from "@jielga/tmdatagrid";

// 2.0.0
import type { TMDataGridSaveDraftsResponse } from "@jielga/tmdatagrid";
```

## Replace removed names

| Removed | Use instead |
| --- | --- |
| `edit.submitAll()` | `edit.commitAll()`, then `edit.saveDrafts()` |
| `editing.onCommitDrafts` | `editing.onSaveDrafts` |
| `rows` and `added` in the `onSaveDrafts` payload | `updated` and `created` |
| `TMDataGridEditCommitDraftsArgs` | `TMDataGridSaveDraftsArgs` |
| `state.pendingCount` in a `TMDataGrid.DraftActions` slot | `state.draftCount` or `state.openCount` |
| `cellExport` on `TMDataGrid.Table` | `exportOptions` on `useTMDataGrid` |
| `exportGridToCsv` | `exportGrid` |
| `TMDataGridCellExportOptions`, `DEFAULT_CELL_EXPORT_OPTIONS`, `fromCellExportOptions` | `TMDataGridExportOptions`, `DEFAULT_EXPORT_OPTIONS` |
| `buildCellMatrix`, `buildGridCellMatrix`, `BuildCellMatrixArgs`, `TMDataGridCellMatrix` | `buildExportData`, `BuildExportDataArgs`, `TMDataGridExportData` |
| `toExcelCsv` | `csvExcelFormat` |
| `downloadTextFile` | `downloadFile` |
| `labels.exportCsv` | `labels.exportCells` |

### submitAll

`submitAll()` was `commitAll()` followed by `saveDrafts()`.
Call both, and combine the results where one answer is needed:

```tsx
const committed = await grid.edit.commitAll();
const saved = await grid.edit.saveDrafts();
const ok = committed.ok && saved.ok;
```

### The CSV export options

`separator` and `decimalComma` move into a format; `includeHeaders` and `fileName` stay in the options:

```tsx
// beta
<TMDataGrid.Table cellExport={{ separator: ",", decimalComma: false, fileName: "orders" }} />;
exportGridToCsv({ table, options: { separator: ",", decimalComma: false } });

// 2.0.0
const exportOptions = {
  format: csvExcelFormat({ separator: ",", decimalComma: false }),
  fileName: "orders",
} satisfies TMDataGridExportOptions;

const grid = useTMDataGrid({ data, columns, exportOptions });
await exportGrid({ table: grid.table, options: exportOptions });
```

`exportOptions` on the hook applies to every export the grid offers, the cell-range menu included.

### The matrix functions

The export functions now return values, not text.
A format writes the text:

```tsx
// beta
const csv = toExcelCsv(buildGridCellMatrix({ table }), { separator: ";" });
downloadTextFile({ fileName: "export.csv", text: csv });

// 2.0.0
const data = buildExportData({ table });
const csv = await csvExcelFormat().write(data, { includeHeaders: true });
downloadFile({ fileName: "export.csv", content: csv, mimeType: "text/csv;charset=utf-8" });
```

For a cell range, pass `rows` and `bounds` to `buildExportData` instead of `rows`, `columns` and `bounds` to `buildCellMatrix`.
`toClipboardText(data)` writes the tab-separated text for the clipboard.

## Remove annotations from meta callbacks

The `row` that `meta.options` and `meta.edit.enabled` callbacks receive is typed with the row type of `createTMDataGridColumnHelper<TData>()`.
Remove casts on `row.original`.
A callback whose parameter is annotated with the untyped row no longer compiles; remove the annotation:

```tsx
// beta
meta: {
  edit: {
    enabled: (row: Row<TMDataGridFeatures, TMDataGridRowData>) =>
      (row.original as Employee).status !== "Terminated",
  },
}

// 2.0.0
meta: {
  edit: { enabled: (row) => row.original.status !== "Terminated" },
}
```

Columns built without the helper keep the untyped row.

## Replace un-exported helpers

These names are internal to the grid and are no longer exported from `@jielga/tmdatagrid`.
An import of one fails to compile:

| Removed | Use instead |
| --- | --- |
| `getDefaultOperator` | `getColumnDefaultOperator(column)` |
| `isColumnEditableForRow` | `edit.canEditCell(row, column)` |
| `isColumnReorderable` | `getColumnCapabilities(column, features).canReorder` |
| `measureColumnContentWidth` | `autosizeColumn` |
| `tmDataGridFeatures` | The `TMDataGridFeatures` type |
| `isSameCell`, `resolveCellMove`, `ResolveCellMoveArgs`, `TMDataGridCellCoords`, `TMDataGridCellNav` | No public replacement; internal to the grid. |
| `boundsCellCount`, `boundsEdges`, `isWithinBounds` | No public replacement; internal to the grid. |
| `getColumnFilterControl` | No public replacement; internal to the grid. |
| `TMDataGridColumnLayout` | No public replacement; internal to the grid. |

## Behaviour changes

- Under `editing.draft` without `onSaveDrafts`, a deletion whose `onRowDelete` throws keeps its deletion mark and is reported in `kept`.
  In the beta, `saveDrafts()` rejected and the mark was lost.
- The Swedish labels `TMDATAGRID_LABELS_SV` say "Välj" for selecting: "Välj alla", "Välj alla rader", "Välj rad" and "Välj grupp".
  Update tests that find these controls by their Swedish name.
