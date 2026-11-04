import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Tests run without the React Compiler that `vite.config.ts` enables. The
 * compiler's memoization is what several of the grid's subscription comments
 * are about, so a component test here proves the wiring, not the caching
 * behaviour under a production build.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    name: "tmdatagrid",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
