import { readFileSync } from "node:fs";
import { test as base, expect } from "@playwright/test";

type AutoFixtures = {
  /** Answers the docs site's npm registry read, so no test touches the network. */
  mockRegistry: void;
  /** Answers the site header's read of the published site list. */
  mockSites: void;
  /** Fails the test on any `console.error` or uncaught page error. */
  failOnConsoleErrors: void;
};

// Only `dist-tags` is read (`packageStatus.ts`). The CORS header is required:
// the site fetches cross-origin, and a response without it is rejected and
// logged as a console error, which the fixture below would then fail on.
const REGISTRY_RESPONSE = {
  "dist-tags": { latest: "1.1.1", beta: "2.0.0-beta.25" },
};

// A local build links to the published sites, and reads their list from there
// (`docs-shell/src/sites.ts`). The repository's own list stands in for it.
const SITES_URL = "https://jielga.github.io/react/sites.json";
const SITES = readFileSync(
  new URL("../../apps/docs-shell/sites.json", import.meta.url),
  "utf8",
);

export const test = base.extend<AutoFixtures>({
  mockRegistry: [
    async ({ page }, use) => {
      await page.route("https://registry.npmjs.org/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(REGISTRY_RESPONSE),
        });
      });
      await use();
    },
    { auto: true },
  ],

  mockSites: [
    async ({ page }, use) => {
      await page.route(SITES_URL, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: SITES,
        });
      });
      await use();
    },
    { auto: true },
  ],

  failOnConsoleErrors: [
    async ({ page }, use) => {
      const errors: Array<string> = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => {
        errors.push(`Uncaught: ${error.message}`);
      });
      await use();
      expect(errors, `Console errors:\n${errors.join("\n")}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
