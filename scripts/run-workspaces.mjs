// Runs one package.json script in every workspace under a folder that has it,
// one at a time, each after the workspaces it depends on. The root build
// scripts use it, so adding a package or a site needs no root wiring.
//
// `bun run --filter` would run them too, but it does not wait for a
// `workspace:*` devDependency: it starts the xlsx build before the grid's
// `dist` exists, and the xlsx declaration build then fails.
//
// Usage: node scripts/run-workspaces.mjs <script> <folder>
//   node scripts/run-workspaces.mjs build packages
// Stops at the first workspace whose script fails, with its exit code.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { getPackages } from "@manypkg/get-packages";

/** The names of the workspaces `pkg` depends on, through any dependency field */
function workspaceDependencies(pkg, names) {
  const json = pkg.packageJson;
  return [
    ...Object.keys(json.dependencies ?? {}),
    ...Object.keys(json.devDependencies ?? {}),
    ...Object.keys(json.peerDependencies ?? {}),
  ].filter((name) => names.has(name));
}

/**
 * The workspaces under `folder` that have `script`, ordered so each comes after
 * the workspaces it depends on, and otherwise by folder name. Throws on a
 * dependency cycle between them.
 */
export function runOrder(packages, { script, folder }) {
  const selected = packages
    .filter((pkg) => {
      const dir = pkg.relativeDir.replaceAll("\\", "/");
      return dir.startsWith(`${folder}/`) && pkg.packageJson.scripts?.[script] !== undefined;
    })
    .sort((a, b) => a.relativeDir.localeCompare(b.relativeDir));
  const byName = new Map(selected.map((pkg) => [pkg.packageJson.name, pkg]));
  const names = new Set(byName.keys());

  const ordered = [];
  const state = new Map();
  const visit = (pkg, path) => {
    const name = pkg.packageJson.name;
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") {
      throw new Error(`Workspace dependency cycle: ${[...path, name].join(" -> ")}`);
    }
    state.set(name, "visiting");
    for (const dependency of workspaceDependencies(pkg, names)) {
      visit(byName.get(dependency), [...path, name]);
    }
    state.set(name, "done");
    ordered.push(pkg);
  };
  for (const pkg of selected) visit(pkg, []);
  return ordered;
}

async function main() {
  const [script, folder] = process.argv.slice(2);
  if (!script || !folder) {
    console.error("Usage: node scripts/run-workspaces.mjs <script> <folder>");
    process.exit(2);
  }
  const { packages } = await getPackages(process.cwd());
  const order = runOrder(packages, { script, folder });
  if (order.length === 0) {
    console.error(`No workspace under ${folder}/ has a "${script}" script.`);
    process.exit(1);
  }
  for (const pkg of order) {
    console.log(`\n> ${pkg.packageJson.name}: bun run ${script}`);
    const result = spawnSync("bun", ["run", script], { cwd: pkg.dir, stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`${pkg.packageJson.name}: "${script}" failed`);
      process.exit(result.status ?? 1);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
