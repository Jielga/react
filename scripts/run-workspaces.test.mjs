import { describe, expect, it } from "vitest";
import { runOrder } from "./run-workspaces.mjs";

function workspace(relativeDir, name, { scripts = { build: "x" }, devDependencies } = {}) {
  return { relativeDir, dir: `/repo/${relativeDir}`, packageJson: { name, scripts, devDependencies } };
}

const names = (packages) => packages.map((pkg) => pkg.packageJson.name);

describe("runOrder", () => {
  it("runs a workspace after the workspaces it depends on", () => {
    const packages = [
      workspace("packages/a-addon", "addon", { devDependencies: { grid: "workspace:*" } }),
      workspace("packages/grid", "grid"),
      workspace("packages/map", "map"),
    ];
    expect(names(runOrder(packages, { script: "build", folder: "packages" }))).toEqual(["grid", "addon", "map"]);
  });

  it("leaves out workspaces in other folders, and those without the script", () => {
    const packages = [
      workspace("packages/grid", "grid"),
      workspace("apps/docs", "docs"),
      workspace("apps/shell", "shell", { scripts: { test: "x" } }),
    ];
    expect(names(runOrder(packages, { script: "build", folder: "apps" }))).toEqual(["docs"]);
  });

  it("reads Windows paths", () => {
    expect(names(runOrder([workspace("packages\\grid", "grid")], { script: "build", folder: "packages" }))).toEqual([
      "grid",
    ]);
  });

  it("refuses a dependency cycle", () => {
    const packages = [
      workspace("packages/a", "a", { devDependencies: { b: "workspace:*" } }),
      workspace("packages/b", "b", { devDependencies: { a: "workspace:*" } }),
    ];
    expect(() => runOrder(packages, { script: "build", folder: "packages" })).toThrow(/cycle: a -> b -> a/);
  });
});
