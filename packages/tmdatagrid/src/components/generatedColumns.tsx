import type { ColumnDef, RowData } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import {
  DETAILS_COLUMN_ID,
  DetailsCell,
  DetailsHeader,
} from "./TMDataGridDetailsColumn";
import { EDIT_COLUMN_ID, EditLaneCell } from "./TMDataGridEditColumn";
import {
  GROUP_COLUMN_ID,
  GroupCell,
  GroupHeader,
} from "./TMDataGridGroupColumn";
import {
  SELECT_COLUMN_ID,
  SelectAllHeader,
  SelectRowCheckbox,
} from "./TMDataGridSelectColumn";

/**
 * The generated checkbox column, prepended under
 * `selectionMode: "checkbox"` (the default) or `"checkboxAndHighlight"`.
 */
export function createSelectColumn<TData extends RowData>(
  label = "Checkbox selection",
): ColumnDef<TMDataGridFeatures, TData, unknown> {
  return {
    id: SELECT_COLUMN_ID,
    meta: {
      label,
      align: "center",
      enableOrdering: false,
    },
    size: 36,
    minSize: 36,
    maxSize: 36,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enableHiding: false,
    enablePinning: false,
    header: ({ table }) => <SelectAllHeader table={table} />,
    cell: ({ row }) => <SelectRowCheckbox row={row} />,
    // A summary cell with nothing declared renders blank, so without this the
    // checkbox disappears from the rows that select a whole group. See
    // renderCellContent.
    aggregatedCell: ({ row }) => <SelectRowCheckbox row={row} />,
  };
}

/**
 * The generated tree column, prepended whenever grouping is enabled and hidden
 * again while `grouping` is empty - see the visibility effect in
 * `useTMDataGrid`.
 *
 * It exists because TanStack ships no auto group column: `groupedColumnMode:
 * "remove"` takes the grouped column out of the grid, so something has to hold
 * the tree. Modelled on the checkbox column, which is generated the same way.
 *
 * Not groupable itself, and nothing had to be written to make that true -
 * `column.getCanGroup()` requires an `accessorFn`, which a display column has
 * no reason to have.
 */
export function createGroupColumn<TData extends RowData>(
  label = "Group",
): ColumnDef<TMDataGridFeatures, TData, unknown> {
  return {
    id: GROUP_COLUMN_ID,
    meta: {
      label,
      enableOrdering: false,
    },
    size: 260,
    minSize: 180,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enableHiding: false,
    enablePinning: false,
    cell: ({ row }) => <GroupCell row={row} />,
    // Without an `aggregatedCell` the tree lane renders blank on the rows it
    // exists for. See renderCellContent.
    aggregatedCell: ({ row }) => <GroupCell row={row} />,
    header: ({ table }) => <GroupHeader table={table} />,
  };
}

/**
 * The generated details lane, added whenever `renderDetails` is set.
 *
 * Structural, like the checkbox and tree columns: fixed width, pinned to the
 * edge `detailsColumnPosition` names, not hideable, not movable and not
 * resizable. Moving or hiding the toggle would leave rows with panels that
 * cannot be opened.
 *
 * Innermost on its edge - last of the left lanes, or first of the right ones,
 * inside the edit lane - because it acts on a single record.
 *
 * A second toggle elsewhere is supported: `row.toggleExpanded()` is the entire
 * interface, and this lane is only the control the grid ships.
 */
export function createDetailsColumn<TData extends RowData>(
  label = "Details",
): ColumnDef<TMDataGridFeatures, TData, unknown> {
  return {
    id: DETAILS_COLUMN_ID,
    meta: {
      label,
      align: "center",
      enableOrdering: false,
    },
    size: 36,
    minSize: 36,
    maxSize: 36,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enableHiding: false,
    enablePinning: false,
    header: ({ table }) => <DetailsHeader table={table} />,
    cell: ({ row }) => <DetailsCell row={row} />,
    // Deliberately no `aggregatedCell`: groups expand into their rows, not into
    // a panel, so blank is right here.
  };
}

/**
 * The generated edit lane, appended and pinned right - the row's Save at the
 * end of the row under `mode: "row"`, the state marker and revert under
 * `editing.draft`, mirroring the checkbox lane's build on the left.
 */
export function createEditColumn<TData extends RowData>(
  label = "Edit",
  /** A draft lane holds three controls where the rest hold two. */
  wide = false,
): ColumnDef<TMDataGridFeatures, TData, unknown> {
  const width = wide ? 88 : 64;
  return {
    id: EDIT_COLUMN_ID,
    meta: {
      label,
      align: "center",
      enableOrdering: false,
    },
    size: width,
    minSize: width,
    maxSize: width,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enableHiding: false,
    enablePinning: false,
    header: () => null,
    cell: ({ row }) => <EditLaneCell row={row} />,
    aggregatedCell: ({ row }) => <EditLaneCell row={row} />,
  };
}
