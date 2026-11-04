import { fileURLToPath } from "node:url";
import type { AliasOptions } from "vite";

const map = (path: string) =>
  fileURLToPath(new URL(`../../packages/nordic-map/${path}`, import.meta.url));
const app = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The site consumes the library the way a user does, by package name, but
 * resolves it to source: `bun run --cwd apps/nordic-map-docs dev` then
 * hot-reloads library files and no build has to run first. The published
 * manifest knows nothing of this - it is the consumer's config, here and in
 * tsconfig.json's `paths`.
 *
 * The package name resolves to `nordicMapForDemos.tsx`, which re-exports the
 * library and wraps `NordicMap` so the demos on the docs pages follow the
 * reader's demo map settings.
 */
export const workspaceAlias: AliasOptions = [
  { find: /^@jielga\/nordic-map$/, replacement: app("src/examples/nordicMapForDemos.tsx") },
  { find: /^@jielga\/nordic-map\/docs\//, replacement: map("docs/") },
];
