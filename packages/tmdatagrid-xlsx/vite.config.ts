import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Builds the publishable package into `dist`. No React and no stylesheet: the
 * addon is one function that writes a workbook, and it never renders.
 *
 * `exceljs` is a dependency rather than a peer, but it stays external all the
 * same - bundling a spreadsheet writer into the addon would hide it from the
 * consumer's dependency tree and duplicate it beside their own copy.
 */
const EXTERNAL = [/^@jielga\//, /^exceljs($|\/)/];

export default defineConfig({
  // Nothing static ships beside the bundle.
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: { external: EXTERNAL },
  },
});
