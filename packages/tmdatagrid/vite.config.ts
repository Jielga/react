import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

/**
 * Emits `styles.layer.css` beside the built stylesheet: the same rules,
 * wrapped in a named cascade layer so a consumer can state the order
 * (`@layer mantine, tmdatagrid, app;`) instead of fighting specificity.
 * The layer name is public API - never rename it.
 */
function emitLayerStylesheet(): Plugin {
  return {
    name: "tmdatagrid:styles-layer",
    async closeBundle() {
      await writeFile(
        fileURLToPath(new URL("./dist/styles.layer.css", import.meta.url)),
        '@import "./styles.css" layer(tmdatagrid);\n',
      );
    },
  };
}

/**
 * Builds the publishable package into `dist`. The docs site is its own
 * workspace package (`apps/docs`) with its own Vite config.
 *
 * Every peer dependency is externalised. Bundling any of them would give the
 * consumer a second copy of React, of the Mantine theme context, or of the
 * TanStack Table feature registry - each of which breaks at runtime rather
 * than at build time.
 */
const EXTERNAL = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^@mantine\//,
  /^@tabler\//,
  /^@tanstack\//,
];

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    emitLayerStylesheet(),
  ],
  // Nothing static ships beside the bundle.
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    // One stylesheet for the whole package, imported by the consumer as
    // `@jielga/tmdatagrid/styles.css`.
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(
        new URL("./src/index.ts", import.meta.url),
      ),
      formats: ["es"],
      fileName: () => "index.js",
      cssFileName: "styles",
    },
    rollupOptions: { external: EXTERNAL },
  },
});
