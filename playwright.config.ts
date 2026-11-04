import { defineConfig, devices } from "@playwright/test";

const DOCS_PORT = 5273;
const DOCS_URL = `http://localhost:${DOCS_PORT}`;
// Must match `server.port` in packages/tmdatagrid/test/gallery/vite.config.ts.
const GALLERY_PORT = 5274;
const GALLERY_URL = `http://localhost:${GALLERY_PORT}/`;
// Must match the `dev` script in apps/popup-docs/package.json.
const POPUP_DOCS_PORT = 5275;
const POPUP_DOCS_URL = `http://localhost:${POPUP_DOCS_PORT}/`;
// Must match the `dev` script in apps/nordic-map-docs/package.json.
const NORDIC_MAP_PORT = 5277;
const NORDIC_MAP_URL = `http://localhost:${NORDIC_MAP_PORT}/`;
// Must match the `dev` script in apps/docs-home/package.json.
const HOME_PORT = 5276;
const HOME_URL = `http://localhost:${HOME_PORT}/`;

// A default export, because the Playwright runner requires one.
export default defineConfig({
  testDir: "playwright",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
  },
  // Each project is paired with the server its baseURL points at.
  projects: [
    {
      name: "docs",
      testDir: "playwright/docs",
      use: { baseURL: DOCS_URL },
    },
    {
      // Stories from packages/tmdatagrid/test/stories, mounted into the
      // gallery page through Playwright's `mount` fixture.
      name: "components",
      testDir: "playwright/components",
      use: {
        baseURL: GALLERY_URL,
        serviceWorkers: "block",
        permissions: ["clipboard-read", "clipboard-write"],
        // Every `mount` navigates to the gallery afresh, so one context per
        // worker loses no isolation the stories rely on.
        reuseContext: true,
      },
    },
    {
      // The react-popup-window demos in apps/popup-docs, driven through real
      // popup windows.
      name: "popup",
      testDir: "playwright/popup",
      use: { baseURL: POPUP_DOCS_URL },
    },
    {
      // The @jielga/nordic-map demos in apps/nordic-map-docs.
      name: "nordic-map",
      testDir: "playwright/nordic-map",
      use: { baseURL: NORDIC_MAP_URL },
    },
    {
      // The index page at the Pages root, in apps/docs-home.
      name: "home",
      testDir: "playwright/home",
      use: { baseURL: HOME_URL },
    },
  ],
  // Playwright starts every entry on every run, whatever `--project` says;
  // the gallery and the other sites are each up in about a second, so all
  // of them always start.
  webServer: [
    {
      // Its own port, so a `bun run dev` on 5173 is never mistaken for the
      // test server; --strictPort makes a taken port fail the run instead of
      // letting Vite drift to the next free one.
      command: `bun run --cwd apps/docs dev --port ${DOCS_PORT} --strictPort`,
      url: `${DOCS_URL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --cwd packages/tmdatagrid gallery",
      url: GALLERY_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --cwd apps/popup-docs dev",
      url: POPUP_DOCS_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --cwd apps/nordic-map-docs dev",
      url: NORDIC_MAP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun run --cwd apps/docs-home dev",
      url: HOME_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
