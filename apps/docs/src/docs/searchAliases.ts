/**
 * Words a reader types that the docs deliberately do not use.
 *
 * This is an exception list, not a keyword map. Almost every word someone
 * searches for is already written down somewhere in the prose, and the index
 * reads the prose - a second copy of the vocabulary would only go stale in
 * silence. What belongs here is the case the prose cannot answer: the industry
 * word for a thing this grid names differently, mostly the vocabulary someone
 * arrives with from another grid.
 *
 * `searchIndex.test.ts` asserts that every target resolves to a real page and,
 * where a hash is given, to a real heading on it - so renaming a page or a
 * heading fails loudly instead of quietly breaking a search.
 */

export type SearchAlias = {
  /** Lower-case. Multi-word terms match when the query contains them. */
  terms: ReadonlyArray<string>;
  pageId: string;
  /** A heading slug on that page. Omitted, the alias points at the page. */
  hash?: string;
};

export const SEARCH_ALIASES: ReadonlyArray<SearchAlias> = [
  // Coming from another grid.
  { terms: ["freeze", "frozen", "freeze column", "freeze columns", "lock", "locked", "lock columns", "sticky column"], pageId: "column-layout", hash: "pinning" },
  { terms: ["column width", "resize", "resizing", "resizable"], pageId: "column-layout", hash: "sizing" },
  { terms: ["master detail", "expandable row", "sub panel"], pageId: "row-details" },
  { terms: ["conditional formatting", "cell class rules", "colour by value", "color by value"], pageId: "row-styling" },
  { terms: ["batch edit", "edit buffer", "unsaved changes", "pending changes"], pageId: "draft-store" },
  { terms: ["read only", "readonly", "non editable", "disable editing"], pageId: "columns", hash: "metaedit" },
  { terms: ["fill down", "fill handle", "paste"], pageId: "cell-selection", hash: "keys-and-keyboard-shortcuts" },
  { terms: ["autosize", "auto fit", "best fit"], pageId: "column-layout", hash: "autosizing" },
  { terms: ["column chooser", "column picker"], pageId: "menu" },
  { terms: ["floating filter", "filter row", "header filter"], pageId: "filtering", hash: "inheader" },
  { terms: ["quick filter", "global filter", "search box"], pageId: "quick-search" },
  { terms: ["filter sidebar", "filter drawer", "filter panel placement"], pageId: "filtering", hash: "the-filters-option" },

  // Words for a feature the docs name with a different one.
  { terms: ["excel", "xlsx", "spreadsheet"], pageId: "xlsx" },
  { terms: ["export", "csv", "download"], pageId: "export", hash: "formats" },
  { terms: ["localstorage", "sessionstorage", "storage"], pageId: "persistence" },
  { terms: ["dark mode", "light mode", "colour scheme", "color scheme", "theme", "theming"], pageId: "styling", hash: "colours" },
  { terms: ["performance", "large data", "big data", "many rows"], pageId: "scrolling" },
  { terms: ["infinite", "lazy load", "load more"], pageId: "server-side", hash: "infinite-scroll" },
  { terms: ["spinner", "skeleton", "busy"], pageId: "loading-and-empty" },
  { terms: ["currency", "money", "decimal", "number format"], pageId: "columns", hash: "column-types" },
  { terms: ["date picker", "calendar"], pageId: "editors", hash: "the-built-in-editors" },
  { terms: ["accessibility", "a11y", "screen reader", "aria"], pageId: "testing" },
  { terms: ["typescript", "types", "generics"], pageId: "components" },
  { terms: ["tree data", "hierarchy", "getsubrows", "nested rows"], pageId: "grouping", hash: "grouping-is-not-hierarchical-data" },
  { terms: ["async", "fetch", "server", "remote"], pageId: "server-side" },
];
