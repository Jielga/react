import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { workspaceAlias } from "./vite.alias.ts";

/**
 * The nordic-map documentation site and its live demos. The library it
 * documents is `@jielga/nordic-map`, resolved to its workspace source through
 * `vite.alias.ts`; the package itself builds from
 * `packages/nordic-map/vite.config.ts`.
 *
 * No `base` here: dev serves from `/`, and the deploy passes the Pages path
 * with `--base` on the command line.
 */
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: { alias: workspaceAlias },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
  },
});
