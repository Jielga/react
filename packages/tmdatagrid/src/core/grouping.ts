import type { Row, RowData } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { formatValueText, type TMDataGridValueTextOptions } from "./valueText";

/**
 * The data rows under a group row, at any depth.
 *
 * Not `row.getLeafRows()`, despite the name: that flattens the whole subtree
 * and keeps the branches, so a group nested two deep reports its sub-groups
 * alongside the records. Grouping `city` then `name` would have Stockholm
 * counting four rows and three names as seven, and one tick on it selecting
 * ids that hold no record.
 *
 * A row with no subRows is a data row, which also makes this the identity on an
 * ungrouped grid.
 */
export function getGroupDataRows<TData extends RowData>(
  row: Row<TMDataGridFeatures, TData>,
): Array<Row<TMDataGridFeatures, TData>> {
  if (row.subRows.length === 0) return [row];
  return row.getLeafRows().filter((leaf) => leaf.subRows.length === 0);
}

/** Shown for a group whose value is empty - `String(null)` would read as "null". */
const BLANK_GROUP_LABEL = "(Blank)";

/**
 * How a grouping value is written into the tree cell.
 *
 * Deliberately not the grouped column's own `cell` renderer: that renderer is
 * written for a data row and is free to reach into `row.original`, which on a
 * group row is the first leaf's record rather than anything about the group.
 * `options` carries what the chrome knows of the column instead - its type,
 * its option labels and the boolean labels.
 */
export function formatGroupValue(
  value: unknown,
  blankLabel = BLANK_GROUP_LABEL,
  options?: TMDataGridValueTextOptions,
): string {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return blankLabel;
  }
  return formatValueText(value, options);
}
