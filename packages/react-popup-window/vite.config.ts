import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Builds the publishable package into `dist`, as ESM and CommonJS. No React
 * plugin and no stylesheet: the source has no JSX and ships no CSS.
 *
 * React stays external, subpaths included (`react/jsx-runtime`,
 * `react-dom/client`): bundling it would hand the consumer a second copy of
 * the React runtime, which fails at runtime rather than at build time.
 */
const EXTERNAL = [/^react($|\/)/, /^react-dom($|\/)/];

export default defineConfig({
  // Nothing static ships beside the bundle.
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: { external: EXTERNAL },
  },
});
