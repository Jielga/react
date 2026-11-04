import { isRecord, useJson } from "./useJson";

/**
 * Live package state: what is on the registry today, shown inside the header's
 * version menu and wherever a site lists its published versions.
 *
 * Read at runtime rather than baked in at build time: a stamped figure would be
 * right the moment it shipped and quietly wrong from the next merge that
 * skipped a release. Which documentation you are reading is the opposite case
 * and is stamped, in `docsVersions.ts`.
 */

/**
 * The abbreviated registry document: dist-tags and dependency data only, a few
 * kB rather than the full document's every-version metadata and README.
 */
const REGISTRY_ACCEPT = "application/vnd.npm.install-v1+json";

export type DistTags = { latest?: string; beta?: string };

function readDistTags(value: unknown): DistTags | null {
  if (!isRecord(value) || !isRecord(value["dist-tags"])) return null;
  const tags = value["dist-tags"];
  const latest = tags.latest;
  const beta = tags.beta;

  return {
    latest: typeof latest === "string" ? latest : undefined,
    beta: typeof beta === "string" ? beta : undefined,
  };
}

export function useDistTags(packageName: string): DistTags | null {
  return useJson(
    `https://registry.npmjs.org/${packageName}`,
    readDistTags,
    REGISTRY_ACCEPT,
  );
}

type Parsed = { release: [number, number, number]; pre: Array<string> };

function parseVersion(version: string): Parsed | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(version);
  if (!match) return null;
  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split(".") : [],
  };
}

/** Semver precedence for one dot-separated prerelease identifier. */
function compareIdentifier(a: string, b: string): number {
  const numericA = /^\d+$/.test(a);
  const numericB = /^\d+$/.test(b);
  if (numericA && numericB) return Number(a) - Number(b);
  // A numeric identifier always has lower precedence than an alphanumeric one.
  if (numericA !== numericB) return numericA ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Whether `version` has higher semver precedence than `other`.
 *
 * Unparseable input answers `false`: the badge it feeds is decoration, and
 * hiding it beats putting a guess in the header.
 */
export function isNewerVersion(version: string, other: string): boolean {
  const a = parseVersion(version);
  const b = parseVersion(other);
  if (!a || !b) return false;

  for (let i = 0; i < 3; i++) {
    if (a.release[i] !== b.release[i]) return a.release[i] > b.release[i];
  }

  // Same release: a prerelease ranks below the release it leads up to.
  if (a.pre.length === 0 || b.pre.length === 0) {
    return b.pre.length > 0 && a.pre.length === 0;
  }

  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const order = compareIdentifier(a.pre[i], b.pre[i]);
    if (order !== 0) return order > 0;
  }
  // All shared identifiers equal: the longer set wins.
  return a.pre.length > b.pre.length;
}

/**
 * Whether the `beta` tag is worth showing beside `latest` - which it is only
 * while it actually runs ahead.
 *
 * A prerelease wave leaves its `beta` tag behind on the registry once `latest`
 * overtakes it, and "differs from latest" then reads a months-old beta as the
 * current version. That is a badge that actively misinforms, so precedence
 * decides it rather than inequality.
 */
export function betaIsAhead(tags: DistTags | null): boolean {
  if (!tags?.beta) return false;
  if (!tags.latest) return true;
  return isNewerVersion(tags.beta, tags.latest);
}

/**
 * The version worth putting in the header: whichever of the two tags a reader
 * would actually be installing today.
 */
export function headlineVersion(tags: DistTags | null): string | undefined {
  if (!tags) return undefined;
  return betaIsAhead(tags) ? tags.beta : tags.latest;
}
