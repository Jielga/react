import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { workspaceAlias } from "./vite.alias.ts";

/**
 * The react-popup-window documentation site and its live examples. The
 * library it documents is `@jielga/react-popup-window`, resolved to its
 * workspace source through `vite.alias.ts`; the package itself builds from
 * `packages/react-popup-window/vite.config.ts`.
 *
 * No `base` here: dev serves from `/`, and the deploy passes the Pages path
 * with `--base` on the command line.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAlias },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
  },
});
