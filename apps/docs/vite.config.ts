import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { workspaceAlias } from "./vite.alias.ts";

/**
 * The docs site - the documentation pages, the live demos and the playground.
 * The library it documents is `@jielga/tmdatagrid`, resolved to its workspace
 * source through `vite.alias.ts`; the package itself builds from
 * `packages/tmdatagrid/vite.config.ts`.
 */
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: { alias: workspaceAlias },
});
