# Styling

The map draws on a canvas, so its colors and sizes are props, in `mapStyle`.
The buttons, the tooltip, the loading spinner and the credit line are HTML, styled with CSS variables.

## Light and dark

`colorScheme` picks the colors of both:

- `"auto"` - follows the light or dark setting of the user's system, and changes with it
- `"light"` and `"dark"` - fixed

By default, `colorScheme` is `"auto"`.
If your app has its own light and dark switch, pass its value, so that the map and the page always agree.

## Map colors

`mapStyle` takes any of the `MapStyle` fields, and the rest come from the color scheme's preset, `lightMapStyle` or `darkMapStyle`:

```demo
file: styling/CustomStyle.tsx
height: 480
extraSources: data/cities.ts
```

Colors take any CSS color.
`"none"` or `"transparent"` leaves a layer undrawn.
Sizes are in pixels, and stay the same at every zoom.

| Field | Light | Dark | Description |
| --- | --- | --- | --- |
| `sea` | `"#b9d7ea"` | `"#06111f"` | Sets the sea, and the area around the map. |
| `land` | `"#fdfcf8"` | `"#12284a"` | Sets the fill of Sweden's land. |
| `lake` | `"#b9d7ea"` | `"#06111f"` | Sets the fill of lakes. |
| `lakeBorder` | `"none"` | `"none"` | Sets the outline of lakes. |
| `border` | `"#1d5fa8"` | `"#fecc02"` | Sets the coastline and the land border. |
| `borderWidth` | `1` | `1` | Sets the width of `border`. Below 1 the line is fainter on normal screens and stays sharp on high resolution screens. |
| `contextLand` | `"#e9e6df"` | `"#0c1c33"` | Sets the fill of the neighbouring countries. |
| `contextBorder` | `"#b3ab9f"` | `"#2a4365"` | Sets the coasts and borders of the neighbouring countries. |
| `road` | `"#c98a3a"` | `"#7fa7d9"` | Sets the road color. |
| `roadWidth` | `1.2` | `1.2` | Sets the width of E-roads. Smaller roads are thinner. |
| `text` | `"#1b2b40"` | `"#e6edf7"` | Sets the color of place names and pin labels. |
| `textHalo` | `"#ffffff"` | `"#06111f"` | Sets the outline around text. |
| `pin` | `"#1b2b40"` | `"#ffffff"` | Sets the color of unselected pins, and the fill of clusters. |
| `pinStroke` | `"#ffffff"` | `"#0b1f3a"` | Sets the outline of pins, and the count in clusters. |
| `pinSelected` | `"#d6336c"` | `"#fecc02"` | Sets the color of selected pins, and of the drag-select box. |
| `pinRadius` | `5` | `5` | Sets the radius of a pin. Clusters are larger. |
| `areaFill` | `"rgb(29 95 168 / 15%)"` | `"rgb(127 167 217 / 25%)"` | Sets the fill of areas without a `fill` of their own. |
| `areaStroke` | `"#1d5fa8"` | `"#7fa7d9"` | Sets the outline of areas without a `stroke` of their own. |
| `path` | `"#0b7a5c"` | `"#4dd4ac"` | Sets the color of paths without a `color` of their own. |
| `pathWidth` | `3` | `3` | Sets the width of paths without a `width` of their own. |
| `highlight` | `"#1b2b40"` | `"#ffffff"` | Sets the ring around the highlighted, hovered or focused pin, and the outline of the hovered area or path. |

## CSS variables

Set these variables on the map, through `className` or `style`, or on any element around it:

| Variable | Description |
| --- | --- |
| `--nordic-map-control-bg` | Sets the background of the zoom buttons and the error message. |
| `--nordic-map-control-hover-bg` | Sets the background of a zoom button under the pointer. |
| `--nordic-map-control-color` | Sets the icon and text color of the zoom buttons and the error message. |
| `--nordic-map-control-disabled-color` | Sets the icon color of a disabled zoom button. |
| `--nordic-map-control-border` | Sets the border of the zoom buttons, the error message and the spinner. |
| `--nordic-map-focus-ring` | Sets the focus outline of the map and the buttons, and the spinner's moving part. |
| `--nordic-map-tooltip-bg` | Sets the background of the tooltip. |
| `--nordic-map-tooltip-color` | Sets the text color of the tooltip. |
| `--nordic-map-attribution-bg` | Sets the background of the credit line. |
| `--nordic-map-attribution-color` | Sets the text color of the credit line. |
| `--nordic-map-radius` | Sets the corner radius of the zoom buttons, the tooltip and the error message. |
| `--nordic-map-font-family` | Sets the font of the tooltip, the error message and the credit line. |

If a variable is not set, its value comes from the color scheme.
The map's root element carries `data-nordic-map` and `data-color-scheme="light"` or `"dark"`, for selectors of your own.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `colorScheme` | Prop | `MapColorScheme` | `"auto"` | Determines whether the map and its buttons use light or dark colors. |
| `mapStyle` | Prop | `Partial<MapStyle>` | - | Sets colors and sizes, over the preset of the color scheme. |
| `className` | Prop | `string` | - | Sets a class on the map's root element. |
| `style` | Prop | `CSSProperties` | - | Sets inline styles on the map's root element. |
| `MapColorScheme` | Type | - | - | `"light" \| "dark" \| "auto"` |
| `MapStyle` | Type | - | - | The fields in [Map colors](#map-colors). |
| `lightMapStyle` | Constant | `MapStyle` | - | The colors of the light scheme. |
| `darkMapStyle` | Constant | `MapStyle` | - | The colors of the dark scheme. |
