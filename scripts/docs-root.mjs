// Writes the Pages root: the index page, the shared 404 page and the files
// every site's copies load from there.
//
// The root holds nothing but one directory per registered site and what this
// script writes, so it starts by removing everything else. That is what
// retires a site dropped from the registry, and what cleared out the grid site
// when it moved from the root to its own directory.
//
// Usage: node scripts/docs-root.mjs <pages-dir> <index-build-dir> <pages-root>
import {
  cpSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { REGISTRY_PATH, readSites } from "./docs-sites.mjs";

const [pages, indexBuild, pagesRoot] = process.argv.slice(2);
if (!pages || !indexBuild || !pagesRoot) {
  console.error(
    "Usage: node scripts/docs-root.mjs <pages-dir> <index-build-dir> <pages-root>",
  );
  process.exit(1);
}

const STATIC = "apps/docs-shell/static";

/**
 * The grid site was served from the Pages root itself before every package got
 * a directory of its own. A missing path under no site is sent there, which
 * keeps links into the old layout working.
 */
const LEGACY_ROOT_SITE = "tmdatagrid";

const sites = readSites();
const keep = new Set([".git", ...sites.map((site) => site.slug)]);

for (const entry of readdirSync(pages)) {
  if (!keep.has(entry)) rmSync(join(pages, entry), { recursive: true });
}

cpSync(indexBuild, pages, { recursive: true });

for (const file of ["docs-spa-path.js", "docs-version-switcher.js"]) {
  cpSync(join(STATIC, file), join(pages, file));
}

const notFound = readFileSync(join(STATIC, "404.html"), "utf8")
  .replaceAll("%PAGES_ROOT%", pagesRoot)
  .replaceAll("%SITES%", sites.map((site) => site.slug).join(" "))
  .replaceAll(
    "%LEGACY_SITE%",
    sites.some((site) => site.slug === LEGACY_ROOT_SITE) ? LEGACY_ROOT_SITE : "",
  );
writeFileSync(join(pages, "404.html"), notFound);

// The registry as the headers read it at runtime, so a frozen copy of one site
// still lists the packages added after it was built.
cpSync(REGISTRY_PATH, join(pages, "sites.json"));

// Pages serves this tree as-is, and Jekyll would otherwise drop anything whose
// name starts with an underscore.
writeFileSync(join(pages, ".nojekyll"), "");

console.log(`Pages root: index page and ${sites.length} site directories`);
