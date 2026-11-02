# Visibility, pinning, ordering and size

Four things a user can change about the layout of the grid, and one button that
resets them. All four write state that
[persists](/docs/use-tm-data-grid#persist) together, so a grid comes back
arranged the way it was left. Each is also an item in the
[column header menu](/docs/column-menu).

```demo
file: columns/ColumnLayout.tsx
hint: Drag a header to reorder · pin or hide from a column menu · drag a divider to resize, or double-click it to fit the content.
```

## Hiding

**Hide column** in any column menu, and the column chooser for the whole list at once: a search field, one checkbox per column, show/hide all, and **Reset layout**.
The chooser comes in three forms:

- `TMDataGrid.Menu.Columns` in the [grid menu](/docs/menu).
- **Manage columns**, a submenu of every column menu with the same items.
- `TMDataGrid.ColumnsPanel`, plain controls for a host that is not a menu.

`enableHiding: false` removes all of it; on a column it removes that column's
menu item and leaves it out of the panel, which lists what can be hidden and
nothing else. Show/hide all covers the same list, so a column switched off this
way keeps whatever visibility it was given. The state is TanStack's
`columnVisibility`.

The generated lanes are all `enableHiding: false` and never appear in the
panel. Each follows the feature that adds it rather than a setting of its own.

## Pinning

**Pin to left** and **Pin to right** are in each column menu. The current
position is marked, and choosing it again unpins. Pinned columns are sticky
within the scroll container. The boundary is marked with a divider and a short
gradient band, which fades in only while it is covering content.

Headers, cells and grid tracks are ordered left, centre, right from the same
source, so pinning does not change a column's position relative to its group.

A pinned column also becomes fixed-width, since sticky offsets cannot be
computed from an `fr` value. The grid writes the column's rendered width into
`columnSizing` as it is pinned, so nothing jumps.

To start pinned, set `initialState.columnPinning`. The slice is TanStack's
full `ColumnPinningState`, so a partial does not compile - name both sides.
A column pinned at mount has no rendered width to store, so it takes its
`size`, clamped between `minSize` and `maxSize`; with none of them set that is
TanStack's default of `150`. Give such a column an explicit `size`:

```tsx
columnHelper.accessor("registration", { header: "Registration", size: 220 });

initialState: { columnPinning: { start: ["registration"], end: [] } }
```

The generated lanes stay outside both pinned lanes: pinning a column right puts
it to the left of the edit lane, so the row's Save, Cancel and Delete remain
last in the row.

## Ordering

Drag a column header sideways to move it. The header being dragged dims, and a
bar marks the edge the column will land against. **Move left** and **Move
right** in the column menu do the same one step at a time, without a pointer.
Both move the header, its cells and its filter entry together.

```tsx
const grid = useTMDataGrid({ data, columns, enableColumnOrdering: false });
```

`enableColumnOrdering` is defined by the grid rather than by TanStack, which
ships the ordering state and APIs but no `enable` option. The per-column form is
`meta.enableOrdering`.

### Regions

A column can only move **within its own pinned region**; a header in another
region does not accept the drop. This follows TanStack's ordering pipeline:
pinning splits the grid into left, centre and right, then `columnOrder`
sequences the centre while `columnPinning.start` and `.end` sequence the
pinned lanes. Unpin a column first to move it out of one.

A neighbour that cannot be moved blocks the move; it is not stepped over. The
checkbox column sets `meta.enableOrdering: false`, so nothing can be placed in
front of it.

Columns inside a header group cannot be moved either, in either direction:
`columnOrder` sequences leaf columns, so moving one would leave the group header
spanning columns that no longer belong to it.

### Moving from your own code

```tsx
import { moveColumn, moveColumnByStep } from "@jielga/tmdatagrid";

moveColumn({ table, columnId: "salary", targetId: "age", side: "before" });
moveColumnByStep({ table, columnId: "salary", direction: 1 });
```

Both are no-ops for a move that is not allowed, including one across regions.
`getStepTargetColumn({ table, columnId, direction })` returns the column a step
would swap with, or `null` at the edge of a region. The menu items use it to
decide whether to disable themselves.

### State

Ordering writes `columnOrder` as the **complete** leaf order, including hidden
and pinned columns, so a column keeps its position when it is later shown or
unpinned. Moving a pinned column also rewrites its `columnPinning` array. A
column added to the definitions later is not in the stored order and is appended
at the end until it is moved.

## Sizing

Columns are fluid by default. Each track is `minmax(minSize, flex fr)`.

| Column option | Effect |
| --- | --- |
| `minSize` | Minimum width, and the column's contribution to the grid minimum width. Also the floor of a resize and of a pinned width. Defaults to `80`, through `defaultColumn.minSize`. |
| `maxSize` | Ceiling of a resize, an autosize and a pinned width. Does not cap a fluid track. No default. |
| `meta.flex` | Share of the remaining width. Defaults to `1`. |
| `minSize === maxSize` | Fixed width. The column is never fluid. |
| `size` | Width of a column pinned at mount, clamped by `minSize` and `maxSize`. Ignored on a fluid column; a resize or an interactive pin stores the rendered width instead. Defaults to `150`. |

Drag a divider to resize. A column switches to a fixed pixel width the moment
it is resized or pinned, and the width is stored in `columnSizing`. The drag
starts from the width the column is rendered with, and the grid paints it on
its own column tracks while the pointer moves; the width reaches `columnSizing`
when the pointer is released. `columnResizeMode: "onChange"` publishes it on
every move instead, at the cost of a render of the grid for each one.

### Autosizing

Double-click a column's resize divider to size it to its widest mounted
content. **Autosize column** in the column menu does the same without a
pointer, and `meta.autoSize: true` runs it once after the first rows render,
unless a persisted or user-set width already applies to the column.

**Mounted content only.** Under virtualization the unmounted rows cannot be
measured, so the width fits the visible window plus overscan. The result is
clamped to `minSize`/`maxSize` and written into `columnSizing`, so it persists
with the other widths and a later drag overrides it.

`meta.autoSize` waits for content: on a grid whose rows are fetched, the first
render has a header and no cells, so the column is sized on the render its
first cells appear in.

`autosizeColumn({ table, columnId, container })` is exported for menus and
consumer code; `container` is the grid's scroll container, or any ancestor of
the column's cells.

## Reset the layout

`resetSettings()` from the hook clears visibility, order, pinning, widths and
grouping in one call. The columns panel offers it as **Reset layout**.

```tsx
const { resetSettings } = useTMDataGrid({ data, columns });
```

To keep several named layouts and switch between them, see
[Saved views](/docs/saved-views).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableHiding` | Table option | `boolean` | `true` | Also a column option. `false` removes hiding entirely. |
| `enableColumnPinning` | Table option | `boolean` | `true` | `false` removes the pin menu items. The generated lanes stay pinned. |
| `enablePinning` | Column option | `boolean` | `true` | `false` for one column. |
| `enableColumnOrdering` | Option | `boolean` | `true` | Header dragging and the move menu items. Grid-defined. |
| `meta.enableOrdering` | Column meta | `boolean` | `true` | `false` keeps one column where it is. |
| `enableColumnResizing` | Table option | `boolean` | `true` | `false` leaves the divider as a separator only. |
| `enableResizing` | Column option | `boolean` | `true` | `false` for one column. |
| `meta.flex` | Column meta | `number` | `1` | Share of the remaining width. |
| `meta.autoSize` | Column meta | `boolean` | `false` | Autosize once, on the render the column's first cells appear in. |
| `minSize` / `maxSize` / `size` | Column options | `number` | `80` / – / – | Width bounds, and the fixed width once one applies. |
| `resetSettings` | Hook return | `() => void` | – | Clears visibility, order, pinning, widths and grouping. |
| `moveColumn` | Export | `({ table, columnId, targetId, side }) => void` | – | Moves a column beside another. |
| `moveColumnByStep` | Export | `({ table, columnId, direction }) => void` | – | Moves it one place. |
| `MoveColumnArgs` · `ColumnStepArgs` | Types | – | – | What `moveColumn` takes, and what `moveColumnByStep` and `getStepTargetColumn` take. |
| `TMDataGridDropSide` | Type | `"before" \| "after"` | – | The `side` of `MoveColumnArgs`: which edge of the target column the moved column lands on. |
| `getStepTargetColumn` | Export | `(args) => Column \| null` | – | What a step would swap with, or `null` at a region edge. |
| `keepGeneratedColumnsOutermost` | Export | `(columnPinning) => ColumnPinningState` | – | Puts the generated lanes back on the outside of both pinned lanes. The grid runs it after every pin. |
| `getColumnRegion` | Export | `(columnPinning, columnId) => "start" \| "center" \| "end"` | – | Which pinned region a column is in. |
| `TMDataGridColumnRegion` | Type | `"start" \| "center" \| "end"` | – | What `getColumnRegion` returns. |
| `autosizeColumn` | Export | `({ table, columnId, container }) => void` | – | Fits a column to its mounted content. |
| `TMDataGrid.Menu.Columns` · `TMDataGrid.ColumnsPanel` | Components | – | – | The column chooser, as menu items and as plain controls. See [Grid menu](/docs/menu). |
