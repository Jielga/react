import type { ColumnDef, RowData } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import {
  DETAILS_COLUMN_ID,
  DetailsCell,
  DetailsHeader,
} from "./TMDataGridDetailsColumn";
import { EDIT_COLUMN_ID, EditLaneCell } from "./TMDataGridEditColumn";
import { GROUP_COLUMN_ID, GroupCell, GroupHeader } from "./TMDataGridGroupColumn";
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
      // Structurally the first column; it also anchors the left pinned lane, so
      // no other column can be moved in front of it.
      enableOrdering: false,
    },
    // A system lane: as wide as the control it holds and no wider. Fixed at
    // every scale - the control does not grow with the font size, so neither
    // should its track.
    size: 36,
    minSize: 36,
    maxSize: 36,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // Not a column the user chose, so not one they can switch off: hiding the
    // lane would take the grid's only way to select a row with it, with the
    // row-selection state left behind and no way back to it. Keeping it out of
    // "Manage columns" follows from this - the panel lists what can be hidden.
    enableHiding: false,
    // Structurally pinned to the left; users shouldn't be able to move it.
    enablePinning: false,
    header: ({ table }) => <SelectAllHeader table={table} />,
    cell: ({ row }) => <SelectRowCheckbox row={row} />,
    // Every cell on a group row that is not the grouped column is a group
    // summary cell, this lane included, and a summary cell with nothing
    // declared renders blank. Without this the checkbox would disappear from
    // exactly the rows that select a whole group. See renderCellContent.
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
      // Structurally the first column after the checkbox lane.
      enableOrdering: false,
    },
    size: 260,
    minSize: 180,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // Keeps it out of the columns panel and out of the header menu: its
    // visibility is not the user's to set, it follows the grouping state.
    enableHiding: false,
    // Structurally pinned to the left; users shouldn't be able to move it.
    enablePinning: false,
    cell: ({ row }) => <GroupCell row={row} />,
    // Every cell on a group row that is not the grouped column is a group
    // summary cell - this lane included. Without an `aggregatedCell` the body
    // would take that as "nothing to summarise" and render the tree lane
    // blank on exactly the rows it exists for. See renderCellContent.
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
      // Structurally the innermost of the generated lanes.
      enableOrdering: false,
    },
    // A system lane: as wide as the control it holds and no wider. Fixed at
    // every scale - the control does not grow with the font size, so neither
    // should its track.
    size: 36,
    minSize: 36,
    maxSize: 36,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // Its visibility is not the user's to set: hiding it would strand every
    // panel behind a control that is no longer there.
    enableHiding: false,
    // Structurally pinned to its edge; users shouldn't be able to move it.
    enablePinning: false,
    header: ({ table }) => <DetailsHeader table={table} />,
    cell: ({ row }) => <DetailsCell row={row} />,
    // Deliberately no `aggregatedCell`: on a group row every cell outside the
    // grouped column is a summary cell, and blank is the right answer here -
    // groups expand into their rows, not into a panel.
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
    // Wide enough for the pair (or draft's trio) it holds while editing.
    size: width,
    minSize: width,
    maxSize: width,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    // The row's Save, Cancel and Delete live here, so hiding the lane would
    // strand an open row with no way to commit or discard it. Same rule as the
    // checkbox lane: chrome the grid generates is not a user setting.
    enableHiding: false,
    // Structurally pinned to the right; not movable.
    enablePinning: false,
    header: () => null,
    cell: ({ row }) => <EditLaneCell row={row} />,
    // Group rows: same reasoning as the checkbox lane - without this the
    // cell renders blank on group rows, but here blank is also correct,
    // so the aggregated cell renders the same (null for groups).
    aggregatedCell: ({ row }) => <EditLaneCell row={row} />,
  };
}
