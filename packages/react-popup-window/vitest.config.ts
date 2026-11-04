import { defineConfig } from "vitest/config";

/**
 * jsdom, with the shared setup file the other workspace packages use. No
 * React plugin: the library has no JSX, and the tests' JSX goes through
 * Vite's own transform.
 */
export default defineConfig({
  test: {
    name: "react-popup-window",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
