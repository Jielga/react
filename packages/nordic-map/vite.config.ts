import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

/**
 * Emits `styles.layer.css` beside the built stylesheet: the same rules,
 * wrapped in a named cascade layer so a consumer can state the order
 * (`@layer nordic-map, app;`) instead of fighting specificity.
 * The layer name is public API - never rename it.
 */
function emitLayerStylesheet(): Plugin {
  return {
    name: "nordic-map:styles-layer",
    async closeBundle() {
      await writeFile(
        fileURLToPath(new URL("./dist/styles.layer.css", import.meta.url)),
        '@import "./styles.css" layer(nordic-map);\n',
      );
    },
  };
}

/**
 * Builds the package into `dist`, as ESM. The docs site is its own workspace
 * package (`apps/nordic-map-docs`) with its own Vite config.
 *
 * Peer dependencies stay external: bundling React hands the consumer a
 * second copy of the runtime. The runtime dependencies stay external too, so
 * the consumer's bundler deduplicates them.
 */
const EXTERNAL = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^d3-geo$/,
];

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), emitLayerStylesheet()],
  // Asset URLs relative to the module that names them, so they resolve
  // wherever the consumer's bundler puts the package.
  base: "./",
  // Nothing from a public directory ships beside the bundle.
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    // One stylesheet for the whole package, imported by the consumer as
    // `@jielga/nordic-map/styles.css`.
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js",
      cssFileName: "styles",
    },
    rollupOptions: {
      external: EXTERNAL,
      output: {
        // The map cells and the county and municipality files, under their
        // own names. Each is a `new URL(…, import.meta.url)` in the bundle,
        // which the consumer's bundler copies in turn, so the data loads from
        // their own origin.
        assetFileNames: (asset) => {
          if (asset.names.some((name) => name.startsWith("sweden-") && name.endsWith(".json"))) {
            return "regions/[name][extname]";
          }
          return asset.names.some((name) => name.endsWith(".json"))
            ? "cells/[name][extname]"
            : "[name][extname]";
        },
      },
    },
  },
});
