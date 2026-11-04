import { Link } from "@tanstack/react-router";
import type { DocsSite } from "docs-shell/docs/DocsSite.ts";
import { loadDemo, loadSharedSource } from "./examples/demoRegistry.ts";

/** What this site hands the shared docs renderer: its demos, and links that go through the router */
export const docsSite: DocsSite = {
  loadDemo,
  loadSharedSource,
  renderLink: ({ href, children }) => {
    // `/docs/pins#labels`: the router takes the path and the hash apart
    const [to, hash] = href.split("#");
    return (
      <Link to={to} hash={hash}>
        {children}
      </Link>
    );
  },
};
