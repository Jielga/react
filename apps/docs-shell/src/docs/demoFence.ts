import type { DemoBlockDemo } from "./DemoBlock";

/**
 * A docs page puts a demo where the prose that explains it is, with a fenced
 * block naming the file:
 *
 * ````markdown
 * ```demo
 * file: rows/Grouping.tsx
 * hint: “Group by …” lives in every column menu.
 * ```
 * ````
 *
 * The single-line form (the whole body being just `rows/Grouping.tsx`) is the
 * common case and means the same thing.
 *
 * A fence rather than MDX because the markdown has to stay markdown: it is
 * what `intent.docs` publishes, what six `SKILL.md` files cite as `sources:`,
 * and what an agent reads as plain text. Anything reading the raw file sees the
 * demo's path and its hint, and the demo itself is code in a file, exactly
 * where the fence says it is.
 */

const KEYS = ["file", "hint", "height", "extraSources"] as const;

type Key = (typeof KEYS)[number];

const isKey = (value: string): value is Key =>
  (KEYS as ReadonlyArray<string>).includes(value);

/**
 * Throws rather than rendering a placeholder: a demo that silently vanished
 * from a page is the failure nobody notices, and a site's smoke test parses
 * every fence on every page, so a typo cannot reach the site.
 */
export function parseDemoFence(body: string): DemoBlockDemo {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const fields = new Map<Key, string>();

  for (const line of lines) {
    const separator = line.indexOf(":");
    const key = separator === -1 ? "" : line.slice(0, separator).trim();

    // No `key:` prefix at all - the single-line form, naming the file.
    if (!isKey(key)) {
      if (separator !== -1 || fields.has("file")) {
        throw new Error(
          `Demo fence: expected "<key>: <value>" with key one of ${KEYS.join(", ")}, got "${line}".`,
        );
      }
      fields.set("file", line);
      continue;
    }

    if (fields.has(key)) {
      throw new Error(`Demo fence: "${key}" given twice.`);
    }

    // Split on the first colon only, so a hint may contain one.
    fields.set(key, line.slice(separator + 1).trim());
  }

  const file = fields.get("file");

  if (!file) {
    throw new Error(`Demo fence: no demo file named in "${body.trim()}".`);
  }

  const height = fields.get("height");

  if (height !== undefined && !/^\d+$/.test(height)) {
    throw new Error(`Demo fence: height must be a whole number, got "${height}".`);
  }

  const extraSources = fields.get("extraSources");

  return {
    file,
    hint: fields.get("hint"),
    height: height === undefined ? undefined : Number(height),
    extraSources:
      extraSources === undefined
        ? undefined
        : extraSources
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
  };
}

export type DocsSegment =
  | { kind: "prose"; markdown: string }
  | { kind: "demo"; demo: DemoBlockDemo };

type FenceOpening = { marker: string; info: string };

const fenceOpening = (line: string): FenceOpening | undefined => {
  const match = /^(`{3,})(.*)$/.exec(line);
  return match ? { marker: match[1], info: match[2].trim() } : undefined;
};

/** A closing fence carries no info string and at least the opener's length. */
const closesFence = (line: string, opening: FenceOpening): boolean => {
  const match = /^(`{3,})\s*$/.exec(line);
  return match !== null && match[1].length >= opening.marker.length;
};

/**
 * A page split at its demo fences: the prose between them, in order, with each
 * demo parsed.
 *
 * Line-by-line rather than one regex because only a *top-level* fence is a
 * demo: a page showing the fence syntax inside a ````markdown block means it
 * as text, and a pattern blind to the enclosing fence would lift the example
 * out and render it.
 *
 * `\r?\n`: a Windows checkout under `core.autocrlf` hands these pages over
 * with CRLF endings, and an LF-only split then finds no fences at all - which
 * surfaces as demos being orphaned rather than as anything naming line
 * endings.
 */
export function splitDemoFences(source: string): Array<DocsSegment> {
  const segments: Array<DocsSegment> = [];
  const prose: Array<string> = [];
  const lines = source.split(/\r?\n/);

  const flushProse = () => {
    const markdown = prose.join("\n");
    prose.length = 0;
    if (markdown.trim().length > 0) {
      segments.push({ kind: "prose", markdown });
    }
  };

  let index = 0;
  let openFence: FenceOpening | undefined;

  while (index < lines.length) {
    const line = lines[index];

    // Inside an ordinary fence everything is text, including ```demo lines.
    if (openFence) {
      prose.push(line);
      if (closesFence(line, openFence)) {
        openFence = undefined;
      }
      index += 1;
      continue;
    }

    const opening = fenceOpening(line);

    if (opening?.info === "demo") {
      const body: Array<string> = [];
      index += 1;
      while (index < lines.length && !closesFence(lines[index], opening)) {
        body.push(lines[index]);
        index += 1;
      }
      if (index === lines.length) {
        throw new Error(`Demo fence never closed: "${body.join(" ").trim()}".`);
      }
      index += 1;
      flushProse();
      segments.push({ kind: "demo", demo: parseDemoFence(body.join("\n")) });
      continue;
    }

    if (opening) {
      openFence = opening;
    }
    prose.push(line);
    index += 1;
  }

  flushProse();
  return segments;
}

/** Every demo fence in a markdown source, in the order they appear. */
export function findDemoFences(source: string): Array<DemoBlockDemo> {
  return splitDemoFences(source).flatMap((segment) =>
    segment.kind === "demo" ? [segment.demo] : [],
  );
}
