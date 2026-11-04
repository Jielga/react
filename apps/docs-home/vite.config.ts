import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The index page at the Pages root. No `base` here: dev serves from `/`, and
 * the deploy passes the Pages root with `--base` on the command line.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
  },
});
