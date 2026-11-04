// The package documentation sites, read from the registry the sites
// themselves are built with: `apps/docs-shell/sites.json`.
//
// The deploy publishes each site under `<pages root>/<slug>/`, and the Pages
// root itself holds nothing but those directories, the index page and the
// files written next to it. A slug is therefore also a directory name at the
// root, and must not collide with anything the index page publishes there.
import { readFileSync } from "node:fs";

export const REGISTRY_PATH = "apps/docs-shell/sites.json";

/** Names the index page's own build writes at the Pages root. */
const RESERVED = new Set(["assets", "b", "next"]);

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The registry, checked. Throws on anything the deploy cannot act on: a bad
 * entry here would publish a site to the wrong directory or delete one.
 */
export function parseSites(value) {
  if (!value || !Array.isArray(value.sites) || value.sites.length === 0) {
    throw new Error(`${REGISTRY_PATH}: expected a non-empty "sites" array.`);
  }
  const seen = new Set();
  return value.sites.map((site, index) => {
    const where = `${REGISTRY_PATH}: sites[${index}]`;
    if (typeof site?.slug !== "string" || !SLUG.test(site.slug)) {
      throw new Error(`${where}: "slug" must match ${SLUG}.`);
    }
    if (RESERVED.has(site.slug) || /^v\d/.test(site.slug)) {
      throw new Error(`${where}: "${site.slug}" is reserved at the Pages root.`);
    }
    if (seen.has(site.slug)) {
      throw new Error(`${where}: "${site.slug}" is listed twice.`);
    }
    seen.add(site.slug);
    for (const key of ["title", "description", "dir", "app"]) {
      if (typeof site[key] !== "string" || site[key] === "") {
        throw new Error(`${where}: "${key}" must be a non-empty string.`);
      }
    }
    if (
      !Array.isArray(site.packages) ||
      site.packages.length === 0 ||
      !site.packages.every((name) => typeof name === "string" && name !== "")
    ) {
      throw new Error(`${where}: "packages" must list at least one package.`);
    }
    if (site.published !== undefined && typeof site.published !== "boolean") {
      throw new Error(`${where}: "published" must be true or false.`);
    }
    return site;
  });
}

export function readSites(path = REGISTRY_PATH) {
  return parseSites(JSON.parse(readFileSync(path, "utf8")));
}
