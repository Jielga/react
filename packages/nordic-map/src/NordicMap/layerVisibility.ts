/**
 * When a map layer shows: always (`true`), never (`false`), or at zoom factors from `minZoom` to `maxZoom`.
 * Zoom 1 shows the whole map. Both ends are included, and an end that is left out has no limit.
 */
export type LayerVisibility = boolean | { minZoom?: number; maxZoom?: number };

/** Zoom factor over which a layer fades, just outside its range, so it does not pop in or out */
const FADE_FACTOR = 1.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Opacity of a layer at `zoom`: 1 inside its range, fading to 0 within one fade step outside it. */
export function layerOpacity({ visibility, zoom }: { visibility: LayerVisibility; zoom: number }): number {
  if (typeof visibility === "boolean") {
    return visibility ? 1 : 0;
  }
  const { minZoom = 0, maxZoom = Infinity } = visibility;
  if (zoom < minZoom) {
    return clamp(1 - Math.log(minZoom / zoom) / Math.log(FADE_FACTOR), 0, 1);
  }
  if (zoom > maxZoom) {
    return clamp(1 - Math.log(zoom / maxZoom) / Math.log(FADE_FACTOR), 0, 1);
  }
  return 1;
}
