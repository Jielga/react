import { useEffect, useMemo, useState } from "react";
import { loadSwedenCounties, loadSwedenMunicipalities } from "@jielga/nordic-map";
import type { MapArea } from "@jielga/nordic-map";
import { partsFromGeometry } from "./editorModel.ts";
import type { Part } from "./editorModel.ts";
import { buildSnapIndex } from "./snapping.ts";
import type { SnapIndex } from "./snapping.ts";

export type ReferenceLayer = "none" | "counties" | "municipalities";

export type Region = { area: MapArea; parts: Part[] };

export type ReferenceRegions = {
  regions: Region[];
  index: SnapIndex | null;
  loading: boolean;
  error: string | null;
};

const LOADERS: Record<Exclude<ReferenceLayer, "none">, () => Promise<MapArea[]>> = {
  counties: loadSwedenCounties,
  municipalities: loadSwedenMunicipalities,
};

const noRegions: Region[] = [];

/** The counties or municipalities shown under the areas, to trace, snap to and add */
export function useReferenceRegions(layer: ReferenceLayer): ReferenceRegions {
  const [loaded, setLoaded] = useState<{ layer: ReferenceLayer; areas: MapArea[] } | null>(null);
  const [error, setError] = useState<{ layer: ReferenceLayer; message: string } | null>(null);

  useEffect(() => {
    if (layer === "none") {
      return;
    }
    let cancelled = false;
    LOADERS[layer]().then(
      (areas) => {
        if (!cancelled) {
          setLoaded({ layer, areas });
        }
      },
      (reason: unknown) => {
        if (!cancelled) {
          setError({ layer, message: reason instanceof Error ? reason.message : String(reason) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [layer]);

  const current = loaded?.layer === layer ? loaded.areas : null;
  const regions = useMemo(() => {
    return current
      ? current.map((area) => {
          return { area, parts: partsFromGeometry(area.geometry) };
        })
      : noRegions;
  }, [current]);
  const index = useMemo(() => {
    return regions.length > 0
      ? buildSnapIndex({
          shapes: regions.map((region) => {
            return region.parts;
          }),
        })
      : null;
  }, [regions]);

  const currentError = error?.layer === layer ? error.message : null;
  return {
    regions: layer === "none" ? noRegions : regions,
    index: layer === "none" ? null : index,
    loading: layer !== "none" && current === null && currentError === null,
    error: currentError,
  };
}
