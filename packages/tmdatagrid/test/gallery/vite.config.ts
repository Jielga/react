import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

/**
 * The story gallery Playwright's component tests mount into. It serves the
 * grid from source with the same compiler plugins as the library build, so a
 * story runs the code that ships.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // The port must match the `components` project's baseURL and its webServer
  // entry in playwright.config.ts. strictPort makes a taken port fail the run
  // instead of letting Vite drift to the next free one.
  server: { port: 5274, strictPort: true },
  publicDir: false,
});
