import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// Every stylesheet a published package ships: `packages/<name>/src/**/*.css`.
const PACKAGES = join(import.meta.dirname, "../packages");
const isPackageStylesheet = (path) => {
  const [, dir, ...rest] = path.split("/");
  return dir === "src" && (rest.at(-1) ?? "").endsWith(".css");
};
const stylesheets = readdirSync(PACKAGES, { recursive: true, encoding: "utf8" })
  .map((path) => path.replaceAll("\\", "/"))
  .filter(isPackageStylesheet)
  .map((path) => ({
    path: `packages/${path}`,
    source: readFileSync(join(PACKAGES, path), "utf8"),
  }));

describe("package stylesheets", () => {
  test("find at least one stylesheet", () => {
    expect(stylesheets.length).toBeGreaterThan(0);
  });

  // Vite builds each package through Lightning CSS, which lowers `light-dark()`
  // for its default browser targets into
  // `var(--lightningcss-light, A) var(--lightningcss-dark, B)` and relies on
  // a `color-scheme` declaration in the same stylesheet to define the two
  // variables. The packages declare none - Mantine owns `color-scheme` - so
  // both fallbacks survive, the declaration holds two values where one is
  // allowed, and the browser drops it. The grid's pinned-lane band, filter
  // pills and match highlight all lost their colours in `dist/styles.css`
  // while every dev server still showed them. The dark scheme is written as a
  // second rule under `:where([data-mantine-color-scheme="dark"])` instead,
  // which is what Mantine's own styles do.
  test("never use light-dark(), which the library build lowers into an invalid declaration", () => {
    const offenders = stylesheets
      .filter(({ source }) => source.includes("light-dark("))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});
