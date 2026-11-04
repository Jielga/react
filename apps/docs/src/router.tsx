import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { AppLayout } from "./AppLayout";
import { DocsIndexPage } from "./docs/DocsIndexPage";
import { DocsRoutePage } from "./docs/DocsRoutePage";
import { GettingStartedPage } from "./GettingStartedPage";
import { PlaygroundExample } from "./examples/playground/PlaygroundExample";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: GettingStartedPage,
});

export const docsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: DocsIndexPage,
});

export const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/$docId",
  component: DocsRoutePage,
});

export const playgroundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/playground",
  component: PlaygroundExample,
});

/**
 * Every route the site has ever published, pointed at the page that now holds
 * that material. Docs and examples used to be two trees; a demo now lives
 * inside the page explaining it, so every `/examples/*` path resolves to a
 * documentation page.
 *
 * These are in the README, the changelog and anything anyone has linked, so
 * they are kept rather than left to 404.
 */
const REDIRECTS: ReadonlyArray<{ path: string; docId: string }> = [
  // Old example topics.
  { path: "/examples/basic-grid", docId: "getting-started" },
  { path: "/examples/column-definitions", docId: "columns" },
  { path: "/examples/density-and-layout", docId: "styling" },
  { path: "/examples/sorting", docId: "sorting" },
  { path: "/examples/filtering", docId: "filtering" },
  { path: "/examples/filter-controls", docId: "filtering" },
  { path: "/examples/column-layout", docId: "column-layout" },
  { path: "/examples/row-selection", docId: "row-selection" },
  { path: "/examples/row-details", docId: "row-details" },
  { path: "/examples/grouping", docId: "grouping" },
  { path: "/examples/row-pinning", docId: "row-pinning" },
  { path: "/examples/row-styling", docId: "row-styling" },
  { path: "/examples/cell-selection", docId: "cell-selection" },
  { path: "/examples/pagination", docId: "pagination" },
  { path: "/examples/quick-search", docId: "quick-search" },
  { path: "/examples/persistence", docId: "persistence" },
  { path: "/examples/server-side", docId: "server-side" },
  { path: "/examples/infinite-scroll", docId: "server-side" },
  { path: "/examples/loading-empty", docId: "loading-and-empty" },
  { path: "/examples/cell-editing", docId: "editing" },
  { path: "/examples/row-batch-editing", docId: "editing" },
  { path: "/examples/editors-validation", docId: "editors" },
  { path: "/examples/toolbar-localization", docId: "toolbar" },
  { path: "/examples/styling", docId: "styling" },
  // Routes the site shipped with before the examples became a tree.
  { path: "/editable-grid", docId: "editing" },
  { path: "/infinite-scroll", docId: "server-side" },
  // A page that was dissolved into the topics it used to collect.
  { path: "/docs/features", docId: "anatomy" },
];

const redirectRoutes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/data-grid",
    beforeLoad: () => {
      throw redirect({ to: "/playground", replace: true });
    },
  }),
  // The examples index became the docs index.
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/examples",
    beforeLoad: () => {
      throw redirect({ to: "/docs", replace: true });
    },
  }),
  // Getting started is the front page. The static path outranks
  // `/docs/$docId`, so existing links land on "/" rather than a 404-ish
  // "no page named" message.
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/docs/getting-started",
    beforeLoad: () => {
      throw redirect({ to: "/", replace: true });
    },
  }),
  ...REDIRECTS.map(({ path, docId }) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: () => {
        throw redirect({
          to: "/docs/$docId",
          params: { docId },
          replace: true,
        });
      },
    }),
  ),
];

const routeTree = rootRoute.addChildren([
  indexRoute,
  docsIndexRoute,
  docsRoute,
  playgroundRoute,
  ...redirectRoutes,
]);

export const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
  // "/" in dev; "/react/" on GitHub Pages (set via vite --base).
  basepath: import.meta.env.BASE_URL,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
