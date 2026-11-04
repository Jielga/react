# Layers

The map draws its layers in this order, from the bottom:

- the sea, and the background land around Sweden
- the land
- [areas](/docs/areas)
- the lakes
- the coastline and the land border
- the roads
- [paths](/docs/paths)
- pin labels, place names and road signs
- [pins](/docs/pins)

## Show a layer in a zoom range

Each `show*` prop takes a `LayerVisibility`:

- `true` - the layer always shows
- `false` - the layer never shows
- `{ minZoom, maxZoom }` - the layer shows at zoom factors from `minZoom` to `maxZoom`, both included

Zoom 1 shows the whole map.
An end left out of the range has no limit, and a layer fades in and out just outside its range instead of appearing at once:

```demo
file: layers/ZoomRanges.tsx
hint: Scroll in and out to see the roads, the road signs and the city names come and go.
height: 480
```

Road signs only show where the roads show too, and pin labels only where the pins show.

## Place names

`showPlaceLabels` shows the names of cities, towns and villages, each beside a dot at its position.
The map names cities first, then towns and villages where there is room.
Towns are in the data from zoom 3 and villages from zoom 10, in `swedenOsmSource`.

A place name never covers a pin, a pin label or another place name.
A pin placed on a city covers the city's dot, so the city's name is left out and the pin's label names it.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `showBorder` | Prop | `LayerVisibility` | `true` | Determines when the coastline and the land border show. |
| `showRoads` | Prop | `LayerVisibility` | `true` | Determines when the roads show. |
| `showRoadLabels` | Prop | `LayerVisibility` | `true` | Determines when the road number signs show. They only show where the roads show too. |
| `showPlaceLabels` | Prop | `LayerVisibility` | `true` | Determines when the names of cities, towns and villages show. |
| `LayerVisibility` | Type | - | - | `boolean \| { minZoom?: number; maxZoom?: number }` |

The other layers are shown with `showPins` and `showPinLabels` on [Pins](/docs/pins), `showAreas` on [Areas](/docs/areas) and `showPaths` on [Paths](/docs/paths).
