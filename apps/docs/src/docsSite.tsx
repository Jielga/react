import { Link } from "@tanstack/react-router";
import type { DocsSite } from "docs-shell/docs/DocsSite.ts";
import { loadDemo, loadSharedSource } from "./examples/demoRegistry";

/**
 * What this site hands the shared docs renderer: its demo registry, and links
 * that go through the router - client-side navigation, and the deploy base path
 * (the site lives under /react/ on GitHub Pages) handled by the router rather
 * than by hand.
 */
export const docsSite: DocsSite = {
  loadDemo,
  loadSharedSource,
  renderLink: ({ href, children }) => {
    // `/docs/grouping#aggregation` - the router wants the two halves
    // apart, and passing the whole string as `to` would look for a
    // route with a hash in its path.
    const [to, hash] = href.split("#");
    return (
      <Link to={to} hash={hash}>
        {children}
      </Link>
    );
  },
};
