// Syncs `metadata.library_version` in every skills/*/SKILL.md of every public
// workspace package to that package's version, then validates the result.
//
// Runs as the second half of `bun run version-packages`, immediately after
// `changeset version` bumps the manifests. Intent compares each skill's
// library_version against its package's version and reports drift, so without
// this step every release would leave every skill stale until someone noticed.
// Doing it here means the bump and the skill sync land in the same Version
// Packages PR and can be reviewed together.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { getPackages } from "@manypkg/get-packages";
import { runIntent } from "./intent.mjs";

const { packages } = await getPackages(process.cwd());

for (const pkg of packages) {
  if (pkg.packageJson.private) continue;
  const skills = join(pkg.dir, "skills");
  if (!existsSync(skills)) continue;
  const status = runIntent([
    "validate",
    "--set-version",
    pkg.packageJson.version,
    skills,
  ]);
  if (status !== 0) process.exit(status);
}
