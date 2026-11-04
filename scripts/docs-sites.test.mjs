import { describe, expect, test } from "vitest";
import { parseSites, readSites } from "./docs-sites.mjs";

const site = {
  slug: "thing",
  title: "Thing",
  description: "A thing.",
  packages: ["@jielga/thing"],
  dir: "packages/thing",
  app: "apps/thing-docs",
};

describe("the site registry", () => {
  test("the repository's own registry is valid", () => {
    expect(readSites().length).toBeGreaterThan(0);
  });

  test("every site's app and package directory exist", async () => {
    const { existsSync } = await import("node:fs");
    for (const entry of readSites()) {
      expect(existsSync(`${entry.app}/package.json`), entry.app).toBe(true);
      expect(existsSync(`${entry.dir}/package.json`), entry.dir).toBe(true);
    }
  });

  test("refuses a slug that would land on the index page's own files", () => {
    expect(() => parseSites({ sites: [{ ...site, slug: "assets" }] })).toThrow(
      /reserved/,
    );
    expect(() => parseSites({ sites: [{ ...site, slug: "v2.0" }] })).toThrow();
  });

  test("refuses a slug listed twice", () => {
    expect(() => parseSites({ sites: [site, site] })).toThrow(/twice/);
  });

  test("refuses a site without packages", () => {
    expect(() => parseSites({ sites: [{ ...site, packages: [] }] })).toThrow(
      /packages/,
    );
  });
});
