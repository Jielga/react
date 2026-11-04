import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/** jsdom, with the shared setup file the other workspace packages use. */
export default defineConfig({
  plugins: [react()],
  test: {
    name: "nordic-map",
    environment: "jsdom",
    setupFiles: ["../../vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
