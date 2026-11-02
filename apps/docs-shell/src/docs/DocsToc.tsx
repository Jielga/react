import { Text } from "@mantine/core";
import classes from "./DocsToc.module.css";
import { extractHeadings } from "./headings";
import { useActiveHeading } from "./useActiveHeading";

/**
 * The table of contents rail: every `##` and `###` on the page, as deep links.
 *
 * Plain `<a href="#slug">` rather than router links - the target is on this
 * page, so the browser's own anchor handling scrolls the article and writes
 * the hash, which is exactly the shareable deep link that is wanted. The
 * router only wants to hear about navigation between pages.
 */
export function DocsToc({ source }: { source: string }) {
  const headings = extractHeadings(source);
  const active = useActiveHeading(
    headings.map((heading) => heading.slug).join(","),
  );

  // One heading is not a table of contents, it is a duplicate of the title.
  if (headings.length < 2) return null;

  return (
    <nav className={classes.rail} aria-label="On this page">
      <Text className={classes.label} size="xs" fw={600} c="dimmed">
        ON THIS PAGE
      </Text>
      <ul className={classes.list}>
        {headings.map((heading) => (
          <li key={heading.slug}>
            <a
              href={`#${heading.slug}`}
              className={classes.link}
              data-level={heading.level}
              data-active={heading.slug === active || undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
