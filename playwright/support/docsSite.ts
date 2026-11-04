import type { Locator, Page } from "@playwright/test";
import { DataGrid } from "./DataGrid";

// Helpers for the docs site only. A docs page renders several demos, each in
// a `DemoBlock` frame marked `data-demo="<path under demos/>"`; nothing here
// belongs in a page object copied into another app.

type DemoTarget = {
  /** The docs page, such as `/docs/sorting`. */
  route: string;
  /** The demo's path under `apps/docs/src/examples/demos/`, such as `columns/Sorting.tsx`. */
  file: string;
};

/**
 * Opens `route` and returns the frame of one demo, for specs that also use
 * controls the demo renders around its grid.
 */
export async function openDemo(
  page: Page,
  { route, file }: DemoTarget,
): Promise<Locator> {
  await page.goto(route);
  const block = page.locator(`[data-demo="${file}"]`);
  await block.scrollIntoViewIfNeeded();
  return block;
}

/** Opens `route` and returns the grid of one demo on it. */
export async function openDemoGrid(
  page: Page,
  target: DemoTarget,
): Promise<DataGrid> {
  const block = await openDemo(page, target);
  return new DataGrid(block.locator("[data-dg-root]"));
}
