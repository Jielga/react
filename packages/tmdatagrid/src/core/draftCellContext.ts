import type { Cell, CellContext, Row } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures } from "../useTMDataGrid";

type ErasedCell = Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
type ErasedRow = Row<TMDataGridFeatures, TMDataGridRowData>;
type ErasedCellContext = CellContext<
  TMDataGridFeatures,
  TMDataGridRowData,
  unknown
>;

/**
 * The row internals the draft wrapper overrides. Private to table-core, but
 * load-bearing for it: `row.getValue` reads `_valuesCache` before running
 * `column.accessorFn(row.original, row.index)`, so owning fresh caches and a
 * draft `original` is what makes every accessor - key, function, dot path -
 * re-derive from the draft. Pinned by draftCellContext.test.ts, which is the
 * tripwire for a beta bump moving these.
 */
type RowInternals = {
  original: TMDataGridRowData;
  _valuesCache: Record<string, unknown>;
  _uniqueValuesCache: Record<string, unknown>;
};

/**
 * A cell render context whose values come from a row's edit draft instead of
 * `data` - how a parked draft is shown through the column's own `cell`
 * renderer.
 *
 * v9 constructs rows and cells as `Object.create(prototype)` instances whose
 * API methods dispatch on `this`, so a wrapper inheriting the real object but
 * owning `original` and empty value caches serves draft values from the same
 * code paths the real row uses. The context is hand-built rather than taken
 * from the wrapper's `getContext()`, which is memoized per instance and would
 * be inherited from the real cell.
 *
 * Limitation, accepted: instance-memoized traversals (`row.getAllCells()` and
 * friends) are inherited already-bound to the real row, so a renderer walking
 * `ctx.row` beyond `original` / `getValue()` / `renderValue()` sees committed
 * values. The documented renderer surface sees the draft.
 */
export function draftCellContext(
  cell: ErasedCell,
  draftValues: TMDataGridRowData,
): ErasedCellContext {
  const draftRow = Object.create(cell.row) as ErasedRow;
  const internals = draftRow as unknown as RowInternals;
  internals.original = draftValues;
  internals._valuesCache = Object.create(null) as Record<string, unknown>;
  internals._uniqueValuesCache = Object.create(null) as Record<string, unknown>;

  const draftCell = Object.create(cell) as ErasedCell;
  (draftCell as { row: ErasedRow }).row = draftRow;

  return {
    table: cell.table,
    column: cell.column,
    row: draftRow,
    cell: draftCell,
    getValue: () => draftRow.getValue(cell.column.id),
    renderValue: () =>
      draftRow.getValue(cell.column.id) ??
      cell.table.options.renderFallbackValue ??
      null,
  };
}
