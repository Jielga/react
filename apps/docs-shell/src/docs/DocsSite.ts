import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";

/**
 * What the shared renderer needs from the site that mounts it. The renderer is
 * the same on every site; where the demos live and how a link to another page
 * navigates are not, so each site hands those in through `DocsSiteProvider`.
 *
 * The value is read on every render, so a site defines it once at module level
 * rather than building a fresh object inside a component.
 */
export type DocsSite = {
  /**
   * The demo component and its source text, by path under the site's demos
   * folder - e.g. `"rows/Grouping.tsx"`. Throws for a file that is not there.
   */
  loadDemo: (file: string) => { Component: ComponentType; source: string };
  /** Source text of a shared module a demo shows as an extra tab. */
  loadSharedSource: (path: string) => string;
  /**
   * Renders a root-relative link, one whose `href` starts with "/". Leave it
   * out to render a plain `<a>`.
   */
  renderLink?: (props: { href: string; children: ReactNode }) => ReactNode;
};

const DocsSiteContext = createContext<DocsSite | undefined>(undefined);

/** `<DocsSiteProvider value={site}>`, around everything that renders docs. */
export const DocsSiteProvider = DocsSiteContext.Provider;

/**
 * The site's hooks into the renderer. Throws outside a provider: a demo with no
 * registry to load it from can only render nothing, and a page that quietly
 * lost its demos is the failure nobody notices.
 */
export function useDocsSite(): DocsSite {
  const site = useContext(DocsSiteContext);

  if (!site) {
    throw new Error(
      "A docs demo rendered outside <DocsSiteProvider>. Wrap the site in one and pass it the site's loadDemo and loadSharedSource.",
    );
  }

  return site;
}

/**
 * The site's link renderer, if it has one. Optional unlike `useDocsSite`: a
 * page without demos renders its links without any provider at all.
 */
export function useDocsLinkRenderer(): DocsSite["renderLink"] {
  return useContext(DocsSiteContext)?.renderLink;
}
