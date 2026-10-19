---
name: rows
description: >
  Everything a TMDataGrid row does beyond holding cells. Covers selectionMode
  and its four modes (checkbox, row, checkboxAndHighlight, highlight), the
  highlight as state of its own with defaultHighlightedRowId and
  onHighlightedRowChange, showSelectedBackground and --dg-row-selected-bg,
  reading a selection through the table store, onRowClick / onCellClick /
  onCellDoubleClick / onCellContextMenu, the renderRowContextMenu slot with its
  internalItems handback, renderColumnMenuItems and rowContextMenuProps, per-row
  styling with rowStyle, rowClassName, striped and the --row-bg rule, the row
  details panel through renderDetails, detailsColumnPosition and
  DETAILS_COLUMN_ID, row pinning with enableRowPinning and row.pin, and the
  row-number gutter through enableRowNumbers. Load when selecting rows, reacting
  to a click, opening a detail panel, colouring rows by their data, pinning rows
  to an edge, or numbering them.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.1.4'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/row-selection.md'
  - 'Jielga/react:packages/tmdatagrid/docs/row-interaction.md'
  - 'Jielga/react:packages/tmdatagrid/docs/column-menu.md'
  - 'Jielga/react:packages/tmdatagrid/docs/row-styling.md'
  - 'Jielga/react:packages/tmdatagrid/docs/row-details.md'
  - 'Jielga/react:packages/tmdatagrid/docs/row-pinning.md'
  - 'Jielga/react:packages/tmdatagrid/src/core/rowSelection.ts'
---

# TMDataGrid - Rows

Selecting rows, reacting to clicks, colouring them, opening a panel under one,
and pinning or numbering them. Column-side concerns are the `columns` skill;
cell cursors and ranges are `cell-selection`.

## Selection

`selectionMode` sets what selecting looks like **and** what a bare row click
does. A bare click either toggles the selection or moves the highlight, never
both.

| Mode | Checkbox column | Row click |
| --- | --- | --- |
| `"checkbox"` (default) | yes, multi-select | nothing |
| `"row"` | no | selects, with the usual modifiers |
| `"checkboxAndHighlight"` | yes, multi-select | highlights one row |
| `"highlight"` | no | highlights one row, no selection at all |

```tsx
const grid = useTMDataGrid({ data, columns, selectionMode: "row" });
```

The first two write to TanStack's `rowSelection`, so `getSelectedRowModel()`
and `onRowSelectionChange` behave the same either way. Under
`"row"` the click follows desktop-list conventions: a plain click
makes the selection this row, Ctrl/Cmd toggles it and leaves the rest, Shift
selects the range from the anchor, Ctrl+Shift adds that range. Rows are
focusable in this mode, and Space or Enter toggles the focused row.

`enableRowSelection: false` removes the checkbox column and row-click selection
in any mode.

### The highlighted row

The highlight is state of its own, not a slice of `rowSelection`. That is what
lets `"checkboxAndHighlight"` run both at once: tick rows for a bulk action,
click one to open its record beside the grid.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  selectionMode: "highlight",
  defaultHighlightedRowId: routeId,
  onHighlightedRowChange: (rowId) =>
    navigate({ to: "/employees/$id", params: { id: rowId ?? "" } }),
});
```

### Reading a selection

Read it through the table store rather than by calling the method directly.
A bare read is stale in any component that does not call `useTMDataGrid`
itself, and under the React Compiler also in the one that does; `useSelector`
subscribes either way.

```tsx
import { useSelector } from "@tanstack/react-store";

const selected = useSelector(grid.table.store, () =>
  grid.table.getSelectedRowModel().rows,
);
```

### The background

`showSelectedBackground` follows the mode: on for `"row"`, where the background
is the only feedback a click gives, and off for `"checkbox"`, where the box
already shows it. Set it explicitly to override either way. The colour is
`--dg-row-selected-bg`, set on the grid element rather than through the flag:

```tsx
<TMDataGrid
  {...grid}
  style={{ "--dg-row-selected-bg": "var(--mantine-color-blue-0)" }}
/>
```

A group row's checkbox selects every record under it at any depth, shows a tick
once all are selected and a dash while only some are, and writes only the
records to `rowSelection`.

## Clicks and context menus

Every handler **composes** with what the click already does. `onRowClick` does
not replace selection or the highlight; yours runs in addition.

| Handler | Argument | Notes |
| --- | --- | --- |
| `onRowClick` | `row` | Rows show a pointer cursor when set |
| `onCellClick` | `{ cell, row, column, event }` | The cell cursor still moves |
| `onCellDoubleClick` | same | A double-click that opens an editor still does |
| `onCellContextMenu` | same | `renderRowContextMenu` still opens |

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

Pass the row type, as above, and `row.original` is typed. None of the four fires
on a group row: TanStack builds a group row on its first child's record, so a
handler would receive a row that looks real but is the wrong one.

`renderRowContextMenu` supplies the contents of the menu. The grid renders the
Mantine `Menu`, opens it at the pointer and closes it on Escape, an outside
click, a body scroll and after an item is picked.

```tsx
<TMDataGrid.Table<Employee>
  renderRowContextMenu={({ table, row, cell }) => (
    <>
      <Menu.Label>{row.original.firstName}</Menu.Label>
      <Menu.Item onClick={() => open(row.original.id)}>Open</Menu.Item>
      <Menu.Item
        onClick={() =>
          navigator.clipboard.writeText(String(cell?.getValue() ?? ""))
        }
      >
        Copy cell value
      </Menu.Item>
    </>
  )}
  rowContextMenuProps={{ width: 260, position: "right-start" }}
/>
```

It is called **during render**, only for the row whose menu is open, so keep it
a pure function of its arguments and do the work in the item handlers. Return
`null` to leave a row without a menu. Right-clicking does not select: it marks
the row with `data-context-menu` while its menu is open, so an action meant for
a multi-selection reads `table` and falls back to the clicked row.

Under `cellSelection: "range"` the grid has its own items for this menu: copy,
export and include headers. `internalItems` holds those items, and **using it
takes over the composition**. Place it, and the menu is exactly what you
returned. Omit it, and the grid renders its items above a divider and yours
below.

```tsx
renderRowContextMenu={({ row, internalItems }) => (
  <>
    <Menu.Item onClick={() => open(row.id)}>Open</Menu.Item>
    <Menu.Divider />
    {internalItems}
  </>
)}
```

`renderColumnMenuItems` is the same idea for a column's menu, and returns an
array rather than a node:

```tsx
<TMDataGrid.Table
  renderColumnMenuItems={({ column, internalItems }) => [
    ...internalItems,
    <Menu.Item key="stats" onClick={() => showStats(column.id)}>Stats</Menu.Item>,
  ]}
/>
```

Returning an empty list leaves the column with no menu button at all.

Source: `packages/tmdatagrid/docs/column-menu.md`.

## Row styling

```tsx
<TMDataGrid.Table<Employee>
  striped
  rowStyle={(row) =>
    !row.getIsGrouped() && row.original.status === "Terminated"
      ? { "--row-bg": "color-mix(in srgb, var(--mantine-color-red-6) 12%, transparent)" }
      : undefined
  }
  rowClassName={(row) => (row.original.overdue ? classes.overdue : undefined)}
/>
```

A row is a strip of cells, some sticky in pinned lanes, and hover, selection,
the highlight, the cell range and striping all paint on top of it. `--row-bg`
sets the variable those layers compose against; `background` overrides all of
them and they stop showing. `striped` follows position in the view, so it
survives sorting and filtering rather than sticking to records, and pinned rows
are not striped.

Rows carry `data-selected`, `data-selected-bg`, `data-highlighted`,
`data-grouped`, `data-depth`, `data-context-menu` and `data-row-id`, so a
stylesheet can target any of it without a callback. The boolean attributes are
present, with the value `"true"`, only while they apply - `data-grouped` only
on group rows - so `[data-grouped]` and `[data-grouped="true"]` are
equivalent. Pick a `--row-bg` that
reads under both colour schemes - a `-0` Mantine shade is near-white and
unreadable in dark mode; mix a mid shade into transparency instead.

## The details panel

Setting `renderDetails` turns the lane on. There is no flag.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  renderDetails: ({ row }) => <EmployeeCard employee={row.original} />,
});
```

The panel opens below the row's cells, which stay where they are; there is no
mode in which a panel replaces the row. Each panel is measured, so heights need
not be uniform. `renderDetailsEstHeight` (default `160`) is what the virtualizer
assumes for one it has not measured yet; set it to the typical panel height.
`DETAILS_COLUMN_ID` is a generated chevron lane. It is pinned left, after the
checkbox and tree lanes; under `detailsColumnPosition: "right"` it is pinned
right, inside the edit lane. It cannot be hidden, moved, resized or unpinned.
Its header opens and closes every panel.

Which rows are open is TanStack's own `expanded` state, so anything can open
one - `row.toggleExpanded()` from a menu item, `initialState.expanded`,
`table.toggleAllRowsExpanded()` - and it persists as a `data` slice. The panel
is a cell spanning the row, not a row: `aria-rowcount` still counts records, and
a click inside it does not select the row underneath. Group rows have no panel;
expanding one opens its children.

Rows are virtualized. A row that leaves the viewport and the `overscan`
unmounts, and its panel unmounts with it, so state held inside the panel is
lost; keep such state outside the grid, keyed by `row.id`. `renderDetails` runs
on every render of the body, so give a heavy panel a `memo` component and pass
it `row.original`, not the row. Key a stateful child by `row.id`; that is stable
only when `getRowId` returns the entity id.

## Pinning and numbering

Two independent lanes at the edges.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  enableRowPinning: true,
  enableRowNumbers: true,
});
```

There is no built-in pin gesture and no pin icon. Build one from TanStack's own
`row.pin("top" | "bottom" | false)`, `row.getIsPinned()` and `row.getCanPin()`,
either as a display column whose cell is a pin button or in the row context
menu. Read the pinned state through a subscription
(`useSelector(row.table.store, () => row.getIsPinned())`) rather than calling it
in a component body. The `row` identity survives a pin, so the React Compiler
would cache the call and the icon would never change. Whichever control you
build, include unpin in it. Pinned rows leave the scrolling order and render in
sticky blocks: top under the header, bottom above the summary row.

Pinned rows are still body rows: selection, editing, details, the context menu
and per-row styling all behave normally. They are excluded only from the
features that depend on scroll order: striping, the cell range and the number
gutter. A pinned row stays at its edge even when a filter or the pager would
have dropped it, and **group rows never pin**.

`enableRowNumbers` adds a gutter outermost left that numbers the current view:
sorted, filtered, continuing across pages. The number is a position in the
current view, not an identifier for the record. For a stable identifier, add a
column of your own over the record's id.

## Common mistakes

### CRITICAL Setting `background` in `rowStyle`

A coloured row stops responding to hover, selection, the highlight and the cell
range, because `background` paints over every layer composed on top of the row.
Nothing errors; the row stops reacting.

Wrong:

```tsx
rowStyle={() => ({ background: "pink" })}
```

Correct:

```tsx
rowStyle={() => ({ "--row-bg": "pink" })}
```

Source: `packages/tmdatagrid/docs/row-styling.md` (Set the row background).

### CRITICAL Reading the selection without subscribing

A bare read is stale in any component that does not call `useTMDataGrid`
itself, and under the React Compiler also in the one that does; `useSelector`
subscribes either way. A stale count renders once and then never changes.

Wrong:

```tsx
const selected = grid.table.getSelectedRowModel().rows;
```

Correct:

```tsx
const selected = useSelector(grid.table.store, () =>
  grid.table.getSelectedRowModel().rows,
);
```

Source: `packages/tmdatagrid/docs/row-selection.md` (Acting on a selection).

### HIGH Looking for the highlight in `rowSelection`

The highlight is separate state, which is what lets `"checkboxAndHighlight"`
run both at once. It never appears in `rowSelection` or
`getSelectedRowModel()`.

Wrong:

```tsx
// Always empty under selectionMode: "highlight".
const current = Object.keys(grid.table.store.state.rowSelection)[0];
```

Correct:

```tsx
const current = useSelector(grid.ui, (state) => state.highlightedRowId);
```

Source: `packages/tmdatagrid/docs/row-selection.md` (The highlighted row).

### HIGH Expecting a click handler to replace the built-in behaviour

`onRowClick` composes. Under `selectionMode: "row"` a click both selects and
runs the handler, so a handler that navigates away will also have changed the
selection on the way out.

Correct, when the click should only navigate:

```tsx
// "highlight" moves a marker and selects nothing.
useTMDataGrid({ data, columns, selectionMode: "highlight" });
```

Source: `packages/tmdatagrid/docs/row-interaction.md`.

### HIGH Reading `row.getIsExpanded()` in a cell without subscribing

Same mechanism as the selection above: the compiler caches the call against the
`row` identity, so a custom expand control renders its initial state forever.

Correct:

```tsx
const expanded = useSelector(row.table.store, () => row.getIsExpanded());
```

Source: `packages/tmdatagrid/docs/row-details.md` (Opening a row from elsewhere).

### MEDIUM Assuming group rows behave like data rows

Group rows are built on their first child's record. They do not fire
`onRowClick`, `onCellClick`, `onCellDoubleClick` or `onCellContextMenu`, they
never pin, they take no row number, and they have no details panel. A handler
written as though every row reaches it silently skips them.

Source: `packages/tmdatagrid/docs/row-interaction.md`, `packages/tmdatagrid/docs/row-pinning.md`.

### MEDIUM Keeping state inside a details panel

A panel unmounts with its row when the row leaves the virtual window, so a form
or an accordion inside `renderDetails` loses its state on a long scroll and
comes back reset.

Correct: hold the state outside the grid, keyed by `row.id`, and pass it in.

```tsx
const [drafts, setDrafts] = useState<Record<string, Draft>>({});
useTMDataGrid({
  data,
  columns,
  renderDetails: ({ row }) => (
    <DetailsForm draft={drafts[row.id]} onChange={(d) => setDrafts((all) => ({ ...all, [row.id]: d }))} />
  ),
});
```

`autoResetExpanded` is already `false` by default, so a refetch does not close
the panels; pass `autoResetExpanded: true` to get TanStack's collapse back.

Source: `packages/tmdatagrid/docs/row-details.md` (Panel behaviour).

### MEDIUM Expecting pinned rows to persist

`rowPinning` is deliberately left out of `settingsKey`: row ids are data, and the
layout store outlives any one data set. A pinned id whose row leaves `data` is
not shown, and returns to its edge if the data comes back.

Source: `packages/tmdatagrid/docs/row-pinning.md`.

## References

- [Rows API](references/rows-api.md) - every option, table prop, callback,
  export, CSS variable and data attribute belonging to these five topics.

See also: the `grouping` skill for group rows and the tree lane, the
`cell-selection` skill for the cell cursor and ranges, and the `appearance`
skill for the CSS variables named here.
