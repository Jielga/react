# Map sources

`NordicMap` draws a `MapSource`: an area, a list of detail levels, and a `loadCell` function that returns what one square cell of a level holds.
The map loads the cells of the level that fits the zoom, for the area in view, and keeps the cells it has loaded.

Define a source outside the component; a new object on every render loads every cell again.

## swedenOsmSource

Sweden from OpenStreetMap, in three detail levels:

| Level | From zoom | Cell size | Content |
| --- | --- | --- | --- |
| 0 | 1 | one cell | E-roads, national roads, lakes from 150 km², cities, and the neighbouring countries as a plain background |
| 1 | 3 | 2° | All roads, lakes from 20 km², cities and towns |
| 2 | 10 | 1° | All roads, lakes from 3 km², cities, towns and villages |

Each cell is a JSON file in `dist/cells/`, named in the bundle with `new URL(..., import.meta.url)`.
Vite and webpack 5 copy the files into your build, so the map works offline and loads its data from your own origin.

If the map shows its load error and the browser reports 404 for files under `cells/`, your bundler did not copy them.
Use a bundler that handles `new URL(..., import.meta.url)`, or a source of your own whose `loadCell` fetches the cells from your server.

## Your own source

A source can wrap another source and change what it loads.
This one keeps only the E-roads and the cities:

```demo
file: map-sources/CustomSource.tsx
height: 480
```

A source written from scratch gives:

- `extent` - the area shown at zoom 1, as a `LonLatBox`
- `centralMeridian` - the meridian of the Transverse Mercator projection, by default the middle of `extent`
- `levels` - the detail levels, from the least detailed, each with the zoom it starts at and its cell size in degrees
- `attribution` - the credit the data's license asks for, shown in the map's corner
- `loadCell(cell)` - a promise of the `MapLayers` of one `MapCell`

The first level starts at zoom 1 and is loaded in full before the map shows; it gives the map its extent.
Cells are squares of `cellSize` degrees, counted from longitude -180 and latitude -90.
A cell may cut its land and lines at the cell edges, because land is only filled and coasts come as separate lines.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `source` | Prop | `MapSource` | - | Sets where the map data comes from. Required. |
| `swedenOsmSource` | Constant | `MapSource` | - | Sweden from OpenStreetMap, in three levels. |
| `MapSource` | Type | - | - | `{ extent: LonLatBox; centralMeridian?: number; levels: MapLevel[]; attribution?: MapAttribution; loadCell: (cell: MapCell) => Promise<MapLayers> }` |
| `MapLevel` | Type | - | - | `{ minZoom: number; cellSize: number }`. The first level's `minZoom` is 1. A level of one cell has a `cellSize` of 360. |
| `MapCell` | Type | - | - | `{ level: number; x: number; y: number }`. `level` is the index in `levels`. |
| `MapAttribution` | Type | - | - | `{ text: string; url?: string }`. `url` links the text to the license. |
| `MapLayers` | Type | - | - | What one cell holds. Its fields are below. |
| `MapContext` | Type | - | - | `{ land: (Polygon \| MultiPolygon)[]; borders: (LineString \| MultiLineString)[] }`. The background land and its borders. |
| `MapRoad` | Type | - | - | `{ geometry: LineString \| MultiLineString; roadClass: RoadClass; ref?: string }`. `ref` is the road number, such as `"E4"`. |
| `RoadClass` | Type | - | - | `"european" \| "national" \| "regional"`. E-roads, national roads and ring roads, and important regional roads. |
| `MapRoadLabel` | Type | - | - | `{ text: string; at: LonLat }`. A road number sign. |
| `MapPlace` | Type | - | - | `{ name: string; at: LonLat; placeClass: PlaceClass; population?: number }`. The larger of two places of one class is named first. |
| `PlaceClass` | Type | - | - | `"city" \| "town" \| "village"`, from the most important. |
| `LonLat` | Type | - | - | `[longitude, latitude]` in WGS 84 degrees. |
| `LonLatBox` | Type | - | - | `{ west: number; south: number; east: number; north: number }` in WGS 84 degrees. |

### MapLayers

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `land` | `(Polygon \| MultiPolygon)[]` | - | Sets the map's own land, filled. Required. |
| `water` | `(Polygon \| MultiPolygon)[]` | - | Sets the lakes, drawn over the land. Required. |
| `borders` | `(LineString \| MultiLineString)[]` | - | Sets the coastline and the land border. Required. |
| `roads` | `MapRoad[]` | - | Sets the roads. Required. |
| `roadLabels` | `MapRoadLabel[]` | `[]` | Sets the road number signs. |
| `places` | `MapPlace[]` | `[]` | Sets the named places. |
| `context` | `MapContext` | - | Sets the plain background around the map's own land. Only cells of the first level carry it. |
