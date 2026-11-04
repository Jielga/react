import { fileURLToPath } from "node:url";
import type { AliasOptions } from "vite";

const popup = (path: string) =>
  fileURLToPath(
    new URL(`../../packages/react-popup-window/${path}`, import.meta.url),
  );

const grid = (path: string) =>
  fileURLToPath(new URL(`../../packages/tmdatagrid/${path}`, import.meta.url));

/**
 * The site consumes the libraries the way a user does, by package name, but
 * resolves them to source: `bun run --cwd apps/popup-docs dev` then
 * hot-reloads library files and no build has to run before the typecheck.
 * The published manifests know nothing of this - it is the consumer's config,
 * here and in tsconfig.json's `paths`.
 */
export const workspaceAlias: AliasOptions = [
  {
    find: /^@jielga\/react-popup-window$/,
    replacement: popup("src/index.ts"),
  },
  { find: /^@jielga\/tmdatagrid$/, replacement: grid("src/index.ts") },
];
