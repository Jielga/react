import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";
import { BUNDLED_SITES, readSites } from "./sites";

function renderHeader(site: string | null) {
  return render(
    <MantineProvider env="test">
      <SiteHeader site={site} />
    </MantineProvider>,
  );
}

beforeEach(() => {
  // Offline: every runtime read falls back to what the build knows.
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
});

describe("SiteHeader", () => {
  it("names the site it belongs to", () => {
    renderHeader("tmdatagrid");
    expect(
      screen.getByRole("button", { name: "Switch package" }),
    ).toHaveTextContent("TMDataGrid");
  });

  it("links every registered site, and the index of all of them", async () => {
    renderHeader("tmdatagrid");
    await userEvent.click(screen.getByRole("button", { name: "Switch package" }));

    const menu = screen.getByRole("menu");
    for (const site of BUNDLED_SITES) {
      expect(
        within(menu).getByRole("menuitem", { name: new RegExp(site.title) }),
      ).toHaveAttribute("href", `https://jielga.github.io/react/${site.slug}/`);
    }
    expect(
      within(menu).getByRole("menuitem", { name: "All packages" }),
    ).toHaveAttribute("href", "https://jielga.github.io/react/");
  });

  it("shows the version menu on a site, and calls a local build dev", () => {
    renderHeader("react-popup-window");
    expect(
      screen.getByRole("button", { name: "Documentation version" }),
    ).toHaveTextContent("dev");
  });

  it("does not ask npm about an unpublished package", async () => {
    const registry = {
      sites: [
        {
          slug: "unpublished",
          title: "Unpublished",
          description: "d",
          packages: ["@jielga/unpublished"],
          dir: "packages/unpublished",
          app: "apps/unpublished-docs",
          published: false,
        },
      ],
    };
    vi.mocked(fetch).mockImplementation((url) =>
      String(url).endsWith("/sites.json")
        ? Promise.resolve(Response.json(registry))
        : Promise.reject(new Error("offline")),
    );
    renderHeader("unpublished");
    await userEvent.click(
      await screen.findByRole("button", { name: "Documentation version" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Not on npm yet" }),
    ).toBeDisabled();
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.endsWith("/sites.json"))).toBe(true);
    expect(urls.some((url) => url.includes("registry.npmjs.org"))).toBe(false);
  });

  it("has no version menu on the index page", () => {
    renderHeader(null);
    expect(
      screen.queryByRole("button", { name: "Documentation version" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Switch package" }),
    ).toHaveTextContent("@jielga packages");
  });

  it("links a site's GitHub icon to that package's source", () => {
    renderHeader("tmdatagrid");
    expect(
      screen.getByRole("link", { name: "GitHub repository" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/Jielga/react/tree/main/packages/tmdatagrid",
    );
  });
});

describe("readSites", () => {
  it("reads the registry", () => {
    expect(BUNDLED_SITES.map((site) => site.slug)).toEqual([
      "tmdatagrid",
      "react-popup-window",
      "nordic-map",
    ]);
  });

  it("drops a malformed entry and keeps the rest", () => {
    const sites = readSites({
      sites: [
        { slug: "", title: "x" },
        {
          slug: "ok",
          title: "OK",
          description: "d",
          packages: ["@jielga/ok"],
          dir: "packages/ok",
          app: "apps/ok-docs",
        },
      ],
    });
    expect(sites?.map((site) => site.slug)).toEqual(["ok"]);
  });

  it("reads a missing published flag as published", () => {
    const [site] =
      readSites({
        sites: [
          {
            slug: "ok",
            title: "OK",
            description: "d",
            packages: ["@jielga/ok"],
            dir: "packages/ok",
            app: "apps/ok-docs",
          },
        ],
      }) ?? [];
    expect(site?.published).toBe(true);
  });

  it("answers null for something that is not a registry", () => {
    expect(readSites({ entries: [] })).toBeNull();
    expect(readSites(null)).toBeNull();
  });
});
