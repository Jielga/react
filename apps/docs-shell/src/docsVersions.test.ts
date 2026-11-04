import { describe, expect, it } from "vitest";
import {
  currentEntry,
  currentLabel,
  docsMenu,
  readManifest,
  ROOT_SLUG,
  showsPreviews,
  versionHref,
  type DocsManifest,
} from "./docsVersions";

const MANIFEST: DocsManifest = {
  entries: [
    { path: "v1.1", label: "1.1.1", version: "1.1.1", kind: "stable", latest: true },
    { path: "next", label: "next", version: "2.0.0-beta.0", kind: "dev" },
    { path: "v2.0", label: "2.0.0-beta.0", version: "2.0.0-beta.0", kind: "prerelease" },
    { path: "b/feature", label: "feature", kind: "preview" },
  ],
};

describe("readManifest", () => {
  it("reads what the deploy writes", () => {
    const parsed = readManifest({
      entries: [{ path: "next", label: "next", kind: "dev" }],
    });
    expect(parsed?.entries).toEqual([
      { path: "next", label: "next", version: undefined, kind: "dev", latest: false },
    ]);
  });

  it("drops an entry it cannot understand rather than the whole manifest", () => {
    const parsed = readManifest({
      entries: [
        { path: "next", label: "next", kind: "dev" },
        { path: "v9.9", label: "9.9.9", kind: "something-later" },
        "not an entry",
      ],
    });
    expect(parsed?.entries.map((entry) => entry.path)).toEqual(["next"]);
  });

  it("answers null for anything that is not a manifest", () => {
    expect(readManifest(null)).toBeNull();
    expect(readManifest({ entries: [] })).toBeNull();
    expect(readManifest({ entries: "no" })).toBeNull();
  });
});

describe("currentEntry", () => {
  it("resolves the root slug to the entry the root mirrors", () => {
    expect(currentEntry(MANIFEST, ROOT_SLUG)?.path).toBe("v1.1");
  });

  it("resolves a directory slug to its own entry", () => {
    expect(currentEntry(MANIFEST, "v2.0")?.label).toBe("2.0.0-beta.0");
  });

  it("has no answer for a local build or an unlisted copy", () => {
    expect(currentEntry(MANIFEST, null)).toBeNull();
    expect(currentEntry(MANIFEST, "b/gone")).toBeNull();
    expect(currentEntry(null, ROOT_SLUG)).toBeNull();
  });
});

describe("currentLabel", () => {
  it("names the copy being read", () => {
    expect(currentLabel(MANIFEST, ROOT_SLUG)).toBe("1.1.1");
    expect(currentLabel(MANIFEST, "next")).toBe("next");
  });

  it("says dev when nothing stamped the build", () => {
    expect(currentLabel(MANIFEST, null)).toBe("dev");
    expect(currentLabel(null, null)).toBe("dev");
  });

  it("falls back to the slug when the manifest has not arrived", () => {
    expect(currentLabel(null, "v2.0")).toBe("v2.0");
  });
});

describe("showsPreviews", () => {
  it("shows branch names to someone already looking at one", () => {
    expect(showsPreviews("next")).toBe(true);
    expect(showsPreviews("b/feature")).toBe(true);
  });

  it("keeps them out of the released documentation's menu", () => {
    expect(showsPreviews(ROOT_SLUG)).toBe(false);
    expect(showsPreviews("v1.1")).toBe(false);
    expect(showsPreviews(null)).toBe(false);
  });
});

describe("docsMenu", () => {
  it("splits the manifest into the menu's two groups", () => {
    const menu = docsMenu(MANIFEST, "next");
    expect(menu.versions.map((entry) => entry.path)).toEqual([
      "v1.1",
      "next",
      "v2.0",
    ]);
    expect(menu.previews.map((entry) => entry.path)).toEqual(["b/feature"]);
  });

  it("withholds the previews outside a preview", () => {
    expect(docsMenu(MANIFEST, ROOT_SLUG).previews).toEqual([]);
  });

  it("survives having no manifest", () => {
    expect(docsMenu(null, null)).toEqual({ versions: [], previews: [] });
  });
});

describe("versionHref", () => {
  const [latest, next] = MANIFEST.entries;

  it("carries the page across to the other copy", () => {
    expect(versionHref(next, "/docs/columns")).toBe("/next/docs/columns");
  });

  it("points the mirrored entry at the site root, not at its directory", () => {
    expect(versionHref(latest, "/docs/columns")).toBe("/docs/columns");
    expect(versionHref(latest, "/")).toBe("/");
  });

  it("lands on the front page of a copy from the front page", () => {
    expect(versionHref(next, "/")).toBe("/next/");
  });
});
