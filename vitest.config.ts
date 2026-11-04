import { defineConfig } from "vitest/config";

/**
 * One `vitest run` at the root covers every workspace package. Each package
 * carries its own `vitest.config.ts` (jsdom, the React plugin, the shared
 * setup file); the deploy scripts under `scripts/` are plain Node ESM and get
 * an inline project of their own.
 */
export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "apps/*/vitest.config.ts",
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.mjs"],
        },
      },
    ],
  },
});
