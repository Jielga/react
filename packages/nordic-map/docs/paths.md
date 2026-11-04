# Paths

A path is a line, such as a GPS track, a route or a pipeline.
Paths are drawn over the roads and under the pins.
Pass them in `paths`, each with an `id` and a GeoJSON `LineString` or `MultiLineString` in WGS 84 degrees:

```demo
file: paths/Routes.tsx
hint: Point at a route, then click it.
height: 480
```

The hovered path has an outline in `mapStyle.highlight`.
`onPathClick` is called when a path is clicked, within a few pixels of its line; the click also reaches `onMapClick`.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `paths` | Prop | `MapPath[]` | `[]` | Sets the paths. Later paths are drawn over earlier ones. |
| `showPaths` | Prop | `LayerVisibility` | `true` | Determines when the paths show. |
| `onPathClick` | Prop | `(path: MapPath) => void` | - | Called when a path is clicked. |
| `MapPath` | Type | - | - | A path. Its fields are below. |

### MapPath

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | - | Identifies the path. Required. |
| `geometry` | `LineString \| MultiLineString` | - | Sets the line, in WGS 84 degrees. Required. |
| `label` | `string` | - | Sets the tooltip. If not set, the path has no tooltip. |
| `color` | `string` | `mapStyle.path` | Sets the line color. |
| `width` | `number` | `mapStyle.pathWidth` | Sets the line width in pixels. |
