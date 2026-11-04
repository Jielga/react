import { useSelector } from "@tanstack/react-store";
import { useTMDataGridContext } from "./TMDataGridContext";
import {
  applyExportDataMapper,
  buildExportData,
  countSelectedExportRows,
  resolveExportOptions,
  writeExportFile,
  type TMDataGridExportOptions,
} from "./core/export";

/** What {@link useTMDataGridExport} returns. */
export type TMDataGridExportApi = {
  /**
   * Downloads every filtered and sorted row, all pages. `overrides` are folded
   * over the hook's options for this one call - the column picker's chosen
   * columns, for instance.
   */
  exportAll: (overrides?: TMDataGridExportOptions) => Promise<void>;
  /**
   * Downloads the selected rows of the current view, in grid order. Resolves
   * without a download when none is selected.
   */
  exportSelected: (overrides?: TMDataGridExportOptions) => Promise<void>;
  /** How many rows `exportSelected` would write. Subscribes to the selection. */
  selectedCount: number;
  /**
   * Whether row selection is on at all - `false` under
   * `selectionMode: "highlight"` or `enableRowSelection: false`, where a
   * "selected rows" control has nothing to offer.
   */
  canExportSelected: boolean;
  /**
   * Whether the grid offers downloads - `false` under `enableDownload: false`,
   * where `exportAll` and `exportSelected` do nothing. A control of your own
   * reads it to hide itself, as the `TMDataGrid.Menu.Export*` items do.
   */
  canDownload: boolean;
};

/**
 * The export as click handlers, for a button of your own anywhere inside the
 * grid. The `TMDataGrid.Menu.Export*` items are this hook behind a
 * `Menu.Item`.
 *
 * ```tsx
 * function ExportButton() {
 *   const { exportAll } = useTMDataGridExport();
 *   return <Button onClick={() => void exportAll()}>Export</Button>;
 * }
 * ```
 *
 * `overrides` are folded over the grid's `exportOptions` for this caller:
 * another format, another file name, another set of columns.
 */
export function useTMDataGridExport(
  overrides?: TMDataGridExportOptions,
): TMDataGridExportApi {
  const { table, features, exportOptions } = useTMDataGridContext();
  const selectedCount = useSelector(table.store, () =>
    countSelectedExportRows(table),
  );

  const run = async (
    rows: "all" | "selected",
    callOverrides?: TMDataGridExportOptions,
  ) => {
    if (!features.download) return;
    const resolved = resolveExportOptions(
      exportOptions,
      overrides,
      callOverrides,
    );
    const data = buildExportData({ table, rows, columns: resolved.columns });
    if (data.columnIds.length === 0) return;
    if (rows === "selected" && data.rows.length === 0) return;
    const mapped = applyExportDataMapper(table, data, { target: "file", rows });
    if (mapped === null) return;
    await writeExportFile(mapped, resolved);
  };

  return {
    exportAll: (callOverrides) => run("all", callOverrides),
    exportSelected: (callOverrides) => run("selected", callOverrides),
    selectedCount,
    canExportSelected: features.rowSelection,
    canDownload: features.download,
  };
}
