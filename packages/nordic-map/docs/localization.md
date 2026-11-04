# Localization

Every text the map shows, and every name it gives to screen readers, comes from one labels object.
By default, the texts are English.

`labels` takes any of the `NordicMapLabels` fields and merges them over the English ones.
A full Swedish set ships as `NORDIC_MAP_LABELS_SV`:

```demo
file: localization/Swedish.tsx
hint: Point at the zoom buttons and at a cluster.
height: 480
extraSources: data/cities.ts
```

`NORDIC_MAP_LABELS_EN` is the English set.
`label` names the map itself, and falls back to `labels.map`.
Place names, road numbers and the credit line come from the map data and are not translated.

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `labels` | Prop | `Partial<NordicMapLabels>` | `NORDIC_MAP_LABELS_EN` | Sets the texts, merged over the English ones. |
| `label` | Prop | `string` | `labels.map` | Sets the accessible name of the map. |
| `NordicMapLabels` | Type | - | - | Every text. Its fields are below. |
| `NORDIC_MAP_LABELS_EN` | Constant | `NordicMapLabels` | - | The English texts. |
| `NORDIC_MAP_LABELS_SV` | Constant | `NordicMapLabels` | - | The Swedish texts. |

### NordicMapLabels

| Field | Type | English | Description |
| --- | --- | --- | --- |
| `map` | `string` | `"Map"` | Sets the accessible name of the map when `label` is not set. |
| `zoomIn` | `string` | `"Zoom in"` | Sets the name of the zoom in button. |
| `zoomOut` | `string` | `"Zoom out"` | Sets the name of the zoom out button. |
| `showWholeMap` | `string` | `"Show whole map"` | Sets the name of the button that shows the whole map. |
| `loading` | `string` | `"Loading map"` | Sets the accessible name of the loading spinner. |
| `loadError` | `string` | `"Could not load the map."` | Sets the message shown when the map data could not be loaded. |
| `cluster` | `(count: number) => string` | `` `${count} pins` `` | Sets the name of a cluster, for its tooltip and for screen readers. |
