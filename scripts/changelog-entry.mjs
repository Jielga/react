// One version's section of CHANGELOG.md, for a GitHub release's body.
//
// The release job publishes before `changesets/action` runs - see release.yml
// for why it has to - so it creates the release itself rather than letting the
// action do it, and this is where the notes come from. The action reads the
// same section for the same purpose, so a release keeps reading as it did.
//
// A line scan is enough: the file is written by `@changesets/changelog-github`,
// whose shape is one `## <version>` heading per release, the package name as
// the only `#` heading, and `###` for the change levels beneath.
//
// Usage: node scripts/changelog-entry.mjs <version> [changelog-path]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** The body under `## <version>`, or null when the version is not in the file. */
export function changelogEntry(markdown, version) {
  const lines = markdown.split("\n");
  const heading = `## ${version}`;
  const start = lines.findIndex((line) => line.trimEnd() === heading);
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }

  return lines.slice(start + 1, end).join("\n").trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [version, path = "CHANGELOG.md"] = process.argv.slice(2);
  if (!version) {
    console.error("Usage: node scripts/changelog-entry.mjs <version> [changelog-path]");
    process.exit(1);
  }

  const entry = changelogEntry(readFileSync(path, "utf8"), version);
  if (entry === null) {
    console.error(`No ${path} section for ${version}.`);
    process.exit(1);
  }

  process.stdout.write(entry + "\n");
}
