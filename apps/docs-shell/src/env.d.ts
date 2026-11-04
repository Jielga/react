/// <reference types="vite/client" />

/**
 * Stamped by the docs deploy workflow, one value per deployed copy. Absent
 * under `bun run dev` and under Vitest, which is what tells the header it is
 * looking at a local build.
 *
 * A site that uses the shell lists this file in its tsconfig `include`.
 */
interface ImportMetaEnv {
  /** The Pages root every site lives under, "/react/" in production. */
  readonly VITE_SITES_ROOT?: string;
  /** This site's root, the directory its copies live under: "/react/tmdatagrid/". */
  readonly VITE_DOCS_SITE_ROOT?: string;
  /** Which copy this bundle is: "root", "next", "v2.0", "b/some-branch". */
  readonly VITE_DOCS_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
