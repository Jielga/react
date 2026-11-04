import type { ColumnDef, RowData } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";

export const ROW_NUMBER_COLUMN_ID = "__rowNumber__";

/**
 * The generated row-number gutter, prepended under `enableRowNumbers` -
 * outermost left, before even the checkbox lane, the way a spreadsheet keeps
 * its gutter outside everything.
 *
 * The def renders nothing itself: a cell cannot know its display position,
 * so the body computes the numbers - one pass over the view, group rows
 * skipped (they are headings over the rows being counted), continuing across
 * pages - and substitutes them in. See `TMDataGridTable`.
 *
 * A system lane: fixed width, no menu, no resize, never exported, and its
 * visibility follows the option rather than the columns panel.
 */
export function createRowNumberColumn<TData extends RowData>(
  label = "Row number",
): ColumnDef<TMDataGridFeatures, TData, unknown> {
  return {
    id: ROW_NUMBER_COLUMN_ID,
    meta: {
      label,
      align: "center",
      // Anchors the left edge with the checkbox lane; nothing moves past it.
      enableOrdering: false,
    },
    size: 48,
    minSize: 48,
    maxSize: 48,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enablePinning: false,
    enableHiding: false,
    header: () => "#",
    // The body substitutes the number; a row without one - a group row -
    // falls through to this.
    cell: () => null,
  };
}
