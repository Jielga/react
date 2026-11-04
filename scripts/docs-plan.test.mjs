import { describe, expect, test } from "vitest";
import { planDispatch, planPush } from "./docs-plan.mjs";

/**
 * The deploy planner, which decides what a run publishes and - the part that
 * matters most - what the site root serves. A root nothing ever mirrors is a
 * 404 on the URL in `package.json`'s `homepage`, and that is what shipped
 * before these tests existed.
 */

/** A push to a branch at 2.0.0-beta.0 with the site root already seeded. */
const seeded = {
  version: "2.0.0-beta.0",
  released: true,
  lineVersion: "2.0.0-beta.0",
  rootExists: true,
  rootSlug: "v1.1",
  rootServesVersion: "1.1.1",
  tag: "@jielga/tmdatagrid@2.0.0-beta.0",
};

const root = (plan) => plan.targets.find((target) => target.mirrorRoot) ?? null;
const slugs = (plan) => plan.targets.map((target) => target.slug);

describe("planPush", () => {
  test("always publishes the tip of main", () => {
    expect(slugs(planPush(seeded))).toContain("next");
  });

  test("leaves a current line and a current root alone", () => {
    const plan = planPush(seeded);
    expect(slugs(plan)).toEqual(["next"]);
    expect(root(plan)).toBeNull();
  });

  test("publishes the line when the branch moved past what is deployed", () => {
    const plan = planPush({ ...seeded, lineVersion: "2.0.0-beta.0", version: "2.0.0-beta.1" });
    expect(slugs(plan)).toEqual(["next", "v2.0"]);
  });

  // The regression: mirroring used to require a stable release, so a project
  // in a prerelease wave never seeded the root and the site had no entry point.
  test("seeds an empty root even when every release is a prerelease", () => {
    const plan = planPush({
      ...seeded,
      rootExists: false,
      rootSlug: null,
      rootServesVersion: null,
    });
    expect(root(plan)).toMatchObject({ slug: "v2.0", kind: "prerelease" });
  });

  test("seeds an empty root from main when there is no version line", () => {
    const plan = planPush({
      ...seeded,
      version: "not-a-version",
      rootExists: false,
      rootSlug: null,
      rootServesVersion: null,
    });
    expect(root(plan)).toMatchObject({ slug: "next" });
  });

  test("keeps the root in step with the line it already mirrors", () => {
    const plan = planPush({
      ...seeded,
      version: "2.0.0-beta.1",
      rootSlug: "v2.0",
      rootServesVersion: "2.0.0-beta.0",
    });
    expect(root(plan)).toMatchObject({ slug: "v2.0", version: "2.0.0-beta.1" });
  });

  // Comparing only major.minor.patch read these two as the same version, which
  // left the root serving a prerelease after the release it led up to shipped.
  test("hands the root to the release its prerelease led up to", () => {
    const plan = planPush({
      version: "2.0.0",
      released: true,
      lineVersion: "2.0.0-beta.0",
      rootExists: true,
      rootSlug: "v2.0",
      rootServesVersion: "2.0.0-beta.0",
      tag: null,
    });
    expect(root(plan)).toMatchObject({ slug: "v2.0", kind: "stable" });
  });

  test("takes the root for a stable release that outranks it", () => {
    const plan = planPush({ ...seeded, version: "2.0.0", lineVersion: undefined });
    expect(root(plan)).toMatchObject({ slug: "v2.0", kind: "stable" });
  });

  test("does not take the root for a prerelease of a newer line", () => {
    expect(root(planPush({ ...seeded, version: "3.0.0-beta.0", lineVersion: undefined }))).toBeNull();
  });

  test("does not take the root for a release the root already outranks", () => {
    const plan = planPush({
      version: "1.1.2",
      released: true,
      lineVersion: undefined,
      rootExists: true,
      rootSlug: "v2.0",
      rootServesVersion: "2.0.0-beta.0",
      tag: null,
    });
    expect(root(plan)).toBeNull();
  });

  test("builds the line from its tag when there is one, and from main when there is not", () => {
    const moved = { ...seeded, version: "2.0.0-beta.1", tag: "@jielga/tmdatagrid@2.0.0-beta.1" };
    expect(planPush(moved).targets[1].ref).toBe("@jielga/tmdatagrid@2.0.0-beta.1");
    expect(planPush({ ...moved, tag: null }).targets[1].ref).toBe("");
  });

  // A private package's version is a placeholder, so a line for it would list
  // a version that was never on npm.
  test("builds no line for a package that is not released, and serves main at the root", () => {
    const unreleased = {
      version: "0.0.0",
      released: false,
      lineVersion: undefined,
      rootExists: false,
      rootSlug: null,
      rootServesVersion: null,
      tag: null,
    };
    expect(slugs(planPush(unreleased))).toEqual(["next"]);
    expect(root(planPush(unreleased))).toMatchObject({ slug: "next" });
    expect(
      root(planPush({ ...unreleased, rootExists: true, rootSlug: "next", rootServesVersion: "0.0.0" })),
    ).toMatchObject({ slug: "next" });
  });

  test("hands the root from main to the first release", () => {
    const plan = planPush({
      version: "0.1.0",
      released: true,
      lineVersion: undefined,
      rootExists: true,
      rootSlug: "next",
      rootServesVersion: "0.0.0",
      tag: null,
    });
    expect(slugs(plan)).toEqual(["next", "v0.1"]);
    expect(root(plan)).toMatchObject({ slug: "v0.1", kind: "stable" });
  });
});

describe("planDispatch", () => {
  test("publishes a back version, and can hand it the root", () => {
    const plan = planDispatch({ slug: "v1.1", ref: "v1.1.1", version: "1.1.1", mirrorRoot: true });
    expect(plan.targets[0]).toEqual({
      slug: "v1.1", ref: "v1.1.1", version: "1.1.1", label: "1.1.1", kind: "stable", mirrorRoot: true,
    });
  });

  test("names the kind from the slug and the version", () => {
    const kind = (slug, version) => planDispatch({ slug, ref: "", version, mirrorRoot: false }).targets[0].kind;
    expect(kind("next", "2.0.0-beta.0")).toBe("dev");
    expect(kind("b/thing", "2.0.0-beta.0")).toBe("preview");
    expect(kind("v2.0", "2.0.0-beta.0")).toBe("prerelease");
    expect(kind("v1.1", "1.1.1")).toBe("stable");
  });
});
