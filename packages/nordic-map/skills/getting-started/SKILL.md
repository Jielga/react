---
name: getting-started
description: >
  Set up @jielga/nordic-map: the NordicMap canvas map of Sweden, the bundled map
  source swedenOsmSource, GPS pins (MapPin with label, color, priority and
  data), pin labels, selection (selectionMode, selected, defaultSelected,
  onSelectionChange, onPinClick, highlighted, onPinHover, selectPinsByArea,
  pinsInArea), layer visibility by zoom (LayerVisibility on showBorder,
  showRoads, showRoadLabels, showPlaceLabels, showPins, showPinLabels),
  colorScheme and mapStyle with lightMapStyle / darkMapStyle, the CSS variables,
  and labels with NORDIC_MAP_LABELS_EN / NORDIC_MAP_LABELS_SV. Load when
  rendering an offline map of Sweden, when the map is blank, stays on its
  loader, reloads on every render, or its cells 404 after a build. Clusters,
  tooltips, the camera ref, areas, paths and custom sources are the map-content
  skill.
metadata:
  type: core
  library: '@jielga/nordic-map'
  library_version: '0.3.0'
sources:
  - 'Jielga/react:packages/nordic-map/docs/getting-started.md'
  - 'Jielga/react:packages/nordic-map/docs/pins.md'
  - 'Jielga/react:packages/nordic-map/docs/selection.md'
  - 'Jielga/react:packages/nordic-map/docs/layers.md'
  - 'Jielga/react:packages/nordic-map/docs/styling.md'
  - 'Jielga/react:packages/nordic-map/docs/localization.md'
  - 'Jielga/react:packages/nordic-map/docs/accessibility.md'
  - 'Jielga/react:packages/nordic-map/docs/data-and-licenses.md'
  - 'Jielga/react:packages/nordic-map/src/index.ts'
  - 'Jielga/react:packages/nordic-map/src/NordicMap/NordicMap.tsx'
---

# nordic-map - Getting started

`NordicMap` draws an offline map of Sweden on a canvas, with GPS pins on top.
Its data ships with the package; no tile server or API key. The only peer
dependencies are `react` and `react-dom` 19.1+.

## Setup

```tsx
import "@jielga/nordic-map/styles.css"; // or styles.layer.css: layer `nordic-map`
import { NordicMap, swedenOsmSource, type MapPin } from "@jielga/nordic-map";
import { useState } from "react";

type Office = { staff: number };

const pins: MapPin<Office>[] = [
  { id: "sto", lat: 59.33, lon: 18.07, label: "Stockholm", data: { staff: 420 } },
];

export function Offices() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div style={{ height: 600 }}>
      <NordicMap
        source={swedenOsmSource}
        label="Offices"
        pins={pins}
        selected={selected}
        onSelectionChange={setSelected}
        onPinClick={(pin) => console.log(pin.data?.staff)}
      />
    </div>
  );
}
```

`NordicMap<T>` and `NordicMapProps<T>` take the type of the pins' `data`.

## Pins

- `MapPin`: `id`, `lat`, `lon` (WGS 84), `label` (visible label, tooltip,
  accessible name), `color`, `priority` (wins label collisions and starts
  clusters), `data`.
- `showPinLabels` (default `false`) draws labels beside pins; they never
  overlap pins or each other.

## Selection

- `selectionMode`: `"multiple"` (default; drag a box, click toggles),
  `"single"` (click selects one, drag pans), `"none"` (drag pans). Type
  `SelectionMode`.
- `selected` / `onSelectionChange` controlled, or `defaultSelected`.
- `highlighted` (pin id) draws a ring; `onPinHover` reports pointer and
  keyboard focus. Together they link the map to a list.
- `selectPinsByArea` (default `false`, `"multiple"` mode only): a click on an
  area selects the pins inside it instead of clearing the selection;
  Shift/Ctrl/Cmd + click adds them, or removes them when all are selected.
  `pinsInArea(pins, area)` returns the pins inside an area (holes excluded,
  great-circle edges as drawn), for selecting by area from your own code.

## Layers

Every `show*` prop takes a `LayerVisibility`: `true`, `false`, or
`{ minZoom, maxZoom }` (zoom 1 is the whole map, both ends included):
`showBorder`, `showRoads`, `showRoadLabels`, `showPlaceLabels`, `showPins`,
`showPinLabels`, `showAreas`, `showPaths`. Hidden pins can not be clicked,
selected or tabbed to.

## Styling

- `colorScheme`: `"auto"` (default, follows the system), `"light"`, `"dark"`.
  Type `MapColorScheme`. Pass your app's scheme if it has its own switch.
- `mapStyle`: any `MapStyle` field over `lightMapStyle` / `darkMapStyle`
  (`sea`, `land`, `border`, `road`, `text`, `pin`, `pinSelected`, `pinRadius`,
  `areaFill`, `path`, `highlight` and more).
- Buttons, tooltip and credit line use CSS variables such as
  `--nordic-map-control-bg`, `--nordic-map-focus-ring`,
  `--nordic-map-tooltip-bg`; set them on the map or an ancestor.

## Text

`labels` merges `NordicMapLabels` over `NORDIC_MAP_LABELS_EN`;
`NORDIC_MAP_LABELS_SV` is Swedish. `label` names the map.

## Sources

`swedenOsmSource` is OpenStreetMap in three levels, with lakes, roads and
place names. Its cells are JSON files in `dist/cells/`, found with
`new URL(..., import.meta.url)`; Vite and webpack 5 copy them.

## Common mistakes

### CRITICAL: a source created during render

```tsx
// Wrong: a new object every render reloads every cell
<NordicMap source={{ ...swedenOsmSource }} />
// Right: a module constant
<NordicMap source={swedenOsmSource} />
```

### HIGH: a container without a height

`NordicMap` fills its container. A container with no height renders a map
0 px tall.

### HIGH: the stylesheet is missing

Without `@jielga/nordic-map/styles.css` the canvas and its input layer are not
laid out, and the map does not fill its container.

### MEDIUM: pins without unique ids

`id` keys the selection, the keyboard buttons and the callbacks. Two pins with
one id select together and confuse screen readers.

### MEDIUM: the attribution is removed

OpenStreetMap data is under the ODbL and must be credited "© OpenStreetMap
contributors". `swedenOsmSource` sets `attribution` and `NordicMap` shows it;
keep it when wrapping the source.

### MEDIUM: cells 404 after a build

A bundler without `new URL(..., import.meta.url)` support leaves the cell
files out and the map shows its load error. Use Vite or webpack 5, or a
`MapSource` whose `loadCell` fetches from your own server.
