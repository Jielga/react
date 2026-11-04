import type { Row } from "@tanstack/react-table";
import {
  getDefaultOperator,
  getOperatorsForType,
  type TMDataGridColumnType,
  type TMDataGridFilterOperator,
} from "./filterOperators";
import { DETAILS_COLUMN_ID } from "../components/TMDataGridDetailsColumn";
import { EDIT_COLUMN_ID } from "../components/TMDataGridEditColumn";
import { GROUP_COLUMN_ID } from "../components/TMDataGridGroupColumn";
import { ROW_NUMBER_COLUMN_ID } from "../components/TMDataGridRowNumberColumn";
import { SELECT_COLUMN_ID } from "../components/TMDataGridSelectColumn";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridColumnMeta, TMDataGridFeatures } from "../useTMDataGrid";
import type { TMDataGridFilterControlComponent } from "./filterControls";

/**
 * Structural shape of the column bits the chrome reads. Kept minimal so these
 * helpers work with any `Column`/`Header` instance without dragging generics
 * through every call site.
 */
type ColumnLike = {
  id: string;
  columnDef: { header?: unknown; meta?: TMDataGridColumnMeta };
  /** Set on a leaf that sits inside a header group. */
  parent?: unknown;
};

/** Menu- and panel-facing column name. */
export function getColumnLabel(column: ColumnLike): string {
  const label = column.columnDef.meta?.label;
  if (label) return label;
  const header = column.columnDef.header;
  return typeof header === "string" ? header : column.id;
}

export function getColumnType(column: ColumnLike): TMDataGridColumnType {
  return column.columnDef.meta?.type ?? "string";
}

/**
 * The operators this column offers: the type's list, narrowed to
 * `meta.filter.operators` when the column declares one. The type's order is
 * kept so the menu reads the same on every column; an operator the type does
 * not offer is dropped, and an allowlist that leaves nothing falls back to the
 * type's full list rather than an empty menu.
 */
export function getColumnOperators(
  column: ColumnLike,
): readonly TMDataGridFilterOperator[] {
  const offered = getOperatorsForType(getColumnType(column));
  const allowed = column.columnDef.meta?.filter?.operators;
  if (!allowed) return offered;
  const narrowed = offered.filter((operator) => allowed.includes(operator));
  return narrowed.length > 0 ? narrowed : offered;
}

/**
 * The operator a fresh filter on this column starts with -
 * `meta.filter.defaultOperator`, else the type's default where the column
 * offers it, else the first operator it does offer.
 */
export function getColumnDefaultOperator(
  column: ColumnLike,
): TMDataGridFilterOperator {
  const declared = column.columnDef.meta?.filter?.defaultOperator;
  if (declared) return declared;
  const offered = getColumnOperators(column);
  const typeDefault = getDefaultOperator(getColumnType(column));
  return offered.includes(typeDefault) ? typeDefault : offered[0];
}

/**
 * This column's filter-panel value control - `meta.filter.control`, or
 * `undefined` for the built-in shape-by-operator input.
 */
export function getColumnFilterControl(
  column: ColumnLike,
): TMDataGridFilterControlComponent | undefined {
  return column.columnDef.meta?.filter?.control;
}

/**
 * Whether `meta.edit.enabled` switches this column off outright, ignoring any
 * per-row predicate. For the passes that have no row in hand - listing which
 * columns a row form covers, finding the first cell an opened row should put
 * the caret in.
 */
export function isColumnEditSwitchedOff(column: ColumnLike): boolean {
  return column.columnDef.meta?.edit?.enabled === false;
}

/**
 * Whether `meta.edit.enabled` lets this column's cell on this row be edited -
 * the switch, then the predicate.
 *
 * This is only the column's half of the rule. A cell also needs the column to
 * map to a field (`getEditFieldName`) and the row to take edits at all
 * (`isRowEditable`); `edit.canEditCell` is the whole question.
 */
export function isColumnEditableForRow(
  column: ColumnLike,
  row: Row<TMDataGridFeatures, TMDataGridRowData>,
): boolean {
  const enabled = column.columnDef.meta?.edit?.enabled;
  if (enabled === false) return false;
  if (typeof enabled === "function") return enabled(row);
  return true;
}

export function getColumnAlign(column: ColumnLike): "left" | "right" | "center" {
  return column.columnDef.meta?.align ?? "left";
}

/**
 * A generated lane holding one fixed-width thing - the checkbox, the details
 * chevron, the row number.
 *
 * They are laid out differently from every other column: cell padding is sized
 * for text and grows with the scale, which at `xl` squeezed a 16px checkbox out
 * of its track, so these lanes centre their content in an unpadded cell.
 * Their headers carry no column menu, and none of them is ever exported -
 * they hold chrome, not values.
 *
 * The tree column is deliberately not one of them: it holds a label as well as a
 * chevron, and wants the padding.
 */
export function isControlColumn(columnId: string): boolean {
  return (
    columnId === SELECT_COLUMN_ID ||
    columnId === DETAILS_COLUMN_ID ||
    columnId === EDIT_COLUMN_ID ||
    columnId === ROW_NUMBER_COLUMN_ID
  );
}

/**
 * Whether the grid generated this column rather than the consumer declaring it
 * - the four control lanes plus the tree column.
 *
 * These hold the grid's own chrome, and they keep the edges of the row: the
 * generated left lanes before every consumer column, the edit lane after all of
 * them. `isControlColumn` answers a narrower question about layout, and leaves
 * the tree column out because it is padded like a data column.
 */
export function isGeneratedColumn(columnId: string): boolean {
  return isControlColumn(columnId) || columnId === GROUP_COLUMN_ID;
}

/**
 * Whether a column may be moved. Ordering is the one column feature TanStack
 * has no column option for, so the switch lives in `meta.enableOrdering`.
 *
 * A leaf inside a header group is never movable: `columnOrder` sequences leaf
 * columns, so moving one out of its group would leave the group header spanning
 * columns that no longer belong to it.
 */
export function isColumnReorderable(column: ColumnLike): boolean {
  if (column.columnDef.meta?.enableOrdering === false) return false;
  return column.parent === undefined;
}

/**
 * The `minSize` of a column that sets none: the floor of its fluid track, of a
 * resize drag and of its pinned width. Passed to TanStack as
 * `defaultColumn.minSize`, which otherwise fills in 20.
 */
export const DEFAULT_COLUMN_MIN_SIZE = 80;

/** The list length from which a column chooser shows its search box. */
export const COLUMN_SEARCH_MIN = 6;

/**
 * `"auto"` shows the search box from `COLUMN_SEARCH_MIN` columns, a number
 * from that many columns.
 */
export type TMDataGridColumnSearchable = boolean | "auto" | number;

/**
 * Whether a column list shows a search box. A handful of columns is read at
 * a glance, so `"auto"` keeps the input out of the way until the list is long
 * enough to need one.
 */
export function showColumnSearch(
  searchable: TMDataGridColumnSearchable,
  count: number,
): boolean {
  if (searchable === "auto") return count >= COLUMN_SEARCH_MIN;
  if (typeof searchable === "number") return count >= searchable;
  return searchable;
}
