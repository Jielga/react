# Scrolling and virtualization

Virtualization is **always on**. There is no flag and no threshold: only the
rows within the viewport, plus a small overscan, are mounted, at any row
count.

```tsx
const grid = useTMDataGrid({ data, columns }); // 200 rows or 200 000
```

Rows only. Columns are not virtualized: every column that is visible is in the
DOM, header and body alike, however far off-screen it sits. A grid with a few
dozen columns is fine; hide the ones a user does not need rather than relying
on the viewport to do it.

## Overscan

How many rows stay mounted on each side of the viewport. Defaults to `6`.

```tsx
const grid = useTMDataGrid({ data, columns, overscan: 12 });
```

Raise it if a fast scroll flashes blank rows; lower it when rows are expensive
to render.

## Row height

Taken from `meta.rowHeight`, or from the `size` prop when that is not set. Rows
are **fixed height**, so the virtualizer's estimate is exact and the scrollbar
does not drift as you scroll.

```tsx
const grid = useTMDataGrid({ data, columns, meta: { rowHeight: 64 } });
```

[Row details](/docs/row-details) are the exception: a row showing a panel is as
tall as the panel, so those rows are measured after they mount.
`renderDetailsEstHeight` is what the virtualizer assumes for one it has not
measured yet.

## Scrolling to a row

```tsx
const { scrollToRow } = useTMDataGrid({ data, columns, getRowId });

scrollToRow({ rowId: "42", align: "center" });
```

Under virtualization the target row may not be mounted, so
`element.scrollIntoView()` cannot find it. `align` is `"start"`, `"center"`,
`"end"` or `"auto"`, which scrolls only if the row is out of view.

It answers whether the row could be reached. `false` means the row is not in
the current view - filtered out, on another page, or an id matching no row -
and nothing scrolled. A pinned row answers `true` without scrolling.

The hook reaches the virtualizer through `scrollerRef`, which `TMDataGrid.Table`
fills in. That is internal wiring rather than an API: spread the whole grid
object onto `<TMDataGrid>`, because a hand-assembled prop list that leaves it
out has no scrolling.

While the draft store is running, `TMDataGrid.DraftActions` hands its
`renderActions` slot an `actions.scrollToFirstOpenRow(align?)` that goes to the
first row [left open](/docs/draft-store), without your having to
track the ids.

## Edge callbacks

`TMDataGrid.Table` reports arrivals at each edge, firing **once** when the
scroll reaches it rather than on every scroll event:

```tsx
<TMDataGrid.Table
  onScrollToBottom={() => console.log("at the end")}
  onScrollToRight={() => console.log("at the last column")}
/>
```

For loading more rows, use [`onReachEnd`](/docs/server-side#infinite-scroll)
instead. It fires a number of rows before the bottom, and latches per row count
so a pending fetch is not requested twice.

## Scroll shadows

Two soft shadows, both driven by `animation-timeline: scroll(…)` rather than by
a scroll listener.

**Under the header.** Once body rows scroll beneath the sticky header, a shadow
appears along its bottom edge, indicating rows above the viewport. A grid with
nothing to scroll shows none. `--dg-header-shadow-color` recolours it.

**Beside a pinned lane.** A [pinned column](/docs/column-layout#pinning) shows a
band over the data next to it, and only while it is covering content: it fades
in over the first 20px of horizontal scroll and fades out again at the far
end.

Where `animation-timeline` is unsupported, the header's own border draws the
boundary and the pinned band is always on.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `overscan` | Option | `number` | `6` | Rows kept mounted beyond each edge of the viewport. |
| `meta.rowHeight` | Option | `number` | `52` at the default `md` size; see [the size scale](/docs/styling#the-size-scale) | Row height, in pixels. The virtualizer needs a number. |
| `scrollToRow` | Hook return | `({ rowId, align? }) => boolean` | `align: "auto"` | Scrolls a row into view, mounted or not. Answers whether it could be reached. |
| `TMDataGridScrollToRowArgs` | Type | `{ rowId, align? }` | – | What `scrollToRow` takes. |
| `onScrollToTop` · `onScrollToBottom` · `onScrollToLeft` · `onScrollToRight` | Table props | `() => void` | – | Fire once on arriving at that edge. |
| `TMDataGridScrollAlign` | Export | `"start" \| "center" \| "end" \| "auto"` | – | The `align` argument. |
| `--dg-header-shadow-color` | CSS variable | colour | Themed | The shadow under the sticky header. |
| `--dg-sticky-edge-range` | CSS variable | length | `20px` | How far the pinned-lane band takes to fade in. |
