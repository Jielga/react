---
name: cell-selection
description: >
  Cell cursor, ranges and the clipboard in TMDataGrid. Covers the cellSelection
  option and its none / single / range modes, the keyboard map (arrows,
  Shift+arrows, PageUp/PageDown, Home/End, Enter, F2, Escape, Space, Ctrl+C),
  the one-tab-stop rule and the in-row Tab walk over controls inside cells, the
  role flip from table/cell to grid/gridcell, ui.state.focusedCell and
  ui.state.cellRange keyed by id, onFocusedCellChange, and the Copy / Export
  cells / Include headers context menu that writes the rectangle in the grid's
  exportOptions format. Load when adding keyboard cell navigation, selecting
  blocks of cells, copying to a spreadsheet, or when Tab walks through controls
  inside the grid body. Exporting whole rows is the data skill.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.2.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/cell-selection.md'
  - 'Jielga/react:packages/tmdatagrid/src/core/cellNavigation.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/cellRange.ts'
  - 'Jielga/react:packages/tmdatagrid/src/core/export.ts'
---

# TMDataGrid - Cell selection

A cell cursor moved with the arrow keys, a rectangle of cells that can be
dragged out, and a Ctrl+C that pastes into Excel as cells rather than as one
string. Off by default.

```tsx
const grid = useTMDataGrid({ data, columns, cellSelection: "range" });
```

| Mode | What it gives |
| --- | --- |
| `"none"` (default) | Nothing |
| `"single"` | One focused cell, moved with the arrow keys |
| `"range"` | As `"single"`, plus a rectangle, Ctrl+C and the export menu |

Setting `editing` defaults `cellSelection` to `"single"`, since editing
navigates by cursor. An explicit `cellSelection` always wins.

Turning it on changes three things about the body:

- The tab stop moves from the row to a cell, so the whole grid is **one** Tab
  stop and the arrow keys move within it.
- The grid reports itself as a `grid` of `gridcell`s rather than a `table` of
  `cell`s, which tells a screen reader those keys are live.
- The focused cell takes `data-focused`, selected ones `data-selected` and
  `data-edge-*`.

## Keys

| Key | Does |
| --- | --- |
| Arrows | Moves one cell, clamped at the edges, no wrapping |
| Shift+arrows | Extends the rectangle from its anchor (`"range"`) |
| PageUp / PageDown | Moves one viewport of rows |
| Home / End | First / last cell of the row |
| Ctrl+Home / Ctrl+End | First / last cell of the grid |
| Enter or F2 | Steps into the cell - its checkbox, link or button |
| Escape | Steps back out, or drops the rectangle to the focused cell |
| Space | Selects the row, as a row click does under `selectionMode: "row"` |
| Ctrl+C | Copies the selection as tab-separated text |

Enter and F2 are the pair a cell editor takes over. Until then they focus the
first control in the cell, and the arrow keys go quiet while focus is in there -
a cell's contents own their own keys.

## One tab stop

The body is one tab stop in each direction. Tab from a cell leaves the grid and
Shift+Tab leaves it backwards, however many rows are mounted and whatever those
rows hold.

A control inside a body cell needs no `tabIndex`. Enter or F2 steps into the
cell and onto its first control, Escape steps back out to the cell, and Space
ticks the row from any of its cells without stepping in.

Once the focus is on a control, Tab walks the rest of that row's controls - its
open editors, the buttons in its cells, and on an open row the edit lane's save
and cancel. Past the row's last control the cursor moves to the next row's first
cell, and Shift+Tab before its first control moves to the previous row's last
cell; neither opens the row it lands on. From the last row, Tab leaves the grid.

Header controls are untouched - the header row is not part of cell navigation.

## Where the selection lives

`ui.state.focusedCell` is a `{ rowId, columnId }` pair, and `ui.state.cellRange`
is two of them: the anchor and the moving corner. They hold **ids rather than
indices**, so sorting, filtering and column reordering move the selection with
the cells instead of leaving it over whatever took those positions. A range
whose corner is filtered away paints nothing, and returns when the filter is
cleared.

```tsx
const focusedCell = useSelector(grid.ui, (state) => state.focusedCell);

grid.ui.actions.setFocusedCell({ rowId: "42", columnId: "salary" });
```

One rectangle at a time; Ctrl+drag for a second, disjoint block is not
supported.

The generated lanes (checkbox, tree, details) are part of the selection: they
take the tint and the outline so the block stays a rectangle. They are never
*exported*, because they hold controls rather than values. A block covering
nothing else has nothing to copy, and the Copy and Export items are disabled.

## Copy and export

Ctrl+C puts the block on the clipboard as tab-separated text with CRLF between
rows, the format Excel, Sheets and Numbers all produce themselves. Values only:
Excel's own copy carries no header row either.

Right-clicking inside the selection opens Copy, "Export cells" and an
"Include headers" toggle. A right-click outside it moves the selection there
first, the way a spreadsheet does. Your own `renderRowContextMenu` items are appended
below a divider, so nothing is lost by turning cell selection on.

"Export cells" writes the rectangle in the grid's export format - by default a
CSV for a Nordic Excel: a `sep=;` first line, a UTF-8 BOM, CRLF endings,
semicolons between fields and a comma as the decimal mark. The format, the file
name and the header row are the grid's `exportOptions`:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  cellSelection: "range",
  exportOptions: { format: csvFormat(), fileName: "employees" },
});
```

What gets written is the cell's **value**, not what it renders, for the file and
for Ctrl+C alike; `meta.exportValue` substitutes a value and
`meta.enableExport: false` drops a column from both. Ctrl+C writes numbers with
the format's decimal mark, so what is pasted matches what is exported.

Exporting every filtered row rather than the rectangle is
`TMDataGrid.Menu.Export`, `TMDataGrid.Menu.ExportSelected` and
`useTMDataGridExport`, covered by the data skill.

## Common mistakes

### CRITICAL A cell control given a tab index of its own

The grid keeps every control in a body cell out of the page's tab order and
reaches them by stepping into the cell. A `<Button>` or `<Checkbox>` handed
`tabIndex={0}` puts one tab stop per mounted row back, and how many that is
depends on the scroll position, which makes the bug look intermittent.

Wrong:

```tsx
const OpenButton = ({ row }) => (
  <Button tabIndex={0} onClick={() => open(row.id)}>
    Open
  </Button>
);
```

Correct:

```tsx
const OpenButton = ({ row }) => <Button onClick={() => open(row.id)}>Open</Button>;
```

Source: `packages/tmdatagrid/docs/cell-selection.md` (One tab stop).

### HIGH Selectors written for `table` / `cell` roles

The grid reports `grid` and `gridcell` once cell selection is on, so a test or a
query written against `getByRole("cell")` stops resolving the moment the option
is set - including when `editing` turns it on implicitly.

Source: `packages/tmdatagrid/docs/cell-selection.md`, and the `testing` skill.

### HIGH Reading the selection as row and column indices

`focusedCell` and `cellRange` hold `{ rowId, columnId }`. Code that converts them
to indices to look values up gets the wrong cell after any sort, filter or column
move - which is exactly what ids were chosen to avoid.

Correct:

```tsx
const row = grid.table.getRow(focusedCell.rowId);
const value = row.getValue(focusedCell.columnId);
```

Source: `packages/tmdatagrid/docs/cell-selection.md` (Where the selection lives).

### MEDIUM Expecting the export to match what the cells show

A cell renders React - often a badge, a link or a formatted string - and the
export writes the underlying value. A currency cell showing `32 000 kr` exports
`32000`. Set `meta.exportValue` on the column, or post-process the data from
`buildExportData`, if the file must match the screen.

Source: `packages/tmdatagrid/docs/cell-selection.md` (The file).

### MEDIUM Expecting headers in the clipboard

Ctrl+C copies values only, matching Excel's own copy. Headers are an option of
the export menu and of `exportOptions`, not of the clipboard path.

Source: `packages/tmdatagrid/docs/cell-selection.md` (Copy and export).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `cellSelection` | Option | `TMDataGridCellSelectionMode`: `"none" \| "single" \| "range"` | `"none"`, or `"single"` under `editing` | Turns the cursor, and the rectangle, on. |
| `onFocusedCellChange` | Callback | `(cell \| null) => void` | – | Follows the cursor. |
| `exportOptions` | Option | `TMDataGridExportOptions` | `csvExcelFormat()`, `"export"`, headers on, `"visible"` columns | Format, file name and header row of the Export cells item. |
| `ui.state.focusedCell` | UI state | `{ rowId, columnId } \| null` | `null` | The cursor. |
| `ui.state.cellRange` | UI state | `{ anchor, focus } \| null` | `null` | The rectangle's two corners. |
| `ui.actions.setFocusedCell` · `setCellRange` | UI actions | – | – | Move either from your own code. |
| `buildExportData` | Export | `({ table, rows, bounds }) => TMDataGridExportData` | – | The rectangle's values, with `bounds`; the whole grid without. |
| `toClipboardText` · `writeClipboardText` | Exports | `(data, options?) => string` · `(text) => Promise<boolean>` | – | The pieces behind Ctrl+C: the tab-separated text, and the write that reports whether it landed. |
| `TMDataGridClipboardTextOptions` | Type | `{ decimalComma?, escapeFormulas? }` | `true` · `true` | The options of `toClipboardText`. |
| `formatExportValue` | Export | `(value, options) => string` | – | One value, formatted as the text formats would. |
| `resolveRangeBounds` | Export | `({ range, rowIndexOf, columnIndexOf }) => TMDataGridRangeBounds \| null` | – | The range as row and column indices - the `bounds` for `buildExportData`, over `getDisplayedRows`. |
| `ResolveRangeBoundsArgs` · `TMDataGridRangeBounds` | Types | – · `{ top, bottom, left, right }` | – | What `resolveRangeBounds` takes, and what it returns. |
| `data-focused` | Data attribute | – | – | On the focused cell. |
| `data-edge-top` · `-bottom` · `-left` · `-right` | Data attributes | – | – | On cells at the rectangle's border. |

See also: the `editing` skill, which turns this on implicitly and takes over
Enter and F2, and the `rows` skill for `renderRowContextMenu`, whose
`internalItems` are exactly the copy and export items described here.
