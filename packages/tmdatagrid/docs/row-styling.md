# Row styling

Colouring rows by their contents, such as an overdue invoice in red.

```tsx
<TMDataGrid.Table<Employee>
  rowStyle={(row) =>
    !row.getIsGrouped() && row.original.status === "Terminated"
      ? { "--row-bg": "color-mix(in srgb, var(--mantine-color-red-6) 12%, transparent)" }
      : undefined
  }
/>
```

Group rows are handed to `rowStyle` and `rowClassName` too, and a group row's `original` is an arbitrary child's record.
Guard a callback that reads `original` with `row.getIsGrouped()`, or match `data-grouped="true"` to style the group rows themselves.

```demo
file: rows/RowStyling.tsx
hint: Select and hover a coloured row - both still show through the row background.
```

## Set the row background

Set `--row-bg` rather than `background`. Hover, selection, the highlight, the
cell range and striping each add a background over the row and are composed
against `--row-bg`; `background` overrides all of them, so a coloured row stops
responding to hover and selection.

```tsx
rowStyle={() => ({ background: "pink" })}          // hover and selection hidden
rowStyle={() => ({ "--row-bg": "pink" })}          // both still show
```

`rowStyle` accepts `CSSProperties` or an object of custom properties. The type
is a union, so a callback returning either compiles.

Pick a colour that reads under both colour schemes. A `-0` Mantine shade
(`red-0`) is near-white, which turns unreadable behind light text in the dark
scheme; mixing a mid shade into transparency tints both schemes evenly:
`color-mix(in srgb, var(--mantine-color-red-6) 12%, transparent)`.

The grid composes `--row-bg` over the theme's body colour, so a translucent value tints the row and stays opaque under the pinned columns and the pinned rows.

## One cell, not the row

There is no `cellStyle` or `cellClassName`. Style a single cell from the
column's own `cell` renderer, which owns the element you want to colour:

```tsx
columnHelper.accessor("age", {
  cell: ({ getValue }) => {
    const age = getValue();
    return <span style={{ color: age > 60 ? "var(--mantine-color-red-6)" : undefined }}>{age}</span>;
  },
});
```

From a stylesheet, match the cell's `data-column-id` under a `rowClassName`.
Body cells carry no `data-dg-part`; the coordinate attributes identify them:

```css
.overdue [data-column-id="dueDate"] {
  font-weight: 600;
}
```

## Classes instead

`rowClassName` takes the same shape and adds to the grid's own classes, for
when the styling belongs in a stylesheet:

```tsx
<TMDataGrid.Table<Invoice>
  rowClassName={(row) => (row.original.overdue ? classes.overdue : undefined)}
/>
```

```css
.overdue {
  --row-bg: color-mix(in srgb, var(--mantine-color-red-6) 12%, transparent);
  font-weight: 600;
}
```

## Striping

`striped` gives every second row `--dg-row-striped-bg`. Striping follows the
row's **position in the view**, so it survives sorting, filtering and
virtualization rather than sticking to particular records.

```tsx
<TMDataGrid.Table striped />
```

Pinned rows are not striped: they have left the scrolling order.

## Hover

A row takes the hover tint under the pointer when the row itself answers a
gesture: `selectionMode: "row"` or a highlight mode, `onRowClick`, or
`renderRowContextMenu`. A grid with none of those shows no hover tint, and a
group row never does, since it sits out those gestures.

`highlightOnHover` overrides that: `true` tints every row, `false` none.

```tsx
<TMDataGrid.Table highlightOnHover={false} />
```

A row carries `data-highlight-on-hover="true"` while the tint applies.

## Styling by state

Rows carry data attributes for their state, so a stylesheet can target any of
it without a callback:

| Attribute | On |
| --- | --- |
| `data-selected` | Selected rows |
| `data-selected-bg` | Selected rows that also take the background |
| `data-highlighted` | The highlighted row |
| `data-grouped` | Group rows |
| `data-depth` | Every row. The nesting level |
| `data-context-menu` | The row whose context menu is open |
| `data-highlight-on-hover` | Rows that take the hover tint. See [Hover](#hover) |
| `data-row-id` | Every row. Its id, which [tests](/docs/testing) key off |

The state attributes are present, with the value `"true"`, only on the rows
they apply to, so the bare attribute and the value match the same rows:

```css
[data-dg-part="row"][data-grouped="true"] {
  --row-bg: color-mix(in srgb, var(--mantine-color-gray-6) 12%, transparent);
  font-weight: 600;
}
```

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `rowStyle` | Table prop | `TMDataGridRowStyle \| (row) => TMDataGridRowStyle` | – | Inline style for a body row. |
| `rowClassName` | Table prop | `string \| (row) => string \| undefined` | – | Class for a body row, added after the grid's own. |
| `striped` | Table prop | `boolean` | `false` | Every second row takes `--dg-row-striped-bg`. |
| `highlightOnHover` | Table prop | `boolean` | On for rows that answer a click or a right-click | Whether a body row takes the hover tint. |
| `TMDataGridRowStyle` | Export | type | – | `CSSProperties` or an object of `--*` custom properties. |
| `--row-bg` | CSS variable | colour | – | The row's own background, composed over the body colour and under hover, selection and range. |
| `--dg-row-striped-bg` | CSS variable | colour | Themed | The stripe colour. |
| `--dg-row-height` | CSS variable | length | From `size` | Row height. `meta.rowHeight` is the supported way to change it. |
