import anatomyDoc from "@jielga/tmdatagrid/docs/anatomy.md?raw";
import cardViewDoc from "@jielga/tmdatagrid/docs/card-view.md?raw";
import addingRowsDoc from "@jielga/tmdatagrid/docs/adding-rows.md?raw";
import cellSelectionDoc from "@jielga/tmdatagrid/docs/cell-selection.md?raw";
import columnLayoutDoc from "@jielga/tmdatagrid/docs/column-layout.md?raw";
import columnMenuDoc from "@jielga/tmdatagrid/docs/column-menu.md?raw";
import componentsDoc from "@jielga/tmdatagrid/docs/components.md?raw";
import columnsDoc from "@jielga/tmdatagrid/docs/columns.md?raw";
import draftStoreDoc from "@jielga/tmdatagrid/docs/draft-store.md?raw";
import editingDoc from "@jielga/tmdatagrid/docs/editing.md?raw";
import editorsDoc from "@jielga/tmdatagrid/docs/editors.md?raw";
import exportDoc from "@jielga/tmdatagrid/docs/export.md?raw";
import filteringDoc from "@jielga/tmdatagrid/docs/filtering.md?raw";
import gettingStartedDoc from "@jielga/tmdatagrid/docs/getting-started.md?raw";
import groupingDoc from "@jielga/tmdatagrid/docs/grouping.md?raw";
import loadingAndEmptyDoc from "@jielga/tmdatagrid/docs/loading-and-empty.md?raw";
import localizationDoc from "@jielga/tmdatagrid/docs/localization.md?raw";
import menuDoc from "@jielga/tmdatagrid/docs/menu.md?raw";
import migratingTo2Doc from "@jielga/tmdatagrid/docs/migrating-to-2.md?raw";
import paginationDoc from "@jielga/tmdatagrid/docs/pagination.md?raw";
import persistenceDoc from "@jielga/tmdatagrid/docs/persistence.md?raw";
import portfolioRebalancerDoc from "@jielga/tmdatagrid/docs/portfolio-rebalancer.md?raw";
import queryBuilderDoc from "@jielga/tmdatagrid/docs/query-builder.md?raw";
import quickSearchDoc from "@jielga/tmdatagrid/docs/quick-search.md?raw";
import rowDetailsDoc from "@jielga/tmdatagrid/docs/row-details.md?raw";
import rowInteractionDoc from "@jielga/tmdatagrid/docs/row-interaction.md?raw";
import rowPinningDoc from "@jielga/tmdatagrid/docs/row-pinning.md?raw";
import rowSelectionDoc from "@jielga/tmdatagrid/docs/row-selection.md?raw";
import rowStylingDoc from "@jielga/tmdatagrid/docs/row-styling.md?raw";
import scrollingDoc from "@jielga/tmdatagrid/docs/scrolling.md?raw";
import serverQueryDoc from "@jielga/tmdatagrid/docs/server-query.md?raw";
import serverSideDoc from "@jielga/tmdatagrid/docs/server-side.md?raw";
import sortingDoc from "@jielga/tmdatagrid/docs/sorting.md?raw";
import stylingDoc from "@jielga/tmdatagrid/docs/styling.md?raw";
import summaryRowDoc from "@jielga/tmdatagrid/docs/summary-row.md?raw";
import testingDoc from "@jielga/tmdatagrid/docs/testing.md?raw";
import toolbarDoc from "@jielga/tmdatagrid/docs/toolbar.md?raw";
import typedDeepLinksDoc from "@jielga/tmdatagrid/docs/typed-deep-links.md?raw";
import useTMDataGridDoc from "@jielga/tmdatagrid/docs/use-tm-data-grid.md?raw";
import xlsxDoc from "@jielga/tmdatagrid-xlsx/docs/xlsx.md?raw";

/**
 * One page per topic: the prose, the demos that show it, and the reference
 * table for everything that page owns. There is no second tree - a demo lives
 * inside the page that explains it, named by a ```demo fence.
 */

export const DOCS_SECTIONS = [
  "Start here",
  "Columns",
  "Rows",
  "Cells and editing",
  "Toolbar and footer",
  "Whole grid",
  "Recipes",
  "Reference",
] as const;

export type DocsSection = (typeof DOCS_SECTIONS)[number];

export type DocsPageEntry = {
  id: string;
  section: DocsSection;
  label: string;
  description: string;
  source: string;
};

/** Ordered as they appear in the sidebar. */
export const DOCS_PAGES: DocsPageEntry[] = [
  // Served at "/" as the front page, not under /docs - the router redirects
  // /docs/getting-started there. It stays in this list so the search indexes
  // it and the nav can order it with the rest.
  {
    id: "getting-started",
    section: "Start here",
    label: "Getting started",
    description: "Installation and a first grid",
    source: gettingStartedDoc,
  },
  {
    id: "anatomy",
    section: "Start here",
    label: "Grid anatomy",
    description: "The hook, the parts, and what each one returns",
    source: anatomyDoc,
  },
  {
    id: "migrating-to-2",
    section: "Start here",
    label: "Migrating from the 2.0 beta",
    description: "Every change from the 2.0 beta to 2.0.0",
    source: migratingTo2Doc,
  },

  {
    id: "columns",
    section: "Columns",
    label: "Defining columns",
    description: "Accessors, column meta and column types",
    source: columnsDoc,
  },
  {
    id: "sorting",
    section: "Columns",
    label: "Sorting",
    description: "Single-column and multi-column sorting",
    source: sortingDoc,
  },
  {
    id: "filtering",
    section: "Columns",
    label: "Filtering",
    description: "Operators, filter surfaces and custom controls",
    source: filteringDoc,
  },
  {
    id: "column-layout",
    section: "Columns",
    label: "Visibility, pinning, ordering and size",
    description: "Hiding, pinning, reordering and sizing columns",
    source: columnLayoutDoc,
  },
  {
    id: "column-menu",
    section: "Columns",
    label: "Column header menu",
    description: "The items on every header menu, and your own",
    source: columnMenuDoc,
  },

  {
    id: "row-selection",
    section: "Rows",
    label: "Row selection",
    description: "Selection modes, and reading the selection",
    source: rowSelectionDoc,
  },
  {
    id: "row-details",
    section: "Rows",
    label: "Row details",
    description: "A panel under an expanded row",
    source: rowDetailsDoc,
  },
  {
    id: "grouping",
    section: "Rows",
    label: "Grouping",
    description: "Grouped rows, aggregation and paging",
    source: groupingDoc,
  },
  {
    id: "summary-row",
    section: "Rows",
    label: "Summary row",
    description: "Column totals below the last row",
    source: summaryRowDoc,
  },
  {
    id: "row-pinning",
    section: "Rows",
    label: "Row pinning and numbering",
    description: "Rows pinned to the top or bottom, and row numbers",
    source: rowPinningDoc,
  },
  {
    id: "row-interaction",
    section: "Rows",
    label: "Clicks and context menus",
    description: "Row and cell clicks, and context menus",
    source: rowInteractionDoc,
  },
  {
    id: "row-styling",
    section: "Rows",
    label: "Row styling",
    description: "Row colours and classes from the row data",
    source: rowStylingDoc,
  },

  {
    id: "cell-selection",
    section: "Cells and editing",
    label: "Cell selection and copy",
    description: "The cell cursor, cell ranges and copying",
    source: cellSelectionDoc,
  },
  {
    id: "editing",
    section: "Cells and editing",
    label: "Editing",
    description: "Edit modes, the edit lane and which cells edit",
    source: editingDoc,
  },
  {
    id: "draft-store",
    section: "Cells and editing",
    label: "Draft store",
    description: "Holding edits until Save, and saving part of them",
    source: draftStoreDoc,
  },
  {
    id: "adding-rows",
    section: "Cells and editing",
    label: "Adding and deleting rows",
    description: "Entry rows, imports and deletion marks",
    source: addingRowsDoc,
  },
  {
    id: "editors",
    section: "Cells and editing",
    label: "Editors and validation",
    description: "Cell editors and validation rules",
    source: editorsDoc,
  },

  {
    id: "toolbar",
    section: "Toolbar and footer",
    label: "Toolbar",
    description: "Toolbar layout and buttons of your own",
    source: toolbarDoc,
  },
  {
    id: "menu",
    section: "Toolbar and footer",
    label: "Grid menu",
    description: "The grid menu and the column chooser",
    source: menuDoc,
  },
  {
    id: "quick-search",
    section: "Toolbar and footer",
    label: "Quick search",
    description: "One search box over every column, with highlighting",
    source: quickSearchDoc,
  },
  {
    id: "pagination",
    section: "Toolbar and footer",
    label: "Pagination",
    description: "Paging modes and a pager of your own",
    source: paginationDoc,
  },
  {
    id: "export",
    section: "Toolbar and footer",
    label: "Export",
    description: "Export menu items, the export hook and file formats",
    source: exportDoc,
  },
  {
    id: "xlsx",
    section: "Toolbar and footer",
    label: "Excel export (xlsx)",
    description: "Excel files through @jielga/tmdatagrid-xlsx",
    source: xlsxDoc,
  },

  {
    id: "styling",
    section: "Whole grid",
    label: "Size, styling and theming",
    description: "The size scale and every CSS variable",
    source: stylingDoc,
  },
  {
    id: "localization",
    section: "Whole grid",
    label: "Localization",
    description: "Every string the grid shows, in any language",
    source: localizationDoc,
  },
  {
    id: "scrolling",
    section: "Whole grid",
    label: "Scrolling and virtualization",
    description: "Overscan, row height, scrolling to a row and edge callbacks",
    source: scrollingDoc,
  },
  {
    id: "loading-and-empty",
    section: "Whole grid",
    label: "Loading and empty states",
    description: "The loader and the empty-state messages",
    source: loadingAndEmptyDoc,
  },
  {
    id: "persistence",
    section: "Whole grid",
    label: "Persistence",
    description: "Column layout and filters kept across reloads",
    source: persistenceDoc,
  },
  {
    id: "server-side",
    section: "Whole grid",
    label: "Server-side data",
    description: "Server-side paging, sorting and filtering",
    source: serverSideDoc,
  },

  {
    id: "query-builder",
    section: "Recipes",
    label: "A query builder form",
    description: "The grid as a form field",
    source: queryBuilderDoc,
  },
  {
    id: "server-query",
    section: "Recipes",
    label: "A server-backed search",
    description: "Grid state mapped onto an API's own query",
    source: serverQueryDoc,
  },
  {
    id: "portfolio-rebalancer",
    section: "Recipes",
    label: "A portfolio rebalancer",
    description: "Derived columns, and a rule over every row",
    source: portfolioRebalancerDoc,
  },
  {
    id: "typed-deep-links",
    section: "Recipes",
    label: "Typed links with TanStack Router",
    description: "Links into a grid, checked against its columns",
    source: typedDeepLinksDoc,
  },
  {
    id: "card-view",
    section: "Recipes",
    label: "A card view",
    description: "The grid's state, rendered as cards",
    source: cardViewDoc,
  },

  {
    id: "use-tm-data-grid",
    section: "Reference",
    label: "useTMDataGrid",
    description: "Every option of useTMDataGrid",
    source: useTMDataGridDoc,
  },
  {
    id: "components",
    section: "Reference",
    label: "Components and hooks",
    description: "Every component and hook, and their props",
    source: componentsDoc,
  },
  {
    id: "testing",
    section: "Reference",
    label: "Testing",
    description: "Selector attributes, roles and Playwright",
    source: testingDoc,
  },
];

export function findDocsPage(id: string): DocsPageEntry | undefined {
  return DOCS_PAGES.find((page) => page.id === id);
}

/** Where a page lives. Getting started is the front page, not a /docs route. */
export function docsPageHref(page: DocsPageEntry): string {
  return page.id === "getting-started" ? "/" : `/docs/${page.id}`;
}

function group(pages: Array<DocsPageEntry>) {
  return DOCS_SECTIONS.map((section) => ({
    section,
    pages: pages.filter((page) => page.section === section),
  })).filter((entry) => entry.pages.length > 0);
}

/**
 * The index page lists everything, Getting started included - it is a
 * directory of the documentation, and leaving out the page people want first
 * would be a strange directory.
 */
export function docsIndexSections() {
  return group(DOCS_PAGES);
}

/**
 * The sidebar's collapsible groups. "Start here" is left out because its pages
 * are pinned at the top of the nav as plain links: a group that opens onto one
 * entry is a click for nothing.
 */
export function docsNavSections() {
  return group(DOCS_PAGES.filter((page) => page.section !== "Start here"));
}

/** The pages pinned above the groups, in order. */
export const DOCS_NAV_TOP = DOCS_PAGES.filter(
  (page) => page.section === "Start here",
);
