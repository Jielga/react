import { rankItem, rankings } from "@tanstack/match-sorter-utils";
import {
  extractHeadings,
  headingSlug,
  REFERENCE_NAME,
  referenceSlug,
} from "docs-shell/docs/headings.ts";
import { DOCS_PAGES } from "./docsPages";
import { SEARCH_ALIASES } from "./searchAliases";

/**
 * The docs search index, built once from the markdown the site already ships.
 *
 * Four kinds of entry, because the queries want opposite treatment. A reader
 * who types `onCellClick` wants that exact symbol first; a reader who types
 * "cell sorting" wants topics; a reader who types "conditional formatting"
 * knows what they want and none of the words the docs use for it. Ranking them
 * in one list with an exact-match override gives all three without a mode
 * switch.
 *
 * The prose is indexed too, keyed to the heading above it. That is what makes
 * the third case work at all: the vocabulary a reader types is mostly already
 * written down, and an index derived from the content cannot drift out of date
 * the way a hand-kept keyword table would.
 */

export type SearchKind = "page" | "section" | "symbol" | "text";

export type SearchEntry = {
  kind: SearchKind;
  /** What matching runs against for a page, section or symbol. */
  title: string;
  /** The page's blurb, or the page a section, symbol or passage lives on. */
  context: string;
  to: string;
  hash?: string;
  /** A `text` entry's passage: what it matches on, and what it shows. */
  body?: string;
  /** Words a reader might type that this page deliberately does not use. */
  keywords?: ReadonlyArray<string>;
};

/**
 * Names in a Reference table read `| \`onCellClick\` | ...`, so the first
 * backticked cell of a table row is a documented symbol. Cheap, and it needs
 * no build step: the page that documents a name is by construction the page
 * the name was found on.
 */
function symbolsIn(source: string): Array<string> {
  return [...source.matchAll(/^\| `([^`]+)`\s*\|/gm)]
    .map((match) => match[1])
    .filter((name) => REFERENCE_NAME.test(name));
}

/** Inline markdown, as text: `code` to code, [label](href) to label. */
function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A passage is a paragraph, a list item or one table row - the unit a result
 * can quote back without quoting a screenful.
 */
type Passage = { heading: string; slug: string; text: string };

/** Shorter than this is a fragment, not an answer. */
const MIN_PASSAGE = 20;

/**
 * The page's prose, split into passages and keyed to the heading above each.
 *
 * Fenced code comes out first: a snippet matches every query naming any
 * identifier in it, which buries the page that explains the identifier under
 * the pages that merely use it.
 */
function passagesIn(source: string): Array<Passage> {
  const prose = source.replace(/^```[\s\S]*?^```/gm, "");

  let heading = "";
  let slug = "";
  const passages: Array<Passage> = [];
  let paragraph: Array<string> = [];

  const push = (text: string) => {
    if (text.length >= MIN_PASSAGE) passages.push({ heading, slug, text });
  };

  const flush = () => {
    if (paragraph.length === 0) return;
    push(plainText(paragraph.join(" ")));
    paragraph = [];
  };

  for (const raw of prose.split(/\r?\n/)) {
    const line = raw.trim();

    if (/^#{1,4} /.test(line)) {
      flush();
      heading = plainText(line.replace(/^#+ /, ""));
      // The h1 is the page, which already has its own entry; a passage under
      // it takes the page as its heading and no anchor.
      slug = line.startsWith("# ") ? "" : headingSlug(heading);
      continue;
    }

    // A table row and a list item each stand alone; running them together
    // would quote a whole reference table back as one passage.
    if (line.startsWith("|")) {
      flush();
      // Anything but the `| --- |` separator under the header row. A row that
      // names a symbol links to the row's own anchor, as the symbol does.
      if (!/^\|[\s|:-]+\|$/.test(line)) {
        const name = /^\| `([^`]+)`\s*\|/.exec(line)?.[1];
        const text = plainText(line.replace(/\|/g, " "));
        if (name && REFERENCE_NAME.test(name)) {
          if (text.length >= MIN_PASSAGE) {
            passages.push({ heading, slug: referenceSlug(name), text });
          }
        } else {
          push(text);
        }
      }
      continue;
    }
    if (/^[-*] /.test(line)) {
      flush();
      paragraph.push(line.replace(/^[-*] /, ""));
      continue;
    }
    if (line === "") {
      flush();
      continue;
    }

    paragraph.push(line);
  }
  flush();

  return passages;
}

/** `pageId#slug`, or `pageId#` for the page itself. */
function aliasKey(pageId: string, hash = ""): string {
  return `${pageId}#${hash}`;
}

const ALIASES_BY_TARGET = SEARCH_ALIASES.reduce<Map<string, Array<string>>>(
  (map, alias) => {
    const key = aliasKey(alias.pageId, alias.hash);
    map.set(key, [...(map.get(key) ?? []), ...alias.terms]);
    return map;
  },
  new Map(),
);

function buildIndex(): Array<SearchEntry> {
  const entries: Array<SearchEntry> = [];

  for (const page of DOCS_PAGES) {
    // Getting started is served at "/" - the router redirects /docs/....
    const to = page.id === "getting-started" ? "/" : `/docs/${page.id}`;

    entries.push({
      kind: "page",
      title: page.label,
      context: page.description,
      to,
      keywords: ALIASES_BY_TARGET.get(aliasKey(page.id)),
    });

    for (const heading of extractHeadings(page.source)) {
      entries.push({
        kind: "section",
        title: heading.text,
        context: page.label,
        to,
        hash: heading.slug,
        keywords: ALIASES_BY_TARGET.get(aliasKey(page.id, heading.slug)),
      });
    }

    for (const symbol of new Set(symbolsIn(page.source))) {
      entries.push({
        kind: "symbol",
        title: symbol,
        context: page.label,
        to,
        // The renderer gives the row its own anchor, so a hit lands on the
        // row, not on the top of the table.
        hash: referenceSlug(symbol),
      });
    }

    for (const passage of passagesIn(page.source)) {
      entries.push({
        kind: "text",
        title: passage.heading || page.label,
        context: page.label,
        to,
        hash: passage.slug || undefined,
        body: passage.text,
      });
    }
  }

  return entries;
}

/** Built once: the markdown is static, so the index can be too. */
export const SEARCH_INDEX = buildIndex();

const MAX_RESULTS = 12;

/**
 * Words in a query, split on whitespace *and* camelCase humps.
 *
 * The humps matter: `onClickExample` is not a real name, but its parts say
 * plainly what was meant, and splitting lets `click` find `onCellClick`.
 * Whitespace matters for the opposite case - "cell sorting" is two topics, and
 * as one string it fuzzy-matches neither.
 */
function tokenize(query: string): Array<string> {
  return query
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/[\s.]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 2);
}

/** Exact, then prefix, then contains. Above anything fuzzy can score. */
function literalScore(haystack: string, needle: string): number {
  if (haystack === needle) return 3000;
  if (haystack.startsWith(needle)) return 2000;
  if (haystack.includes(needle)) return 1000;
  return 0;
}

/**
 * A word, not a fragment. Prose is long enough that a bare `includes` finds
 * `id` inside "considered" on every page.
 */
function wordScore(haystack: string, needle: string): number {
  if (haystack === needle) return 3000;
  const at = haystack.indexOf(needle);
  if (at < 0) return 0;
  const edge = (char: string | undefined) =>
    char === undefined || !/[\w-]/.test(char);
  if (!edge(haystack[at - 1])) return 0;
  return edge(haystack[at + needle.length]) ? 1000 : 400;
}

/**
 * Prose ranks below the titles, always.
 *
 * A passage mentioning a word is a weaker answer than a heading named after
 * it, and there are two orders of magnitude more passages than headings, so
 * without this every topic query fills with body text.
 */
const TEXT_WEIGHT = 0.3;

/**
 * A fuzzy hit has to be a real one.
 *
 * `rankItem`'s lowest ranking passes on scattered characters, so `theme`
 * matched "T-*he* ... *me*nu" and ten other unrelated titles. Gated at ACRONYM
 * the same query reaches an honest empty state instead of ten confident wrong
 * answers, and the literal scoring above already covers every case worth
 * having.
 */
const FUZZY = { threshold: rankings.ACRONYM } as const;

/** An alias answers the whole query at once, but never beats an exact title. */
const ALIAS_PHRASE = 1800;
const ALIAS_WORD = 900;

/**
 * Ranked results for a query.
 *
 * A literal hit on the whole query jumps the queue outright - typing a prop
 * name should never rank a paragraph that mentions it above the prop itself.
 * Below that, each word is scored separately and matching more of them wins,
 * which is what lets a two-word topic query work at all.
 */
export function searchDocs(query: string): Array<SearchEntry> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const needle = trimmed.toLowerCase();
  const tokens = tokenize(trimmed);

  const scored = SEARCH_INDEX.flatMap((entry) => {
    const hit =
      entry.kind === "text"
        ? scoreText((entry.body ?? "").toLowerCase(), needle, tokens)
        : scoreTitle(entry, entry.title.toLowerCase(), needle, tokens);

    if (hit.score <= 0) return [];

    // At equal quality a page outranks a section outranks a symbol outranks a
    // passage: the page is the broader answer, and its sections are one scroll
    // away.
    const kindBias =
      entry.kind === "page" ? 2 : entry.kind === "section" ? 1 : 0;

    return [{ entry, score: hit.score + kindBias, complete: hit.complete }];
  });

  // Once a title answers the whole query, nothing that answers half of it is
  // worth a row: "dark mode" found the theming page and then eight titles
  // holding the word "mode", and a short honest list beats a full one. The
  // test is a title rather than any entry, because a passage happening to
  // carry both words is not reason enough to drop the page named after one -
  // "cell sorting" wants the Sorting page, and no title holds both words.
  const complete = scored.filter((result) => result.complete);
  const anchored = complete.some((result) => result.entry.kind !== "text");
  const kept = anchored ? complete : scored;

  return dedupe(kept.sort((a, b) => b.score - a.score)).slice(0, MAX_RESULTS);
}

/** A score, and whether every word of the query was accounted for. */
type Hit = { score: number; complete: boolean };

function scoreTitle(
  entry: SearchEntry,
  title: string,
  needle: string,
  tokens: Array<string>,
): Hit {
  // The whole query, weighted heaviest - an exact name beats everything.
  let score = literalScore(title, needle) * 2;

  const keywords = entry.keywords ?? [];
  if (keywords.some((word) => needle.includes(word) || word.includes(needle))) {
    score += ALIAS_PHRASE;
  }

  let matched = 0;
  for (const token of tokens) {
    const literal = literalScore(title, token);
    if (literal > 0) {
      score += literal;
      matched += 1;
      continue;
    }
    if (keywords.some((word) => word.split(" ").includes(token))) {
      score += ALIAS_WORD;
      matched += 1;
      continue;
    }
    const ranked = rankItem(entry.title, token, FUZZY);
    if (ranked.passed) {
      score += ranked.rank * 10;
      matched += 1;
    }
  }

  if (score === 0) return { score: 0, complete: false };

  // Matching every word of the query beats matching one of them, whatever the
  // individual words scored.
  const share = tokens.length > 0 ? matched / tokens.length : 1;
  return { score: score * share, complete: share === 1 };
}

/**
 * Prose scores on literal word matches only, and only when every word of the
 * query is in the passage.
 *
 * No fuzzy leg: over 36,000 words of body text a near miss matches something
 * on nearly every page, and a result list that always fills is the failure
 * this index was built to end. One word of a phrase is not an answer to the
 * phrase either, so a partial match scores nothing.
 *
 * The whole query counts as a word of its own. A name is one word in the
 * prose and several to the tokenizer: `createTMDataGridColumnHelper` splits
 * into `tmdata`, which no passage holds on its own, so the paragraph defining
 * the name scored nothing and only its Reference row was found. A passage
 * that opens with the query is the one defining it, and ranks above the ones
 * that only mention it.
 */
function scoreText(body: string, needle: string, tokens: Array<string>): Hit {
  const phrase = wordScore(body, needle) * (body.startsWith(needle) ? 2 : 1);

  let words = 0;
  for (const token of tokens) {
    const hit = wordScore(body, token);
    if (hit === 0) {
      words = 0;
      break;
    }
    words += hit;
  }

  const score = phrase + words;
  if (score === 0) return { score: 0, complete: false };
  return { score: score * TEXT_WEIGHT, complete: true };
}

/**
 * One row per destination. The prose repeats itself across a page, so several
 * passages under one heading can all match - and a list of five links to the
 * same anchor answers nothing the first one did not. Symbols are the
 * exception: a Reference table is one anchor holding many of them, so each
 * symbol keeps its row, and a passage landing on an anchor a symbol already
 * holds - the symbol's own table row - does not.
 */
function dedupe(
  results: Array<{ entry: SearchEntry; score: number }>,
): Array<SearchEntry> {
  const anchors = new Set<string>();
  const symbols = new Set<string>();
  const kept: Array<SearchEntry> = [];
  for (const { entry } of results) {
    const anchor = `${entry.to}#${entry.hash ?? ""}`;
    if (entry.kind === "symbol") {
      const key = `${entry.title} ${anchor}`;
      if (symbols.has(key)) continue;
      symbols.add(key);
    } else if (anchors.has(anchor)) {
      continue;
    }
    anchors.add(anchor);
    kept.push(entry);
  }
  return kept;
}

/**
 * The passage, cut to a line and centred on what matched - a body hit is
 * unreadable as the first eighty characters of its paragraph.
 */
export function excerpt(body: string, query: string, length = 140): string {
  if (body.length <= length) return body;

  const lower = body.toLowerCase();
  const at = [query.trim().toLowerCase(), ...tokenize(query)]
    .map((token) => lower.indexOf(token))
    .find((index) => index >= 0);

  const start = Math.max(0, (at ?? 0) - Math.floor(length / 3));
  const end = Math.min(body.length, start + length);
  const head = start > 0 ? "…" : "";
  const tail = end < body.length ? "…" : "";
  return `${head}${body.slice(start, end).trim()}${tail}`;
}
