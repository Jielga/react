# Tooltips

A tooltip shows over the pin, cluster, area or path under the pointer, and over the pin or cluster with keyboard focus.
By default, it shows:

- the `label` of a pin, an area or a path
- the number of pins in a cluster, from `labels.cluster`

An item without a `label` has no tooltip.

## Custom content

`renderTooltip` replaces the content.
It receives a `MapTooltipTarget`, whose `kind` says what the pointer is over, and returns any React node, or `null` for no tooltip:

```demo
file: tooltips/CustomTooltip.tsx
hint: Point at a city, then at a cluster.
height: 480
extraSources: data/cities.ts
```

The tooltip is hidden from screen readers, which read the same name from the pin's button.
[Accessibility](/docs/accessibility) describes the buttons.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `renderTooltip` | Prop | `(target: MapTooltipTarget<T>) => ReactNode` | - | Sets the content of the tooltip. If not set, the tooltip shows the label, or the pin count of a cluster. |
| `MapTooltipTarget` | Type | - | - | What the tooltip is over. Its variants are below. |

### MapTooltipTarget

| `kind` | Other fields | Over |
| --- | --- | --- |
| `"pin"` | `pin: MapPin<T>` | A pin |
| `"cluster"` | `pins: MapPin<T>[]` | A cluster, with its pins in `pins` order |
| `"area"` | `area: MapArea` | An area |
| `"path"` | `path: MapPath` | A path |
