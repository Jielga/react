# Clusters

Set `cluster` to join pins that are close on screen into a cluster, drawn as a circle with the number of its pins:

```demo
file: clusters/Clusters.tsx
hint: Click a cluster to zoom in on it. Drag a box over clusters to select all their pins.
height: 520
```

A cluster behaves like this:

- a click, or Enter on its keyboard focus, zooms in until its pins fit in the view
- a drag-select box over a cluster selects every pin in it
- a cluster with some of its pins selected has a ring in `mapStyle.pinSelected`, and a cluster with all of them selected is filled with it
- at `maxZoom` every pin shows on its own, so pins at the same spot can still be reached

The pin with the highest `priority` starts a cluster and takes the pins around it.
Between pins of the same priority, the pin earlier in `pins` comes first.
The clusters change at fixed zoom steps, not on every frame of a zoom.

## Cluster radius

By default, pins within 40 pixels of each other join a cluster.
To change the distance, pass `radius`:

```tsx
<NordicMap source={swedenOsmSource} pins={stores} cluster={{ radius: 60 }} />
```

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `cluster` | Prop | `boolean \| ClusterOptions` | `false` | Determines whether pins close together join clusters. |
| `ClusterOptions` | Type | - | - | The options of `cluster`. Its field is below. |

### ClusterOptions

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `radius` | `number` | `40` | Sets the distance in pixels within which pins join a cluster. |
