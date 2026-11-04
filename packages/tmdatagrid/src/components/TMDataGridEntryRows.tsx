import {
  flexRender,
  useTable,
  type Cell,
  type Column,
  type Row,
} from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import { useLayoutEffect, useMemo, useRef } from "react";
import classes from "./TMDataGridTable.module.css";
import sticky from "./sticky.module.css";
import { type TMDataGridRowData, useTMDataGridContext } from "../TMDataGridContext";
import {
  getColumnAlign,
  isColumnEditableForRow,
  isControlColumn,
} from "../core/columnUtils";
import { draftCellContext } from "../core/draftCellContext";
import { getEditFieldName, type TMDataGridEditApi } from "../core/editEngine";
import { focusEditorContent } from "../core/editorFocus";
import {
  tmDataGridFeatures,
  type TMDataGridFeatures,
} from "../useTMDataGrid";
import { TMDataGridCellEditor } from "./TMDataGridCellEditor";
import { EDIT_COLUMN_ID } from "./TMDataGridEditColumn";
import type { TMDataGridColumnLayout } from "./TMDataGridTable";

type ErasedColumn = Column<TMDataGridFeatures, TMDataGridRowData, unknown>;
type EntryRow = Row<TMDataGridFeatures, TMDataGridRowData>;
type EntryCellApi = Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;

/**
 * Whether an entry cell edits. `edit.canEditCell` asks the main table for
 * the row, and an entry row is precisely not there yet - so the structural
 * half of the same rule is applied to the entry table's own row.
 */
function isEntryCellEditable(
  row: Row<TMDataGridFeatures, TMDataGridRowData>,
  column: ErasedColumn,
  edit: TMDataGridEditApi,
): boolean {
  if (!edit.isColumnEditable(column)) return false;
  return isColumnEditableForRow(column, row);
}

/**
 * One cell of an entry row: the lane's controls, an editor for a cell the
 * open row edits, or a value through the column's own renderer. The invalid
 * marker subscribes here, per cell, as a body cell's does - a refused ✓
 * paints the cells its issues name and nothing else. No dirty marker:
 * everything in an entry row is new.
 */
function EntryCell({
  entryRow,
  column,
  cell,
  committed,
  layout,
  rowHeight,
  pinnedZ,
}: {
  entryRow: EntryRow;
  column: ErasedColumn;
  cell: EntryCellApi | undefined;
  committed: boolean;
  layout: TMDataGridColumnLayout;
  rowHeight: number;
  pinnedZ: string;
}) {
  const { edit } = useTMDataGridContext();
  const fieldName = getEditFieldName(column);
  const isInvalid = useSelector(edit.store, (state) => {
    if (fieldName === null) return false;
    const projection = state.rows[entryRow.id];
    return projection !== undefined && projection.errorFields.includes(fieldName);
  });
  const editable =
    cell !== undefined && isEntryCellEditable(entryRow, column, edit);
  // An open row's cells outside the editors follow the form as it is typed,
  // as a body row's do: the column's renderer over a context reading the
  // form's values - the whole row, so a computed cell repaints with any
  // field. `undefined` for a committed row, whose values the entry table
  // already holds as data, and for the lanes.
  const draftValues = useSelector(edit.store, (state) =>
    committed || isControlColumn(column.id)
      ? undefined
      : state.rows[entryRow.id]?.values,
  );
  return (
    <div
      role="cell"
      data-column-id={column.id}
      data-align={getColumnAlign(column)}
      data-control-column={isControlColumn(column.id) || undefined}
      data-invalid={isInvalid || undefined}
      // A committed row re-opens where it is double-clicked, the same
      // gesture a body cell answers - and, like a body cell, a cell that
      // takes no edit answers nothing.
      onDoubleClick={
        committed && editable
          ? () => edit.begin({ rowId: entryRow.id, columnId: column.id })
          : undefined
      }
      className={[
        classes.entryCell,
        layout.isBoundary && layout.pinnedAt === "left" ? sticky.stickyLeft : "",
        layout.isBoundary && layout.pinnedAt === "right"
          ? sticky.stickyRight
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        minHeight: rowHeight,
        left: layout.pinnedAt === "left" ? layout.offset : undefined,
        right: layout.pinnedAt === "right" ? layout.offset : undefined,
        position: layout.pinnedAt ? "sticky" : undefined,
        zIndex: layout.pinnedAt ? pinnedZ : undefined,
      }}
    >
      {cell === undefined ? null : column.id === EDIT_COLUMN_ID ? (
        // The lane's cell - the entry row's controls.
        flexRender(cell.column.columnDef.cell, cell.getContext())
      ) : !committed && editable ? (
        <TMDataGridCellEditor
          cell={cell}
          row={entryRow}
          takeSeedText={() => undefined}
          onClose={() => {}}
          inEntryBlock
        />
      ) : committed || !isControlColumn(column.id) ? (
        // A value through the column's own renderer. Every cell of a row
        // entered and awaiting Save all, over the draft the entry table was
        // fed - and, while the row is open, every cell it does not open (a
        // display column, `meta.edit.enabled` off), over the form as it is
        // typed, as a body row in row mode shows them. Blank was how a
        // calculated column or a button cell vanished the moment a
        // committed row was reopened. The generated lanes stay blank while
        // the row is open: a checkbox or a chevron there would act on the
        // entry table's own state, which reaches nothing.
        <span className={classes.cellContent}>
          {flexRender(
            cell.column.columnDef.cell,
            draftValues !== undefined
              ? draftCellContext(cell, draftValues)
              : cell.getContext(),
          )}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The sticky entry block - one row of open editors per `edit.addRow()`,
 * pinned under the header. The one place stickiness is genuinely required:
 * an existing row that scrolls away has a place to scroll back to, a row
 * being typed into does not exist anywhere else.
 *
 * A second, tiny table instance over the new rows' seed values - same
 * columns, its own `useTable`, no sorting or filtering ever exercised - so
 * these are real `Cell`s and the editor host, the typed editors and the
 * validators all apply unchanged. The forms live in the same engine map as
 * every other draft, keyed by their temporary ids.
 *
 * Enter commits the entry - `onRowAdd`, or a park under `editing.draft`,
 * where `saveDrafts` reports it in `created`; Escape discards it. The edit
 * lane, when present, offers the same pair as buttons.
 */
export function TMDataGridEntryRows({
  orderedColumns,
  layoutFor,
  rowHeight,
}: {
  orderedColumns: ReadonlyArray<ErasedColumn>;
  layoutFor: (columnId: string) => TMDataGridColumnLayout;
  rowHeight: number;
}) {
  const { table, edit, features } = useTMDataGridContext();
  const sticky = features.editNewRowsSticky;
  // A row being *typed* into is always here - it exists nowhere else to
  // scroll back to. A committed row is a body row, sorted and filtered with
  // the rest (the hook feeds it to the table as `data`), unless
  // `newRowsSticky` keeps it pinned here until the save. Only the rows the
  // block renders go into its table: after an import `newRows` runs to
  // thousands, every one of them committed and in the body.
  const newRows = useSelector(
    edit.store,
    (state) =>
      sticky
        ? state.newRows
        : state.newRows.filter((newRow) => !newRow.committed),
    { compare: shallow },
  );
  // What a committed row renders from. It has no form - its values are the
  // draft store's - and this is the same snapshot the table feeds a
  // committed row in the body.
  const committedValues = useSelector(
    edit.store,
    (state) => state.committedValues,
  );
  // The reopen gesture: `begin` on a committed entry row flips it back to
  // editors and names the cell double-clicked - where the caret goes.
  const activeEntry = useSelector(edit.store, (state) =>
    state.active !== null &&
    state.newRows.some(
      (newRow) => newRow.tempId === state.active?.rowId && !newRow.committed,
    )
      ? state.active
      : null,
  );
  const blockRef = useRef<HTMLDivElement>(null);
  /** The entry row the caret has already been placed in. */
  const focusedTempIdRef = useRef<string | null>(null);
  /** The reopen target (`rowId:columnId`) the caret has already landed in. */
  const focusedActiveRef = useRef<string | null>(null);

  /**
   * The caret goes into a row the moment `edit.addRow()` opens it, landing in
   * its first editable cell - the same placement the main table makes for a
   * row opened by a gesture, and made here for the same reason: an editor is
   * free not to focus itself, and then a new row appeared with the caret
   * still outside it.
   */
  useLayoutEffect(() => {
    const newest = newRows.at(-1)?.tempId;
    if (newest === undefined) {
      focusedTempIdRef.current = null;
      return;
    }
    if (focusedTempIdRef.current === newest) return;
    const block = blockRef.current;
    if (block === null) return;
    const editor = block.querySelector<HTMLElement>(
      `[data-dg-part="editor"][data-row-id="${CSS.escape(newest)}"]`,
    );
    // Not mounted yet; the next render tries again, as the table's does.
    if (editor === null) return;
    focusedTempIdRef.current = newest;
    focusEditorContent(editor);
  });

  /**
   * The caret for a reopen: `begin` on a committed row re-arms its editors
   * and the double-clicked cell's editor should hold the caret, not the
   * row's first. Keyed separately from the add effect above - the row was
   * already focused once when it was added.
   */
  useLayoutEffect(() => {
    if (activeEntry === null) {
      focusedActiveRef.current = null;
      return;
    }
    const key = `${activeEntry.rowId}:${activeEntry.columnId ?? ""}`;
    if (focusedActiveRef.current === key) return;
    const block = blockRef.current;
    if (block === null) return;
    const editor = block.querySelector<HTMLElement>(
      activeEntry.columnId !== null
        ? `[data-dg-part="editor"][data-row-id="${CSS.escape(activeEntry.rowId)}"][data-column-id="${CSS.escape(activeEntry.columnId)}"]`
        : `[data-dg-part="editor"][data-row-id="${CSS.escape(activeEntry.rowId)}"]`,
    );
    // Not mounted yet; the next render tries again, as the add effect does.
    if (editor === null) return;
    focusedActiveRef.current = key;
    focusEditorContent(editor);
  });

  // What the rows render over. A committed row is data: its values are the
  // draft store's, which stand through a reopen. An open row's cells read
  // the form itself - the editors directly, the rest through EntryCell's
  // draft overlay - so its entry here gives the row an identity and a
  // fallback: the committed values it was reopened from, else the seed
  // frozen at addRow (the form's `defaultValues`, which a reopen keeps at
  // the seed and writes the committed values over).
  const data = useMemo(
    () =>
      newRows.map(
        ({ tempId }) =>
          (committedValues[tempId] ??
            edit.getForm(tempId)?.options.defaultValues ??
            {}) as TMDataGridRowData,
      ),
    [newRows, committedValues, edit],
  );

  const entryTable = useTable({
    features: tmDataGridFeatures,
    columns: table.options.columns,
    data,
    getRowId: (_row, index) => newRows[index]?.tempId ?? String(index),
  });

  if (newRows.length === 0) return null;

  const stickyRows = entryTable.getCoreRowModel().rows;
  const committedById = new Map(
    newRows.map((newRow) => [newRow.tempId, newRow.committed]),
  );

  const renderEntryRow = (entryRow: EntryRow, pinnedZ: string) => {
    const cellsById = new Map(
      entryRow.getAllCells().map((cell) => [cell.column.id, cell]),
    );
    const committed = committedById.get(entryRow.id) === true;
    return (
      <div
        key={entryRow.id}
        role="row"
        data-dg-part="entry-row"
        data-row-id={entryRow.id}
        data-new
        data-committed={committed || undefined}
        // The same marker body rows carry once committed, so one selector
        // reaches everything parked in the draft store.
        data-draft={committed || undefined}
        className={classes.entryRow}
      >
        {orderedColumns.map((column) => (
          <EntryCell
            key={column.id}
            entryRow={entryRow}
            column={column}
            cell={cellsById.get(column.id)}
            committed={committed}
            layout={layoutFor(column.id)}
            rowHeight={rowHeight}
            pinnedZ={pinnedZ}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      {stickyRows.length > 0 && (
        <div
          ref={blockRef}
          role="rowgroup"
          data-dg-entry-block
          className={classes.entryBlock}
        >
          {stickyRows.map((entryRow) =>
            renderEntryRow(entryRow, "var(--dg-z-pinned-row-pinned-cell, 5)"),
          )}
        </div>
      )}
    </>
  );
}
