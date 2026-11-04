import type { SelectionMode } from "@jielga/nordic-map";
import { isBoolean, isNumber } from "../../useStoredState.ts";
import type { LayerSetting } from "./layerSetting.ts";
import { colorFields } from "./mapColors.ts";
import type { MapColors } from "./mapColors.ts";

/** Checks for the playground's stored settings */

export function isSelectionMode(value: unknown): value is SelectionMode {
  return value === "multiple" || value === "single" || value === "none";
}

export function isLayerSetting(value: unknown): value is LayerSetting {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { enabled, range } = value as { enabled?: unknown; range?: unknown };
  return isBoolean(enabled) && Array.isArray(range) && range.length === 2 && range.every(isNumber);
}

/** Picked colors, or null for the colors of the site's color scheme */
export function isPickedColors(value: unknown): value is MapColors | null {
  if (value === null) {
    return true;
  }
  if (typeof value !== "object") {
    return false;
  }
  const colors = value as Record<string, unknown>;
  return colorFields.every(({ key }) => {
    return typeof colors[key] === "string";
  });
}
