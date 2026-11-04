import { TMDATAGRID_LABELS_EN } from "@jielga/tmdatagrid";
import localizationMd from "@jielga/tmdatagrid/docs/localization.md?raw";
import { describe, expect, it } from "vitest";
import labelsReferenceMd from "../../../../packages/tmdatagrid/skills/appearance/references/labels.md?raw";

// The docs page and the appearance skill each carry the table of every label
// key. The keys and the English strings come from TMDATAGRID_LABELS_EN, so a
// key added, renamed or reworded in labels.ts fails here until both tables
// follow.
const FILES = [
  { path: "packages/tmdatagrid/docs/localization.md", markdown: localizationMd },
  {
    path: "packages/tmdatagrid/skills/appearance/references/labels.md",
    markdown: labelsReferenceMd,
  },
];

const HEADER = "| Key | Default | Where it shows |";

/** Every label key, `operators` flattened to `operators.<name>`, with its English value. */
const LABEL_ENTRIES: ReadonlyArray<readonly [string, unknown]> = Object.entries(
  TMDATAGRID_LABELS_EN,
).flatMap(([key, value]) =>
  key === "operators"
    ? Object.entries(TMDATAGRID_LABELS_EN.operators).map(
        ([operator, text]) => [`operators.${operator}`, text] as const,
      )
    : [[key, value] as const],
);

const LABEL_KEYS = new Set(LABEL_ENTRIES.map(([key]) => key));

type KeyRow = { keyCell: string; defaultCell: string };

/** The cells of one table line, split on unescaped pipes. */
const splitCells = (line: string): string[] => {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
};

/** The body rows of the table under the label key header, or null. */
const readKeyTable = (markdown: string): KeyRow[] | null => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const headerIndex = lines.findIndex((line) => line.trim() === HEADER);
  if (headerIndex === -1) return null;
  const rows: KeyRow[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith("|")) break;
    const [keyCell = "", defaultCell = ""] = splitCells(line);
    rows.push({ keyCell, defaultCell });
  }
  return rows;
};

/** `name` for a cell holding exactly `` `name` ``, otherwise null. */
const unwrapKey = (cell: string): string | null => {
  return /^`([^`]+)`$/.exec(cell)?.[1] ?? null;
};

describe.each(FILES)("the label key table in $path", ({ path, markdown }) => {
  const rows = readKeyTable(markdown) ?? [];

  it("is there", () => {
    expect(
      readKeyTable(markdown),
      `${path} has no table with the header "${HEADER}".`,
    ).not.toBeNull();
  });

  it("has exactly one row for every key", () => {
    const problems = LABEL_ENTRIES.flatMap(([key]) => {
      const count = rows.filter((row) => row.keyCell === `\`${key}\``).length;
      return count === 1
        ? []
        : [`${path}: \`${key}\` has ${count} rows, expected exactly 1.`];
    });
    expect(problems).toEqual([]);
  });

  it("states every string label's English default", () => {
    const problems = LABEL_ENTRIES.flatMap(([key, value]) => {
      if (typeof value !== "string") return [];
      const row = rows.find((candidate) => candidate.keyCell === `\`${key}\``);
      if (row === undefined) return [];
      return row.defaultCell === `\`${value}\``
        ? []
        : [
            `${path}: the Default of \`${key}\` is ${row.defaultCell}, expected \`${value}\`.`,
          ];
    });
    expect(problems).toEqual([]);
  });

  it("names no key that does not exist", () => {
    const problems = rows.flatMap(({ keyCell }) => {
      const key = unwrapKey(keyCell);
      if (key === null) {
        return [`${path}: the key cell ${keyCell} is not one key in backticks.`];
      }
      return LABEL_KEYS.has(key)
        ? []
        : [`${path}: \`${key}\` is not a key of TMDataGridLabels.`];
    });
    expect(problems).toEqual([]);
  });
});
