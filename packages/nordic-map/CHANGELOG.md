# @jielga/nordic-map

## 0.3.0

### Minor Changes

- [#163](https://github.com/Jielga/react/pull/163) [`72ded1a`](https://github.com/Jielga/react/commit/72ded1acdcbd23ffb4e24c999f35b80b593f1748) Thanks [@Psvensso](https://github.com/Psvensso)! - `NordicMapHandle.project` and `NordicMapHandle.unproject` convert between positions and points on screen, for drawing your own elements over the map.

- [#163](https://github.com/Jielga/react/pull/163) [`72ded1a`](https://github.com/Jielga/react/commit/72ded1acdcbd23ffb4e24c999f35b80b593f1748) Thanks [@Psvensso](https://github.com/Psvensso)! - - `selectPinsByArea`: a click on an area selects the pins inside it, and Shift, Ctrl or Cmd + click adds or removes them.
  - `pinsInArea(pins, area)` returns the pins inside an area.

## 0.2.0

### Minor Changes

- [`437eea6`](https://github.com/Jielga/react/commit/437eea63d16e3bfa7ceea2e281f8f9051cfddc2a) Thanks [@Psvensso](https://github.com/Psvensso)! - Pin labels, clusters, areas, paths, place names, a camera ref, keyboard access and docs pages.

  - Pins: `MapPin<T>` with `priority` and `data`, visible labels that never overlap (`showPinLabels`), `showPins` zoom ranges, `cluster`, `selectionMode`, `highlighted`, `onPinHover` and `renderTooltip`.
  - Areas and paths: `areas`, `paths` and their callbacks, with Sweden's counties and municipalities from `loadSwedenCounties` and `loadSwedenMunicipalities`.
  - Place names of cities, towns and villages in `swedenOsmSource`, shown with `showPlaceLabels`.
  - A `ref` with `flyTo`, `fitBounds`, `fitPins`, `zoomIn`, `zoomOut`, `reset` and `getView`, and `onMapClick`.
  - Light and dark colors through `colorScheme`, `mapStyle` with `lightMapStyle` and `darkMapStyle`, CSS variables for the buttons, and `styles.layer.css`.
  - `labels`, with English and Swedish texts.
  - Every pin and cluster on screen is a button in the tab order.

  Breaking:

  - `@mantine/core` and `@tabler/icons-react` are no longer peer dependencies, and the map needs no `MantineProvider`.
  - `SwedenMap` and `swedenOverviewSource` are removed, with their Natural Earth data; use `<NordicMap source={swedenOsmSource} />`.
  - `NordicMapPin` is now `MapPin`, and `MapLabel` with `MapLayers.labels` is now `MapRoadLabel` with `MapLayers.roadLabels`.
  - The color and size props (`background`, `landFill`, `pinColor`, `pinRadius`, `borderWidth`, `roadColor` and the others) moved into `mapStyle`, under the names on the Styling page.
  - `loadErrorText` is now `labels.loadError`, and `onZoomChange` is now `onViewChange`, called with the whole view.
  - The default colors follow the system's light or dark setting; pass `colorScheme="dark"` for the old colors.
