import type { RowData } from "@tanstack/react-table";
import type { TMDataGridTable } from "../useTMDataGrid";

/**
 * Which rows of a table carry a deletion mark, for readers that hold the
 * table and nothing else - `exportGrid` and the export data it builds on.
 * The marks live in the edit engine, which those readers cannot reach; the
 * hook registers the engine's answer per table instead. A table built without
 * the grid has no marks.
 */
// Keyed on the store, not the table: `useTable` hands out a fresh shallow
// copy of the table on every render, and every copy shares the one store.
const sources = new WeakMap<object, (rowId: string) => boolean>();

/** Registers the answer for one table; returns the unregister. */
export function registerDeletedRows<TData extends RowData>(
  table: TMDataGridTable<TData>,
  isRowDeleted: (rowId: string) => boolean,
): () => void {
  sources.set(table.store, isRowDeleted);
  return () => {
    if (sources.get(table.store) === isRowDeleted) {
      sources.delete(table.store);
    }
  };
}

/** Whether the row is marked for deletion under `editing.draft`. */
export function isRowMarkedDeleted<TData extends RowData>(
  table: TMDataGridTable<TData>,
  rowId: string,
): boolean {
  return sources.get(table.store)?.(rowId) ?? false;
}
