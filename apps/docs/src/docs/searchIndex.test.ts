import { describe, expect, it } from "vitest";
import { extractHeadings } from "docs-shell/docs/headings.ts";
import { DOCS_PAGES, findDocsPage } from "./docsPages";
import { SEARCH_ALIASES } from "./searchAliases";
import { excerpt, searchDocs, SEARCH_INDEX } from "./searchIndex";

/**
 * The query shapes the palette has to serve at once: an exact API name, a
 * couple of words describing a topic, and a word the docs deliberately do not
 * use. They want opposite ranking, so all three are pinned here - along with
 * the queries that used to return a full list of confident nonsense.
 */

const titles = (query: string) =>
  searchDocs(query).map((entry) => entry.title);

/** The page a result sits on: a page entry is its own title. */
const pageOf = (query: string) =>
  searchDocs(query).map((entry) =>
    entry.kind === "page" ? entry.title : entry.context,
  );

describe("docs search", () => {
  it("indexes pages, sections, symbols and prose", () => {
    const kinds = new Set(SEARCH_INDEX.map((entry) => entry.kind));
    expect([...kinds].sort()).toEqual(["page", "section", "symbol", "text"]);
  });

  it("puts an exact symbol match first", () => {
    expect(titles("onCellClick")[0]).toBe("onCellClick");
    expect(titles("renderDetails")[0]).toBe("renderDetails");
    expect(titles("--dg-row-selected-bg")[0]).toBe("--dg-row-selected-bg");
  });

  it("finds a symbol from a near miss", () => {
    // The user's own example: not a real name, but the click handlers are
    // plainly what was meant.
    expect(titles("onClickExample")).toContain("onCellClick");
  });

  it("finds topics from a couple of words", () => {
    const results = titles("cell sorting");
    expect(results.some((title) => /sorting/i.test(title))).toBe(true);
  });

  it("finds a page by its name", () => {
    expect(titles("grouping")).toContain("Grouping");
  });

  it("ignores a query too short to mean anything", () => {
    expect(searchDocs("a")).toEqual([]);
    expect(searchDocs("  ")).toEqual([]);
  });

  it("every result points at a route", () => {
    for (const entry of SEARCH_INDEX) {
      expect(entry.to.startsWith("/")).toBe(true);
    }
  });

  it("indexes only identifier-shaped symbols", () => {
    // A reference row can lead with a value rather than a name; those used to
    // be indexed as symbols and surfaced on unrelated queries.
    const symbols = SEARCH_INDEX.filter((entry) => entry.kind === "symbol");
    expect(symbols.length).toBeGreaterThan(100);
    for (const entry of symbols) {
      expect(entry.title).not.toMatch(/[\s{},|]/);
    }
  });

  describe("the fuzzy leg is gated", () => {
    // Every one of these used to return a full list with nothing relevant in
    // it: `theme` scattered-character-matched "T-he ... me-nu" on ten titles.
    it("does not answer a topic query with unrelated titles", () => {
      for (const query of ["theme", "tree", "read only", "freeze columns"]) {
        const results = searchDocs(query);
        expect(
          results.every((entry) => entry.kind === "text"),
          `${query} returned only prose hits`,
        ).toBe(false);
      }
    });

    it("returns nothing for a word the docs never use", () => {
      expect(searchDocs("kubernetes")).toEqual([]);
    });

    it("drops half-matches once a title answers the whole query", () => {
      // "dark mode" used to return the theming page and then eight titles
      // holding only the word "mode".
      const results = searchDocs("dark mode");
      expect(results.length).toBeLessThanOrEqual(3);
      expect(results[0].context).toBe("Size, styling and theming");
    });

    it("keeps the half-matches when no title answers all of it", () => {
      // No heading holds both words, so the Sorting page is still the answer.
      expect(titles("cell sorting")).toContain("Sorting");
    });
  });

  describe("prose is searchable", () => {
    it("finds a page by a word only its body carries", () => {
      expect(pageOf("virtualization")).toContain("Scrolling and virtualization");
      expect(pageOf("localStorage")).toContain("Persistence");
    });

    it("ranks a passage below the heading it sits under", () => {
      const first = searchDocs("overscan")[0];
      expect(first.kind).not.toBe("text");
    });

    it("requires every word of a phrase, not one of them", () => {
      for (const entry of searchDocs("row height")) {
        if (entry.kind !== "text") continue;
        const body = entry.body?.toLowerCase() ?? "";
        expect(body).toContain("row");
        expect(body).toContain("height");
      }
    });

    it("shows the passage centred on what matched", () => {
      const body =
        "The grid never writes cells from the clipboard, so a paste is silent and nothing at all happens to the selection you made.";
      expect(excerpt(body, "clipboard", 60)).toContain("clipboard");
      expect(excerpt(body, "clipboard", 60).length).toBeLessThan(70);
    });

    it("finds the section that explains a symbol, not only its Reference row", () => {
      // The tokenizer splits the name into words no passage holds on its own,
      // so the passage under "The column helper" that defines it went unfound.
      const results = searchDocs("createTMDataGridColumnHelper");
      expect(results[0].kind).toBe("symbol");
      expect(results[1]).toMatchObject({ kind: "text", hash: "the-column-helper" });
    });

    it("finds a symbol's passages while the name is still being typed", () => {
      const hashes = searchDocs("createTMDataGridCol").map((entry) => entry.hash);
      expect(hashes).toContain("the-column-helper");
    });

    it("returns one row per destination", () => {
      const results = searchDocs("draft");
      const keys = results.map((entry) => `${entry.to}#${entry.hash ?? ""}${entry.kind === "symbol" ? entry.title : ""}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("links a symbol to its own reference row", () => {
      const [first] = searchDocs("resolveRowSelectionClick");
      expect(first).toMatchObject({
        kind: "symbol",
        to: "/docs/row-selection",
        hash: "ref-resolveRowSelectionClick",
      });
    });

    it("drops a passage that points where a symbol already does", () => {
      // The Reference row that holds a symbol is also a passage; both land on
      // the row's anchor.
      const destinations = searchDocs("createTMDataGridColumnHelper")
        .filter((entry) => entry.context === "Defining columns")
        .map((entry) => entry.hash);
      expect(new Set(destinations).size).toBe(destinations.length);
    });
  });

  describe("the alias list", () => {
    it("points every alias at a page and heading that exist", () => {
      for (const alias of SEARCH_ALIASES) {
        const page = findDocsPage(alias.pageId);
        expect(page, `no page ${alias.pageId}`).toBeDefined();
        if (!page || alias.hash === undefined) continue;
        const slugs = extractHeadings(page.source).map((heading) => heading.slug);
        expect(slugs, `${alias.pageId}#${alias.hash}`).toContain(alias.hash);
      }
    });

    it("answers the words a reader arrives with", () => {
      // Each of these returned nothing, or nothing relevant, before the
      // aliases existed. The docs use a different word on purpose.
      const expected: Array<[string, string]> = [
        ["freeze column", "Visibility, pinning, ordering and size"],
        ["excel", "Excel export (xlsx)"],
        ["localstorage", "Persistence"],
        ["conditional formatting", "Row styling"],
        ["dark mode", "Size, styling and theming"],
        ["master detail", "Row details"],
        ["keyboard shortcuts", "Cell selection and copy"],
        ["date picker", "Editors and validation"],
        ["tree data", "Grouping"],
      ];
      for (const [query, page] of expected) {
        expect(pageOf(query).slice(0, 4), query).toContain(page);
      }
    });
  });
});

describe("docs pages", () => {
  /**
   * The sidebar label, the page's own h1 and the search title are one name.
   * Nine pages carried two, which left a reader unsure they had landed where
   * they clicked and split the index across both spellings.
   */
  it("labels every page the way the page titles itself", () => {
    for (const page of DOCS_PAGES) {
      const h1 = page.source.split(/\r?\n/)[0];
      expect(h1, page.id).toMatch(/^# /);
      expect(h1.slice(2).trim(), page.id).toBe(page.label);
    }
  });
});
