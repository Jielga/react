import { useEffect, useState } from "react";
import { loadSwedenCounties } from "@jielga/nordic-map";
import { partsFromGeometry } from "./editorModel.ts";
import { buildOutlineIndex } from "./snapping.ts";
import type { SnapIndex } from "./snapping.ts";

let coast: Promise<SnapIndex> | null = null;

/**
 * Sweden's coast and its land borders, as the outline of the counties. The counties are clipped to the land and
 * share their borders exactly, so their outline is the edges that only one county has.
 */
function loadCoast(): Promise<SnapIndex> {
  coast ??= loadSwedenCounties().then((counties) => {
    return buildOutlineIndex(
      counties.map((county) => {
        return partsFromGeometry(county.geometry);
      }),
    );
  });
  coast.catch(() => {
    coast = null;
  });
  return coast;
}

/** The coast and border to snap to, once loaded, while `enabled` */
export function useCoastIndex(enabled: boolean): SnapIndex | null {
  const [index, setIndex] = useState<SnapIndex | null>(null);
  useEffect(() => {
    if (!enabled || index) {
      return;
    }
    let cancelled = false;
    // Without the coast, snapping still works on the areas and the regions
    loadCoast().then(
      (loaded) => {
        if (!cancelled) {
          setIndex(loaded);
        }
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, index]);
  return enabled ? index : null;
}
