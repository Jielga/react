import type { ComponentType } from "react";

/**
 * Pairs every demo module with its own source text. Both globs walk the same paths, so adding a demo is adding
 * a file, and the code on screen is the code that runs.
 */

type DemoModule = Record<string, unknown>;

const demoModules = import.meta.glob<DemoModule>("./demos/**/*.tsx", { eager: true });

const demoSources = import.meta.glob<string>("./demos/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The shared modules demos import, available as extra source tabs */
const sharedSources = import.meta.glob<string>("./data/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** A demo file exports exactly one component, under whatever name reads best in its own source */
function findComponent(module: DemoModule, file: string): ComponentType {
  const exported = Object.values(module).find((value) => {
    return typeof value === "function";
  });
  if (!exported) {
    throw new Error(`Demo "${file}" exports no component.`);
  }
  return exported as ComponentType;
}

/** `file` is relative to `demos/`, for example `"pins/PinLabels.tsx"` */
export function loadDemo(file: string): { Component: ComponentType; source: string } {
  const key = `./demos/${file}`;
  const module = demoModules[key];
  const source = demoSources[key];
  if (!module || source === undefined) {
    throw new Error(`Unknown demo "${file}". Expected a file at apps/nordic-map-docs/src/examples/demos/${file}.`);
  }
  return { Component: findComponent(module, file), source };
}

/** `file` is relative to `examples/`, for example `"data/cities.ts"` */
export function loadSharedSource(file: string): string {
  const source = sharedSources[`./${file}`];
  if (source === undefined) {
    throw new Error(`Unknown shared source "${file}". Expected a file at apps/nordic-map-docs/src/examples/${file}.`);
  }
  return source;
}

/** Every demo path. The demo test walks this. */
export function listDemoFiles(): string[] {
  return Object.keys(demoModules).map((key) => {
    return key.replace("./demos/", "");
  });
}
