// Publishes every public workspace package whose version the registry does not
// have yet. The Release workflow runs it on every push to main.
//
// Each package is its own npm package and publishes on its own, at whatever
// version its manifest says. Some share one version line through a fixed
// changesets group and some version on their own; this script does not care
// which. A package already on the registry is skipped, so merge order stops
// mattering and a version a previous run missed is picked up by the next push.
//
// Packing is bun's: `bun pm pack` resolves the `workspace:` and `catalog:`
// protocols in the manifest, which `npm publish` from a directory would ship
// verbatim. Publishing is npm's: it is the client that speaks trusted
// publishing (OIDC), which bun does not. The tarball is built first, so
// nothing here runs `prepublishOnly`; the workflow builds before it calls this.
//
// Usage: node scripts/publish-missing.mjs [--dry-run]
// Writes `published=<JSON array>` to $GITHUB_OUTPUT, one
// `{ name, version, changelog }` per package it published, where `changelog`
// is the repo-relative path of the package's CHANGELOG.md, or null when it has
// none. The array is empty when nothing was published. The Release workflow
// tags and writes a GitHub release for each entry.

import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getPackages } from "@manypkg/get-packages";

/** The public packages whose version is not on the registry. */
export function selectMissing(packages, isPublished) {
  return packages.filter(
    (pkg) => !pkg.private && !isPublished(pkg.name, pkg.version),
  );
}

/**
 * The dist-tag a version publishes under: `latest` for a release, the
 * prerelease identifier (`beta` for `2.0.0-beta.3`) otherwise, which is what
 * `changeset publish` did and what keeps `npm install` on the stable line.
 */
export function distTag(version) {
  const pre = version.split("-")[1];
  return pre ? pre.split(".")[0] : "latest";
}

/**
 * The repo-relative path of a package's CHANGELOG.md, with forward slashes on
 * every platform, or null when the package has none. `exists` answers for a
 * repo-relative path.
 */
export function changelogPath(relativeDir, exists) {
  const path = `${relativeDir.replaceAll("\\", "/")}/CHANGELOG.md`;
  return exists(path) ? path : null;
}

/** What the Release workflow needs to tag and release a published package. */
export function publishedEntry(pkg, exists) {
  return {
    name: pkg.name,
    version: pkg.version,
    changelog: changelogPath(pkg.relativeDir, exists),
  };
}

/** The $GITHUB_OUTPUT line: the published entries as single-line JSON. */
export function publishedOutput(published) {
  return `published=${JSON.stringify(published)}`;
}

function writeOutput(published) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${publishedOutput(published)}\n`);
  }
}

function isOnRegistry(name, version) {
  const result = spawnSync("npm", ["view", `${name}@${version}`, "version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return result.status === 0 && result.stdout.trim() !== "";
}

function run(command, args, options) {
  execFileSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = process.argv.includes("--dry-run");
  const { rootDir, packages } = await getPackages(process.cwd());
  const candidates = packages.map((pkg) => ({
    name: pkg.packageJson.name,
    version: pkg.packageJson.version,
    private: pkg.packageJson.private === true,
    dir: pkg.dir,
    relativeDir: pkg.relativeDir,
  }));

  const missing = selectMissing(candidates, isOnRegistry);
  for (const pkg of candidates) {
    if (pkg.private) continue;
    if (!missing.includes(pkg)) {
      console.log(`${pkg.name}@${pkg.version} is already on the registry.`);
    }
  }
  if (missing.length === 0) {
    console.log("Nothing to publish.");
    writeOutput([]);
    process.exit(0);
  }

  // The output is written in a finally block so that a package that did
  // publish still gets its tag and release when a later one fails; the next
  // run skips it as already on the registry and would otherwise never tag it.
  const inRepo = (path) => existsSync(join(rootDir, path));
  const published = [];
  const out = mkdtempSync(join(tmpdir(), "publish-"));
  try {
    for (const pkg of missing) {
      console.log(`Publishing ${pkg.name}@${pkg.version} (${distTag(pkg.version)})`);
      const tarball = execFileSync(
        "bun",
        ["pm", "pack", "--quiet", "--destination", out],
        { cwd: pkg.dir, encoding: "utf8", shell: process.platform === "win32" },
      ).trim();
      const args = ["publish", tarball, "--access", "public", "--tag", distTag(pkg.version)];
      if (dryRun) args.push("--dry-run");
      run("npm", args);
      published.push(publishedEntry(pkg, inRepo));
    }
  } finally {
    writeOutput(published);
  }
}
