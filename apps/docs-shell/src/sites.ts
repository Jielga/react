import registry from "../sites.json";
import { isRecord, useJson } from "./useJson";

/**
 * Every package documentation site published from this repository.
 *
 * `sites.json` is the one list: the header's package menu, the index page at
 * the Pages root and the deploy workflow all read it. Adding a package site is
 * adding an entry there.
 *
 * The deploy also publishes the file at the Pages root, and the header reads
 * that copy at runtime. A versioned copy of one site is a frozen build, so the
 * bundled list in it is the list from the day it was built; the published
 * one names packages added since.
 */

export type Site = {
  /** Directory under the Pages root, and the site's URL segment. */
  slug: string;
  title: string;
  description: string;
  /** The packages the site documents. The first one sets its version. */
  packages: ReadonlyArray<string>;
  /** The first package's directory in the repository. */
  dir: string;
  /** The application that builds the site. */
  app: string;
  /**
   * Whether the packages are on npm. A site whose packages are not shows no
   * registry version and no npm links. Defaults to `true`.
   */
  published: boolean;
};

/**
 * The Pages root every site lives under. The deploy sets it; a local build
 * links to the published sites, because no other site runs beside it.
 */
export const SITES_ROOT: string =
  import.meta.env.VITE_SITES_ROOT ?? "https://jielga.github.io/react/";

export const REPO_URL = "https://github.com/Jielga/react";

function readSite(value: unknown): Site | null {
  if (!isRecord(value)) return null;
  const { slug, title, description, packages, dir, app, published } = value;
  if (typeof slug !== "string" || slug === "") return null;
  if (typeof title !== "string" || typeof description !== "string") {
    return null;
  }
  if (typeof dir !== "string" || typeof app !== "string") return null;
  if (!Array.isArray(packages) || packages.length === 0) return null;
  if (!packages.every((name) => typeof name === "string")) return null;
  if (published !== undefined && typeof published !== "boolean") return null;

  return {
    slug,
    title,
    description,
    packages,
    dir,
    app,
    published: published ?? true,
  };
}

/**
 * Reads a registry, dropping malformed entries rather than failing: the
 * published copy may come from a newer deploy than this build.
 */
export function readSites(value: unknown): ReadonlyArray<Site> | null {
  if (!isRecord(value) || !Array.isArray(value.sites)) return null;
  const sites = value.sites
    .map(readSite)
    .filter((site): site is Site => site !== null);
  return sites.length > 0 ? sites : null;
}

/** The list this build was made with. */
export const BUNDLED_SITES: ReadonlyArray<Site> = readSites(registry) ?? [];

/** The published list once it has loaded, the bundled one until then. */
export function useSites(): ReadonlyArray<Site> {
  return useJson(`${SITES_ROOT}sites.json`, readSites) ?? BUNDLED_SITES;
}

export function findSite(
  sites: ReadonlyArray<Site>,
  slug: string,
): Site | undefined {
  return sites.find((site) => site.slug === slug);
}

/** A site's front page: its newest release. */
export function siteHref(site: Site): string {
  return `${SITES_ROOT}${site.slug}/`;
}

/** The package's source in the repository. */
export function siteSourceHref(site: Site): string {
  return `${REPO_URL}/tree/main/${site.dir}`;
}

export function npmHref(packageName: string): string {
  return `https://www.npmjs.com/package/${packageName}`;
}
