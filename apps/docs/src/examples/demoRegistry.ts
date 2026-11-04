import type { ComponentType } from "react";

/**
 * Pairs every demo module with its own source text. Both globs walk the same
 * paths, so adding a demo is adding a file - there is no list to keep in step,
 * and the code on screen is by construction the code that is running.
 *
 * Eager on purpose: the demos are small next to the grid they render, and
 * loading them up front keeps the topic page synchronous and the smoke test a
 * plain loop.
 */

type DemoModule = Record<string, unknown>;

const demoModules = import.meta.glob<DemoModule>("./demos/**/*.tsx", {
  eager: true,
});

const demoSources = import.meta.glob<string>("./demos/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The shared modules demos import, available as extra source tabs. */
const sharedSources = import.meta.glob<string>("./data/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

export type LoadedDemo = {
  Component: ComponentType;
  source: string;
};

/**
 * A demo file exports exactly one component, under whatever name reads best in
 * its own source - so the component is found by shape rather than by a name
 * every file would otherwise have to share.
 */
function findComponent(module: DemoModule, file: string): ComponentType {
  const exported = Object.values(module).find(
    (value) => typeof value === "function",
  );

  if (!exported) {
    throw new Error(`Demo "${file}" exports no component.`);
  }

  return exported as ComponentType;
}

/** `file` is relative to `demos/` - e.g. `"columns/Sorting.tsx"`. */
export function loadDemo(file: string): LoadedDemo {
  const key = `./demos/${file}`;
  const module = demoModules[key];
  const source = demoSources[key];

  if (!module || source === undefined) {
    throw new Error(
      `Unknown demo "${file}". Expected a file at apps/docs/src/examples/demos/${file}.`,
    );
  }

  return { Component: findComponent(module, file), source };
}

/** `file` is relative to `apps/docs/src/examples/` - e.g. `"data/employees.ts"`. */
export function loadSharedSource(file: string): string {
  const source = sharedSources[`./${file}`];

  if (source === undefined) {
    throw new Error(
      `Unknown shared source "${file}". Expected a file at apps/docs/src/examples/${file}.`,
    );
  }

  return source;
}

/** Every registered demo path. The smoke test walks this. */
export function listDemoFiles(): Array<string> {
  return Object.keys(demoModules).map((key) => key.replace("./demos/", ""));
}
