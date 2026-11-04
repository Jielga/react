import { describe, expect, it, vi } from "vitest";
import SOURCE from "../static/docs-spa-path.js?raw";

/**
 * `static/docs-spa-path.js` is what makes a deep link into a site, or into one
 * of its copies, land in that copy. It ships as plain JS outside every bundle,
 * so nothing else typechecks it or runs it: this is its only cover.
 *
 * The script reads `window.location`, `history` and `document.currentScript`
 * and nothing else, so the test hands it those three rather than fighting
 * jsdom over a location it refuses to let go of.
 */

const PAGES_ROOT = "/react/";

type Attributes = Record<string, string>;

/** The root's 404 page, as the deploy writes it. */
const ROUTER: Attributes = {
  "data-site-root": PAGES_ROOT,
  "data-sites": "tmdatagrid react-popup-window",
  "data-legacy-site": "tmdatagrid",
};

/** A copy of the grid site, as the deploy stamps it. */
function copy(slug: string): Attributes {
  return { "data-site-root": "/react/tmdatagrid/", "data-slug": slug };
}

function run({ attributes, url }: { attributes: Attributes; url: string }) {
  const parsed = new URL(url, "https://example.test");
  const replace = vi.fn();
  const replaceState = vi.fn();

  const location = {
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    replace,
  };
  const currentScript = {
    getAttribute: (name: string) => attributes[name] ?? null,
  };

  new Function("window", "document", "history", SOURCE)(
    { location },
    { currentScript },
    { replaceState },
  );

  return {
    /** Where it sent the browser, or null when it left the URL alone. */
    sentTo: replace.mock.calls[0]?.[0] ?? null,
    /** The URL it settled on in place, or null when it did not. */
    settledOn: replaceState.mock.calls[0]?.[2] ?? null,
  };
}

describe("the root's 404 page", () => {
  it("sends a deep link into a site to that site's front copy", () => {
    expect(
      run({ attributes: ROUTER, url: "/react/tmdatagrid/docs/testing" })
        .sentTo,
    ).toBe("/react/tmdatagrid/?/docs/testing");
  });

  it("sends a version's deep link to that version", () => {
    expect(
      run({ attributes: ROUTER, url: "/react/tmdatagrid/next/docs/testing" })
        .sentTo,
    ).toBe("/react/tmdatagrid/next/?/docs/testing");
  });

  it("sends a branch build's deep link to that build", () => {
    expect(
      run({
        attributes: ROUTER,
        url: "/react/react-popup-window/b/feat/examples",
      }).sentTo,
    ).toBe("/react/react-popup-window/b/feat/?/examples");
  });

  // The grid site used to be served from the Pages root itself.
  it("sends a path under no site to the legacy site", () => {
    expect(
      run({ attributes: ROUTER, url: "/react/docs/xlsx" }).sentTo,
    ).toBe("/react/tmdatagrid/?/docs/xlsx");
    expect(
      run({ attributes: ROUTER, url: "/react/v2.0/docs/columns" }).sentTo,
    ).toBe("/react/tmdatagrid/v2.0/?/docs/columns");
  });

  it("leaves a path under no site alone without a legacy site", () => {
    const { "data-legacy-site": _, ...attributes } = ROUTER;
    expect(run({ attributes, url: "/react/docs/xlsx" }).sentTo).toBeNull();
  });

  it("adds the slash a site's own path is missing", () => {
    expect(
      run({ attributes: ROUTER, url: "/react/react-popup-window?a=1" }).sentTo,
    ).toBe("/react/react-popup-window/?a=1");
  });

  it("carries a query and a hash across the round trip", () => {
    const out = run({
      attributes: ROUTER,
      url: "/react/tmdatagrid/v2.0/docs/testing?a=1&b=2#parts",
    });
    expect(out.sentTo).toBe(
      "/react/tmdatagrid/v2.0/?/docs/testing&a=1~and~b=2#parts",
    );

    expect(run({ attributes: copy("v2.0"), url: out.sentTo! }).settledOn).toBe(
      "/react/tmdatagrid/v2.0/docs/testing?a=1&b=2#parts",
    );
  });

  // A parked path that reaches the 404 page again names a copy that is not
  // deployed. Sending it on would loop.
  it("stops at a parked path", () => {
    expect(
      run({ attributes: ROUTER, url: "/react/tmdatagrid/v9.9/?/docs/x" })
        .sentTo,
    ).toBeNull();
  });

  it("says nothing about a path outside the Pages root", () => {
    expect(
      run({ attributes: ROUTER, url: "/somewhere/else" }).sentTo,
    ).toBeNull();
  });
});

describe("a copy", () => {
  it("puts the parked path back before the router reads it", () => {
    expect(
      run({
        attributes: copy("next"),
        url: "/react/tmdatagrid/next/?/docs/testing",
      }).settledOn,
    ).toBe("/react/tmdatagrid/next/docs/testing");
  });

  // A copy's index is a real file, so it is served rather than missed.
  it("leaves its own front page alone", () => {
    const out = run({ attributes: copy("next"), url: "/react/tmdatagrid/next/" });
    expect(out.sentTo).toBeNull();
    expect(out.settledOn).toBeNull();
  });

  it("never redirects", () => {
    expect(
      run({ attributes: copy("root"), url: "/react/tmdatagrid/next/docs/x" })
        .sentTo,
    ).toBeNull();
  });
});
