# Cell selection and copy

A cell cursor moved with the arrow keys, a rectangle of cells that can be
dragged out, and Ctrl+C that pastes into Excel as cells rather than as one
string. Off by default; `cellSelection` turns it on.

```tsx
const grid = useTMDataGrid({ data, columns, cellSelection: "range" });
```

| Mode | What it gives |
| ---- | ------------- |
| `"none"` | Nothing. The default |
| `"single"` | One focused cell, moved with the arrow keys |
| `"range"` | As `"single"`, plus a rectangle of cells, Ctrl+C and the export menu |

```demo
file: cells/CellSelection.tsx
hint: Tab into the grid, then arrows to move · Shift+arrows or drag to select a block. However many cells it holds, the whole grid is one tab stop.
```

Turning it on changes three things about the body:

- The tab stop moves from the row to a cell, so the whole grid is **one** Tab
  stop and the arrow keys move within it.
- The grid reports itself as a `grid` of `gridcell`s rather than a `table` of
  `cell`s, which is what tells a screen reader the arrow keys are live.
- The focused cell takes `data-focused`, and the selected ones `data-selected`
  and `data-edge-*`, which the stylesheet styles.

## Keys and keyboard shortcuts

| Key | Does |
| --- | --- |
| Arrows | Moves one cell. Clamped at the edges; no wrapping |
| Shift+arrows | Extends the rectangle from its anchor (`"range"`) |
| PageUp / PageDown | Moves one viewport of rows |
| Home / End | First / last cell of the row |
| Ctrl+Home / Ctrl+End | First / last cell of the grid |
| Enter or F2 | Steps into the cell, to its checkbox, link or button |
| Escape | Steps back out, or drops the rectangle to the focused cell |
| Space | Selects the row, as a row click does under `selectionMode: "row"` |
| Ctrl+C | Copies the selection as tab-separated text |
| Ctrl+V | Not handled. The grid never writes cells from the clipboard |

There is no paste and no fill handle: values arrive through a cell editor or
through [`edit.addRows`](/docs/adding-rows#importing-rows), which is the
path for importing a block of rows at once.

A [cell editor](/docs/editing) takes over Enter and F2 when editing is on.
Otherwise they focus the first control in the cell, and the arrow keys stop
moving the cursor while focus is inside it.

## One tab stop

The body is one tab stop in each direction.
Tab from a cell leaves the grid and Shift+Tab leaves it backwards, however many
rows are mounted and whatever those rows hold.

A control inside a body cell needs no `tabIndex`.
Enter or F2 steps into the cell and onto its first control, Escape steps back
out to the cell, and Space selects the row from any of its cells without
stepping in.

Once the focus is on a control, Tab walks the rest of that row's controls - its
open editors, the buttons in its cells, and on an open row the edit lane's save
and cancel.
Past the row's last control the cursor moves to the next row's first cell, and
Shift+Tab before its first control moves to the previous row's last cell;
neither opens the row it lands on.
From the last row, Tab leaves the grid.

Header controls are unaffected: the header row is not part of cell navigation,
so Tab is the only way to its sort buttons and menus.

## Where the selection lives

`ui.state.focusedCell` is a `{ rowId, columnId }` pair, and `ui.state.cellRange`
is two of them: the anchor and the moving corner. They hold **ids rather than
indices**, so sorting, filtering and column reordering move the selection with
the cells instead of leaving it over whatever took those positions. A range
whose corner is filtered away is not shown, and returns when the filter is
cleared.

Move either with `ui.actions.setFocusedCell` / `setCellRange`, follow them with
`onFocusedCellChange`, or read them with TanStack Store's
[`useSelector`](https://tanstack.com/store/latest/docs/framework/react/reference):

```tsx
const focusedCell = useSelector(grid.ui, (state) => state.focusedCell);
```

One rectangle at a time. Ctrl+drag for a second, disjoint block is not
supported.

### System lanes

The generated lanes (checkbox, tree, details) are part of the selection. They
take the tint and the outline, so the block stays a rectangle and the arrow keys
still reach the checkbox. They are never exported. A block covering nothing else
has nothing to copy, and the Copy and Export items are disabled.

## Copy and export

Ctrl+C puts the selected block on the clipboard as tab-separated text with CRLF
between rows, the format Excel, Sheets and Numbers all write themselves, so a
paste lands in cells rather than in one column. Values only: no header row, the
same as Excel's own copy.

```demo
file: cells/CopyAndExport.tsx
hint: Select a block and press Ctrl+C. It pastes into Excel as cells, not as one string.
```

Right-clicking inside the selection opens a menu with **Copy**, **Export cells**
and an **Include headers** toggle. A right-click outside it moves the
selection there first, as a spreadsheet does. Your own
[`renderRowContextMenu`](/docs/row-interaction#context-menus) items are appended
below a divider, so turning cell selection on removes nothing. Those three items are also what that slot's `internalItems` contains.

### The file

**Export cells** writes the rectangle in the grid's export format, by default a CSV for a Nordic Excel: a `sep=;` first line, a UTF-8 BOM, CRLF endings, semicolons between fields and a comma as the decimal mark.
The format, the file name and the header row are the grid's `exportOptions`; the formats, `meta.exportValue` and `meta.enableExport` are on [Export](/docs/export).

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  cellSelection: "range",
  exportOptions: { format: csvFormat(), fileName: "employees" },
});
```

What is written is the cell's **value**, not what it renders, for the file and for Ctrl+C alike.
Ctrl+C writes numbers with the format's decimal mark, so what is pasted matches what is exported.

Exporting every filtered row rather than the rectangle is `TMDataGrid.Menu.Export` and `useTMDataGridExport`, on [Export](/docs/export).

### Export the range from your own code

`resolveRangeBounds` turns `ui.state.cellRange` into the `bounds` that `buildExportData` takes: the rectangle as row and column indices, both ends included.
The row indices count into the rows the body renders, from [`getDisplayedRows`](/docs/anatomy#which-rows-it-renders), and the column indices into the visible leaf columns in render order, start-pinned, center and end-pinned, the generated lanes included.
It returns `null` when there is no range, and when a corner's row is filtered out or its column hidden.

To export the selected range from a control of your own, pass the same rows to `buildExportData` and write the result in any format:

```tsx
const exportRange = async () => {
  const { table, features, ui } = grid;
  const rows = getDisplayedRows(table, features);
  const columns = [
    ...table.getStartVisibleLeafColumns(),
    ...table.getCenterVisibleLeafColumns(),
    ...table.getEndVisibleLeafColumns(),
  ];
  const bounds = resolveRangeBounds({
    range: ui.state.cellRange,
    rowIndexOf: (rowId) => rows.findIndex((row) => row.id === rowId),
    columnIndexOf: (columnId) =>
      columns.findIndex((column) => column.id === columnId),
  });
  if (bounds === null) return;

  const data = buildExportData({ table, rows, bounds });
  await writeExportFile(
    data,
    resolveExportOptions({ format: csvFormat(), fileName: "selection" }),
  );
};
```

`buildExportData` leaves out the generated lanes and every column with `meta.enableExport: false`, as the Export cells item does.
Unlike the Export cells item, `resolveRangeBounds` does not fall back to the focused cell when there is no range.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `cellSelection` | Option | `"none" \| "single" \| "range"` | `"none"` | Turns the cell cursor, and the rectangle, on. |
| `TMDataGridCellSelectionMode` | Type | – | – | The type of `cellSelection`. |
| `onFocusedCellChange` | Callback | `(cell \| null) => void` | – | Follows the cursor. |
| `exportOptions` | Option | `TMDataGridExportOptions` | `csvExcelFormat()`, `"export"`, headers on, `"visible"` columns | Format, file name and header row of the Export cells item. See [Export](/docs/export). |
| `ui.state.focusedCell` | UI state | `{ rowId, columnId } \| null` | `null` | The cursor. |
| `ui.state.cellRange` | UI state | `{ anchor, focus } \| null` | `null` | The rectangle's two corners. |
| `ui.actions.setFocusedCell` · `setCellRange` | UI actions | – | – | Move either from your own code. |
| `toClipboardText` · `writeClipboardText` | Exports | – | – | The pieces behind Ctrl+C. |
| `TMDataGridClipboardTextOptions` | Type | `{ decimalComma?, escapeFormulas? }` | – | The options of `toClipboardText`. |
| `buildExportData` | Export | `({ table, rows, bounds }) => TMDataGridExportData` | – | The rectangle's values, with `bounds`. |
| `resolveRangeBounds` | Export | `({ range, rowIndexOf, columnIndexOf }) => TMDataGridRangeBounds \| null` | – | The range as row and column indices, the `bounds` that `buildExportData` takes. `null` when a corner is filtered out or hidden. See [Export the range from your own code](#export-the-range-from-your-own-code). |
| `ResolveRangeBoundsArgs` · `TMDataGridRangeBounds` | Types | – · `{ top, bottom, left, right }` | – | What `resolveRangeBounds` takes, and what it returns. |
| `labels.copy` · `labels.exportCells` · `labels.includeHeaders` · `labels.cellCount` | Labels | – | – | The menu's strings. |
| `data-focused` | Data attribute | – | – | On the focused cell. |
| `data-edge-top` · `-bottom` · `-left` · `-right` | Data attributes | – | – | On cells at the rectangle's border. |
