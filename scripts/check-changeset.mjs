// Fails the commit when a published package changed but no changeset is
// pending, so a release can't silently ship an unlisted change.
//
// Deliberately narrow. Only changes under the `src/` of a public workspace
// package -- the code that ends up in a tarball -- require a changeset. Docs
// site, docs markdown, skills, CI and tooling commits do not, and neither does
// the "chore: version packages" commit, which consumes changesets rather than
// adding one and never touches the sources.
//
// The check looks for any pending changeset, not one staged in this particular
// commit: a feature is usually several commits and one changeset covers them.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { getPackages } from "@manypkg/get-packages";

const { packages } = await getPackages(process.cwd());
// Git prints forward slashes whatever the platform; relativeDir does not.
const LIBRARY_DIRS = packages
  .filter((pkg) => !pkg.packageJson.private)
  .map((pkg) => `${pkg.relativeDir.replaceAll("\\", "/")}/src/`);

const staged = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const libraryChanges = staged.filter((file) =>
  LIBRARY_DIRS.some((dir) => file.startsWith(dir)),
);
if (libraryChanges.length === 0) process.exit(0);

const pending = existsSync(".changeset")
  ? readdirSync(".changeset").filter(
      (file) => file.endsWith(".md") && file !== "README.md",
    )
  : [];

if (pending.length > 0) process.exit(0);

console.error(`
✖ No changeset for a change to a published package.

  Staged under ${LIBRARY_DIRS.join(", ")}
${libraryChanges.map((file) => `    ${file}`).join("\n")}

  Describe the change so it reaches the changelog and bumps the version:

    bun run changeset

  If this genuinely needs no release -- a comment, a test, an internal
  refactor with no observable effect -- skip the check:

    git commit --no-verify
`);

process.exit(1);
