# Row pinning and numbering

Two independent features: rows stuck to the top or bottom of the body so they
stay in view, and a gutter numbering the rows.

## Pinning rows

Opt in with `enableRowPinning: true`, or a per-row predicate.

```tsx
const grid = useTMDataGrid({ data, columns, enableRowPinning: true });
```

Pinned rows leave the scrolling order and render in sticky blocks: top-pinned
rows under the header (and under the entry block while one is open),
bottom-pinned rows above the summary row.

There is no built-in pin gesture and no pin icon. The grid provides `row.pin()`
on every row, callable from anywhere a row is rendered. Two places are
convenient for it.

A **lane of your own**, a display column whose cell is a pin button:

```tsx
function PinToggle({ row }: { row: Row<TMDataGridFeatures, Employee> }) {
  // Subscribed rather than called in the component body: the React Compiler
  // caches a bare call along with the stable `row` identity.
  const pinned = useSelector(row.table.store, () => row.getIsPinned());
  return (
    <ActionIcon
      variant={pinned === false ? "subtle" : "light"}
      color={pinned === false ? "gray" : "blue"}
      aria-label={pinned === false ? "Pin to top" : "Unpin"}
      // The row underneath may select or highlight on click.
      onClick={(event) => {
        event.stopPropagation();
        row.pin(pinned === false ? "top" : false);
      }}
    >
      {pinned === false ? <IconPin size={16} /> : <IconPinFilled size={16} />}
    </ActionIcon>
  );
}

const pinColumn = columnHelper.display({
  id: "pin",
  header: "",
  // Columns are fluid - `minmax(minSize, flex fr)` - so a control lane states
  // one width three times to opt out. See [Sizing](/docs/column-layout#sizing).
  size: 44,
  minSize: 44,
  maxSize: 44,
  meta: { label: "Pin", align: "center" },
  enableResizing: false,
  enableSorting: false,
  cell: ({ row }) => <PinToggle row={row} />,
});
```

Or the **row context menu**, which reaches a row at either edge as well as one
in the body:

```tsx
<TMDataGrid.Table<Employee>
  renderRowContextMenu={({ row }) => (
    <>
      {row.getIsPinned() !== "top" && (
        <Menu.Item onClick={() => row.pin("top")}>Pin to top</Menu.Item>
      )}
      {row.getIsPinned() !== false && (
        <Menu.Item onClick={() => row.pin(false)}>Unpin</Menu.Item>
      )}
    </>
  )}
/>
```

Include a way to unpin.

```demo
file: rows/PinningAndNumbers.tsx
hint: Click a pin, or right-click a row for either edge, then scroll.
```

`row.pin("top" | "bottom" | false)`, `row.getIsPinned()` and `row.getCanPin()`
are TanStack's own APIs; the state is `rowPinning: { top: string[], bottom:
string[] }`, settable wholesale with `table.setRowPinning()` or seeded through
`initialState`.

### Pinned row behaviour

Selection, editing, details, the context menu and per-row styling all behave as
they do in the body. Pinned rows are excluded only from the features that
depend on scroll *order* - striping and the cell range - and the row-number
gutter leaves them unnumbered.

Also note:

- A pinned row stays at its edge even when a filter or the pager would have
  dropped it from the body.
- A pinned id whose row leaves `data` (a delete, a server-side page swap) is not
  shown. It stays in state and the row returns to its edge if its data comes
  back.
- **Group rows never pin.** A leaf whose group is collapsed stays hidden while
  pinned.
- `rowPinning` is **not** persisted. Row ids are data, and the settings group
  holds layout only.

## Numbering rows

`enableRowNumbers: true` adds a gutter, outermost left, before every other
lane.

```tsx
const grid = useTMDataGrid({ data, columns, enableRowNumbers: true });
```

It numbers **the current view**: sorted, filtered, and continuing across pages
rather than restarting on each one. The number is a position, not an identifier
for the record; for that, add a column of your own over the record's id. Group
rows and pinned rows take no number.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableRowPinning` | Table option | `boolean \| (row) => boolean` | `false` | Whether rows can be pinned. |
| `initialState.rowPinning` | Table option | `{ top: string[], bottom: string[] }` | empty | Rows pinned at mount. Not persisted. |
| `enableRowNumbers` | Option | `boolean` | `false` | Adds the row-number gutter. |
| `row.pin` | Row method | `("top" \| "bottom" \| false) => void` | – | Pins or unpins one row. |
| `row.getIsPinned` | Row method | `() => "top" \| "bottom" \| false` | – | Where a row is pinned. |
| `ROW_NUMBER_COLUMN_ID` | Export | `"__rowNumber__"` | – | Id of the generated number gutter. |
