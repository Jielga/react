import type {
  Column,
  ColumnPinningPosition,
  ColumnPinningState,
} from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import { isColumnReorderable, isGeneratedColumn } from "./columnUtils";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

type GridColumn = Column<TMDataGridFeatures, TMDataGridRowData, unknown>;
type GridTable = TMDataGridTable<TMDataGridRowData>;

/**
 * The lane a column renders in.
 *
 * Pinning splits the grid into three, and TanStack sequences them from two
 * different state slices: `columnPinning.start` / `.end` order the pinned
 * lanes, `columnOrder` orders the centre. A move therefore always stays inside
 * one lane - moving a column into another one would be a pin, not a reorder.
 */
export type TMDataGridColumnRegion = "start" | "center" | "end";

/** Which edge of the column under the pointer a dragged column lands on. */
export type TMDataGridDropSide = "before" | "after";

export function getColumnRegion(
  columnPinning: ColumnPinningState,
  columnId: string,
): TMDataGridColumnRegion {
  if (columnPinning.start.includes(columnId)) return "start";
  if (columnPinning.end.includes(columnId)) return "end";
  return "center";
}

/**
 * TanStack's pinned regions are logical: `start` and `end` follow the writing
 * direction. The grid's own vocabulary - its sticky CSS, the `data-pinned`
 * attribute, the column menu's "Pin left" and "Pin right" - is physical, and
 * the grid renders left to right only. This translates between the pair:
 * `left` maps to `start` and `right` to `end`.
 */
export function pinningPositionOfSide(
  side: "left" | "right" | false,
): ColumnPinningPosition {
  if (side === "left") return "start";
  if (side === "right") return "end";
  return false;
}

/** Moves one id next to another, leaving every other id in place. */
function moveInList(
  ids: ReadonlyArray<string>,
  movedId: string,
  targetId: string,
  side: TMDataGridDropSide,
): Array<string> {
  const remaining = ids.filter((id) => id !== movedId);
  const targetIndex = remaining.indexOf(targetId);
  if (targetIndex === -1) return [...ids];
  remaining.splice(side === "before" ? targetIndex : targetIndex + 1, 0, movedId);
  return remaining;
}

export type MoveColumnArgs = {
  table: GridTable;
  /** Column being moved. */
  columnId: string;
  /** Column it was dropped on. */
  targetId: string;
  side: TMDataGridDropSide;
};

/**
 * Moves a column next to another one. A no-op when the two are in different
 * pinned regions, or when either id is unknown.
 *
 * `columnOrder` is always written as the full leaf order, including hidden and
 * pinned columns, so a column keeps its place when it is later shown or
 * unpinned. Pinned lanes are read from `columnPinning`, so a move inside one
 * updates that array as well.
 */
export function moveColumn({
  table,
  columnId,
  targetId,
  side,
}: MoveColumnArgs): void {
  if (columnId === targetId) return;

  const columnPinning = table.store.state.columnPinning;
  const region = getColumnRegion(columnPinning, columnId);
  if (region !== getColumnRegion(columnPinning, targetId)) return;

  const leafIds = table.getAllLeafColumns().map((column) => column.id);
  table.setColumnOrder(moveInList(leafIds, columnId, targetId, side));

  if (region !== "center") {
    table.setColumnPinning((previous) => ({
      ...previous,
      [region]: moveInList(previous[region], columnId, targetId, side),
    }));
  }
}

/**
 * Puts the generated lanes back on the outside of both pinned lanes: the ones
 * on the left before every consumer column, the edit lane after all of them.
 *
 * `column.pin("end")` appends, so pinning a column right would otherwise drop
 * it outside the edit lane, so the row's Save and Delete would no longer be
 * last in the row. Pinning left appends too, which is already correct there,
 * but the same pass keeps both lanes in place whatever a consumer writes into
 * `columnPinning` directly.
 *
 * Relative order is preserved inside each part, so a user's own arrangement of
 * the pinned columns survives.
 */
export function keepGeneratedColumnsOutermost(
  pinning: ColumnPinningState,
): ColumnPinningState {
  const generated = (id: string) => isGeneratedColumn(id);
  return {
    start: [
      ...pinning.start.filter(generated),
      ...pinning.start.filter((id) => !generated(id)),
    ],
    end: [
      ...pinning.end.filter((id) => !generated(id)),
      ...pinning.end.filter(generated),
    ],
  };
}

/** Visible leaf columns of one lane, in the order they render. */
function getRegionColumns(
  table: GridTable,
  region: TMDataGridColumnRegion,
): Array<GridColumn> {
  if (region === "start") return table.getStartVisibleLeafColumns();
  if (region === "end") return table.getEndVisibleLeafColumns();
  return table.getCenterVisibleLeafColumns();
}

export type ColumnStepArgs = {
  table: GridTable;
  columnId: string;
  /** `-1` moves towards the start of the lane, `1` towards its end. */
  direction: -1 | 1;
};

/**
 * The column a single step would swap with, or `null` when there is none.
 *
 * A neighbour that cannot be reordered acts as a wall rather than being skipped
 * - that is what keeps the checkbox column anchored at the start of the left
 * lane. Use it to enable or disable a "move" control.
 */
export function getStepTargetColumn({
  table,
  columnId,
  direction,
}: ColumnStepArgs): GridColumn | null {
  const region = getColumnRegion(table.store.state.columnPinning, columnId);
  const columns = getRegionColumns(table, region);
  const index = columns.findIndex((column) => column.id === columnId);
  if (index === -1) return null;

  const target = columns[index + direction];
  if (!target || !isColumnReorderable(target)) return null;
  return target;
}

/** Moves a column one position within its lane. Hidden columns are stepped over. */
export function moveColumnByStep({
  table,
  columnId,
  direction,
}: ColumnStepArgs): void {
  const target = getStepTargetColumn({ table, columnId, direction });
  if (!target) return;

  moveColumn({
    table,
    columnId,
    targetId: target.id,
    side: direction === -1 ? "before" : "after",
  });
}
