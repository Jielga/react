// Runs `@tanstack/intent`'s CLI.
//
// By path, rather than the `intent` shim in node_modules/.bin. Two installed
// packages declare a bin by that name - @tanstack/intent and
// @tanstack/devtools-event-client, the latter arriving transitively through
// @tanstack/react-form - and whichever wins the name is an install-order
// accident. When the wrong one wins it crashes on an import the other package
// does not export, which is why `npx intent` does not work here. A path cannot
// be ambiguous, and it needs no shell, so Windows and CI take the same route.
//
// Everything that runs intent goes through here so that the local hook, the
// release's version step and CI all run the same pinned CLI. CI installing it
// globally at `latest` is what let a skill fail there and pass here.
//
// Usage: node scripts/intent.mjs <args...>
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const INTENT_CLI = fileURLToPath(
  new URL("../node_modules/@tanstack/intent/dist/cli.mjs", import.meta.url),
);

/** Runs the CLI to completion and answers its exit status. */
export function runIntent(args) {
  if (!existsSync(INTENT_CLI)) {
    console.error(
      `Could not find the intent CLI at ${INTENT_CLI} - is @tanstack/intent installed?`,
    );
    return 1;
  }

  const result = spawnSync(process.execPath, [INTENT_CLI, ...args], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Could not run intent: ${result.error.message}`);
    return 1;
  }

  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runIntent(process.argv.slice(2)));
}
