import { useSelector } from "@tanstack/react-store";
import { useTMDataGridContext } from "../TMDataGridContext";

/**
 * The columns a column chooser may list, and the two writes it makes.
 *
 * Shared by `TMDataGridColumnsPanel` (plain controls) and
 * `TMDataGrid.Menu.Columns` (menu items), so the two always list the same
 * columns and hide them the same way.
 */
export function useHideableColumns() {
  const { table } = useTMDataGridContext();

  const columnVisibility = useSelector(
    table.store,
    (state) => state.columnVisibility,
  );

  // Only what can actually be hidden. A column with `enableHiding: false` is
  // left out rather than listed and disabled: a box that cannot be ticked only
  // invites the question, and every generated lane is one - the checkbox and
  // edit lanes hold the controls the grid needs, the tree column follows the
  // grouping state, the row-number gutter follows `enableRowNumbers`. None of
  // them is a setting.
  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());

  const shownCount = columns.filter(
    (column) => columnVisibility[column.id] !== false,
  ).length;

  /**
   * Show or hide every listed column.
   *
   * Not `table.toggleAllColumnsVisible`, which writes a visibility entry for
   * *every* leaf column: showing all would publish the tree column - hidden
   * because nothing is grouped, not because the user hid it - and hiding all
   * would force the same column visible, since it writes `!getCanHide()` for
   * the columns it will not touch. Either way a lane the panel never listed
   * changes state, and persistence then keeps it that way.
   */
  const setAllVisible = (visible: boolean) => {
    table.setColumnVisibility((previous) => {
      const next = { ...previous };
      for (const column of columns) next[column.id] = visible;
      return next;
    });
  };

  return { columns, columnVisibility, shownCount, setAllVisible };
}
