// Semver precedence, enough of it for the versions this project publishes.
//
// Shared by the two deploy scripts: `docs-targets.mjs` asks whether a release
// outranks what the site root serves, and `docs-manifest.mjs` orders the lines
// in the version menu. They have to agree, and they disagreed once already -
// a comparison that ignored prerelease identifiers read "2.0.0" and
// "2.0.0-beta.0" as the same version, so a stable release could never take the
// root from the prerelease that led up to it.

/** `{ release: [major, minor, patch], pre: [identifier] }`, or null. */
function parse(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(
    version ?? "",
  );
  if (!match) return null;
  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split(".") : [],
  };
}

/** Precedence for one dot-separated prerelease identifier. */
function compareIdentifier(a, b) {
  const numericA = /^\d+$/.test(a);
  const numericB = /^\d+$/.test(b);
  if (numericA && numericB) return Number(a) - Number(b);
  // A numeric identifier always has lower precedence than an alphanumeric one.
  if (numericA !== numericB) return numericA ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Negative, zero or positive, as an ordering function returns.
 *
 * Anything unparseable compares equal rather than throwing: both callers are
 * ordering a menu or choosing a directory, and neither is worth failing a
 * deploy over.
 */
export function compareVersions(a, b) {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;

  for (let i = 0; i < 3; i++) {
    if (left.release[i] !== right.release[i]) {
      return left.release[i] - right.release[i];
    }
  }

  // Same release: a prerelease ranks below the release it leads up to.
  if (left.pre.length === 0 || right.pre.length === 0) {
    return left.pre.length === 0 ? (right.pre.length > 0 ? 1 : 0) : -1;
  }

  for (let i = 0; i < Math.min(left.pre.length, right.pre.length); i++) {
    const order = compareIdentifier(left.pre[i], right.pre[i]);
    if (order !== 0) return order;
  }
  // All shared identifiers equal: the longer set wins.
  return left.pre.length - right.pre.length;
}

export function isPrerelease(version) {
  return /^\d+\.\d+\.\d+-/.test(version ?? "");
}

/** "2.0.0-beta.0" becomes "v2.0": one directory per minor line. */
export function lineOf(version) {
  const match = /^(\d+)\.(\d+)\./.exec(version ?? "");
  return match ? `v${match[1]}.${match[2]}` : null;
}
