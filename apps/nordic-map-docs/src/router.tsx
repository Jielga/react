import { createBrowserHistory, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { DocsIndexPage } from "./docs/DocsIndexPage.tsx";
import { DocsRoutePage } from "./docs/DocsRoutePage.tsx";
import { AreaEditorPage } from "./editor/AreaEditorPage.tsx";
import { Playground } from "./examples/playground/Playground.tsx";
import { GettingStartedPage } from "./GettingStartedPage.tsx";
import { AppLayout } from "./layout/AppLayout.tsx";

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => {
    return rootRoute;
  },
  path: "/",
  // The site used to show its demos at hash links on the front page
  beforeLoad: ({ location }) => {
    if (location.hash === "nordic-map" || location.hash === "sweden-map") {
      throw redirect({ to: "/playground", replace: true });
    }
  },
  component: GettingStartedPage,
});

const docsIndexRoute = createRoute({
  getParentRoute: () => {
    return rootRoute;
  },
  path: "/docs",
  component: DocsIndexPage,
});

export const docsRoute = createRoute({
  getParentRoute: () => {
    return rootRoute;
  },
  path: "/docs/$docId",
  component: DocsRoutePage,
});

// Getting started is the front page. The static path outranks `/docs/$docId`.
const gettingStartedRedirect = createRoute({
  getParentRoute: () => {
    return rootRoute;
  },
  path: "/docs/getting-started",
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});

const playgroundRoute = createRoute({
  getParentRoute: () => {
    return rootRoute;
  },
  path: "/playground",
  component: Playground,
});

const editorRoute = createRoute({
  getParentRoute: () => {
    return rootRoute;
  },
  path: "/editor",
  component: AreaEditorPage,
});

const routeTree = rootRoute.addChildren([indexRoute, docsIndexRoute, docsRoute, gettingStartedRedirect, playgroundRoute, editorRoute]);

export const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
  // "/" in dev; the site's path on GitHub Pages, set with vite --base
  basepath: import.meta.env.BASE_URL,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
