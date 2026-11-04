import type { Column } from "@tanstack/react-table";
import { resolveColumnOptions, type TMDataGridOption } from "../../core/columnOptions";
import { getColumnFilterControl, getColumnType } from "../../core/columnUtils";
import type { TMDataGridFilterControlComponent } from "../../core/filterControls";
import type { TMDataGridRowData } from "../../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../../useTMDataGrid";
import { TMDataGridFilterValueInput } from "./TMDataGridFilterValueInput";

type FilterColumn = Column<TMDataGridFeatures, TMDataGridRowData, unknown>;

/** One array, so "this column has no options" never changes identity. */
const NO_OPTIONS: ReadonlyArray<TMDataGridOption> = [];

/**
 * Whether resolving this column's options would read the faceted index -
 * which is what makes the resolution worth memoizing, and what it goes stale
 * against.
 */
export function filterOptionsUseFacets(column: FilterColumn): boolean {
  const declared = column.columnDef.meta?.options;
  return (
    columnNeedsFilterOptions(column) &&
    (declared === undefined || declared === "faceted")
  );
}

/**
 * Whether a column's filter control is offered a list of options at all.
 *
 * Only where options mean something out of the box - a declared set, or a
 * select-shaped column's faceted values. A custom control wanting faceted
 * values on some other column resolves them itself; resolving here would build
 * the faceted index for every filtered column.
 */
function columnNeedsFilterOptions(column: FilterColumn): boolean {
  const type = getColumnType(column);
  return (
    column.columnDef.meta?.options !== undefined ||
    type === "select" ||
    type === "multiSelect"
  );
}

/**
 * What a column's filter control is, and what options it is handed - the one
 * decision the panel row and the header cell make identically.
 *
 * Not a hook: the panel resolves this inside a `map` over its rows, where a
 * hook cannot go. The header row memoizes the call itself, because it
 * re-renders with the table on every scroll frame.
 */
export function filterControlFor(
  table: TMDataGridTable<TMDataGridRowData>,
  column: FilterColumn,
): {
  options: ReadonlyArray<TMDataGridOption>;
  ValueControl: TMDataGridFilterControlComponent;
} {
  return {
    options: columnNeedsFilterOptions(column)
      ? resolveColumnOptions({ table, column, fallback: "faceted" })
      : NO_OPTIONS,
    ValueControl: getColumnFilterControl(column) ?? TMDataGridFilterValueInput,
  };
}
