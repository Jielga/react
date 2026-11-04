import testingMd from "@jielga/tmdatagrid/docs/testing.md?raw";
import { describe, expect, it } from "vitest";
import dataGridSource from "../../../../playwright/support/DataGrid.ts?raw";

// testing.md shows the page object a consumer copies; the end-to-end suite
// runs the real one. The marker names the file the block must match, so the
// two cannot drift apart.
const DOCS_FILE = "packages/tmdatagrid/docs/testing.md";
const SOURCE_FILE = "playwright/support/DataGrid.ts";
const MARKER = `<!-- source: ${SOURCE_FILE} -->`;

/** CRLF to LF, no trailing whitespace on any line or at the end. */
const normalise = (text: string): string => {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
};

/** The fenced ```ts block on the line after the marker, or null. */
const findMarkedBlock = (markdown: string): string | null => {
  const lines = normalise(markdown).split("\n");
  const markerIndex = lines.findIndex((line) => line.trim() === MARKER);
  if (markerIndex === -1 || lines[markerIndex + 1] !== "```ts") return null;
  const end = lines.indexOf("```", markerIndex + 2);
  if (end === -1) return null;
  return lines.slice(markerIndex + 2, end).join("\n");
};

describe("the page object in testing.md", () => {
  it("matches playwright/support/DataGrid.ts", () => {
    const block = findMarkedBlock(testingMd);
    expect(
      block,
      `${DOCS_FILE} has no \`\`\`ts block right after the line "${MARKER}"; ` +
        `put one there holding ${SOURCE_FILE} as it is.`,
    ).not.toBeNull();
    expect(
      block,
      `The page object in ${DOCS_FILE} differs from ${SOURCE_FILE}.`,
    ).toBe(normalise(dataGridSource));
  });
});
