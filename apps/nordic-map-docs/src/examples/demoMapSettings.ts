import { createContext, useContext } from "react";
import type { NordicMapProps } from "../../../../packages/nordic-map/src/index.ts";
import { isBoolean } from "../useStoredState.ts";

/** The map layers a reader can turn off in every demo on the docs pages */
export type DemoMapSettings = { roads: boolean; roadLabels: boolean; places: boolean };

export const DEMO_MAP_DEFAULTS: DemoMapSettings = { roads: true, roadLabels: true, places: true };

export const DEMO_MAP_SWITCHES: { key: keyof DemoMapSettings; label: string }[] = [
  { key: "roads", label: "Roads" },
  { key: "roadLabels", label: "Road signs" },
  { key: "places", label: "Places" },
];

export function isDemoMapSettings(value: unknown): value is DemoMapSettings {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { roads, roadLabels, places } = value as Record<keyof DemoMapSettings, unknown>;
  return isBoolean(roads) && isBoolean(roadLabels) && isBoolean(places);
}

export type SettingsContext = { settings: DemoMapSettings; setSettings: (next: DemoMapSettings) => void };

export const Settings = createContext<SettingsContext | null>(null);

/** Whether the maps under it follow the settings. The docs pages set it; the playground and the editor do not. */
export const Applied = createContext(false);

export function useDemoMapSettings(): SettingsContext {
  const context = useContext(Settings);
  if (!context) {
    throw new Error("useDemoMapSettings needs a DemoMapSettingsProvider");
  }
  return context;
}

/** The settings to apply to a map, or null outside a scope or a provider */
export function useAppliedDemoMapSettings(): DemoMapSettings | null {
  const applied = useContext(Applied);
  const context = useContext(Settings);
  return applied && context ? context.settings : null;
}

/** The layer props a map gets from the settings. A prop the demo passes itself wins. */
export function demoMapLayerProps<T>({
  settings,
  props,
}: {
  settings: DemoMapSettings;
  props: NordicMapProps<T>;
}): Pick<NordicMapProps<T>, "showRoads" | "showRoadLabels" | "showPlaceLabels"> {
  return {
    showRoads: props.showRoads ?? settings.roads,
    showRoadLabels: props.showRoadLabels ?? settings.roadLabels,
    showPlaceLabels: props.showPlaceLabels ?? settings.places,
  };
}
