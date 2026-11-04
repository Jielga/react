import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { workspaceAlias } from "./vite.alias.ts";

/** The site's own tests: every demo mounts, and the docs pages match the library they document. */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAlias },
  test: {
    name: "nordic-map-docs",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
