# Pins

A pin is a GPS position drawn over the map.
Pass the pins in `pins`:

```tsx
import { NordicMap, swedenOsmSource, type MapPin } from "@jielga/nordic-map";

const pins: MapPin[] = [
  { id: "sto", lat: 59.33, lon: 18.07, label: "Stockholm" },
  { id: "got", lat: 57.71, lon: 11.97, label: "Göteborg" },
];

<NordicMap source={swedenOsmSource} pins={pins} />;
```

`id` identifies the pin in the selection and in callbacks, so each pin needs its own.
`lat` and `lon` are WGS 84 degrees, as a GPS gives them.

## Labels

`label` names a pin: it is the pin's tooltip, its accessible name, and the text of its visible label.
Set `showPinLabels` to draw the labels next to the pins:

```demo
file: pins/PinLabels.tsx
hint: Zoom in on Stockholm to see the labels that did not fit.
height: 480
```

A label never covers a pin or another label, and a label that does not fit is left out.
The map tries each label right of its pin, then left of it, above it and below it.
When labels compete for the same space, they are placed in this order:

- the label of the highlighted pin, and of the pin with keyboard focus
- the labels of selected pins
- the labels of pins with a higher `priority`
- the labels of pins earlier in `pins`

Place names and road signs give way to pin labels.

## Colors

`color` sets the color of one unselected pin.
The other pins take `mapStyle.pin`, selected pins take `mapStyle.pinSelected`, and `mapStyle.pinRadius` sets the size of every pin.
[Styling](/docs/styling) lists every style.

## Show pins in a zoom range

`showPins` and `showPinLabels` take a [layer visibility](/docs/layers): `true`, `false`, or a zoom range.
In this demo the pins show from zoom 3, and their labels from zoom 4:

```demo
file: pins/PinZoomRange.tsx
hint: Scroll in until the pins appear.
height: 480
```

A hidden pin can not be clicked, selected or reached with the keyboard.
Pin labels only show where the pins show.

## Your own data

`MapPin` takes the type of `data` as its type parameter, and every callback hands the pin back with its `data`:

```tsx
type Office = { staff: number };

const offices: MapPin<Office>[] = [{ id: "sto", lat: 59.33, lon: 18.07, data: { staff: 420 } }];

<NordicMap
  source={swedenOsmSource}
  pins={offices}
  onPinClick={(pin) => {
    console.log(pin.data?.staff);
  }}
/>;
```

## Reference

| Name | Kind | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `pins` | Prop | `MapPin<T>[]` | `[]` | Sets the pins. |
| `showPins` | Prop | `LayerVisibility` | `true` | Determines when the pins show. |
| `showPinLabels` | Prop | `LayerVisibility` | `false` | Determines when the pin labels show. They only show where the pins show too. |
| `MapPin` | Type | - | - | A pin. Its fields are below. |

### MapPin

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | - | Identifies the pin. Required. |
| `lat` | `number` | - | Latitude in WGS 84 degrees. Required. |
| `lon` | `number` | - | Longitude in WGS 84 degrees. Required. |
| `label` | `string` | - | Sets the pin's visible label, its tooltip and its accessible name. If not set, the pin has no label and no tooltip, and its accessible name is its `id`. |
| `color` | `string` | `mapStyle.pin` | Sets the color of the pin when it is not selected. |
| `priority` | `number` | `0` | Sets the pin's rank when labels collide, and in [clusters](/docs/clusters). Higher first. |
| `data` | `T` | - | Sets your own data, handed back in callbacks. |
