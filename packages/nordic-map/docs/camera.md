# Camera

The user moves the map like this:

- scroll, pinch on a trackpad, or pinch with two fingers to zoom
- drag with the right or middle mouse button, hold Space and drag, or drag with two fingers to pan
- let go while dragging, and the map keeps moving a short way
- with `selectionMode` set to `"single"` or `"none"`, a drag with the left mouse button or one finger pans too

The zoom factor runs from 1, the whole map, to `maxZoom`.
The zoom buttons in the top right corner zoom in, zoom out and show the whole map.

## Keyboard

With the map focused:

- `+` and `-` zoom in and out
- the arrow keys pan
- `0` shows the whole map
- Tab moves through the pins on screen, as described on [Accessibility](/docs/accessibility)

## Move the map from your code

Pass a `ref` to get a `NordicMapHandle`:

```demo
file: camera/MoveTheMap.tsx
height: 520
extraSources: data/cities.ts
```

The handle has these methods:

- `flyTo({ lat, lon, zoom })` - centers the map on a position, at `zoom` or at the current zoom
- `fitBounds(bounds)` - shows an area, given as a `LonLatBox`, as large as fits
- `fitPins(ids)` - shows the pins with these ids as large as fits, or every pin when `ids` is left out
- `zoomIn()` and `zoomOut()` - zoom by one step around the middle of the view
- `reset()` - shows the whole map
- `getView()` - returns the current `NordicMapView`, or `null` while the map data is loading
- `project({ lat, lon })` - returns the point on screen of a position, as `{ x, y }` in CSS pixels from the map's top left corner, or `null` while the map data is loading
- `unproject({ x, y })` - returns the position at a point on screen, as `{ lat, lon }`, or `null` while the map data is loading

A single pin, or a very small area, shows at `maxZoom`; use `flyTo` to choose the zoom.
A call made while the map data is still loading takes effect, without animation, once the map is shown.

## Animation

By default, `flyTo`, `fitBounds`, `fitPins` and `reset` ease to the new view, unless the user's system asks for reduced motion.
To choose, pass `CameraMoveOptions`:

```tsx
map.current?.flyTo({ lat: 59.33, lon: 18.07, zoom: 12 }, { animate: false });
```

## Follow the view

`onViewChange` is called with a `NordicMapView` when the view changes.
During a zoom or a pan it is called on every animation frame, so keep it cheap.

To draw your own elements over the map, position them with `project` and update them in `onViewChange`.
A point from `project` may lie outside the view.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `ref` | Prop | `Ref<NordicMapHandle>` | - | Receives the `NordicMapHandle`. |
| `maxZoom` | Prop | `number` | `50` | Sets the largest zoom factor, where 1 shows the whole map. |
| `padding` | Prop | `number` | `16` | Sets the space in pixels around the map at zoom 1. |
| `showZoomControls` | Prop | `boolean` | `true` | Determines whether the zoom buttons show in the top right corner. |
| `onViewChange` | Prop | `(view: NordicMapView) => void` | - | Called when the view changes, on every animation frame of a zoom or pan. |
| `NordicMapHandle` | Type | - | - | The methods listed in [Move the map from your code](#move-the-map-from-your-code). |
| `NordicMapView` | Type | - | - | `{ zoom: number; center: { lat: number; lon: number }; bounds: LonLatBox }`. `bounds` is the area in view. |
| `CameraMoveOptions` | Type | - | - | `{ animate?: boolean }`. If `animate` is not set, the move eases unless the system asks for reduced motion. |
