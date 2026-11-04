# NordicMap

A canvas map drawn from a `MapSource`, with pins, areas and paths on top.
`NordicMap` takes the type of its pins' `data` as its type parameter, `NordicMap<T>`, and `NordicMapProps<T>` is the type of its props.

## Map clicks

`onMapClick` is called with the position of a click or tap that hits no pin or cluster, in WGS 84 degrees:

```tsx
<NordicMap
  source={swedenOsmSource}
  onMapClick={({ lat, lon }) => {
    console.log(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  }}
/>
```

A click on an area or a path calls `onMapClick` too, after `onAreaClick` or `onPathClick`.

## Props by page

| Prop | Described on |
| --- | --- |
| `source` | [Map sources](/docs/map-sources) |
| `pins`, `showPins`, `showPinLabels` | [Pins](/docs/pins) |
| `selectionMode`, `selected`, `defaultSelected`, `onSelectionChange`, `selectPinsByArea`, `onPinClick`, `highlighted`, `onPinHover` | [Selection](/docs/selection) |
| `cluster` | [Clusters](/docs/clusters) |
| `renderTooltip` | [Tooltips](/docs/tooltips) |
| `showBorder`, `showRoads`, `showRoadLabels`, `showPlaceLabels` | [Layers](/docs/layers) |
| `ref`, `maxZoom`, `padding`, `showZoomControls`, `onViewChange` | [Camera](/docs/camera) |
| `areas`, `showAreas`, `onAreaClick`, `onAreaHover` | [Areas](/docs/areas) |
| `paths`, `showPaths`, `onPathClick` | [Paths](/docs/paths) |
| `colorScheme`, `mapStyle`, `className`, `style` | [Styling](/docs/styling) |
| `labels`, `label` | [Localization](/docs/localization) |
| `onMapClick` | This page |

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `onMapClick` | Prop | `(position: { lat: number; lon: number }) => void` | - | Called with the position of a click or tap that hits no pin or cluster. |
| `NordicMap` | Component | - | - | The map. |
| `NordicMapProps` | Type | - | - | The props of `NordicMap`. |
