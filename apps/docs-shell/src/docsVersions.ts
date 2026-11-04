import { isRecord, useJson } from "./useJson";

/**
 * Which copy of a site's documentation this is, and what else is deployed
 * beside it.
 *
 * Each site is published as several complete builds under its own directory
 * of the Pages root, `/react/<slug>/`: the newest release at that directory,
 * the tip of main at `next/`, one directory per minor line at `v1.1/`, and
 * builds of a branch at `b/<branch>/`.
 * Each build is compiled against its own `--base`, so switching version is a
 * full page load to another bundle, never a router navigation.
 *
 * The identity of a copy is stamped at build time, unlike the registry figures
 * in `packageStatus.ts`: a build genuinely is one version's documentation for
 * ever, and asking a server which one it is would be asking a question the
 * bundle already answers.
 */

/** The directory this site's copies live under. "/" under `bun run dev`. */
export const DOCS_SITE_ROOT =
  import.meta.env.VITE_DOCS_SITE_ROOT ?? import.meta.env.BASE_URL;

/** This copy's slug, or null when nothing stamped it: a local build. */
export const DOCS_SLUG = import.meta.env.VITE_DOCS_SLUG ?? null;

const MANIFEST_URL = `${DOCS_SITE_ROOT}versions.json`;

/** The slug of the copy served from the site root. */
export const ROOT_SLUG = "root";

export type DocsEntryKind = "stable" | "prerelease" | "dev" | "preview";

export type DocsEntry = {
  /** Directory under the site root. Never empty: the root copy is a mirror. */
  path: string;
  label: string;
  version?: string;
  kind: DocsEntryKind;
  /** Whether the site root serves a copy of this entry. */
  latest?: boolean;
};

export type DocsManifest = { entries: ReadonlyArray<DocsEntry> };

const KINDS: ReadonlyArray<DocsEntryKind> = [
  "stable",
  "prerelease",
  "dev",
  "preview",
];

function isKind(value: unknown): value is DocsEntryKind {
  return KINDS.includes(value as DocsEntryKind);
}

function readEntry(value: unknown): DocsEntry | null {
  if (!isRecord(value)) return null;
  const { path, label, version, kind, latest } = value;
  if (typeof path !== "string" || path === "") return null;
  if (typeof label !== "string" || !isKind(kind)) return null;

  return {
    path,
    label,
    version: typeof version === "string" ? version : undefined,
    kind,
    latest: latest === true,
  };
}

/**
 * Reads the manifest the deploy writes, dropping anything malformed rather than
 * failing: an unreadable entry costs one menu item, and a manifest from an
 * older deploy has to stay readable by a newer build.
 */
export function readManifest(value: unknown): DocsManifest | null {
  if (!isRecord(value) || !Array.isArray(value.entries)) return null;
  const entries = value.entries
    .map(readEntry)
    .filter((entry): entry is DocsEntry => entry !== null);

  return entries.length > 0 ? { entries } : null;
}

export function useDocsManifest(): DocsManifest | null {
  return useJson(MANIFEST_URL, readManifest);
}

/** The entry this build is, or null on a local build or an unlisted copy. */
export function currentEntry(
  manifest: DocsManifest | null,
  slug: string | null,
): DocsEntry | null {
  if (!manifest || slug === null) return null;
  if (slug === ROOT_SLUG) {
    return manifest.entries.find((entry) => entry.latest) ?? null;
  }
  return manifest.entries.find((entry) => entry.path === slug) ?? null;
}

/** What the header badge says. A local build is honest about being one. */
export function currentLabel(
  manifest: DocsManifest | null,
  slug: string | null,
): string {
  return currentEntry(manifest, slug)?.label ?? (slug === null ? "dev" : slug);
}

/**
 * Previews are branch names on public URLs. They belong in the menu of someone
 * already looking at one, and not in the menu a reader of the released
 * documentation opens.
 */
export function showsPreviews(slug: string | null): boolean {
  return slug === "next" || (slug !== null && slug.startsWith("b/"));
}

export type DocsMenu = {
  versions: ReadonlyArray<DocsEntry>;
  previews: ReadonlyArray<DocsEntry>;
};

/** The manifest split into the menu's two groups, in manifest order. */
export function docsMenu(
  manifest: DocsManifest | null,
  slug: string | null,
): DocsMenu {
  const entries = manifest?.entries ?? [];
  return {
    versions: entries.filter((entry) => entry.kind !== "preview"),
    previews: showsPreviews(slug)
      ? entries.filter((entry) => entry.kind === "preview")
      : [],
  };
}

/**
 * Where a menu item points: the same page in another copy.
 *
 * An absolute URL rather than a router target, because the destination is a
 * different bundle. The path is carried across so switching version from
 * `/docs/columns` lands on that page's older wording; a page that version never
 * had falls through to the soft "no documentation page named" message the docs
 * route already renders.
 */
export function versionHref(entry: DocsEntry, pathname: string): string {
  const directory = entry.latest ? "" : `${entry.path}/`;
  return `${DOCS_SITE_ROOT}${directory}${pathname.replace(/^\//, "")}`;
}
