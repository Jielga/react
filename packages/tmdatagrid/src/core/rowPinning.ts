import type { Row, RowData } from "@tanstack/react-table";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

/**
 * The rows pinned to one edge, resolved safely and in pin order.
 *
 * Not TanStack's `getTopRows()`: that resolves each pinned id with
 * `getRow(id, true)`, which throws once the row's data is gone - and pinned
 * ids outlive data. A delete, a server-side page swap, a refetch that comes
 * back without the row: any of these would take the whole grid down. Here a
 * stale id is skipped instead; it stays in state, harmless, and the row
 * returns to its edge if its data comes back.
 *
 * The semantics are TanStack's `keepPinnedRows: true`: a pinned row stays at
 * its edge even when a filter or the pager would have dropped it from the
 * body. Ids resolve against the pre-pagination model first - those rows carry
 * the live sort and filter context - with the core model as the fallback for
 * rows the filters removed. A leaf whose group is collapsed stays hidden,
 * as upstream does.
 */
export function readPinnedRows<TData extends RowData>(
  table: TMDataGridTable<TData>,
  position: "top" | "bottom",
): Array<Row<TMDataGridFeatures, TData>> {
  const ids = table.store.state.rowPinning[position];
  if (ids.length === 0) return [];
  const visible = table.getPrePaginatedRowModel().rowsById;
  const all = table.getCoreRowModel().rowsById;
  const rows: Array<Row<TMDataGridFeatures, TData>> = [];
  for (const id of ids) {
    const row = visible[id] ?? all[id];
    if (row === undefined) continue;
    if (!row.getIsAllParentsExpanded()) continue;
    rows.push(row);
  }
  return rows;
}
