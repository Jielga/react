import { describe, expect, it } from "vitest";
import { findDemoFences, splitDemoFences } from "./demoFence";

const kinds = (source: string) =>
  splitDemoFences(source).map((segment) => segment.kind);

describe("splitDemoFences", () => {
  it("splits prose around a demo fence", () => {
    const segments = splitDemoFences(
      ["Before.", "", "```demo", "rows/Grouping.tsx", "```", "", "After."].join(
        "\n",
      ),
    );

    expect(segments).toEqual([
      { kind: "prose", markdown: "Before.\n" },
      { kind: "demo", demo: expect.objectContaining({ file: "rows/Grouping.tsx" }) },
      { kind: "prose", markdown: "\nAfter." },
    ]);
  });

  it("parses the key: value fence body", () => {
    const segments = splitDemoFences(
      ["```demo", "file: rows/Grouping.tsx", "hint: Try it.", "```"].join("\n"),
    );

    expect(segments).toEqual([
      {
        kind: "demo",
        demo: expect.objectContaining({
          file: "rows/Grouping.tsx",
          hint: "Try it.",
        }),
      },
    ]);
  });

  it("emits no empty prose segments around demos at the edges", () => {
    expect(
      kinds(
        ["```demo", "a.tsx", "```", "", "```demo", "b.tsx", "```"].join("\n"),
      ),
    ).toEqual(["demo", "demo"]);
  });

  it("leaves a demo fence shown inside a wider fence as prose", () => {
    const source = [
      "The syntax:",
      "",
      "````markdown",
      "```demo",
      "rows/Grouping.tsx",
      "```",
      "````",
    ].join("\n");

    expect(splitDemoFences(source)).toEqual([
      { kind: "prose", markdown: source },
    ]);
    expect(findDemoFences(source)).toEqual([]);
  });

  it("leaves ordinary code fences in the prose", () => {
    const source = ["```tsx", "const grid = useTMDataGrid();", "```"].join(
      "\n",
    );

    expect(splitDemoFences(source)).toEqual([
      { kind: "prose", markdown: source },
    ]);
  });

  it("splits CRLF sources", () => {
    expect(
      kinds("Before.\r\n\r\n```demo\r\nrows/Grouping.tsx\r\n```\r\n"),
    ).toEqual(["prose", "demo"]);
  });

  it("throws on an unclosed demo fence", () => {
    expect(() => splitDemoFences("```demo\nrows/Grouping.tsx")).toThrow(
      /never closed/,
    );
  });
});

describe("findDemoFences", () => {
  it("returns every demo in order", () => {
    expect(
      findDemoFences(
        [
          "```demo",
          "a.tsx",
          "```",
          "Prose.",
          "```demo",
          "file: b.tsx",
          "```",
        ].join("\n"),
      ).map((demo) => demo.file),
    ).toEqual(["a.tsx", "b.tsx"]);
  });
});
