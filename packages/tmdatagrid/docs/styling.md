# Size, styling and theming

The grid is themed through CSS custom properties, and sized through Mantine's
standard `size` scale. Both are set on the root element, so a grid can be
themed per instance without a provider.

```tsx
<TMDataGrid {...grid} size="sm" style={{ "--dg-row-selected-bg": "color-mix(in srgb, var(--mantine-color-blue-6) 12%, transparent)" }} />
```

```demo
file: customization/Styling.tsx
hint: Every value the controls change is a CSS variable set on the grid element.
extraSources: data/employeeColumns.tsx
```

## The size scale

`size` drives row height, header height, font size and cell padding together,
and selects the size of every Mantine control the grid renders - the page-size
select, the filter inputs, the column checkboxes.

| `size` | Row height | Header height | Font size | Cell padding |
| --- | --- | --- | --- | --- |
| `xs` | 34px | 32px | `xs` | 6px |
| `sm` | 42px | 38px | `sm` | 8px |
| `md` (default) | 52px | 44px | `sm` | 10px |
| `lg` | 62px | 52px | `md` | 14px |
| `xl` | 72px | 60px | `lg` | 18px |

```demo
file: getting-started/DensityAndLayout.tsx
```

Row height is also required by the virtualizer **as a number**, so it cannot be
defined in CSS alone. `SIZE_ROW_HEIGHT` is the exported source of these values,
and the stylesheet mirrors them. To use a height outside the scale, set
`meta.rowHeight` rather than the variable.

## CSS variables

`style` accepts custom properties, and `className` reaches the same element
from a stylesheet.
The wrapper components - `Toolbar`, `Spacer`, `Footer`, `FilterPanel`, `FilterPills` and `ColumnsPanel` - take Mantine's `BoxProps` on top of their own props, so `mb="sm"` or `hiddenFrom="sm"` on any of them sets the element itself; see [Toolbar](/docs/toolbar#style-props).

### Metrics

| Variable | Default | Applies to |
| --- | --- | --- |
| `--dg-row-height` | From `size` | Row height. Prefer `meta.rowHeight` - the virtualizer needs the number. |
| `--dg-header-height` | From `size` | Header row height |
| `--dg-summary-height` | From `size` | [Summary row](/docs/summary-row) height |
| `--dg-entry-height` | From `size` | The sticky [entry block](/docs/adding-rows#adding-rows) |
| `--dg-font-size` | From `size` | Cell font size. The header follows it unless `--dg-header-font-size` is set. |
| `--dg-header-font-size` | `--dg-font-size` | Header font size |
| `--dg-padding` | From `size` | Horizontal cell padding. The generated lanes are excluded: they are fixed 36px tracks that centre their control. |
| `--dg-radius` | `--mantine-radius-md` | The frame's corner radius. `0` squares the grid off. The root clips its overflow, so the header and the last row follow it. |

### Colours

Both colour schemes are supported. The grid's own stylesheet resolves its
colours with `light-dark()`, so it follows Mantine's scheme without a prop or a
second import. A default of **Themed** below means exactly that: the variable
resolves to one value under the light scheme and another under the dark one.
Set such a variable and you take over both schemes, so give it a value that
reads in each - `light-dark()` works in your own value too.

| Variable | Default | Applies to |
| --- | --- | --- |
| `--row-bg` | – | One row's own background. Set this, never `background`. See [Row styling](/docs/row-styling#set-the-row-background). |
| `--dg-row-selected-bg` | `--mantine-primary-color-light` | [Selected](/docs/row-selection) rows |
| `--dg-row-highlight-bg` | Themed | The highlighted row |
| `--dg-row-striped-bg` | Themed | Every second row under `striped` |
| `--dg-row-group-bg` | Themed | [Group](/docs/grouping) rows |
| `--dg-row-new-bg` | Green tint | New rows entered into the [draft store](/docs/draft-store) |
| `--dg-match-highlight-bg` | Themed yellow | [Marked](/docs/quick-search#match-highlighting) text |
| `--dg-header-shadow-color` | Themed | The shadow under the sticky header |

### Layout internals

| Variable | Default | Applies to |
| --- | --- | --- |
| `--dg-sticky-edge-range` | `20px` | How far the pinned-lane band takes to fade in |
| `--dg-edge-top` · `-bottom` · `-left` · `-right` | – | Set by the grid to mark [cell-range](/docs/cell-selection) borders |
| `--dg-z-header` · `-pinned-cell` · `-summary-row` · … | – | The stacking order. Change these only to place something of your own between two layers. |

## The stylesheet

One import, once, anywhere in your app:

```tsx
import "@jielga/tmdatagrid/styles.css";
```

`@jielga/tmdatagrid/styles.layer.css` is the same stylesheet wrapped in a
`@layer`, for an application that orders its own layers and needs the grid to
sit at a known place in that order. Import **one** of the two, never both.

## Layout

The grid fills the box you give it and scrolls inside it. It does not size
itself to its content: a virtualized grid has no content height to measure.

```tsx
<div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
  <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
    <TMDataGrid.Table />
  </TMDataGrid>
</div>
```

`minHeight: 0` is required. A flex item's default `min-height: auto` will not
shrink below its content, so without it the grid grows past the viewport instead
of scrolling.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `size` | Prop | `MantineSize` | `"md"` | The whole density scale. |
| `className` | Prop | `string` | – | Added to the root element's classes. |
| `style` | Prop | `CSSProperties` + `--*` | – | Root element styles, including the variables above. |
| `id` | Prop | `string` | – | Set on the root element. |
| `meta.rowHeight` | Option | `number` | From `size` | A row height outside the scale. |
| `SIZE_ROW_HEIGHT` | Export | `Record<MantineSize, number>` | – | The row heights listed in the table above. |
| `SIZE_CONTROL_SIZE` | Export | `Record<MantineSize, MantineSize>` | – | Which control size each grid size uses. |
| `DEFAULT_TMDATAGRID_SIZE` | Export | `"md"` | – | The default. |
