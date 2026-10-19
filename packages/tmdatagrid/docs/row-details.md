# Row details

A panel that opens underneath a row, spanning every column, holding whatever
does not fit in the cells - a summary card, an action strip, a nested table.

Setting `renderDetails` turns the lane on. There is no separate flag.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  renderDetails: ({ row }) => <EmployeeCard employee={row.original} />,
});
```

```demo
file: rows/DetailsPanel.tsx
hint: Expand a few rows - the panels differ in height, and each one is measured.
height: 460
```

The panel is as tall as whatever it renders. The grid measures each one, so
they need not be uniform. `renderDetailsEstHeight` (default `160`) is what the
virtualizer assumes for a panel it has not measured yet, which keeps the
scrollbar accurate for rows that open off screen.

## The details lane

Setting `renderDetails` adds a generated chevron column, `DETAILS_COLUMN_ID`
(`"__details__"`). By default it is pinned to the left after the checkbox and
tree columns - `[checkbox, tree, details, …]`. To pin it to the right edge
instead, after every column of yours and inside the edit lane, set
`detailsColumnPosition: "right"`:

```demo
file: rows/DetailsPanelRight.tsx
hint: The chevron sits at the end of each row, and the header control at the end of the header.
```

On either edge it is a system lane: as wide as the chevron it holds, with no
resize handle and no column menu, and it cannot be hidden, moved, resized or
unpinned. Its header is a control rather than a title, expanding and collapsing
every panel at once.

Group rows get no chevron: they expand into their children from the tree lane.

To give only some rows a panel, set `getRowCanExpand`:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  renderDetails: ({ row }) => <Notes notes={row.original.notes} />,
  getRowCanExpand: (row) => row.original.notes.length > 0,
});
```

A row it turns down gets no chevron, and the header control skips it.
It never applies to a group row.

## Opening a row from elsewhere

Which rows are open is TanStack's own `expanded` state, so anything can open
one - a context menu item, a double-click, a button in your own cell:

```tsx
<Menu.Item onClick={() => row.toggleExpanded()}>Show details</Menu.Item>
```

Anything reading `row.getIsExpanded()` inside a cell has to subscribe to the
store with TanStack Store's
[`useSelector`](https://tanstack.com/store/latest/docs/framework/react/reference), or the
React Compiler caches the call along with the `row` identity and the control
never updates:

```tsx
const expanded = useSelector(row.table.store, () => row.getIsExpanded());
```

Because it is the standard state, `table.toggleAllRowsExpanded()`,
`initialState.expanded` and persistence all work with it. It is one of the
`data` slices, so open panels survive a reload on a
[persisted](/docs/use-tm-data-grid#persist) grid.

> TanStack resets `expanded` whenever the `data` array changes, which would
> close every panel on each draft commit. The grid therefore sets
> `autoResetExpanded: false`; pass `autoResetExpanded: true` to have a new
> `data` array close the panels.

## A wider cell on an open row

To have an open row show something wider in the row itself - a title across
the columns, say - give that column a `meta.colSpan` that depends on
`row.getIsExpanded()`. See [Spanning columns](/docs/columns#spanning-columns).

## The two kinds of expanding

TanStack keeps one `expanded` state, and the grid uses it for two unrelated
things: opening a group row into its children, and opening a data row into its
panel. The controls are kept separate. The details header only opens and closes
panels, and "Expand all groups" in the tree menu only unfolds the tree.

`table.toggleAllRowsExpanded()` is the one that does not distinguish them: it
writes the state's whole-table form, which is every group and every panel at
once. `resolveExpandAll` and `areAllRowsExpanded` are exported for anything
building its own control:

```tsx
table.setExpanded(
  resolveExpandAll({
    rows: table.getPrePaginatedRowModel().flatRows,
    expanded: table.store.state.expanded,
    target: "details",
    expand: true,
  }),
);
```

## Panel behaviour

The panel is a cell spanning the row, inside the row element. It takes the row's
background, moves with it and is measured with it, but it is **not a row**:
`aria-rowcount` still counts records, and a click or right-click inside it does
not select or highlight the row underneath. It carries
`data-dg-part="details"` with the row's `data-row-id`. See
[Testing](/docs/testing).

Group rows have no panel. Expanding one opens its children.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `renderDetails` | Option | `({ row, table }) => ReactNode` | – | Contents of the panel. Setting it adds the lane. |
| `TMDataGridDetailsArgs` | Type | `{ row, table }` | – | What `renderDetails` receives. |
| `getRowCanExpand` | Table option | `(row) => boolean` | – | Determines which data rows have a panel. If not set, every data row has one. Group rows always expand. |
| `renderDetailsEstHeight` | Option | `number` | `160` | Height the virtualizer assumes for an unmeasured panel. |
| `detailsColumnPosition` | Option | `"left" \| "right"` | `"left"` | Which edge the lane is pinned to. `"right"` places it after every column, inside the edit lane. |
| `initialState.expanded` | Table option | `ExpandedState` | `{}` | Rows open at mount. A data slice, so it persists. |
| `autoResetExpanded` | Table option | `boolean` | `false` | `true` closes the panels when the `data` array changes. Off by default, so a draft commit keeps them open. |
| `DETAILS_COLUMN_ID` | Export | `"__details__"` | – | Id of the generated chevron column. |
| `resolveExpandAll` | Export | `(args) => ExpandedState` | – | Expand or collapse every group, or every panel, but not both. |
| `areAllRowsExpanded` | Export | `(args) => boolean` | – | Whether every row of one target is open. |
| `TMDataGridExpandAllArgs` · `TMDataGridExpandTarget` | Types | – | – | What `resolveExpandAll` and `areAllRowsExpanded` take, and its `target`: `"groups"` or `"details"`. |
| `data-dg-part="details"` | Data attribute | – | – | The panel element, carrying the row's `data-row-id`. |
