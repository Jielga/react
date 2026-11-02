import { Fragment } from "react";
import { extractHeadings } from "./headings";
import { useActiveHeading } from "./useActiveHeading";
import classes from "./DocsPage.module.css";

/**
 * Where the reader is: the site's trail to the page (section, page), then the
 * `##` section being read. It sits above the scroll area, so a deep link or a
 * search hit that lands halfway down a page still says which page and which
 * section it is.
 */
export function DocsBreadcrumb({
  trail,
  source,
}: {
  trail: ReadonlyArray<string>;
  source: string;
}) {
  const headings = extractHeadings(source).filter(
    (heading) => heading.level === 2,
  );
  const activeSlug = useActiveHeading(
    headings.map((heading) => heading.slug).join(","),
  );
  const active = headings.find((heading) => heading.slug === activeSlug);

  return (
    <nav aria-label="Breadcrumb" className={classes.breadcrumb}>
      <div className={classes.breadcrumbTrail}>
        {trail.map((label, index) => (
          <Fragment key={label}>
            {index > 0 && <span aria-hidden="true">›</span>}
            <span data-current-page={index === trail.length - 1 || undefined}>
              {label}
            </span>
          </Fragment>
        ))}
        {active && (
          <>
            <span aria-hidden="true">›</span>
            <a href={`#${active.slug}`}>{active.text}</a>
          </>
        )}
      </div>
    </nav>
  );
}
