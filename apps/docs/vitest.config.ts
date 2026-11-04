import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { workspaceAlias } from "./vite.alias.ts";

/** The site's own tests: demos, docs registry, search index, deploy shims. */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAlias },
  test: {
    name: "docs",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
