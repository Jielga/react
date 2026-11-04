import { NordicMap as LibraryNordicMap } from "../../../../packages/nordic-map/src/index.ts";
import type { NordicMapProps } from "../../../../packages/nordic-map/src/index.ts";
import { demoMapLayerProps, useAppliedDemoMapSettings } from "./demoMapSettings.ts";

/*
 * What `@jielga/nordic-map` resolves to in this app, through vite.alias.ts and tsconfig.json's `paths`.
 * Everything is the library's own, except `NordicMap`, which follows the reader's demo map settings on the
 * docs pages. The demos keep importing the package by name, so their source reads as a user's would.
 */
// oxlint-disable-next-line react/only-export-components -- the module stands in for the package, so it exports all of it
export * from "../../../../packages/nordic-map/src/index.ts";

export function NordicMap<T = unknown>(props: NordicMapProps<T>) {
  const settings = useAppliedDemoMapSettings();
  if (!settings) {
    return <LibraryNordicMap {...props} />;
  }
  return <LibraryNordicMap {...props} {...demoMapLayerProps({ settings, props })} />;
}
