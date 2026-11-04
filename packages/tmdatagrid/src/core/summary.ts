import {
  type AggregationContext,
  aggregationFns,
  type RowData,
} from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

/** The registered aggregation names - the same set `aggregationFn` accepts. */
export type TMDataGridAggregationName = keyof typeof aggregationFns;

/**
 * One column aggregated over every filtered row - the number a summary-row
 * `footer` wants:
 *
 * ```tsx
 * columnHelper.accessor("salary", {
 *   footer: ({ table }) => sek(Number(aggregateColumn({ table, columnId: "salary" }))),
 * });
 * ```
 *
 * Filtered rather than paginated rows, so the total covers everything the
 * filters left (all pages), and follows the filters as they change. Reuses
 * TanStack's registered aggregation functions; `fn` defaults to `"sum"`.
 *
 * Every data row counts once. Grouping builds its group rows from this model
 * rather than into it, so a grouped grid totals its records, not its records
 * plus their subtotals; a tree counts parents and children alike.
 */
export function aggregateColumn<TData extends RowData>({
  table,
  columnId,
  fn = "sum",
}: {
  table: TMDataGridTable<TData>;
  columnId: string;
  fn?: TMDataGridAggregationName;
}): unknown {
  const erased = table as unknown as TMDataGridTable<TMDataGridRowData>;
  const column = erased.getColumn(columnId);
  // A summary for a column the table does not hold has no value.
  if (!column) return undefined;
  // `flatRows`, not `rows`: the filtered model nests under `getSubRows`, and
  // the top-level array would total a tree's roots and drop every child.
  // Grouping does not nest it - the group rows are built from this model, not
  // held in it - so a grouped grid is unaffected either way.
  const rows = erased.getFilteredRowModel().flatRows;
  // The rows are already every row, so there is nothing below them to select:
  // `maxDepth: 0`, and no `subRows` or `groupingRow` - this is not a group.
  const context: AggregationContext<TMDataGridFeatures, TMDataGridRowData> = {
    column,
    columnId,
    maxDepth: 0,
    getValue: (row) => row.getValue(columnId),
    rows,
    table: erased,
  };
  return aggregationFns[fn].aggregate(context);
}
