# Accessibility

The map is one stop in the tab order, with the role `application` and the name from `label`.
Its pins and clusters follow it in the tab order.

## Keyboard

With the map focused:

- `+` and `-` zoom in and out
- the arrow keys pan
- `0` shows the whole map
- Tab moves to the first pin or cluster on screen, and on through the others in `pins` order

With a pin or cluster focused:

- Enter or Space clicks it: a pin is selected or unselected, and a cluster zooms in on its pins
- the arrow keys, `+`, `-` and `0` still move the map
- the map draws a ring around it, and shows its tooltip

Only the pins and clusters on screen are in the tab order, and hidden pins are not.
When the focused pin leaves the view, or its cluster splits, the focus moves back to the map.

## Screen readers

Each pin and cluster on screen is a button, hidden from view, named by the pin's `label` or the cluster's `labels.cluster` text.
When pins can be selected, a pin's button is a toggle button, pressed while the pin is selected.
The tooltip is hidden from screen readers, since the button carries the same name.
The zoom buttons are named from `labels`, as described on [Localization](/docs/localization).

## Reduced motion

When the user's system asks for reduced motion, `flyTo`, `fitBounds`, `fitPins`, `reset` and a click on a cluster move the map at once instead of easing.
The loading spinner turns more slowly.
