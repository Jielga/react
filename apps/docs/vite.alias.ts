import { fileURLToPath } from "node:url";
import type { AliasOptions } from "vite";

const lib = (path: string) =>
  fileURLToPath(new URL(`../../packages/tmdatagrid/${path}`, import.meta.url));

const xlsx = (path: string) =>
  fileURLToPath(
    new URL(`../../packages/tmdatagrid-xlsx/${path}`, import.meta.url),
  );

/**
 * The site consumes the library the way a user does, by package name, but
 * resolves it to source: `bun run dev` then hot-reloads library files and no
 * build has to run before the tests or the typecheck. The published manifest
 * knows nothing of this - it is the consumer's config, here and in
 * tsconfig.json's `paths`.
 */
export const workspaceAlias: AliasOptions = [
  // The addon first: both regexes are anchored, so the order does not decide
  // anything, but the longer package name being matched first is the rule that
  // would hold if one of them ever lost its anchor.
  { find: /^@jielga\/tmdatagrid-xlsx$/, replacement: xlsx("src/index.ts") },
  { find: /^@jielga\/tmdatagrid-xlsx\/docs\//, replacement: xlsx("docs/") },
  { find: /^@jielga\/tmdatagrid$/, replacement: lib("src/index.ts") },
  { find: /^@jielga\/tmdatagrid\/docs\//, replacement: lib("docs/") },
];
