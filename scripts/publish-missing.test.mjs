import { describe, expect, it } from "vitest";
import {
  changelogPath,
  distTag,
  publishedEntry,
  publishedOutput,
  selectMissing,
} from "./publish-missing.mjs";

const pkg = (name, version, extra = {}) => ({ name, version, ...extra });

describe("selectMissing", () => {
  it("publishes only public packages the registry lacks", () => {
    const packages = [
      pkg("@jielga/tmdatagrid", "2.1.0"),
      pkg("@jielga/tmdatagrid-excel", "2.1.0"),
      pkg("@jielga/docs", "0.0.0", { private: true }),
    ];
    const onRegistry = (name) => name === "@jielga/tmdatagrid";
    expect(selectMissing(packages, onRegistry).map((p) => p.name)).toEqual([
      "@jielga/tmdatagrid-excel",
    ]);
  });

  it("is empty when everything is published", () => {
    expect(selectMissing([pkg("a", "1.0.0")], () => true)).toEqual([]);
  });
});

describe("distTag", () => {
  it("is latest for a release", () => {
    expect(distTag("2.1.0")).toBe("latest");
    expect(distTag("0.3.0")).toBe("latest");
  });

  it("is the prerelease identifier otherwise", () => {
    expect(distTag("2.0.0-beta.15")).toBe("beta");
    expect(distTag("3.0.0-rc.0")).toBe("rc");
  });
});

describe("changelogPath", () => {
  const exists = (path) => path === "packages/tmdatagrid/CHANGELOG.md";

  it("is the package's CHANGELOG.md relative to the repo root", () => {
    expect(changelogPath("packages/tmdatagrid", exists)).toBe(
      "packages/tmdatagrid/CHANGELOG.md",
    );
  });

  it("uses forward slashes when the dir comes from Windows", () => {
    expect(changelogPath("packages\\tmdatagrid", exists)).toBe(
      "packages/tmdatagrid/CHANGELOG.md",
    );
  });

  it("is null when the package has no changelog", () => {
    expect(changelogPath("packages/react-popup-window", exists)).toBeNull();
  });
});

describe("publishedEntry", () => {
  it("carries the name, the version and the changelog path", () => {
    const popup = pkg("@jielga/react-popup-window", "0.3.0", {
      relativeDir: "packages/react-popup-window",
      dir: "/repo/packages/react-popup-window",
    });
    expect(publishedEntry(popup, () => true)).toEqual({
      name: "@jielga/react-popup-window",
      version: "0.3.0",
      changelog: "packages/react-popup-window/CHANGELOG.md",
    });
  });
});

describe("publishedOutput", () => {
  it("is the entries as one line of JSON", () => {
    const line = publishedOutput([
      { name: "@jielga/tmdatagrid", version: "2.1.0", changelog: "packages/tmdatagrid/CHANGELOG.md" },
      { name: "@jielga/react-popup-window", version: "0.3.0", changelog: null },
    ]);
    expect(line).toBe(
      'published=[{"name":"@jielga/tmdatagrid","version":"2.1.0","changelog":"packages/tmdatagrid/CHANGELOG.md"},' +
        '{"name":"@jielga/react-popup-window","version":"0.3.0","changelog":null}]',
    );
  });

  it("is an empty array when nothing was published", () => {
    expect(publishedOutput([])).toBe("published=[]");
  });
});
