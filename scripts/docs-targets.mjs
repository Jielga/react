// Reads the state a deploy run decides against and prints the plan.
//
// The decision itself is in `docs-plan.mjs`, once per site; this is the shell
// around it - the site registry, git, the gh-pages tree, and the event that
// fired. Deciding against the tree rather than against git history makes a run
// idempotent: a line that failed to deploy is picked up by the next push, and a
// rerun of the same push writes the same directories.
//
// The trigger is the push to main rather than a tag or a release, because
// Changesets creates both with GITHUB_TOKEN and events raised by that token do
// not start workflow runs. The merge of a "chore: version packages" pull
// request is an ordinary push whose package.json version changed, and that is
// what a versioned snapshot hangs off.
//
// Usage: node scripts/docs-targets.mjs <pages-dir>
// Reads GITHUB_EVENT_NAME and the workflow_dispatch inputs from DOCS_INPUT_SITE,
// DOCS_INPUT_REF, DOCS_INPUT_SLUG and DOCS_INPUT_MIRROR_ROOT.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lineOf, planDispatch, planPush } from "./docs-plan.mjs";
import { readSites } from "./docs-sites.mjs";

const pages = process.argv[2];
if (!pages) {
  console.error("Usage: node scripts/docs-targets.mjs <pages-dir>");
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function showJson(ref, path) {
  try {
    return JSON.parse(
      execFileSync("git", ["show", `${ref}:${path}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return null;
  }
}

/**
 * The version of the site's first package at a ref, or in the working tree
 * when ref is empty. The manifest counts only when it names that package.
 */
function versionAt(ref, site) {
  const path = `${site.dir}/package.json`;
  const manifest = ref ? showJson(ref, path) : readJson(path);
  return manifest?.name === site.packages[0] ? (manifest.version ?? null) : null;
}

/**
 * The release tag of a version, `<name>@<version>` as the release workflow
 * writes it, when the package at that tag really is that version.
 */
function tagFor(site, version) {
  const tag = `${site.packages[0]}@${version}`;
  return versionAt(`refs/tags/${tag}`, site) === version ? tag : null;
}

/** The metadata a build wrote into its own directory. */
function metaAt(siteDir, slug) {
  return slug ? readJson(join(siteDir, slug, "meta.json")) : null;
}

/** Whether the site's first package is released, that is, not `"private": true`. */
function isReleased(site) {
  return readJson(`${site.dir}/package.json`)?.private !== true;
}

function planSite(site) {
  const siteDir = join(pages, site.slug);
  const version = versionAt("", site);
  if (!version) {
    console.error(`${site.slug}: no version for ${site.packages[0]}; skipped.`);
    return { targets: [], remove: [] };
  }
  const line = lineOf(version);
  // The root carries the slug it mirrors rather than a copy of that build's
  // metadata, so what it serves is read through the copy it points at.
  const rootSlug = readJson(join(siteDir, "meta.json"))?.slug ?? null;

  return planPush({
    version,
    released: isReleased(site),
    lineVersion: metaAt(siteDir, line)?.version,
    rootExists: existsSync(join(siteDir, "index.html")),
    rootSlug,
    rootServesVersion: metaAt(siteDir, rootSlug)?.version ?? null,
    tag: tagFor(site, version),
  });
}

/** A plan's targets, each told which site it belongs to and how to build it. */
function forSite(site, plan) {
  return {
    targets: plan.targets.map((target) => ({
      ...target,
      site: site.slug,
      app: site.app,
    })),
    remove: plan.remove.map((slug) => `${site.slug}/${slug}`),
  };
}

const sites = readSites();
const event = process.env.GITHUB_EVENT_NAME ?? "";
const plans = [];

if (event === "workflow_dispatch") {
  const slug = process.env.DOCS_INPUT_SLUG ?? "";
  const siteSlug = process.env.DOCS_INPUT_SITE ?? "";
  const site = sites.find((entry) => entry.slug === siteSlug);
  if (!site || !slug) {
    console.error(
      `workflow_dispatch needs a site input (one of: ${sites
        .map((entry) => entry.slug)
        .join(", ")}) and a slug input.`,
    );
    process.exit(1);
  }
  const ref = process.env.DOCS_INPUT_REF ?? "";
  plans.push(
    forSite(
      site,
      planDispatch({
        slug,
        ref,
        version: versionAt(ref, site),
        mirrorRoot: process.env.DOCS_INPUT_MIRROR_ROOT === "true",
      }),
    ),
  );
} else {
  for (const site of sites) plans.push(forSite(site, planSite(site)));
}

const targets = plans.flatMap((plan) => plan.targets);
const remove = plans.flatMap((plan) => plan.remove);
const out = { targets, remove, work: targets.length + remove.length > 0 };
console.error(JSON.stringify(out, null, 2));
process.stdout.write(JSON.stringify(out));
