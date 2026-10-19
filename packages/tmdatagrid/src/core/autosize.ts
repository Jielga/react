import type { RowData } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridTable } from "../useTMDataGrid";
import { DEFAULT_COLUMN_MIN_SIZE } from "./columnUtils";
import { isHTMLElement } from "./dom";

/**
 * Room the header keeps for its hover-revealed actions (sort arrow, menu) and
 * the resize divider, which measure zero while idle. Without it a column sized
 * exactly to its header text puts the actions on top of the title.
 */
const HEADER_ACTIONS_ALLOWANCE = 30;

/** Breathing room so the widest value does not touch the next divider. */
const CONTENT_ALLOWANCE = 2;

/**
 * What the content inside one cell actually spans, in px.
 *
 * A Range over the children rather than the span's `scrollWidth`, because the
 * two disagree in opposite directions: a left-aligned cell stretches its
 * content span to fill the cell (`flex: 1 1 auto`), so `scrollWidth` reports
 * the stretched box and autosize could never *shrink* a column - while for
 * clipped content both see past the `overflow: hidden`. The Range measures
 * the laid-out text and elements themselves, whatever box they sit in.
 *
 * `scrollWidth` stays as the fallback for environments whose Ranges do not
 * measure (jsdom reports 0 there).
 */
function contentSpanWidth(content: HTMLElement): number {
  // The cell's own document, not the global one: a Range from the opener's
  // document cannot select nodes in a window opened with `window.open`.
  const range = content.ownerDocument.createRange();
  range.selectNodeContents(content);
  // jsdom's Range has no getBoundingClientRect at all, hence the guard
  // rather than a zero-check alone.
  const width =
    typeof range.getBoundingClientRect === "function"
      ? range.getBoundingClientRect().width
      : 0;
  return width > 0 ? width : content.scrollWidth;
}

/**
 * One column's body cells that are currently in the DOM.
 *
 * `measurable` leaves out the cells spanning several columns (`meta.colSpan`):
 * such a cell says nothing about this one column's width.
 */
function mountedCells(
  container: HTMLElement,
  columnId: string,
  { measurable }: { measurable: boolean },
): NodeListOf<HTMLElement> {
  const id = CSS.escape(columnId);
  const unspanned = measurable ? ":not([data-col-span])" : "";
  return container.querySelectorAll<HTMLElement>(
    `[role="cell"][data-column-id="${id}"]${unspanned},` +
      `[role="gridcell"][data-column-id="${id}"]${unspanned}`,
  );
}

/**
 * Whether this column has any body cell in the DOM.
 *
 * A caller sizing a column on its own schedule rather than from a gesture has
 * to ask: the virtualizer mounts its first rows a render *after* the grid
 * itself mounts, and a measurement taken before that fits the header alone.
 *
 * A spanning cell counts. A column whose every mounted cell spans has its
 * rows, and measuring it fits the header, which is the width it gets; left
 * out, the column would wait for cells that never come.
 */
export function hasMountedCells(
  container: HTMLElement,
  columnId: string,
): boolean {
  return mountedCells(container, columnId, { measurable: false }).length > 0;
}

/**
 * Widest rendered content of one column, in px, measured from the DOM.
 *
 * Mounted cells only: under virtualization the unmounted rows do not exist to
 * be measured, so this reads the visible window plus overscan - the same
 * trade AG Grid's autosize makes by default. With no rows mounted at all the
 * header is the only thing left to measure, which is a width that fits the
 * title and nothing else - see `hasMountedCells`.
 */
export function measureColumnContentWidth({
  container,
  columnId,
}: {
  /** The grid's scroll container - anything enclosing the column's cells. */
  container: HTMLElement;
  columnId: string;
}): number {
  let widest = 0;

  for (const cell of mountedCells(container, columnId, { measurable: true })) {
    const content = cell.firstElementChild;
    if (!isHTMLElement(content)) continue;
    const styles = getComputedStyle(cell);
    const padding =
      (Number.parseFloat(styles.paddingLeft) || 0) +
      (Number.parseFloat(styles.paddingRight) || 0);
    widest = Math.max(
      widest,
      contentSpanWidth(content) + padding + CONTENT_ALLOWANCE,
    );
  }

  const title = container.querySelector<HTMLElement>(
    `[data-column-id="${CSS.escape(columnId)}"] [data-dg-header-title]`,
  );
  if (title) {
    const header = title.closest<HTMLElement>('[role="columnheader"]');
    const styles = header ? getComputedStyle(header) : null;
    const padding = styles
      ? (Number.parseFloat(styles.paddingLeft) || 0) +
        (Number.parseFloat(styles.paddingRight) || 0)
      : 0;
    widest = Math.max(
      widest,
      contentSpanWidth(title) + padding + HEADER_ACTIONS_ALLOWANCE,
    );
  }

  return widest;
}

/**
 * Sizes a column to its widest mounted content - what double-clicking the
 * resize divider does, exported so a menu item or consumer code can trigger
 * the same thing.
 *
 * The width lands in `columnSizing`, so it persists with the other widths and
 * a later resize drag takes over from it. Clamped to the column's
 * `minSize`/`maxSize`; a no-op (returning `false`) for a column that cannot
 * be resized or has nothing mounted to measure.
 */
export function autosizeColumn<TData extends RowData>({
  table,
  columnId,
  container,
}: {
  table: TMDataGridTable<TData>;
  columnId: string;
  container: HTMLElement;
}): boolean {
  const erased = table as unknown as TMDataGridTable<TMDataGridRowData>;
  const column = erased.getColumn(columnId);
  if (!column || !column.getCanResize()) return false;

  const measured = measureColumnContentWidth({ container, columnId });
  if (measured <= 0) return false;

  const minSize = column.columnDef.minSize ?? DEFAULT_COLUMN_MIN_SIZE;
  const maxSize = column.columnDef.maxSize ?? Number.POSITIVE_INFINITY;
  const width = Math.round(Math.min(Math.max(measured, minSize), maxSize));

  erased.setColumnSizing((previous) => ({ ...previous, [columnId]: width }));
  return true;
}
