import type { LayerVisibility } from "@jielga/nordic-map";

/** Largest zoom the layer controls offer, the same as the map's default */
export const MAX_ZOOM = 50;

export type LayerSetting = {
  enabled: boolean;
  /** Zoom range, from 1 to `MAX_ZOOM` */
  range: [number, number];
};

export function toVisibility(setting: LayerSetting): LayerVisibility {
  const [minZoom, maxZoom] = setting.range;
  return setting.enabled ? { minZoom, maxZoom } : false;
}
