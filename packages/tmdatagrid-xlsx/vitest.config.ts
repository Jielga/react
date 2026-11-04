import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Node rather than jsdom: nothing here renders, and the workbook is read back
 * from a buffer. The grid resolves to source, the same pair the docs site
 * uses, so no build of it has to run before these tests.
 */
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@jielga\/tmdatagrid$/,
        replacement: fileURLToPath(
          new URL("../tmdatagrid/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    name: "tmdatagrid-xlsx",
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
