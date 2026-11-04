# Getting started

An offline map of Sweden for React, with GPS pins, labels, clusters, areas and paths.
The map data ships with the package, so no tile server or API key is needed.

## Installation

```sh
npm install @jielga/nordic-map
```

The peer dependencies are `react` and `react-dom`, 19.1 or later.

Import the stylesheet once:

```ts
import "@jielga/nordic-map/styles.css";
```

To order the map's rules against your own, import `@jielga/nordic-map/styles.layer.css` instead.
It holds the same rules in the cascade layer `nordic-map`:

```css
@layer nordic-map, app;
```

## A first map

`NordicMap` fills its container, so give the container a height:

```tsx
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";

export function Offices() {
  return (
    <div style={{ height: 600 }}>
      <NordicMap source={swedenOsmSource} label="Offices" />
    </div>
  );
}
```

Define `source` outside the component; a new object on every render loads every map cell again.

## Pins and selection

Pass `pins` to draw GPS points, and `selected` with `onSelectionChange` to control which of them are selected:

```demo
file: getting-started/FirstMap.tsx
hint: Drag a box over the pins to select them. Scroll to zoom, and drag with the right mouse button to pan.
height: 480
```

## Map data

`swedenOsmSource` is Sweden from OpenStreetMap in three detail levels, with lakes, roads and place names.
A map that shows OpenStreetMap data must credit its contributors, and `NordicMap` shows that credit in its corner.
[Map sources](/docs/map-sources) describes the source and how to write your own, and [Data and licenses](/docs/data-and-licenses) the credit it needs.
