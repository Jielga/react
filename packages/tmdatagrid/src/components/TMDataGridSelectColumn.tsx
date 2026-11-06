import { Checkbox } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { Row, RowData } from "@tanstack/react-table";
import {
  useBodyControlTabIndex,
  useTMDataGridContext,
} from "../TMDataGridContext";
import { isMouseEvent } from "../core/dom";
import {
  getDisplayedRows,
  getSelectableRowIds,
  resolveRowSelectionClick,
} from "../core/rowSelection";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

export const SELECT_COLUMN_ID = "__select__";

/**
 * Both checkboxes subscribe to the table store themselves rather than reading
 * the selection off the render they were handed.
 *
 * A cell is rendered by `flexRender`, which mounts the cell function as its own
 * component - but the body cell above it keeps the same props across a
 * selection change (row, column and layout identities all survive it), so the
 * React Compiler reuses the memoized element and the subtree never re-renders.
 * The row highlight would update, from state `TMDataGridTable` subscribes to,
 * while the box below it stayed unchecked.
 *
 * Selection is derived inside the selector, not from a method call in the
 * component body, for the same reason: `table` and `row` identities survive the
 * change, so a call in the body would be cached along with them.
 */
function SelectAllCheckbox<TData extends RowData>({
  table,
}: {
  table: TMDataGridTable<TData>;
}) {
  const { labels } = useTMDataGridContext();
  const allSelected = useSelector(table.store, () =>
    table.getIsAllRowsSelected(),
  );
  const someSelected = useSelector(table.store, () =>
    table.getIsSomeRowsSelected(),
  );

  return (
    <Checkbox
      size="xs"
      aria-label={labels.selectAllRows}
      data-dg-part="select-all"
      checked={allSelected}
      indeterminate={someSelected && !allSelected}
      onChange={(event) => {
        if (event.currentTarget.checked) {
          table.toggleAllRowsSelected(true);
          return;
        }
        // Not `toggleAllRowsSelected(false)`: since TanStack 9.2 it keeps a
        // ticked row that `enableRowSelection` turns down, so the box could
        // never clear. Every row the filters show is unticked; rows a filter
        // hides keep their tick, as they always have.
        const next = { ...table.store.state.rowSelection };
        for (const row of table.getPreGroupedRowModel().flatRows) {
          delete next[row.id];
        }
        table.setRowSelection(next);
      }}
    />
  );
}

/**
 * Drops the select-all box when only one row may be selected. Read from the
 * feature flags rather than `table.options.enableMultiRowSelection` directly:
 * the flags are re-derived from a fresh object every render, so the switch
 * cannot be cached along with a `table` identity that survives an options
 * change - the same reason the rest of the chrome reads them. See
 * readFeatureFlags.
 */
export function SelectAllHeader<TData extends RowData>({
  table,
}: {
  table: TMDataGridTable<TData>;
}) {
  const { features } = useTMDataGridContext();
  if (!features.multiRowSelection) return null;
  return <SelectAllCheckbox table={table} />;
}

export function SelectRowCheckbox<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  const { ui, features, labels, edit } = useTMDataGridContext();
  const tabIndex = useBodyControlTabIndex();
  const isGroupRow = row.subRows.length > 0;
  // The mark lives in the edit store and the row and cell identities do not
  // change, so this subscription is what re-renders the box when it lands.
  useSelector(edit.store, (state) => state.deletedRowIds.includes(row.id));

  // TanStack's `getIsSelected()` is a plain lookup in `rowSelection`, which
  // holds only the leaves, so a group asks about its descendants.
  const selected = useSelector(row.table.store, () =>
    isGroupRow ? row.getIsAllSubRowsSelected() : row.getIsSelected(),
  );
  const someSelected = useSelector(row.table.store, () =>
    row.getIsSomeSelected(),
  );

  const selectableIds = getSelectableRowIds(row);

  if (isGroupRow && !row.getCanMultiSelect()) return null;

  return (
    <Checkbox
      size="xs"
      tabIndex={tabIndex}
      aria-label={isGroupRow ? labels.selectGroup : labels.selectRow}
      data-dg-part="select-row"
      data-row-id={row.id}
      checked={selected}
      disabled={selectableIds.length === 0}
      indeterminate={someSelected && !selected}
      // All of it in `onChange`, not split with an `onClick`: a
      // `preventDefault()` in a click handler cannot stop the change from
      // firing, so a range done in `onClick` loses the clicked row, which
      // `onChange` then toggles back off.
      onChange={(event) => {
        const native = event.nativeEvent;
        const isMouse = isMouseEvent(native);
        const resolved = resolveRowSelectionClick({
          rows: getDisplayedRows(row.table, features),
          rowId: row.id,
          anchorRowId: ui.state.selectionAnchorRowId,
          modifiers: {
            toggle: isMouse && (native.ctrlKey || native.metaKey),
            extend: isMouse && native.shiftKey,
          },
          selection: row.table.store.state.rowSelection,
          canReplaceSelection: false,
        });
        row.table.setRowSelection(resolved.selection);
        ui.actions.setSelectionAnchor(resolved.anchorRowId);
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
