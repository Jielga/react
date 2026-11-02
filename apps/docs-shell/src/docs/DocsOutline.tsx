import classes from "./DocsToc.module.css";
import { useActiveHeading } from "./useActiveHeading";
import { extractHeadings } from "./headings";

/**
 * The `##` headings of the page being read, for a site navigation to show
 * under the page's own link. The same links and the same active marker as the
 * rail, without its `###` entries: in the navigation they sit beside every
 * other page name, and only the top level stays scannable there.
 */
export function DocsOutline({ source }: { source: string }) {
  const headings = extractHeadings(source).filter(
    (heading) => heading.level === 2,
  );
  const active = useActiveHeading(
    headings.map((heading) => heading.slug).join(","),
  );

  // One heading is not an outline, it is a duplicate of the page link.
  if (headings.length < 2) return null;

  return (
    <ul className={classes.list} aria-label="On this page">
      {headings.map((heading) => (
        <li key={heading.slug}>
          <a
            href={`#${heading.slug}`}
            className={classes.link}
            data-active={heading.slug === active || undefined}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  );
}
