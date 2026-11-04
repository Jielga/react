---
name: map-content
description: >
  Put more on a @jielga/nordic-map NordicMap and move it from code: clusters
  (cluster, ClusterOptions), tooltips (renderTooltip, MapTooltipTarget), the
  camera ref (NordicMapHandle with flyTo, fitBounds, fitPins, zoomIn, zoomOut,
  reset, getView, project, unproject; CameraMoveOptions; NordicMapView and
  onViewChange; maxZoom, padding, showZoomControls), onMapClick, areas and
  choropleth maps (MapArea, areas, onAreaClick, onAreaHover, loadSwedenCounties,
  loadSwedenMunicipalities), paths and GPS tracks (MapPath, paths, onPathClick),
  and custom map sources (MapSource, MapLevel, MapCell, MapLayers, MapRoad,
  RoadClass, MapRoadLabel, MapPlace, PlaceClass, MapContext, MapAttribution,
  LonLat, LonLatBox). Load when many pins overlap, when zooming to pins or a
  position from code, when coloring counties or municipalities by a value, when
  drawing routes, or when feeding the map other data.
metadata:
  type: sub-skill
  library: '@jielga/nordic-map'
  library_version: '0.3.0'
requires:
  - getting-started
sources:
  - 'Jielga/react:packages/nordic-map/docs/clusters.md'
  - 'Jielga/react:packages/nordic-map/docs/tooltips.md'
  - 'Jielga/react:packages/nordic-map/docs/camera.md'
  - 'Jielga/react:packages/nordic-map/docs/areas.md'
  - 'Jielga/react:packages/nordic-map/docs/paths.md'
  - 'Jielga/react:packages/nordic-map/docs/map-sources.md'
  - 'Jielga/react:packages/nordic-map/docs/nordic-map.md'
  - 'Jielga/react:packages/nordic-map/src/NordicMap/mapItems.ts'
  - 'Jielga/react:packages/nordic-map/src/NordicMap/mapSource.ts'
---

# nordic-map - Map content

## Clusters

`cluster` (or `cluster={{ radius: 60 }}`, type `ClusterOptions`, default
radius 40 px) joins close pins into a circle with a count. A click zooms in on
it, a drag-select box selects all its pins, and at `maxZoom` every pin shows
on its own. The highest `priority` pin starts each cluster.

## Tooltips

Shown for the hovered or keyboard-focused item: `label`, or the pin count of a
cluster. Replace with `renderTooltip(target)`, where `target` is a
`MapTooltipTarget`: `{ kind: "pin", pin }`, `{ kind: "cluster", pins }`,
`{ kind: "area", area }` or `{ kind: "path", path }`. Return `null` for none.

## Camera

```tsx
const map = useRef<NordicMapHandle>(null);
<NordicMap ref={map} source={swedenOsmSource} pins={pins} onViewChange={(view) => setZoom(view.zoom)} />;

map.current?.flyTo({ lat: 59.33, lon: 18.07, zoom: 12 });
map.current?.fitPins(["sto", "got"]); // all pins when left out
map.current?.fitBounds({ west: 18.1, south: 56.9, east: 19.4, north: 58.0 });
map.current?.reset({ animate: false }); // CameraMoveOptions
map.current?.getView(); // NordicMapView | null while loading
map.current?.project({ lat: 59.33, lon: 18.07 }); // { x, y } in CSS pixels from the map's top left, or null
map.current?.unproject({ x: 100, y: 200 }); // { lat, lon }, or null
```

Calls made before the data loads apply once the map shows. Moves ease unless
the system asks for reduced motion. `onViewChange` runs every animation frame; use it with `project` to keep your own overlay in place.
`maxZoom` (50), `padding` (16), `showZoomControls` (true).
`onMapClick({ lat, lon })` fires for clicks that hit no pin or cluster.

## Areas

```tsx
const [counties, setCounties] = useState<MapArea[]>([]);
useEffect(() => {
  void loadSwedenCounties().then((areas) =>
    setCounties(areas.map((area) => ({ ...area, fill: colorFor(values[area.id]) }))),
  );
}, []);
<NordicMap source={swedenOsmSource} areas={counties} onAreaClick={...} onAreaHover={...} />;
```

`MapArea`: `id`, `geometry` (GeoJSON Polygon or MultiPolygon, WGS 84, any
winding), `label`, `fill`, `stroke`. `loadSwedenCounties` ids are SCB county
codes (`"01"`), `loadSwedenMunicipalities` ids are municipality codes
(`"0180"`, starting with the county code). Keep each area's `geometry` object
when changing `fill`, so it is not projected again.

## Paths

`MapPath`: `id`, `geometry` (LineString or MultiLineString), `label`, `color`,
`width`. `paths`, `showPaths`, `onPathClick`. Drawn over roads, under pins.

## Custom sources

Wrap a source to change what it loads, as a module constant:

```tsx
const eRoadsOnly: MapSource = {
  ...swedenOsmSource,
  loadCell: async (cell) => {
    const layers = await swedenOsmSource.loadCell(cell);
    return { ...layers, roads: layers.roads.filter((road) => road.roadClass === "european") };
  },
};
```

A `MapSource` has `extent` (`LonLatBox`), optional `centralMeridian`,
`levels` (`MapLevel[]`: `minZoom`, `cellSize` in degrees; the first starts at
1), optional `attribution` (`MapAttribution`), and `loadCell(cell: MapCell)`
returning `MapLayers`: `land`, `water`, `borders`, `roads` (`MapRoad` with
`RoadClass`), optional `roadLabels` (`MapRoadLabel`), `places` (`MapPlace`
with `PlaceClass`) and `context` (`MapContext`). `LonLat` is
`[longitude, latitude]`.

## Common mistakes

### HIGH: a new areas or source object with new geometry every render

Mapping over loaded areas is fine; building new geometry objects on every
render re-projects every area each time.

### MEDIUM: fitPins with one pin

A single pin or a tiny area fits at `maxZoom`. Use `flyTo` with a `zoom` to
choose the zoom.
