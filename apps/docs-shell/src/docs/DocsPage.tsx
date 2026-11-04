import { Box, Table, Typography } from "@mantine/core";
import { useEffect, type ComponentPropsWithoutRef } from "react";
import Markdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { DocsBreadcrumb } from "./DocsBreadcrumb";
import { DemoBlock } from "./DemoBlock";
import { splitDemoFences } from "./demoFence";
import { useDocsLinkRenderer } from "./DocsSite";
import { DocsToc } from "./DocsToc";
import { headingSlug, nodeText } from "./headings";
import { rehypeReferenceRows } from "./referenceRows";
import classes from "./DocsPage.module.css";

/** ```tsx → "tsx". Anything unrecognised falls back to plain text. */
function languageFromClassName(className: string | undefined): string {
  const match = /language-(\w+)/.exec(className ?? "");
  return match ? match[1] : "text";
}

/**
 * Headings carry their slug as an id. Without this every `#anchor` on the
 * site is dead - react-markdown emits no ids of its own, which is how the
 * docs accumulated 18 links pointing at nothing.
 *
 * Each heading also ends in a `#` link to itself, so a deep link can be copied
 * from any heading, not only from the table of contents, which a narrow
 * viewport hides. The link sits inside the heading with an `aria-label`, as
 * VitePress and Docusaurus place theirs. A plain `href="#slug"`, like the
 * rail's: the browser scrolls and writes the hash itself.
 */
function heading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return ({ children, ...props }: ComponentPropsWithoutRef<"h2">) => {
    const slug = headingSlug(children);
    return (
      <Tag id={slug} {...props}>
        {children}
        <a
          href={`#${slug}`}
          className={classes.headingAnchor}
          aria-label={`Link to "${nodeText(children)}"`}
        >
          #
        </a>
      </Tag>
    );
  };
}

/**
 * A root-relative link points somewhere else on this site, so it goes through
 * the site's `renderLink` - on a site with a router, client-side navigation and
 * the deploy base path (the site lives under /react/ on GitHub Pages) handled
 * by the router rather than by hand. Anything else (an external URL, an
 * in-page anchor) is left alone.
 */
function MarkdownLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const renderLink = useDocsLinkRenderer();

  if (!href?.startsWith("/") || !renderLink) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  return renderLink({ href, children });
}

const markdownComponents: Components = {
  // Mantine's Table gets the borders and spacing right, and gives
  // wide prop tables their own horizontal scroll.
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <Table.ScrollContainer
      minWidth={520}
      type="native"
      className={classes.tableBlock}
    >
      <Table striped withTableBorder withColumnBorders {...props} />
    </Table.ScrollContainer>
  ),
  // Fenced blocks go through the same highlighter the examples
  // use, so docs and demos show code identically - and every
  // snippet in the docs gets a copy button.
  code: ({ className, children, ...props }: ComponentPropsWithoutRef<"code">) => {
    // Inline code has no language class; only fences do.
    if (!className?.startsWith("language-")) {
      return <code {...props}>{children}</code>;
    }
    // Every top-level demo fence was lifted out before the markdown render;
    // one arriving here means `splitDemoFences` missed it, and a loud failure
    // beats a demo quietly rendering as its own source text.
    if (className === "language-demo") {
      throw new Error("Demo fence reached the markdown renderer unsplit.");
    }
    return (
      <CodeBlock
        code={String(children)}
        language={languageFromClassName(className)}
      />
    );
  },
  // react-markdown wraps a fence in <pre><code>; the block brings its own, so
  // rendering this one would nest a scroller inside a scroller. It becomes a
  // plain div instead of a fragment because something has to carry the block's
  // vertical margin: Mantine's `CodeHighlight` zeroes its own, and Typography
  // styles `pre`, which never reaches the DOM here. Without it the block takes
  // its gap above from the paragraph's margin-bottom and has none below.
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
    <div className={classes.fence}>{children}</div>
  ),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  a: MarkdownLink,
};

type PluggableList = NonNullable<Options["rehypePlugins"]>;

const REHYPE_PLUGINS: PluggableList = [
  [rehypeReferenceRows, { anchorClass: classes.rowAnchor }],
];

/**
 * The markdown renderer every prose page of a site shares - on the grid site,
 * the docs routes and the getting-started front page. Mantine's `Typography` styles the raw HTML that
 * react-markdown emits, so the markdown stays plain - no MDX, no component
 * imports in the content.
 *
 * Each demo stands *between* Typography blocks, never inside one. Typography's
 * `:first-child` / `:last-child` margin rules match every descendant, and
 * inside a component they win on specificity - Mantine centres the Checkbox
 * icon with `margin: auto`, and under Typography the check sat pinned to the
 * bottom of the box. `my="xl"` is the demo's own spacing; without it the Code
 * button rides up against the snippet above and reads as belonging to it.
 */
export function DocsMarkdown({ source }: { source: string }) {
  return (
    <>
      {splitDemoFences(source).map((segment, index) =>
        segment.kind === "demo" ? (
          <Box key={index} my="xl">
            <DemoBlock demo={segment.demo} />
          </Box>
        ) : (
          <Typography key={index}>
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={REHYPE_PLUGINS}
              components={markdownComponents}
            >
              {segment.markdown}
            </Markdown>
          </Typography>
        ),
      )}
    </>
  );
}

/**
 * Renders a documentation page: the markdown in the docs measure, with the
 * table of contents beside it where the viewport is wide enough.
 *
 * The rail is inside the scroller rather than outside it so that `position:
 * sticky` has this scroll container to stick within - and so an anchor jump
 * scrolls the article under a rail that stays put.
 */
export function DocsPage({
  source,
  toc = true,
  breadcrumb,
}: {
  source: string;
  /** `false` leaves the rail out, for a site that lists the headings in its own navigation. */
  toc?: boolean;
  /** The trail to this page, such as section and page label, shown above the scroll area with the section being read. */
  breadcrumb?: ReadonlyArray<string>;
}) {
  // A pasted `/docs/grouping#aggregation` asks the browser to scroll to an
  // element React has not rendered yet, and a router navigation writes the
  // hash with `pushState`, which neither scrolls nor moves `:target`. Doing the
  // fragment navigation again once the page is rendered does both, and it
  // replaces the history entry rather than adding one.
  useEffect(() => {
    const { hash } = window.location;
    const target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target && !target.matches(":target")) window.location.replace(hash);
  }, [source]);

  return (
    <div className={classes.page}>
      {breadcrumb && <DocsBreadcrumb trail={breadcrumb} source={source} />}
      <div className={classes.scroller}>
        <div className={classes.layout}>
          <article className={classes.article}>
            <DocsMarkdown source={source} />
          </article>
          {toc && <DocsToc source={source} />}
        </div>
      </div>
    </div>
  );
}
