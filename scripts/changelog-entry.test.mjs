import { describe, expect, test } from "vitest";
import { changelogEntry } from "./changelog-entry.mjs";

const CHANGELOG = `# @jielga/tmdatagrid

## 2.0.0-beta.7

### Minor Changes

- Something new.

## 2.0.0-beta.6

### Patch Changes

- Something fixed.

## 1.1.1
`;

describe("changelogEntry", () => {
  test("takes the section under the version and stops at the next one", () => {
    expect(changelogEntry(CHANGELOG, "2.0.0-beta.7")).toBe(
      "### Minor Changes\n\n- Something new.",
    );
  });

  test("reads a section that is not the newest", () => {
    expect(changelogEntry(CHANGELOG, "2.0.0-beta.6")).toBe(
      "### Patch Changes\n\n- Something fixed.",
    );
  });

  test("answers an empty body for a version with no entries", () => {
    expect(changelogEntry(CHANGELOG, "1.1.1")).toBe("");
  });

  test("answers null for a version the file does not have", () => {
    expect(changelogEntry(CHANGELOG, "9.9.9")).toBeNull();
  });

  test("does not match a version that only prefixes a heading", () => {
    expect(changelogEntry(CHANGELOG, "2.0.0-beta")).toBeNull();
  });
});
