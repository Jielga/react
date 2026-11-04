import {
  Burger,
  Flex,
  NavLink,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDocumentTitle, useMediaQuery } from "@mantine/hooks";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { docsPageHref, docsSections, findDocsPage } from "../docs/docsPages.ts";
import { DemoMapSettingsProvider } from "../examples/DemoMapSettings.tsx";
import { DEMO_MAP_SWITCHES, useDemoMapSettings } from "../examples/demoMapSettings.ts";
import { AppHeader } from "./AppHeader.tsx";
import { DocsSearch } from "./DocsSearch.tsx";

const NAV_LINK_STYLE = { borderRadius: "var(--mantine-radius-sm)" };

/** The router marks the active link with `aria-current`. Exact, so `/docs` is not active on every page under it. */
const EXACT = { exact: true } as const;

/** Wide enough for the navigation to sit open beside the page */
const WIDE_VIEWPORT = "(min-width: 1000px)";
const NAV_WIDTH_OPEN = 260;
/** Collapsed, the navigation keeps a rail wide enough for the button that opens it */
const NAV_WIDTH_RAIL = 44;

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

function titleFor(pathname: string): string {
  if (pathname === "/") {
    return "Nordic Map";
  }
  if (pathname === "/docs") {
    return "Documentation · Nordic Map";
  }
  if (pathname === "/playground") {
    return "Playground · Nordic Map";
  }
  if (pathname === "/editor") {
    return "Area editor · Nordic Map";
  }
  const page = findDocsPage(pathname.replace("/docs/", ""));
  return page ? `${page.label} · Nordic Map` : "Nordic Map";
}

/** The front page and the playground, then every docs page by section */
function Navigation() {
  return (
    <>
      <NavLink
        component={Link}
        to="/"
        activeOptions={EXACT}
        label="Getting started"
        description="Installation and a first map"
        style={NAV_LINK_STYLE}
      />
      <NavLink
        component={Link}
        to="/playground"
        activeOptions={EXACT}
        label="Playground"
        description="Every layer and color behind switches"
        style={NAV_LINK_STYLE}
      />
      <NavLink
        component={Link}
        to="/editor"
        activeOptions={EXACT}
        label="Area editor"
        description="Draw your own areas and export them"
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
      {docsSections()
        .filter(({ section }) => {
          return section !== "Start here";
        })
        .map(({ section, pages }) => {
          return (
            <NavLink
              key={section}
              label={section}
              defaultOpened
              childrenOffset={12}
              style={NAV_LINK_STYLE}
            >
              {pages.map((page) => {
                return (
                  <NavLink
                    key={page.id}
                    component={Link}
                    to={docsPageHref(page)}
                    activeOptions={EXACT}
                    label={page.label}
                    style={NAV_LINK_STYLE}
                  />
                );
              })}
            </NavLink>
          );
        })}
    </>
  );
}

/** Map layers a reader can turn off in every demo, for a less cluttered map. The playground has its own switches. */
function DemoMapPanel() {
  const { settings, setSettings } = useDemoMapSettings();
  return (
    <Stack gap={6} px="sm" pb="sm" data-demo-map-panel="">
      <SectionLabel>DEMO MAPS</SectionLabel>
      {DEMO_MAP_SWITCHES.map(({ key, label }) => {
        return (
          <Switch
            key={key}
            size="xs"
            label={label}
            checked={settings[key]}
            // The map shows road signs only where it shows roads
            disabled={key === "roadLabels" && !settings.roads}
            onChange={(event) => {
              setSettings({ ...settings, [key]: event.currentTarget.checked });
            }}
          />
        );
      })}
    </Stack>
  );
}

function isDocsRoute(pathname: string): boolean {
  return (
    pathname === "/" || pathname === "/docs" || pathname.startsWith("/docs/")
  );
}

export function AppLayout() {
  const wide = useMediaQuery(WIDE_VIEWPORT, true, {
    getInitialValueInEffect: false,
  });
  // The viewport decides until someone clicks, and then it is their call
  const [navOpen, setNavOpen] = useState<boolean | null>(null);
  const open = navOpen ?? wide;
  const pathname = useRouterState({
    select: (state) => {
      return state.location.pathname;
    },
  });

  useDocumentTitle(titleFor(pathname));

  return (
    <DemoMapSettingsProvider>
      <Flex direction="column" h="100vh" style={{ overflow: "hidden" }}>
        <AppHeader />
        <DocsSearch />

        <Flex flex={1} style={{ minHeight: 0, overflow: "hidden" }}>
          <nav
            style={{
              width: open ? NAV_WIDTH_OPEN : NAV_WIDTH_RAIL,
              flexShrink: 0,
              borderRight: "1px solid var(--mantine-color-default-border)",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <Tooltip
              label={open ? "Hide navigation" : "Show navigation"}
              withArrow
            >
              <Burger
                size="sm"
                opened={open}
                onClick={() => {
                  setNavOpen(!open);
                }}
                aria-label={open ? "Hide navigation" : "Show navigation"}
              />
            </Tooltip>
            {open && <Navigation />}
            {open && isDocsRoute(pathname) && <DemoMapPanel />}
          </nav>

          <main style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <Outlet />
          </main>
        </Flex>
      </Flex>
    </DemoMapSettingsProvider>
  );
}
