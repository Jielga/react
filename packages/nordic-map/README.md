# @jielga/nordic-map

An offline map of Sweden for React, with GPS pins, labels, clusters, areas and paths.
The map data ships with the package, so no tile server or API key is needed.

- Documentation and live demos: <https://jielga.github.io/react/nordic-map/>
- Source: <https://github.com/Jielga/react/tree/main/packages/nordic-map>

## Installation

```sh
npm install @jielga/nordic-map
```

The peer dependencies are `react` and `react-dom`, 19.1 or later.

Import the stylesheet once:

```ts
import "@jielga/nordic-map/styles.css";
```

`@jielga/nordic-map/styles.layer.css` holds the same rules in the cascade layer `nordic-map`.

## Usage

`NordicMap` fills its container, so give the container a height:

```tsx
import { NordicMap, swedenOsmSource, type MapPin } from "@jielga/nordic-map";
import { useState } from "react";

const pins: MapPin[] = [
  { id: "sto", lat: 59.33, lon: 18.07, label: "Stockholm" },
  { id: "got", lat: 57.71, lon: 11.97, label: "Göteborg" },
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
      />
    </div>
  );
}
```

Define `source` outside the component; a new object on every render loads every map cell again.

## Features

- Pins with labels that never overlap, colors, priorities and your own data
- Selection by drag box, by click or by clicking an area, and a highlighted pin for linking the map to a list
- Clusters of close pins, which open on click
- Areas, with Sweden's counties and municipalities built in for choropleth maps
- Paths, such as GPS tracks and routes
- Place names, roads and road signs, each shown in a zoom range of your choice
- A camera you move from code: `flyTo`, `fitBounds`, `fitPins`
- Light and dark colors, a style object for every color, and CSS variables for the buttons
- English and Swedish texts
- Keyboard access to every pin on screen

The documentation in [`docs/`](docs/) has one page per feature, and ships with the package.

## Data licenses

The OpenStreetMap data is © OpenStreetMap contributors, under the Open Database License (ODbL).
A map that shows it must credit "© OpenStreetMap contributors"; `swedenOsmSource` sets this credit, and `NordicMap` shows it in the corner.
The Natural Earth land borders of the neighbouring countries are in the public domain.

## Development

The data in `src/data/` is built by the scripts in [`scripts/map-data/`](scripts/map-data/README.md), which also lists the sources and how to rebuild.
The output is committed, so the scripts only need to run when the data changes.

The documentation site is [`apps/nordic-map-docs/`](../../apps/nordic-map-docs) in this repository:

```sh
bun run --cwd apps/nordic-map-docs dev
```
