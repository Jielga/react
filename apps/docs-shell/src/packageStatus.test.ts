import { describe, expect, it } from "vitest";
import { betaIsAhead, headlineVersion, isNewerVersion } from "./packageStatus";

describe("isNewerVersion", () => {
  it("compares the release triple numerically", () => {
    expect(isNewerVersion("1.0.10", "1.0.9")).toBe(true);
    expect(isNewerVersion("1.2.0", "1.10.0")).toBe(false);
    expect(isNewerVersion("2.0.0", "1.99.99")).toBe(true);
    expect(isNewerVersion("1.0.2", "1.0.2")).toBe(false);
  });

  it("ranks a prerelease below the release it leads up to", () => {
    expect(isNewerVersion("1.0.0", "1.0.0-beta.0")).toBe(true);
    expect(isNewerVersion("1.0.0-beta.0", "1.0.0")).toBe(false);
  });

  it("orders prerelease identifiers by semver precedence", () => {
    expect(isNewerVersion("1.0.0-beta.2", "1.0.0-beta.1")).toBe(true);
    // Numeric identifiers compare numerically, not as strings.
    expect(isNewerVersion("1.0.0-beta.10", "1.0.0-beta.9")).toBe(true);
    // A numeric identifier ranks below an alphanumeric one.
    expect(isNewerVersion("1.0.0-beta", "1.0.0-1")).toBe(true);
    // All shared identifiers equal: the longer set wins.
    expect(isNewerVersion("1.0.0-beta.1", "1.0.0-beta")).toBe(true);
  });

  it("answers false rather than guessing at unparseable input", () => {
    expect(isNewerVersion("next", "1.0.0")).toBe(false);
    expect(isNewerVersion("1.0.0", "")).toBe(false);
  });
});

describe("betaIsAhead", () => {
  it("is false for a beta tag left behind by a newer latest", () => {
    // The case that put "v1.0.0-beta.0" in the site header while 1.0.2 shipped.
    expect(betaIsAhead({ latest: "1.0.2", beta: "1.0.0-beta.0" })).toBe(false);
  });

  it("is true while the wave is genuinely ahead", () => {
    expect(betaIsAhead({ latest: "1.0.2", beta: "1.1.0-beta.1" })).toBe(true);
  });

  it("handles a missing tag either way", () => {
    expect(betaIsAhead({ latest: "1.0.2" })).toBe(false);
    expect(betaIsAhead({ beta: "1.1.0-beta.1" })).toBe(true);
    expect(betaIsAhead(null)).toBe(false);
  });
});

describe("headlineVersion", () => {
  it("shows what npm install gives you today", () => {
    expect(headlineVersion({ latest: "1.0.2", beta: "1.0.0-beta.0" })).toBe(
      "1.0.2",
    );
    expect(headlineVersion({ latest: "1.0.2", beta: "1.1.0-beta.1" })).toBe(
      "1.1.0-beta.1",
    );
    expect(headlineVersion(null)).toBeUndefined();
  });
});
