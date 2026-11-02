import { useEffect, useState } from "react";

/** How far below the top of the scroll area a heading counts as passed. */
const READING_LINE = 80;

function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * Marks the section being read: the last heading above a line near the top
 * of the scroll area, or the last heading once the page is scrolled to its
 * end, where a short final section never reaches that line.
 *
 * Worked out from the scroll position on every scroll, rather than from a
 * heading crossing a band: a deep link or a search hit lands in the middle of
 * a section with no heading crossing anything, and the section stayed
 * unmarked until the next heading scrolled past.
 */
export function useActiveHeading(slugKey: string): string | undefined {
  const [active, setActive] = useState<string>();

  // The comma-joined slugs rather than the array: a fresh array every render
  // would re-subscribe every render, and slugs cannot contain a comma.
  useEffect(() => {
    const headings = slugKey
      .split(",")
      .map((slug) => document.getElementById(slug))
      .filter((element) => element !== null);

    if (headings.length === 0) return;
    const scroller = scrollParent(headings[0]);

    const update = () => {
      const top = scroller?.getBoundingClientRect().top ?? 0;
      const atEnd =
        scroller !== null &&
        scroller.scrollTop > 0 &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      const passed = headings.filter(
        (heading) => heading.getBoundingClientRect().top - top <= READING_LINE,
      );
      const current = atEnd ? headings.at(-1) : passed.at(-1);
      setActive(current?.id);
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    const target = scroller ?? window;
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [slugKey]);

  return active;
}
