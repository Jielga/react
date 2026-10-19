import { isGeneratedColumn } from "./columnUtils";

/** Which pinned block a displayed column sits in. */
export type TMDataGridColumnSection = "left" | "center" | "right";

/**
 * How wide each displayed cell of one row is, in columns.
 *
 * `spans[i]` is `n >= 1` for a cell that renders and covers `n` tracks from
 * column `i` rightwards, and `0` for a cell covered by one to its left, which
 * does not render. The array runs in display order, the order of
 * `orderedColumns`, and its entries always sum to the column count.
 *
 * A span stops short at the first column it may not cover:
 *
 * - a generated lane - the checkbox, tree, details and edit lanes stay
 *   where they are whatever a data cell asks for, which is also why
 *   `Infinity` reads as "to the last of my columns";
 * - the edge of the cell's pinned block - a pinned cell is sticky at the
 *   offset of its own column, and one stretching into the scrolling centre
 *   would slide over the cells it is meant to leave.
 *
 * A generated lane never spans, and a request below 1, or one that is not a
 * number, is 1.
 */
export function resolveColSpans(
  columns: ReadonlyArray<{ id: string; section: TMDataGridColumnSection }>,
  requestedSpan: (columnIndex: number) => number,
): Array<number> {
  const spans: Array<number> = [];
  let index = 0;
  while (index < columns.length) {
    const column = columns[index]!;
    const requested = isGeneratedColumn(column.id) ? 1 : requestedSpan(index);
    const wanted =
      typeof requested === "number" && requested >= 1
        ? Math.floor(requested)
        : 1;
    let span = 1;
    while (span < wanted) {
      const next = columns[index + span];
      if (
        next === undefined ||
        next.section !== column.section ||
        isGeneratedColumn(next.id)
      ) {
        break;
      }
      span += 1;
    }
    spans.push(span);
    for (let covered = 1; covered < span; covered += 1) spans.push(0);
    index += span;
  }
  return spans;
}

/**
 * The column a position on a row lands on once spans are applied: itself
 * when its cell renders, otherwise the spanning cell covering it.
 */
export function spanAnchorIndex(
  spans: ReadonlyArray<number>,
  columnIndex: number,
): number {
  let index = columnIndex;
  while (index > 0 && spans[index] === 0) index -= 1;
  return index;
}

/** The last column the cell at `columnIndex` covers - itself when unspanned. */
export function spanEndIndex(
  spans: ReadonlyArray<number>,
  columnIndex: number,
): number {
  const anchor = spanAnchorIndex(spans, columnIndex);
  return anchor + Math.max(1, spans[anchor] ?? 1) - 1;
}
