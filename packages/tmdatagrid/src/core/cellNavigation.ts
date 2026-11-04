/**
 * Which cell has the focus, by id rather than by position.
 *
 * Ids, because every other thing the grid does moves cells around: sorting
 * reorders rows, filtering removes them, dragging a header reorders columns. A
 * coordinate pair would silently come to mean a different cell after any of
 * them, while a pair of ids either still resolves or does not resolve at all,
 * and the grid handles "does not resolve" explicitly.
 *
 * Indices are what navigation is actually computed in, so they are resolved
 * from the ids on each keystroke and turned straight back. See resolveCellMove.
 */
export type TMDataGridCellPosition = {
  rowId: string;
  columnId: string;
};

/** Where the focused cell sits in the rows and columns on screen. */
export type TMDataGridCellCoords = {
  rowIndex: number;
  columnIndex: number;
};

export type ResolveCellMoveArgs = {
  /** `KeyboardEvent.key`. */
  key: string;
  /** Ctrl or Cmd - Home and End jump to the corner rather than the row end. */
  ctrlKey: boolean;
  from: TMDataGridCellCoords;
  rowCount: number;
  columnCount: number;
  /**
   * How far PageUp and PageDown travel: one viewport of rows. Passed in rather
   * than assumed, since only the body knows how tall it is.
   */
  pageRows: number;
};

const clamp = (value: number, max: number) =>
  Math.min(Math.max(value, 0), Math.max(max, 0));

/**
 * The next cell for a navigation key, or `null` when the key is not one.
 *
 * Moves clamp at the edges instead of wrapping. Wrapping suits a menu, where
 * the items are a short ring; a grid is a coordinate space, and a Right at the
 * last column that lands on the first column of the next row loses the one
 * thing arrow keys are for - knowing where you will end up without looking.
 *
 * A clamped move returns the position it started from rather than `null`. The
 * caller still needs to know the key was handled: an arrow at the last row must
 * not fall through to the scroll container, which would scroll the body out
 * from under a focus that did not move.
 */
export function resolveCellMove({
  key,
  ctrlKey,
  from,
  rowCount,
  columnCount,
  pageRows,
}: ResolveCellMoveArgs): TMDataGridCellCoords | null {
  if (rowCount === 0 || columnCount === 0) return null;

  const lastRow = rowCount - 1;
  const lastColumn = columnCount - 1;
  const at = (rowIndex: number, columnIndex: number): TMDataGridCellCoords => ({
    rowIndex: clamp(rowIndex, lastRow),
    columnIndex: clamp(columnIndex, lastColumn),
  });

  switch (key) {
    case "ArrowDown":
      return at(from.rowIndex + 1, from.columnIndex);
    case "ArrowUp":
      return at(from.rowIndex - 1, from.columnIndex);
    case "ArrowRight":
      return at(from.rowIndex, from.columnIndex + 1);
    case "ArrowLeft":
      return at(from.rowIndex, from.columnIndex - 1);
    case "PageDown":
      return at(from.rowIndex + Math.max(pageRows, 1), from.columnIndex);
    case "PageUp":
      return at(from.rowIndex - Math.max(pageRows, 1), from.columnIndex);
    // Ctrl+Home / Ctrl+End address the grid, plain Home / End the row - the
    // convention every spreadsheet and APG's own grid pattern share.
    case "Home":
      return ctrlKey ? at(0, 0) : at(from.rowIndex, 0);
    case "End":
      return ctrlKey ? at(lastRow, lastColumn) : at(from.rowIndex, lastColumn);
    default:
      return null;
  }
}

export type NextEditableCellArgs = {
  from: TMDataGridCellCoords;
  /** `1` is Tab, `-1` is Shift+Tab. */
  direction: 1 | -1;
  rowCount: number;
  columnCount: number;
  /** Whether the cell at these coordinates takes edits. */
  isEditable: (coords: TMDataGridCellCoords) => boolean;
};

/**
 * The next editable cell in reading order, wrapping to the next row - and
 * from the last cell of the grid back to the first. `null` when no other
 * cell is editable.
 *
 * Deliberately wrapping where {@link resolveCellMove} deliberately clamps:
 * arrows are a coordinate space and clamp so the destination is predictable,
 * but Tab mid-edit is the spreadsheet's "next field" - at the end of a row
 * the next field is on the next row, which is a convention, not a surprise.
 */
export function getNextEditableCell({
  from,
  direction,
  rowCount,
  columnCount,
  isEditable,
}: NextEditableCellArgs): TMDataGridCellCoords | null {
  const total = rowCount * columnCount;
  if (total === 0) return null;
  const start = from.rowIndex * columnCount + from.columnIndex;
  for (let step = 1; step < total; step += 1) {
    const index = (start + direction * step + total * step) % total;
    const coords = {
      rowIndex: Math.floor(index / columnCount),
      columnIndex: index % columnCount,
    };
    if (isEditable(coords)) return coords;
  }
  return null;
}

/** Whether two positions address the same cell. `null` equals only `null`. */
export function isSameCell(
  a: TMDataGridCellPosition | null,
  b: TMDataGridCellPosition | null,
): boolean {
  if (a === null || b === null) return a === b;
  return a.rowId === b.rowId && a.columnId === b.columnId;
}
