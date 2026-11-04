import { useEffect, useState } from "react";
import { exportAreas, parseAreas } from "./areaFiles.ts";
import type { EditorArea } from "./editorModel.ts";

/** Where the area editor keeps its areas, as MapArea JSON */
const STORAGE_KEY = "nordic-map-area-editor";
/** Kept in storage at full precision, so a reload changes nothing */
const STORED_DECIMALS = 9;

export function readStoredAreas(): EditorArea[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const result = parseAreas({ input: stored });
    return "areas" in result ? result.areas : [];
  } catch {
    return [];
  }
}

export function writeStoredAreas(areas: EditorArea[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, exportAreas({ areas, format: "json", decimals: STORED_DECIMALS }));
  } catch {
    // Storage may be full or blocked. The editor still works, it only forgets on reload.
  }
}

/** The areas saved by the area editor, updated when the editor saves in another tab */
export function useStoredAreas(): EditorArea[] {
  const [areas, setAreas] = useState(readStoredAreas);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setAreas(readStoredAreas());
      }
    };
    window.addEventListener("storage", listener);
    return () => {
      window.removeEventListener("storage", listener);
    };
  }, []);
  return areas;
}

export type MapLayerSettings = { places: boolean; roads: boolean; roadLabels: boolean; border: boolean };

export type EditorSettings = {
  layers: MapLayerSettings;
  reference: "none" | "counties" | "municipalities";
  snapping: boolean;
};

const SETTINGS_KEY = "nordic-map-area-editor-settings";

// Names and roads hide the shapes being drawn, so they start hidden. The coast is what areas are traced along.
const DEFAULT_SETTINGS: EditorSettings = {
  layers: { places: false, roads: false, roadLabels: false, border: true },
  reference: "none",
  snapping: true,
};

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** The stored settings, each one checked, so a setting the editor no longer knows falls back to its default */
function readSettings(): EditorSettings {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (typeof stored !== "object" || stored === null) {
      return DEFAULT_SETTINGS;
    }
    const { layers, reference, snapping } = stored as Partial<Record<keyof EditorSettings, unknown>>;
    const storedLayers = (typeof layers === "object" && layers !== null ? layers : {}) as Partial<Record<keyof MapLayerSettings, unknown>>;
    const defaults = DEFAULT_SETTINGS.layers;
    return {
      layers: {
        places: flag(storedLayers.places, defaults.places),
        roads: flag(storedLayers.roads, defaults.roads),
        roadLabels: flag(storedLayers.roadLabels, defaults.roadLabels),
        border: flag(storedLayers.border, defaults.border),
      },
      reference: reference === "counties" || reference === "municipalities" || reference === "none" ? reference : DEFAULT_SETTINGS.reference,
      snapping: flag(snapping, DEFAULT_SETTINGS.snapping),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** The editor's switches and layer settings, kept in local storage */
export function useEditorSettings(): [EditorSettings, (next: EditorSettings) => void] {
  const [settings, setSettings] = useState(readSettings);
  const update = (next: EditorSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Storage may be full or blocked. The settings still apply until the page reloads.
    }
  };
  return [settings, update];
}
