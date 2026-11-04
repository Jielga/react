# Areas

An area is a filled region, such as a county, a sales district or a nature reserve.
Areas are drawn over the land, and under the lakes, the coastline, the roads and the pins.
Pass them in `areas`, each with an `id` and a GeoJSON `Polygon` or `MultiPolygon` in WGS 84 degrees:

```tsx
const district: MapArea = {
  id: "north",
  label: "District North",
  fill: "rgb(214 51 108 / 30%)",
  geometry: { type: "Polygon", coordinates: [[[17, 63], [20, 63], [20, 65], [17, 65], [17, 63]]] },
};

<NordicMap source={swedenOsmSource} areas={[district]} />;
```

Rings may be wound in either direction.

## Draw your own areas

The [area editor](/editor) draws areas over the map and exports them as a `MapArea[]` TypeScript module, as `MapArea[]` JSON or as GeoJSON.
It snaps to your other areas and to the county, municipality and national borders, joins selected counties or municipalities into one area, and clips areas to Sweden's land.

## Counties and municipalities

The package has Sweden's 21 counties and 290 municipalities as areas, clipped to the land:

- `loadSwedenCounties()` - each `id` is the county code from Statistics Sweden, such as `"01"` for Stockholms län
- `loadSwedenMunicipalities()` - each `id` is the municipality code, such as `"0180"` for Stockholm, and starts with its county's code

Each `label` is the area's name.
The files load on the first call, about 150 kB and 250 kB compressed, and later calls share them.
Neighbouring areas share their borders exactly.

## Choropleth map

To color each area by a value, set its `fill`:

```demo
file: areas/CountyChoropleth.tsx
hint: Point at a county for its name, and click it for its population.
height: 520
extraSources: data/countyPopulation.ts
```

## Hover and click

`onAreaHover` is called when the pointer moves onto an area, and with `null` when it leaves.
`onAreaClick` is called when an area is clicked; the click also reaches `onMapClick`.
The hovered area has an outline in `mapStyle.highlight`:

```demo
file: areas/Municipalities.tsx
hint: Click municipalities to pick them.
height: 520
```

Changing an area's `fill` does not project it again, as long as its `geometry` object stays the same.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `areas` | Prop | `MapArea[]` | `[]` | Sets the areas. Later areas are drawn over earlier ones. |
| `showAreas` | Prop | `LayerVisibility` | `true` | Determines when the areas show. |
| `onAreaClick` | Prop | `(area: MapArea) => void` | - | Called when an area is clicked. |
| `onAreaHover` | Prop | `(area: MapArea \| null) => void` | - | Called when the pointer moves onto an area, and with `null` when it leaves. |
| `loadSwedenCounties` | Function | `() => Promise<MapArea[]>` | - | Loads Sweden's counties. |
| `loadSwedenMunicipalities` | Function | `() => Promise<MapArea[]>` | - | Loads Sweden's municipalities. |
| `MapArea` | Type | - | - | An area. Its fields are below. |

### MapArea

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | - | Identifies the area. Required. |
| `geometry` | `Polygon \| MultiPolygon` | - | Sets the shape, in WGS 84 degrees. Required. |
| `label` | `string` | - | Sets the tooltip. If not set, the area has no tooltip. |
| `fill` | `string` | `mapStyle.areaFill` | Sets the fill color. |
| `stroke` | `string` | `mapStyle.areaStroke` | Sets the outline color. |
