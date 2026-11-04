import type { ReactNode } from "react";
import { useStoredState } from "../useStoredState.ts";
import { Applied, DEMO_MAP_DEFAULTS, isDemoMapSettings, Settings } from "./demoMapSettings.ts";

/** Holds the settings for the site, so the navigation can change them and the docs pages can apply them */
export function DemoMapSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useStoredState({ key: "demo-map", initial: DEMO_MAP_DEFAULTS, isValid: isDemoMapSettings });
  return <Settings.Provider value={{ settings, setSettings }}>{children}</Settings.Provider>;
}

/** Makes every map under it follow the settings, unless the demo sets the layer itself */
export function DemoMapSettingsScope({ children }: { children: ReactNode }) {
  return <Applied.Provider value={true}>{children}</Applied.Provider>;
}
