import { Burger, Flex, NavLink, Text, Tooltip } from "@mantine/core";
import { useDocumentTitle } from "@mantine/hooks";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { DocsOutline } from "docs-shell/docs/DocsOutline.tsx";
import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import { AppHeader } from "./AppHeader";
import {
  DOCS_NAV_TOP,
  docsNavSections,
  docsPageHref,
  findDocsPage,
  type DocsPageEntry,
} from "./docs/docsPages";
import { DocsSearch } from "./docs/DocsSearch";
import { useDocsSearch } from "./docs/useDocsSearch";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      size="xs"
      fw={600}
      c="dimmed"
      px="sm"
      py="xs"
      style={{ letterSpacing: "0.05em" }}
    >
      {children}
    </Text>
  );
}

const NAV_LINK_STYLE = { borderRadius: "var(--mantine-radius-sm)" };

/**
 * The router marks the active link with `aria-current`, which is what Mantine's
 * NavLink styles - so no link needs an `active` prop of its own. Exact, because
 * the default is a prefix match: without it `/docs` reads as active on every
 * page under it.
 */
const EXACT = { exact: true } as const;

/** The nav's padding, which the sticky header covers so links scroll out of sight under it. */
const NAV_PADDING = 8;

const NAV_HEADER_STYLE = {
  position: "sticky",
  top: -NAV_PADDING,
  zIndex: 1,
  margin: `-${NAV_PADDING}px -${NAV_PADDING}px 0`,
  padding: NAV_PADDING,
  background: "var(--mantine-color-body)",
} as const;

/** The docs page a pathname shows: getting started is served at "/". */
function pageAt(pathname: string): DocsPageEntry | undefined {
  if (pathname === "/") return findDocsPage("getting-started");
  return pathname.startsWith("/docs/")
    ? findDocsPage(pathname.slice("/docs/".length))
    : undefined;
}

/** The page's `##` headings, indented under its link. */
function PageOutline({ page }: { page: DocsPageEntry }) {
  return (
    <div style={{ margin: "2px 0 6px 12px" }}>
      <DocsOutline source={page.source} />
    </div>
  );
}

/**
 * One tree: the front page, the playground, then the documentation grouped by
 * section. Child links carry no description - at two dozen entries the second
 * line stops being context and starts being noise, and the index page at
 * `/docs` is where each page gets its sentence.
 *
 * Only the section holding the current page starts open, and only the current
 * page lists its headings, so the tree stays one screen tall however many
 * pages the docs grow. A section opened or closed by hand stays that way until
 * the page changes: a search hit in a section closed earlier has to show where
 * it landed.
 */
function DocsNav({ current }: { current: DocsPageEntry | undefined }) {
  const [toggled, setToggled] = useState<{
    page: string | undefined;
    sections: Partial<Record<string, boolean>>;
  }>({ page: current?.id, sections: {} });
  const sections = toggled.page === current?.id ? toggled.sections : {};

  return (
    <>
      {docsNavSections().map(({ section, pages }) => {
        return (
          <NavLink
            key={section}
            label={section}
            opened={sections[section] ?? current?.section === section}
            onChange={(opened) =>
              setToggled({
                page: current?.id,
                sections: { ...sections, [section]: opened },
              })
            }
            childrenOffset={12}
            style={NAV_LINK_STYLE}
          >
            {pages.map((page) => (
              <Fragment key={page.id}>
                <NavLink
                  component={Link}
                  to={`/docs/${page.id}`}
                  activeOptions={EXACT}
                  label={page.label}
                  style={NAV_LINK_STYLE}
                />
                {page === current && <PageOutline page={page} />}
              </Fragment>
            ))}
          </NavLink>
        );
      })}
    </>
  );
}

/**
 * The tab title. Every page shipped as "tmtable", the repo's own name, so a
 * reader with several docs tabs open could not tell them apart.
 */
function titleFor(pathname: string): string {
  if (pathname === "/") return "TMDataGrid";
  if (pathname === "/docs") return "Documentation · TMDataGrid";
  if (pathname === "/playground") return "Playground · TMDataGrid";
  const page = findDocsPage(pathname.replace("/docs/", ""));
  return page ? `${page.label} · TMDataGrid` : "TMDataGrid";
}

/** Wide enough for the nav to sit open without crowding the page beside it. */
const WIDE_VIEWPORT = "(min-width: 1000px)";

/**
 * Collapsed, the nav keeps a rail wide enough for the burger that reopens it -
 * 260px is a quarter of a narrow window, and a page squeezed into what is left
 * is not a page anyone can judge a grid by.
 */
const NAV_WIDTH_OPEN = 260;
const NAV_WIDTH_RAIL = 44;

function useWideViewport(): boolean {
  const [wide, setWide] = useState(
    () => window.matchMedia(WIDE_VIEWPORT).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(WIDE_VIEWPORT);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return wide;
}

/**
 * Scrolls the nav so the current page's link, and the outline under it, is in
 * view - on load and after every navigation, a search hit included, which can
 * land on a page far down a tree the user had scrolled elsewhere. Only on a
 * page change, so a nav scrolled by hand stays where it was while the page is
 * read.
 *
 * Opening the page's section animates its height and moves everything under
 * it, so the reveal runs again as each transition ends.
 */
function useRevealActiveLink(
  navRef: RefObject<HTMLElement | null>,
  pathname: string,
  open: boolean,
) {
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !open) return;

    const reveal = () => {
      const link = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!link) return;
      const header = nav.querySelector<HTMLElement>("[data-nav-header]");
      const bounds = nav.getBoundingClientRect();
      const top = link.getBoundingClientRect().top - bounds.top;
      const outline = link.nextElementSibling;
      const bottom =
        Math.max(
          link.getBoundingClientRect().bottom,
          outline?.getBoundingClientRect().bottom ?? 0,
        ) - bounds.top;
      const margin = 8;
      // The sticky header covers the top of the nav.
      const first = (header?.offsetHeight ?? 0) + margin;
      const last = nav.clientHeight - margin;
      // Too tall for the nav: the page link at the top wins over the outline.
      if (top < first || bottom - top > last - first) {
        nav.scrollTop += top - first;
      } else if (bottom > last) {
        nav.scrollTop += bottom - last;
      }
    };

    reveal();
    nav.addEventListener("transitionend", reveal);
    return () => nav.removeEventListener("transitionend", reveal);
  }, [navRef, pathname, open]);
}

export function AppLayout() {
  const wide = useWideViewport();
  // The viewport decides until someone clicks, and then it is their call - see
  // the same pattern on the playground's options panel.
  const [navOpen, setNavOpen] = useState<boolean | null>(null);
  const open = navOpen ?? wide;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useDocsSearch();
  const current = pageAt(pathname);
  const navRef = useRef<HTMLElement>(null);

  useDocumentTitle(titleFor(pathname));
  useRevealActiveLink(navRef, pathname, open);

  return (
    <Flex direction="column" h="100vh" style={{ overflow: "hidden" }}>
      <AppHeader onSearch={search.open} />
      <DocsSearch opened={search.opened} onClose={search.close} />

      <Flex flex={1} style={{ minHeight: 0, overflow: "hidden" }}>
        <nav
          ref={navRef}
          style={{
            width: open ? NAV_WIDTH_OPEN : NAV_WIDTH_RAIL,
            flexShrink: 0,
            borderRight: "1px solid var(--mantine-color-default-border)",
            padding: NAV_PADDING,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            overflowY: "auto",
            overflowX: "hidden",
            // Only the current section is open, so the tree grows past the
            // window on one page and fits on the next. Without a reserved
            // gutter every link shifts sideways as the scrollbar comes and
            // goes. The rail never scrolls, and a gutter there would take a
            // third of its width from the burger.
            scrollbarGutter: open ? "stable" : undefined,
            // The gutter is there on every page now, so it costs as little
            // of the nav's width as the platform allows.
            scrollbarWidth: "thin",
          }}
        >
          {/* Stuck to the top, so the burger is never half scrolled away. */}
          <div data-nav-header style={NAV_HEADER_STYLE}>
            <Tooltip
              label={open ? "Hide navigation" : "Show navigation"}
              withArrow
            >
              <Burger
                size="sm"
                opened={open}
                onClick={() => setNavOpen(!open)}
                aria-label={open ? "Hide navigation" : "Show navigation"}
              />
            </Tooltip>
          </div>

          {open && (
            <>
              {/* The front page leads the nav, the way a package site starts
                  with its install-and-first-render page. */}
              {DOCS_NAV_TOP.map((page) => (
                <Fragment key={page.id}>
                  <NavLink
                    component={Link}
                    to={docsPageHref(page)}
                    activeOptions={EXACT}
                    label={page.label}
                    description={page.description}
                    style={NAV_LINK_STYLE}
                  />
                  {page === current && <PageOutline page={page} />}
                </Fragment>
              ))}
              <NavLink
                component={Link}
                to="/playground"
                activeOptions={EXACT}
                label="Playground"
                description="Every feature at once, behind switches"
                style={NAV_LINK_STYLE}
              />

              <SectionLabel>DOCUMENTATION</SectionLabel>
              <NavLink
                component={Link}
                to="/docs"
                activeOptions={EXACT}
                label="Overview"
                style={NAV_LINK_STYLE}
              />
              <DocsNav current={current} />
            </>
          )}

          {/* The router devtools badge floats in this corner during dev, and
              the nav's last link is what it would land on. */}
          {import.meta.env.DEV && <div style={{ height: 36, flexShrink: 0 }} />}
        </nav>

        <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <Outlet />
        </main>
      </Flex>

      {/* Bottom-left: the grid's pager lives in the opposite corner, and a
          floating badge over it is the one thing you cannot scroll out of the
          way. */}
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
    </Flex>
  );
}
