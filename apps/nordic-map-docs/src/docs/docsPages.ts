import accessibilityDoc from "@jielga/nordic-map/docs/accessibility.md?raw";
import areasDoc from "@jielga/nordic-map/docs/areas.md?raw";
import cameraDoc from "@jielga/nordic-map/docs/camera.md?raw";
import clustersDoc from "@jielga/nordic-map/docs/clusters.md?raw";
import dataAndLicensesDoc from "@jielga/nordic-map/docs/data-and-licenses.md?raw";
import gettingStartedDoc from "@jielga/nordic-map/docs/getting-started.md?raw";
import layersDoc from "@jielga/nordic-map/docs/layers.md?raw";
import localizationDoc from "@jielga/nordic-map/docs/localization.md?raw";
import mapSourcesDoc from "@jielga/nordic-map/docs/map-sources.md?raw";
import nordicMapDoc from "@jielga/nordic-map/docs/nordic-map.md?raw";
import pathsDoc from "@jielga/nordic-map/docs/paths.md?raw";
import pinsDoc from "@jielga/nordic-map/docs/pins.md?raw";
import selectionDoc from "@jielga/nordic-map/docs/selection.md?raw";
import stylingDoc from "@jielga/nordic-map/docs/styling.md?raw";
import tooltipsDoc from "@jielga/nordic-map/docs/tooltips.md?raw";

/**
 * One page per topic: the prose, the demos that show it, and the reference table for everything that page
 * owns. A demo lives inside the page that explains it, named by a ```demo fence.
 */

export const DOCS_SECTIONS = ["Start here", "Pins", "Map", "Look and language", "Data", "Reference"] as const;

export type DocsSection = (typeof DOCS_SECTIONS)[number];

export type DocsPageEntry = {
  id: string;
  section: DocsSection;
  label: string;
  description: string;
  source: string;
};

/** Ordered as they appear in the navigation */
export const DOCS_PAGES: DocsPageEntry[] = [
  // Served at "/" as the front page, not under /docs
  {
    id: "getting-started",
    section: "Start here",
    label: "Getting started",
    description: "Installation and a first map",
    source: gettingStartedDoc,
  },
  {
    id: "pins",
    section: "Pins",
    label: "Pins",
    description: "GPS points with labels, colors and your own data",
    source: pinsDoc,
  },
  {
    id: "selection",
    section: "Pins",
    label: "Selection",
    description: "Select pins by drag, click or area, and highlight one from a list",
    source: selectionDoc,
  },
  {
    id: "clusters",
    section: "Pins",
    label: "Clusters",
    description: "Pins close together join a cluster with a count",
    source: clustersDoc,
  },
  {
    id: "tooltips",
    section: "Pins",
    label: "Tooltips",
    description: "What shows over a pin, cluster, area or path",
    source: tooltipsDoc,
  },
  {
    id: "layers",
    section: "Map",
    label: "Layers",
    description: "Show each layer always, never, or in a zoom range",
    source: layersDoc,
  },
  {
    id: "camera",
    section: "Map",
    label: "Camera",
    description: "Zoom, pan and move the map from your code",
    source: cameraDoc,
  },
  {
    id: "areas",
    section: "Map",
    label: "Areas",
    description: "Filled regions, counties and municipalities, choropleth maps, and drawing your own",
    source: areasDoc,
  },
  {
    id: "paths",
    section: "Map",
    label: "Paths",
    description: "Lines such as GPS tracks and routes",
    source: pathsDoc,
  },
  {
    id: "styling",
    section: "Look and language",
    label: "Styling",
    description: "Light and dark colors, map style and CSS variables",
    source: stylingDoc,
  },
  {
    id: "localization",
    section: "Look and language",
    label: "Localization",
    description: "Every text the map shows, in English and Swedish",
    source: localizationDoc,
  },
  {
    id: "accessibility",
    section: "Look and language",
    label: "Accessibility",
    description: "Keyboard, screen readers and reduced motion",
    source: accessibilityDoc,
  },
  {
    id: "map-sources",
    section: "Data",
    label: "Map sources",
    description: "The bundled map data, and your own",
    source: mapSourcesDoc,
  },
  {
    id: "data-and-licenses",
    section: "Data",
    label: "Data and licenses",
    description: "Where the map data comes from, and the credit it needs",
    source: dataAndLicensesDoc,
  },
  {
    id: "nordic-map",
    section: "Reference",
    label: "NordicMap",
    description: "Every prop of the component, and where it is described",
    source: nordicMapDoc,
  },
];

export function findDocsPage(id: string): DocsPageEntry | undefined {
  return DOCS_PAGES.find((page) => {
    return page.id === id;
  });
}

/** Where a page lives. Getting started is the front page, not a /docs route. */
export function docsPageHref(page: DocsPageEntry): string {
  return page.id === "getting-started" ? "/" : `/docs/${page.id}`;
}

/** The sections with their pages, in order, without the empty ones */
export function docsSections(): { section: DocsSection; pages: DocsPageEntry[] }[] {
  return DOCS_SECTIONS.map((section) => {
    return {
      section,
      pages: DOCS_PAGES.filter((page) => {
        return page.section === section;
      }),
    };
  }).filter((entry) => {
    return entry.pages.length > 0;
  });
}
