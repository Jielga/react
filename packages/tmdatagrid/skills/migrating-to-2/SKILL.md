---
name: migrating-to-2
description: >
  Upgrade code written against a 2.0.0-beta release of TMDataGrid to 2.0.0, as a
  checklist to run over a codebase. Covers the edit.commitAll / saveDrafts /
  addRows result objects and the silent `if (await saveDrafts())` trap, the
  onSaveDrafts return type renamed to TMDataGridSaveDraftsResponse, every
  removed name with its replacement (submitAll, onCommitDrafts, rows / added,
  pendingCount, cellExport, exportGridToCsv, the cell-matrix functions,
  toExcelCsv, downloadTextFile, labels.exportCsv), the helpers no longer
  exported, removing row annotations and casts from meta.options and
  meta.edit.enabled callbacks, and the behaviour changes. Load when upgrading
  @jielga/tmdatagrid from a 2.0 beta, or when an import or a property from the
  beta no longer resolves.
metadata:
  type: lifecycle
  library: '@jielga/tmdatagrid'
  library_version: '2.3.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/migrating-to-2.md'
  - 'Jielga/react:packages/tmdatagrid/src/index.ts'
---

# TMDataGrid - Migrating from the 2.0 beta to 2.0.0

2.0.0 removes every name deprecated during the 2.0 beta, stops exporting a set
of internal helpers, and changes what three edit calls resolve. Run the steps
below in order over the codebase. Step 1 finds code that still compiles but
behaves differently; the compiler finds most of the rest.

## 1. CRITICAL Read `ok` from commitAll and saveDrafts

`edit.commitAll()` and `edit.saveDrafts()` resolve an object instead of a
`boolean`. A truthiness check on the old `boolean` still compiles and is now
always true, so a failed save reports success with no error.

Search for: `commitAll(` and `saveDrafts(`, including the `actions.save` and
`actions.commitAll` of a `TMDataGrid.DraftActions` `renderActions` slot, which
resolve the same objects.

| Call | Resolves |
| --- | --- |
| `edit.commitAll()` · `actions.commitAll()` | `TMDataGridCommitAllResult`: `{ ok, committed, open }` |
| `edit.saveDrafts()` · `actions.save()` | `TMDataGridSaveDraftsResult`: `{ ok, saved, kept, reopened }` |
| `edit.addRows(rows, options)` | `TMDataGridAddRowsResult`: `{ ok, committed, open }` - `ok` is new |
| `edit.commit(rowId)` | `boolean`, unchanged |

Wrong (compiles, always true):

```tsx
if (await grid.edit.saveDrafts()) notify("Saved");
const done = await grid.edit.commitAll();
if (!done) return;
```

Correct:

```tsx
const { ok, kept, reopened } = await grid.edit.saveDrafts();
if (ok) notify("Saved");
else notify(`${kept.length + reopened.length} rows need attention`);

const { ok: committed } = await grid.edit.commitAll();
if (!committed) return;
```

Each list holds row ids, and temp ids for new rows. `ok` is `true` when `open`
is empty, or, for `saveDrafts()`, when `kept` and `reopened` are both empty.
Also check every other use of the result: `.then((saved) => ...)`, a `return`
of it from a `boolean` function, `!result`, `result ? ... : ...` and
`Boolean(result)`.

Source: `packages/tmdatagrid/docs/migrating-to-2.md` (Read the batch edit results).

## 2. Rename the onSaveDrafts return type

The type of what `editing.onSaveDrafts` may return is renamed
`TMDataGridSaveDraftsResponse`. `TMDataGridSaveDraftsResult` is now the type
`edit.saveDrafts()` resolves, so code that kept the old name for the callback
fails to compile.

Search for: `TMDataGridSaveDraftsResult`. Where it types an `onSaveDrafts`
callback or its return value, replace it:

```tsx
// beta
import type { TMDataGridSaveDraftsResult } from "@jielga/tmdatagrid";

// 2.0.0
import type { TMDataGridSaveDraftsResponse } from "@jielga/tmdatagrid";
```

Where it types the value of `await edit.saveDrafts()`, keep it.

Source: `packages/tmdatagrid/docs/migrating-to-2.md` (Rename the onSaveDrafts return type).

## 3. Replace removed names

Search for each name in the first column and replace it:

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

Search for `onSaveDrafts` as well, and check what each callback reads off its
payload.

### submitAll

`submitAll()` was `commitAll()` followed by `saveDrafts()`. Call both, and
combine the results where one answer is needed:

```tsx
const committed = await grid.edit.commitAll();
const saved = await grid.edit.saveDrafts();
const ok = committed.ok && saved.ok;
```

### The CSV export options

`separator` and `decimalComma` move into a format; `includeHeaders` and
`fileName` stay in the options. `exportOptions` on the hook applies to every
export the grid offers, the cell-range menu included.

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

### The matrix functions

The export functions now return values, not text. A format writes the text:

```tsx
// beta
const csv = toExcelCsv(buildGridCellMatrix({ table }), { separator: ";" });
downloadTextFile({ fileName: "export.csv", text: csv });

// 2.0.0
const data = buildExportData({ table });
const csv = await csvExcelFormat().write(data, { includeHeaders: true });
downloadFile({ fileName: "export.csv", content: csv, mimeType: "text/csv;charset=utf-8" });
```

For a cell range, pass `rows` and `bounds` to `buildExportData` instead of
`rows`, `columns` and `bounds` to `buildCellMatrix`. `toClipboardText(data)`
writes the tab-separated text for the clipboard.

Source: `packages/tmdatagrid/docs/migrating-to-2.md` (Replace removed names).

## 4. Remove annotations and casts from meta callbacks

The `row` that `meta.options` and `meta.edit.enabled` callbacks receive is
typed with the row type of `createTMDataGridColumnHelper<TData>()`:
`Row<TMDataGridFeatures, TData>`. A callback whose parameter is annotated with
the untyped row no longer compiles.

Search for: `options:` and `enabled:` inside column `meta`, and
`Row<TMDataGridFeatures, TMDataGridRowData>` or `as ` casts on `row.original`
next to them. Remove the annotation and the cast:

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

Columns built without the helper keep the untyped row,
`Row<TMDataGridFeatures, TMDataGridRowData>`; leave those as they are.

Source: `packages/tmdatagrid/docs/migrating-to-2.md` (Remove annotations from meta callbacks).

## 5. Replace helpers that are no longer exported

These names are internal to the grid and are no longer exported from
`@jielga/tmdatagrid`. An import of one fails to compile. Search the imports
from `@jielga/tmdatagrid` for each:

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

Source: `packages/tmdatagrid/docs/migrating-to-2.md` (Replace un-exported helpers).

## 6. Check the behaviour changes

- Under `editing.draft` without `onSaveDrafts`, a deletion whose
  `onRowDelete` throws keeps its deletion mark and is reported in `kept`. In
  the beta, `saveDrafts()` rejected and the mark was lost. Search for a
  `try` / `catch` around `saveDrafts()` that expected the rejection, and read
  `kept` instead.
- The Swedish labels `TMDATAGRID_LABELS_SV` say "Välj" for selecting: "Välj
  alla", "Välj alla rader", "Välj rad" and "Välj grupp". Update tests that find
  these controls by their Swedish name.

Source: `packages/tmdatagrid/docs/migrating-to-2.md` (Behaviour changes).

## 7. Verify

Run the project's typecheck: an import of a removed or un-exported name, and a
meta callback annotated with the untyped row, fail there. Then run the tests
that save or commit edits, since the truthiness check of step 1 and the
behaviour changes of step 6 compile.

See also: the `editing` skill for the result objects and the draft store, and
the `data` skill for the export API.
