import type { TMDataGridCellPosition } from "./cellNavigation";

/**
 * A selected rectangle of cells, held as the two cells that span it.
 *
 * Two corners rather than a list of cells, because a range is a gesture, not a
 * set: dragging over 40 columns of a 100k-row grid would otherwise build - and
 * rebuild, on every mouse move - a list with millions of entries in it. Two
 * positions describe the same thing and cost nothing to extend.
 *
 * `anchor` is where the gesture started and stays put; `focus` is the end that
 * moves. Which of the two is top-left depends on the direction it was dragged,
 * so nothing here assumes an order - see {@link resolveRangeBounds}.
 */
export type TMDataGridCellRange = {
  anchor: TMDataGridCellPosition;
  focus: TMDataGridCellPosition;
};

/** The rectangle a range covers, in row and column indices, both ends included. */
export type TMDataGridRangeBounds = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type ResolveRangeBoundsArgs = {
  range: TMDataGridCellRange | null;
  /** Index of a row id among the rows on screen, or `-1`. */
  rowIndexOf: (rowId: string) => number;
  columnIndexOf: (columnId: string) => number;
};

/**
 * Turns a range into the rectangle to paint and copy, or `null` when either
 * corner no longer exists.
 *
 * A corner goes missing whenever a filter drops its row or a column is hidden.
 * There is then no rectangle, rather than a guessed replacement corner that
 * would copy cells the user never selected. The range itself is left alone:
 * clearing it here would discard a selection that returns as soon as the filter
 * is cleared.
 */
export function resolveRangeBounds({
  range,
  rowIndexOf,
  columnIndexOf,
}: ResolveRangeBoundsArgs): TMDataGridRangeBounds | null {
  if (range === null) return null;

  const anchorRow = rowIndexOf(range.anchor.rowId);
  const focusRow = rowIndexOf(range.focus.rowId);
  const anchorColumn = columnIndexOf(range.anchor.columnId);
  const focusColumn = columnIndexOf(range.focus.columnId);
  if (
    anchorRow < 0 ||
    focusRow < 0 ||
    anchorColumn < 0 ||
    focusColumn < 0
  ) {
    return null;
  }

  return {
    top: Math.min(anchorRow, focusRow),
    bottom: Math.max(anchorRow, focusRow),
    left: Math.min(anchorColumn, focusColumn),
    right: Math.max(anchorColumn, focusColumn),
  };
}

/**
 * Whether a cell is inside the rectangle.
 *
 * A cell spanning several columns (`meta.colSpan`) is addressed by its first
 * column: it is inside when that column is, and a rectangle over only the
 * columns it covers leaves it out.
 */
export function isWithinBounds(
  bounds: TMDataGridRangeBounds | null,
  rowIndex: number,
  columnIndex: number,
): boolean {
  if (bounds === null) return false;
  return (
    rowIndex >= bounds.top &&
    rowIndex <= bounds.bottom &&
    columnIndex >= bounds.left &&
    columnIndex <= bounds.right
  );
}

/** How many cells the rectangle covers. `0` for no range at all. */
export function boundsCellCount(bounds: TMDataGridRangeBounds | null): number {
  if (bounds === null) return 0;
  return (
    (bounds.bottom - bounds.top + 1) * (bounds.right - bounds.left + 1)
  );
}

/**
 * Which edges of the rectangle a cell lies on, for the outline.
 *
 * The border is drawn per cell rather than as one box over the top, because the
 * body is a scrolling CSS grid with sticky columns in it: an overlay would have
 * to be positioned against a moving target and would still be wrong the moment
 * a pinned lane slid over it. Four booleans per cell need no positioning at all.
 */
export function boundsEdges(
  bounds: TMDataGridRangeBounds | null,
  rowIndex: number,
  columnIndex: number,
  lastColumnIndex: number = columnIndex,
): { top: boolean; bottom: boolean; left: boolean; right: boolean } | null {
  if (!isWithinBounds(bounds, rowIndex, columnIndex) || bounds === null) {
    return null;
  }
  // A cell spanning columns up to `lastColumnIndex` is one box: the
  // rectangle's right edge falling anywhere inside it is drawn on its side.
  return {
    top: rowIndex === bounds.top,
    bottom: rowIndex === bounds.bottom,
    left: columnIndex === bounds.left,
    right: bounds.right <= lastColumnIndex,
  };
}
