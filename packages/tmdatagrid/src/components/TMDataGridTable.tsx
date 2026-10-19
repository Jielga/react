import { Checkbox, Loader, Menu, type MenuProps, Text } from "@mantine/core";
import {
  type Cell,
  type Column,
  flexRender,
  type Row,
  type RowData,
  type Table,
} from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import classes from "./TMDataGridTable.module.css";
import sticky from "./sticky.module.css";
import { type TMDataGridRowData, useTMDataGridContext } from "../TMDataGridContext";
import {
  TMDataGridFilterPopup,
  TMDataGridFilterSidebar,
} from "./TMDataGridFilterSurface";
import { TMDataGridHeaderFilterRow } from "./TMDataGridHeaderFilterRow";
import { getGridCapabilities } from "../core/capabilities";
import {
  TMDataGridHeaderCell,
  type TMDataGridColumnMenuItemsRenderer,
} from "./TMDataGridHeaderCell";
import {
  TMDataGridCellEditor,
  type TMDataGridCellEditorClose,
} from "./TMDataGridCellEditor";
import { TMDataGridEntryRows } from "./TMDataGridEntryRows";
import {
  DEFAULT_COLUMN_MIN_SIZE,
  getColumnAlign,
  isControlColumn,
  isGeneratedColumn,
} from "../core/columnUtils";
import {
  resizePreview,
  type TMDataGridColumnTrack,
} from "../core/resizePreview";
import { useSettledTableState } from "../core/useSettledTableState";
import { isInputElement } from "../core/dom";
import { draftCellContext } from "../core/draftCellContext";
import {
  getEditFieldName,
  type TMDataGridEditState,
} from "../core/editEngine";
import {
  getNextEditableCell,
  resolveCellMove,
  type TMDataGridCellPosition,
} from "../core/cellNavigation";
import { FOCUSABLE_IN_CELL, focusEditorContent } from "../core/editorFocus";
import {
  boundsCellCount,
  boundsEdges,
  isWithinBounds,
  resolveRangeBounds,
} from "../core/cellRange";
import {
  buildExportData,
  resolveExportOptions,
  toClipboardText,
  writeClipboardText,
  writeExportFile,
} from "../core/export";
import { autosizeColumn, hasMountedCells } from "../core/autosize";
import {
  resolveColSpans,
  spanAnchorIndex,
  spanEndIndex,
  type TMDataGridColumnSection,
} from "../core/colSpan";
import {
  getDisplayedRows,
  getSelectableRowIds,
  isPagingActive,
  resolveRowSelectionClick,
} from "../core/rowSelection";
import { readPinnedRows } from "../core/rowPinning";
import { filterNarrowsRows } from "../core/filterOperators";
import { buildMatchNeedles, findMatchRanges } from "../core/matchHighlight";
import { ROW_NUMBER_COLUMN_ID } from "./TMDataGridRowNumberColumn";
import { SearchIcon } from "./icons";
import type { TMDataGridFeatures } from "../useTMDataGrid";

/** Where a column sits relative to the pinned regions, resolved once per render. */
export type TMDataGridColumnLayout = {
  pinnedAt: "left" | "right" | false;
  /** Distance in px from the grid's left or right edge. */
  offset: number;
  /** Last left-pinned / first right-pinned column - the one that casts the edge. */
  isBoundary: boolean;
};

const UNPINNED_LAYOUT: TMDataGridColumnLayout = {
  pinnedAt: false,
  offset: 0,
  isBoundary: false,
};

/**
 * The mounted element for a cell position, or `null` when its row is scrolled
 * out - the normal case for a move that has to scroll before it can focus.
 */
function findCellElement(
  container: HTMLElement,
  cell: TMDataGridCellPosition,
): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `[data-cell="true"][data-row-id="${CSS.escape(cell.rowId)}"]` +
      `[data-column-id="${CSS.escape(cell.columnId)}"]`,
  );
}

/**
 * Scrolls sideways far enough to clear the pinned lanes.
 *
 * `scrollIntoView` cannot do this: the pinned columns are `position: sticky`,
 * so as far as the browser is concerned a cell sliding underneath them is
 * still perfectly visible, and it stops scrolling the moment the cell's edge
 * reaches the container's. The visible edge is the inside of the pinned lane,
 * which only this component knows - it laid the lanes out.
 */
function keepColumnInView({
  container,
  cellElement,
  leftPinnedWidth,
  rightPinnedWidth,
}: {
  container: HTMLElement;
  cellElement: HTMLElement;
  leftPinnedWidth: number;
  rightPinnedWidth: number;
}): void {
  const cellRect = cellElement.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const leftBound = containerRect.left + leftPinnedWidth;
  const rightBound = containerRect.right - rightPinnedWidth;

  if (cellRect.left < leftBound) {
    container.scrollLeft -= leftBound - cellRect.left;
  } else if (cellRect.right > rightBound) {
    container.scrollLeft += cellRect.right - rightBound;
  }
}

/**
 * What a cell shows once grouping is in play.
 *
 * A group row carries a cell for every column, but only some of them have
 * anything to say:
 *
 * | Cell | Renders |
 * | ---- | ------- |
 * | On a data row | the column's `cell`, as always |
 * | Placeholder - a grouped column other than this row's own | nothing |
 * | Group summary, column declares `aggregatedCell` | that |
 * | Group summary, column declares an `aggregationFn` | the column's `cell`, over the aggregate |
 * | Group summary, column declares neither | nothing |
 *
 * That last row is the one worth spelling out. Without an aggregation function
 * `getValue()` is `undefined` on a group row, so the column's own renderer
 * would be handed nothing - and a renderer that formats what it gets
 * (`value.toFixed(2)`) would throw. Blank is both the safe answer and the right
 * one: a plain "group by" is a tree, not a summary, and a column only joins in
 * once it has been told how.
 */
function renderCellContent(
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>,
) {
  if (cell.getIsPlaceholder()) return null;
  if (!isGroupSummaryCell(cell)) {
    return flexRender(cell.column.columnDef.cell, cell.getContext());
  }
  const { aggregatedCell } = cell.column.columnDef;
  if (aggregatedCell !== undefined) {
    return flexRender(aggregatedCell, cell.getContext());
  }
  if (!cell.getIsAggregated()) return null;
  return flexRender(cell.column.columnDef.cell, cell.getContext());
}

/**
 * A cell on a group row in any column but the one the row groups by - the
 * cells that summarise the group rather than show a record.
 *
 * Not `cell.getIsAggregated()`: since TanStack Table 9.2 that is true only
 * when the column has an aggregation function, so it cannot tell a group
 * row's blank cell from a data row's cell.
 */
function isGroupSummaryCell(
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>,
): boolean {
  return cell.row.getIsGrouped() && !cell.getIsGrouped();
}

/**
 * What a cell needs to take part in cell selection, or `undefined` while the
 * feature is off - which is what keeps a plain grid's cells exactly as they
 * were: no tab stop, no `gridcell` role, no coordinates in the DOM.
 *
 * The coordinates are there for the delegated key handler, which reads them off
 * `event.target` rather than closing over per-cell state, and for the effect
 * that puts DOM focus where {@link TMDataGridUiState.focusedCell} says.
 */
export type TMDataGridCellNav = {
  rowId: string;
  /** 1-based, for `aria-colindex`. */
  columnIndex: number;
  focused: boolean;
  /** The roving tab stop: `0` on exactly one mounted cell, `-1` on the rest. */
  tabIndex: 0 | -1;
  /** Inside the selected rectangle. Always `false` under `"single"`. */
  selected: boolean;
  /**
   * Which sides of the rectangle this cell is on, or `null` when it is not in
   * one. The outline is drawn per cell - see {@link boundsEdges}.
   */
  edges: { top: boolean; bottom: boolean; left: boolean; right: boolean } | null;
};

/**
 * The text with its matched slices wrapped in `<mark>` - or handed back
 * whole when nothing matches. Only ever called on string output; a renderer
 * returning its own elements never reaches this.
 */
function withMatchHighlights(
  text: string,
  needles: ReadonlyArray<string>,
): ReactNode {
  const ranges = findMatchRanges(text, needles);
  if (ranges === null) return text;
  const parts: Array<ReactNode> = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(
      <mark key={range.start} className={classes.matchHighlight}>
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function TMDataGridBodyCell({
  cell,
  rowHeight,
  colSpan = 1,
  layout,
  nav,
  editor,
  contentOverride,
  highlightNeedles,
  onFocus,
  onClick,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onContextMenu,
}: {
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  rowHeight: number;
  /** Columns this cell covers - see `meta.colSpan`. */
  colSpan?: number;
  layout: TMDataGridColumnLayout;
  nav?: TMDataGridCellNav;
  /** The mounted editor, when this is the cell being edited. */
  editor?: ReactNode;
  /**
   * Replaces the column renderer's output - the row-number gutter, whose
   * value only the body knows. `undefined` means "render normally".
   */
  contentOverride?: ReactNode;
  /**
   * Needles to highlight in string output - see `enableMatchHighlighting`.
   * `undefined` almost always: only set while a highlightable filter is
   * active for this column.
   */
  highlightNeedles?: ReadonlyArray<string>;
  onFocus?: () => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseDown?: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: () => void;
  onDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  // The edit markers subscribe here, per cell, all to the one projection
  // store - so typing in an editor repaints the edited row's cells and
  // nothing else. Constant `false` everywhere while editing is off.
  const { table, edit } = useTMDataGridContext();
  const fieldName = getEditFieldName(cell.column);
  const cellRowId = cell.row.id;
  const isControl = isControlColumn(cell.column.id);
  const isDirty = useSelector(edit.store, (state) => {
    if (fieldName === null) return false;
    const projection = state.rows[cellRowId];
    return projection !== undefined && projection.dirtyFields.includes(fieldName);
  });
  const isInvalid = useSelector(edit.store, (state) => {
    if (fieldName === null) return false;
    const projection = state.rows[cellRowId];
    return projection !== undefined && projection.errorFields.includes(fieldName);
  });
  // The whole draft, not one field: a computed or custom renderer may read any
  // field off the row, so every data cell of a drafted row repaints together
  // when its draft moves - and only then, `values` being reference-stable
  // across meta-only form events. `undefined` everywhere else - including a
  // committed row, whose draft already *is* the row: the hook feeds the draft
  // store's values to the table as `data`, so `row.original` holds them.
  // Only an open form's undecided values need the overlay.
  const draftValues = useSelector(edit.store, (state) => {
    if (isControl) return undefined;
    if (state.committedRowIds.includes(cellRowId)) return undefined;
    if (
      state.newRows.some(
        (newRow) => newRow.tempId === cellRowId && newRow.committed,
      )
    ) {
      return undefined;
    }
    return state.rows[cellRowId]?.values;
  });
  return (
    <div
      // `gridcell` rather than `cell` is what tells a screen reader the arrow
      // keys move a cursor here, so it is set together with the tab stop rather
      // than always.
      role={nav ? "gridcell" : "cell"}
      aria-colindex={nav?.columnIndex}
      aria-colspan={colSpan > 1 ? colSpan : undefined}
      // Published for styling and for autosize, which leaves a spanning cell
      // out of its column's measurement.
      data-col-span={colSpan > 1 ? colSpan : undefined}
      tabIndex={nav?.tabIndex}
      // The marker the delegated key handler tests: a key event whose target is
      // a cell is the grid's, one from inside a cell belongs to whatever holds
      // the focus in there.
      data-cell={nav ? true : undefined}
      // Both coordinates are always present, not only under cell selection:
      // autosize finds a column's mounted cells by the column id, and the pair
      // is how a test addresses one cell -
      // `[data-row-id="42"][data-column-id="name"]`. The cell-navigation
      // selectors also require `data-cell`, so they are unaffected.
      data-row-id={cell.row.id}
      data-column-id={cell.column.id}
      data-focused={nav?.focused || undefined}
      aria-selected={nav?.selected}
      data-selected={nav?.selected || undefined}
      // One attribute per side rather than a class per combination: the
      // stylesheet draws the outline edge by edge, and sixteen classes for the
      // sixteen corners of a rectangle is not a stylesheet anyone can read.
      data-edge-top={nav?.edges?.top || undefined}
      data-edge-bottom={nav?.edges?.bottom || undefined}
      data-edge-left={nav?.edges?.left || undefined}
      data-edge-right={nav?.edges?.right || undefined}
      // Bubbles, so focus landing on a control inside the cell counts as
      // landing on the cell - the ring follows the user into the checkbox
      // rather than being left behind on whichever cell they came from.
      onFocus={onFocus}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
      data-editing={editor !== undefined || undefined}
      data-dirty={isDirty || undefined}
      data-invalid={isInvalid || undefined}
      data-align={getColumnAlign(cell.column)}
      // A control lane is a fixed track, so it cannot take the cell padding the
      // scale grows for text. See isControlColumn.
      data-control-column={isControl || undefined}
      onContextMenu={onContextMenu}
      className={[
        classes.bodyCell,
        layout.isBoundary && layout.pinnedAt === "left" ? sticky.stickyLeft : "",
        layout.isBoundary && layout.pinnedAt === "right"
          ? sticky.stickyRight
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        minHeight: rowHeight,
        gridColumn: colSpan > 1 ? `span ${colSpan}` : undefined,
        left: layout.pinnedAt === "left" ? layout.offset : undefined,
        right: layout.pinnedAt === "right" ? layout.offset : undefined,
        // The focus ring is drawn inside the cell's own box, so the cell has to
        // stack above the cells it shares an edge with - but not above the
        // pinned lanes, or the ring rides over them once the row scrolls
        // sideways. A focused cell that is itself pinned takes the slot above
        // them, keeping its ring whole while the rest of the row slides under
        // it. Values from the stacking ladder in TMDataGrid.module.css.
        position: layout.pinnedAt
          ? "sticky"
          : nav?.focused
            ? "relative"
            : undefined,
        zIndex: layout.pinnedAt
          ? nav?.focused
            ? "var(--dg-z-pinned-focused-cell, 3)"
            : "var(--dg-z-pinned-cell, 2)"
          : nav?.focused
            ? "var(--dg-z-focused-cell, 1)"
            : undefined,
      }}
    >
      {editor ?? (
        <span className={classes.cellContent}>
          {(() => {
            // A row with a live form shows its draft, not `data`: the column's
            // own renderer over a context reading the form's values. The
            // drafts that outlive their editor - parked ones, cellConfirm's
            // kept ones - are the point; group cells are excluded because no
            // group row ever has a form.
            const draftContext =
              draftValues !== undefined &&
              contentOverride === undefined &&
              !cell.getIsPlaceholder() &&
              !isGroupSummaryCell(cell)
                ? draftCellContext(cell, draftValues)
                : undefined;
            // Highlighting reproduces the *default* renderer, value then
            // `toString`, with the matched parts marked. A column with its own
            // `cell` is excluded: its renderer is not the default one, and the
            // grid does not modify a custom renderer's output.
            if (
              highlightNeedles !== undefined &&
              contentOverride === undefined &&
              !cell.getIsPlaceholder() &&
              !isGroupSummaryCell(cell) &&
              cell.column.columnDef.cell === table.getDefaultColumnDef().cell
            ) {
              const value =
                draftContext !== undefined
                  ? draftContext.renderValue()
                  : cell.renderValue();
              if (typeof value === "string" || typeof value === "number") {
                return withMatchHighlights(String(value), highlightNeedles);
              }
            }
            if (draftContext !== undefined) {
              return flexRender(cell.column.columnDef.cell, draftContext);
            }
            return contentOverride ?? renderCellContent(cell);
          })()}
        </span>
      )}
    </div>
  );
}

/**
 * The virtualized body rows, wrapped in the single Menu that serves all of them
 * when `renderRowContextMenu` is set.
 *
 * One instance for the whole body rather than one per row. A Mantine `Menu` is
 * a `Popover`, and a closed Popover still runs its hooks on every render - and
 * the body re-renders on every scroll frame, because that is how virtualization
 * works. Wrapping each of ~20 mounted rows measured a fifth onto a body render;
 * wrapping the group is the same behaviour for one instance.
 *
 * `display: contents` keeps the group out of the grid's layout while still
 * taking the right-click, carrying `Menu.ContextMenu`'s handlers, and passing
 * its inherited `user-select: none` down to the rows.
 */
function TMDataGridBodyRowGroup({
  enabled,
  menuContent,
  menuProps,
  onContextMenu,
  onClose,
  children,
}: {
  enabled: boolean;
  menuContent: ReactNode;
  menuProps?: Omit<MenuProps, "opened" | "onChange" | "children">;
  onContextMenu: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const rowGroup = (
    <div
      role="rowgroup"
      style={{ display: "contents" }}
      // Runs before Mantine's own handler, which `Menu.ContextMenu` composes on
      // top of this one - so the row and cell are known by the time the
      // dropdown is built and opened at the pointer.
      onContextMenu={enabled ? onContextMenu : undefined}
    >
      {children}
    </div>
  );

  if (!enabled) return rowGroup;

  return (
    <Menu
      // Open only once the render prop has returned something: a row it answers
      // `null` for never opens an empty dropdown.
      opened={menuContent !== null}
      onChange={(opened) => {
        if (!opened) onClose();
      }}
      position="bottom-start"
      shadow="md"
      width={220}
      {...menuProps}
    >
      <Menu.ContextMenu>{rowGroup}</Menu.ContextMenu>
      <Menu.Dropdown>{menuContent}</Menu.Dropdown>
    </Menu>
  );
}

/** What `renderRowContextMenu` is handed for the right-clicked row. */
export type TMDataGridRowContextMenuArgs<TData extends RowData> = {
  table: Table<TMDataGridFeatures, TData>;
  row: Row<TMDataGridFeatures, TData>;
  /**
   * The cell under the pointer. `null` only when the right-click landed on the
   * row but on no cell - which a custom cell renderer that stops propagation
   * can cause.
   */
  cell: Cell<TMDataGridFeatures, TData, unknown> | null;
  /**
   * Closes the menu. `Menu.Item` already closes on click (Mantine's
   * `closeOnItemClick`), so this is for content that isn't a menu item.
   */
  close: () => void;
  /**
   * The grid's own items for this menu: the cell copy and export items, under
   * `cellSelection: "range"`, and `null` otherwise.
   *
   * Placing it decides the order. Ignore it and the grid keeps today's
   * behavior, rendering its items above a divider and yours below.
   */
  internalItems: ReactNode;
};

/**
 * Builds the contents of a row's context menu - `Menu.Item`, `Menu.Label`,
 * `Menu.Divider`, `Menu.Sub`, or any other node. The grid owns the `Menu` and
 * its `Menu.Dropdown`; this fills the dropdown.
 */
export type TMDataGridRowContextMenuRenderer<TData extends RowData> = (
  args: TMDataGridRowContextMenuArgs<TData>,
) => ReactNode;

/**
 * What the `onCellClick` family receives - the cell with its row and column,
 * in the consumer's own row type, plus the pointer event.
 */
export type TMDataGridCellEventArgs<TData extends RowData> = {
  cell: Cell<TMDataGridFeatures, TData, unknown>;
  row: Row<TMDataGridFeatures, TData>;
  column: Column<TMDataGridFeatures, TData, unknown>;
  event: MouseEvent<HTMLElement>;
};

/**
 * Inline styles for a row. Widened to accept CSS variables, because setting
 * `--row-bg` is the supported way to colour a row - see {@link
 * TMDataGridTableProps.rowStyle}.
 */
export type TMDataGridRowStyle =
  | CSSProperties
  | (CSSProperties & Record<`--${string}`, string | number>);

export type TMDataGridTableProps<TData extends RowData> = {
  /**
   * Called when a body row is clicked. Runs in addition to row selection under
   * `selectionMode: "row"`, not instead of it.
   */
  onRowClick?: (row: Row<TMDataGridFeatures, TData>) => void;
  /**
   * Called when a body cell is clicked. Composes, never suppresses: whatever
   * the click already does - selecting, highlighting, moving the cell cursor
   * - still happens. Group rows sit out the cell handlers the way they sit
   * out `onRowClick`, and for the same reason.
   */
  onCellClick?: (args: TMDataGridCellEventArgs<TData>) => void;
  /** As {@link onCellClick}; a double-click that opens an editor still does. */
  onCellDoubleClick?: (args: TMDataGridCellEventArgs<TData>) => void;
  /**
   * As {@link onCellClick}; `renderRowContextMenu` and the cell-selection menu still
   * open. To suppress the browser's own menu on a grid with neither, call
   * `event.preventDefault()` here.
   */
  onCellContextMenu?: (args: TMDataGridCellEventArgs<TData>) => void;
  /**
   * Class for a body row - a string, or a function of the row (group rows
   * included; test `row.getIsGrouped()` to skip them). Added after the grid's
   * own row class.
   */
  rowClassName?:
    | string
    | ((row: Row<TMDataGridFeatures, TData>) => string | undefined);
  /**
   * Inline style for a body row. To colour a row, set `--row-bg` rather than
   * `background`: the row's own background, its sticky pinned cells and the
   * cell-range tint all read that variable, and hover/selection/highlight
   * keep working on top of it - a raw `background` bypasses all of them.
   *
   * ```tsx
   * rowStyle={(row) =>
   *   row.original.overdue ? { "--row-bg": "var(--mantine-color-red-0)" } : undefined
   * }
   * ```
   */
  rowStyle?:
    | TMDataGridRowStyle
    | ((row: Row<TMDataGridFeatures, TData>) => TMDataGridRowStyle | undefined);
  /**
   * Every second row takes `--dg-row-striped-bg`. Computed from the row's
   * position in the view - sorting and filtering restripe, and the stripes
   * stay put while the virtualizer mounts and unmounts rows.
   */
  striped?: boolean;
  /**
   * Whether a body row takes the hover tint under the pointer. Unset, a row
   * takes it when the row itself answers a gesture: `selectionMode: "row"`,
   * a highlight mode, `onRowClick` or `renderRowContextMenu`. Group rows sit
   * out those gestures and so sit out the tint too. `true` tints every row,
   * `false` none. The row carries `data-highlight-on-hover` while it applies.
   */
  highlightOnHover?: boolean;
  /**
   * Called when the scroll *arrives* at an edge - once per arrival, not per
   * scroll event, and not on mount (the grid starts at the top-left edge).
   * For loading more rows as the end approaches, `onReachEnd` is the better
   * hook: it fires rows-early and latches per row count.
   */
  onScrollToTop?: () => void;
  /** As {@link onScrollToTop}, for the bottom edge. */
  onScrollToBottom?: () => void;
  /** As {@link onScrollToTop}, for the left edge. */
  onScrollToLeft?: () => void;
  /** As {@link onScrollToTop}, for the right edge. */
  onScrollToRight?: () => void;
  /**
   * Rendered centred in the body when the view is empty - the branded blank
   * slate. It takes over states 3 and 4 of the empty matrix (see the docs):
   * loading still shows the loader, and open entry rows still show only
   * themselves. `hasActiveFilters` says which emptiness this is - a filter
   * that matched nothing wants a "clear filters" invitation, a grid with no
   * data wants a "create the first one".
   */
  renderEmptyState?: (args: {
    hasActiveFilters: boolean;
    table: Table<TMDataGridFeatures, TData>;
  }) => ReactNode;
  /**
   * Contents of the menu a right-click on a row opens, at the pointer. Return
   * `null` to leave a row without one - the browser's own menu stays suppressed
   * either way.
   *
   * ```tsx
   * <TMDataGrid.Table<Employee>
   *   renderRowContextMenu={({ row, close }) => (
   *     <>
   *       <Menu.Label>{row.original.firstName}</Menu.Label>
   *       <Menu.Item onClick={() => open(row.original.id)}>Open</Menu.Item>
   *       <Menu.Divider />
   *       <Menu.Item color="red" onClick={() => remove(row.original.id)}>
   *         Delete
   *       </Menu.Item>
   *     </>
   *   )}
   * />
   * ```
   *
   * `internalItems` is the grid's own half - place it to control the order,
   * ignore it and the grid keeps its items above a divider and yours below.
   *
   * Called during render, and only for the row whose menu is open - so it stays
   * a pure function of the row, and cost per row does not matter.
   */
  renderRowContextMenu?: TMDataGridRowContextMenuRenderer<TData>;
  /**
   * Replaces a column menu's contents, taking the grid's own items and
   * returning the full list.
   *
   * ```tsx
   * <TMDataGrid.Table
   *   renderColumnMenuItems={({ column, internalItems }) => [
   *     ...internalItems,
   *     <Menu.Divider key="custom" />,
   *     <Menu.Item key="stats" onClick={() => showStats(column.id)}>
   *       Statistics
   *     </Menu.Item>,
   *   ]}
   * />
   * ```
   *
   * Returning an empty list leaves the column with no menu button, the same as
   * a column whose every feature is switched off.
   */
  renderColumnMenuItems?: TMDataGridColumnMenuItemsRenderer;
  /**
   * Passed to the Mantine `Menu` the grid wraps the row in - `width`, `shadow`,
   * `position`, `transitionProps` and the rest. Its open state is the grid's.
   */
  rowContextMenuProps?: Omit<MenuProps, "opened" | "onChange" | "children">;
  /**
   * Called when the scroll approaches the last row - the infinite-scroll
   * hook-in. Append the next page to `data` and the virtualizer keeps its
   * position; fires once per row count, so a pending fetch is not asked
   * again until it lands.
   *
   * ```tsx
   * <TMDataGrid.Table onReachEnd={() => query.fetchNextPage()} />
   * ```
   *
   * Sorting and filtering must be server-side (`manual*`) on a grid that
   * loads this way - the client only ever holds a prefix of the data. Not
   * compatible with `enablePagination`, which slices the same scroll.
   */
  onReachEnd?: () => void;
  /**
   * How many rows before the end {@link onReachEnd} fires at. Defaults to 10.
   */
  reachEndThreshold?: number;
  /**
   * Accessible name for the grid: what a screen reader announces on entry, and
   * what `getByRole("grid", { name })` matches. Set it on any page holding more
   * than one grid; without it they are all announced as "grid".
   */
  "aria-label"?: string;
  /** As {@link "aria-label"}, pointing at an element that already names it. */
  "aria-labelledby"?: string;
};

/**
 * The scrollable grid surface. Always virtualized: only the rows inside the
 * viewport (plus overscan) are mounted, which is what makes the default
 * no-pagination mode work at any row count. Pagination is opt in through
 * `enablePagination`, or implied by `manualPagination`.
 */
export function TMDataGridTable<TData extends RowData = TMDataGridRowData>({
  onRowClick,
  onCellClick,
  onCellDoubleClick,
  onCellContextMenu,
  rowClassName,
  rowStyle,
  striped = false,
  highlightOnHover,
  onScrollToTop,
  onScrollToBottom,
  onScrollToLeft,
  onScrollToRight,
  renderEmptyState,
  renderRowContextMenu,
  renderColumnMenuItems,
  rowContextMenuProps,
  onReachEnd,
  reachEndThreshold = 10,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: TMDataGridTableProps<TData>) {
  const {
    table,
    ui,
    edit,
    features,
    filters,
    exportOptions: gridExportOptions,
    labels,
    rowHeight,
    controlSize,
    renderDetails,
    renderDetailsEstHeight,
    overscan,
    scrollerRef,
  } = useTMDataGridContext();

  // The body depends on every settled state slice (sorting, filters, paging,
  // sizing, visibility, selection). Not on the transient resize deltas: those
  // publish on every pointer move and the drag paints itself, see below.
  useSettledTableState(table.store);
  // The active row lives in the chrome store, so it needs its own subscription.
  const highlightedRowId = useSelector(ui, (state) => state.highlightedRowId);
  // As does the focused cell. Selected separately from the row above so a grid
  // with cell selection off never re-renders for it.
  const focusedCell = useSelector(ui, (state) => state.focusedCell);
  const cellRange = useSelector(ui, (state) => state.cellRange);
  // Which cell has an editor open. The projection (dirty/error markers) is
  // subscribed per cell instead - see TMDataGridBodyCell.
  const editActive = useSelector(edit.store, (state) => state.active);
  // Row mode opens whole rows and any number of them at once, so which rows
  // are showing editors is the set of open forms, not the single active slot.
  const editOpenRowIds = useSelector(edit.store, (state) => state.openRowIds);
  // Entry rows, for the block's mount and for `data-new` on the committed
  // ones that have joined the body. Identity-stable across typing.
  const newRows = useSelector(edit.store, (state) => state.newRows);
  const newRowCount = newRows.length;
  const deletedRowIds = useSelector(edit.store, (state) => state.deletedRowIds);
  // Rows carrying a dirty draft, for the row-level marker. Derived from the
  // same projections the cells subscribe to; the array's identity churns with
  // `openRowIds`' own per-publish churn, so this adds no new render class.
  const editDirtyRowIds = useSelector(edit.store, (state) =>
    state.openRowIds.filter(
      (id) => (state.rows[id]?.dirtyFields.length ?? 0) > 0,
    ),
  );
  // Rows parked in the draft store, waiting for Save. A separate marker from
  // `data-dirty`, which covers any row being typed into: after a partial save
  // these are what is left, so one selector highlights everything still
  // pending.
  const editDraftRowIds = useSelector(
    edit.store,
    (state) => state.committedRowIds,
  );
  // The same lists by id: the body asks them once per rendered row, and an
  // import runs each of them to thousands.
  const editOpenRowIdSet = useMemo(
    () => new Set(editOpenRowIds),
    [editOpenRowIds],
  );
  const editDirtyRowIdSet = useMemo(
    () => new Set(editDirtyRowIds),
    [editDirtyRowIds],
  );
  const editDraftRowIdSet = useMemo(
    () => new Set(editDraftRowIds),
    [editDraftRowIds],
  );
  const newRowIdSet = useMemo(
    () => new Set(newRows.map((newRow) => newRow.tempId)),
    [newRows],
  );

  const { loading, noResultsLabel = labels.noResults } =
    table.options.meta ?? {};

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Pagination off (the default): every filtered+sorted row, virtualized.
  // Pagination on: the current page; under `manualPagination` TanStack returns
  // the rows as delivered, so the same branch serves server paging.
  const rows = getDisplayedRows(table, features);

  // Per-column highlight needles, or `null` while off or nothing is active -
  // the common case, costing one flag check per render.
  const matchNeedles = features.matchHighlighting
    ? buildMatchNeedles(table)
    : null;

  // The edge blocks. `getDisplayedRows` above has already taken these out of
  // the scrolling order; stale ids resolve to nothing - see readPinnedRows.
  const pinnedTopRows = features.rowPinning ? readPinnedRows(table, "top") : [];
  const pinnedBottomRows = features.rowPinning
    ? readPinnedRows(table, "bottom")
    : [];
  const pinnedRowCount = pinnedTopRows.length + pinnedBottomRows.length;

  // The row-number gutter's numbers: one pass over the view per render, only
  // while the lane exists. A cell cannot know its display position, so the
  // body hands each row its number - group rows get none (they are headings
  // over the rows being counted), and paging continues the count across
  // pages rather than restarting every page at 1.
  let rowNumberById: Map<string, number> | null = null;
  if (features.rowNumbers) {
    rowNumberById = new Map();
    let n = isPagingActive(table, features)
      ? table.store.state.pagination.pageIndex *
        table.store.state.pagination.pageSize
      : 0;
    for (const viewRow of rows) {
      if (!viewRow.getIsGrouped()) rowNumberById.set(viewRow.id, ++n);
    }
  }

  /**
   * Whether this row opens a detail panel underneath it.
   *
   * Group rows are out: expanding one opens its children, and they share the
   * `expanded` state with details - so a grouped grid with `renderDetails` set
   * would otherwise render a panel about the group's first record.
   */
  const showsDetails = (row: Row<TMDataGridFeatures, TMDataGridRowData>) =>
    renderDetails !== undefined && !row.getIsGrouped() && row.getIsExpanded();

  /**
   * `meta.autoSize` columns, sized once each after the first rows are in the
   * DOM.
   *
   * The wait is required. The virtualizer measures its scroll element in an
   * effect and mounts its first rows in the render that follows, so on the
   * mounting commit this column has a header and no cells, and autosize would
   * fit the header alone and keep that width for the rest of the session. The
   * ids are therefore held in a set, and each one is dropped only once it has
   * been measured against mounted content.
   *
   * A ref rather than an effect dependency: a column is sized once per mount,
   * and only while no persisted or user width covers it - autosizing again on a
   * data change would fight a width the user has since dragged. Built from
   * every leaf column rather than the visible ones, so a column hidden at mount
   * is still sized when it is shown.
   */
  const pendingAutoSizeRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container === null) return;
    pendingAutoSizeRef.current ??= new Set(
      table
        .getAllLeafColumns()
        .filter((column) => column.columnDef.meta?.autoSize === true)
        .map((column) => column.id),
    );
    const pending = pendingAutoSizeRef.current;
    if (pending.size === 0) return;

    for (const columnId of [...pending]) {
      if (columnId in table.store.state.columnSizing) {
        pending.delete(columnId);
        continue;
      }
      if (!hasMountedCells(container, columnId)) continue;
      autosizeColumn({ table, columnId, container });
      pending.delete(columnId);
    }
  });

  /**
   * Everything the body rows start after, and how much of it stays on screen
   * once they scroll: the header rows, the entry block and the pinned top
   * block all sit in the same scroll content, above the first virtual row.
   *
   * Three readers, one measurement.
   *
   * `--dg-header-height` is the header total alone, published for the entry
   * block to stick under and only while a block is in use - the stylesheet's
   * per-`size` value is what the header cells are laid out against otherwise,
   * and it is not the sum of a stacked group's rows.
   *
   * `bodyOffsetTop` is the whole stack, and it is the virtualizer's
   * `scrollMargin`: item offsets start at zero, so without it every one of
   * them is short by the height of what the rows begin after. `stickyCoverTop`
   * leaves out the entry rows that flow with the body (`editNewRowsSticky`
   * off), and is its `scrollPaddingStart` - the part of the stack that stays
   * put and would otherwise be covering the row `align: "auto"` just scrolled
   * to.
   *
   * The observer is mounted whatever the grid shows, unlike the block
   * measurements below it: the header is there in every case, and the
   * virtualizer needs its height from the first paint.
   */
  const gridElementRef = useRef<HTMLDivElement>(null);
  /**
   * Header filters only render where something can be filtered - the row would
   * otherwise be a band of empty cells on a grid with `enableColumnFilters:
   * false`. Derived up here because the header measurement below depends on
   * whether the row is in the DOM.
   */
  const hasHeaderFilterRow =
    filters.inHeader && getGridCapabilities(table, features).canFilterAny;
  /**
   * How many rows deep the header is. In the measurement's dependencies
   * because the rows are found once, by query: a `columns` change that adds or
   * drops a group level changes which elements have to be measured and given
   * their sticky inset, and nothing else in the list moves when it does.
   */
  const headerDepth = table.getCenterHeaderGroups().length;
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [bodyOffsetTop, setBodyOffsetTop] = useState(0);
  const [stickyCoverTop, setStickyCoverTop] = useState(0);
  const [stickyCoverBottom, setStickyCoverBottom] = useState(0);
  useEffect(() => {
    const grid = gridElementRef.current;
    if (grid === null) return;
    const headerRows = grid.querySelectorAll<HTMLElement>(
      "[data-dg-header-row]",
    );
    const stickyBlocks = grid.querySelectorAll<HTMLElement>(
      '[data-dg-entry-block], [data-dg-part="pinned-top"]',
    );
    const flowBlocks = grid.querySelectorAll<HTMLElement>(
      "[data-dg-entry-flow-block]",
    );
    const measure = () => {
      let header = 0;
      for (const headerRow of headerRows) {
        // Every header row is sticky, so each one needs the height of the rows
        // above it as its own inset - otherwise a stacked group and the filter
        // row all pin to the top edge and paint over each other. Written on the
        // element because only JS knows where the row before it ended; the
        // stylesheet's `top` is the pre-measurement fallback.
        headerRow.style.top = `${header}px`;
        header += headerRow.offsetHeight;
      }
      if (newRowCount > 0 || pinnedTopRows.length > 0) {
        grid.style.setProperty("--dg-header-height", `${header}px`);
      }
      // The whole header's height, on the wrapper rather than on the grid,
      // because the popup is a sibling of the scroll container and never sees
      // a property set inside it. A second name rather than reusing
      // `--dg-header-height`: the header cells read that one for their own
      // `min-height`, so publishing a stacked total there would feed a
      // two-row header back in as the height of each of its rows.
      tableWrapperRef.current?.style.setProperty(
        "--dg-header-stack-height",
        `${header}px`,
      );
      let cover = header;
      for (const block of stickyBlocks) cover += block.offsetHeight;
      let offset = cover;
      for (const block of flowBlocks) offset += block.offsetHeight;
      setStickyCoverTop(cover);
      setBodyOffsetTop(offset);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [...headerRows, ...stickyBlocks, ...flowBlocks]) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [newRowCount, pinnedTopRows.length, hasHeaderFilterRow, headerDepth]);

  /**
   * The entry block's height, published as `--dg-entry-height` so the pinned
   * top block can stack under it - measured only while both blocks exist,
   * which is the only time the offset is anything but 0.
   */
  useEffect(() => {
    if (newRowCount === 0 || pinnedTopRows.length === 0) return;
    const grid = gridElementRef.current;
    if (grid === null) return;
    const entryBlock = grid.querySelector<HTMLElement>("[data-dg-entry-block]");
    if (entryBlock === null) return;
    const measure = () =>
      grid.style.setProperty("--dg-entry-height", `${entryBlock.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(entryBlock);
    return () => {
      observer.disconnect();
      grid.style.removeProperty("--dg-entry-height");
    };
  }, [newRowCount, pinnedTopRows.length]);

  // A persisted pageIndex can outlive the data that produced it; TanStack only
  // auto-resets on live filter/sort/data changes, not on restored state. The
  // guard makes the dependency-free effect idempotent.
  useEffect(() => {
    if (!features.pagination) return;
    const pageCount = table.getPageCount();
    if (pageCount > 0 && table.store.state.pagination.pageIndex >= pageCount) {
      table.setPageIndex(pageCount - 1);
    }
  });

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    /**
     * Exact for a plain row, which is fixed at `rowHeight`, and a guess for a
     * row showing a detail panel - the panel is as tall as whatever the
     * consumer renders. Rows are measured whenever details are on (see
     * `measureElement` below), so this only has to hold until the row has been
     * on screen once.
     *
     * Not a `useCallback`, unlike `getItemKey` below it: the virtualizer's
     * measurement cache lists `getItemKey` among its dependencies and not this,
     * so a stable identity here would buy nothing - and the closure has to see
     * the current expansion to answer at all.
     */
    estimateSize: (index: number) => {
      const row = rows[index];
      if (row === undefined) return rowHeight;
      return rowHeight + (showsDetails(row) ? renderDetailsEstHeight : 0);
    },
    /**
     * Zero is never a row: every one carries `minHeight: rowHeight`. An element
     * reports it before layout has run - and always under jsdom, which has no
     * layout at all - and a row cached at zero height stays that way until
     * something resizes it. The estimate stands in until there is a real
     * measurement.
     */
    measureElement: (element, _entry, instance) =>
      element.getBoundingClientRect().height ||
      instance.options.estimateSize(instance.indexFromElement(element)),
    getItemKey: useCallback((index: number) => rows[index]?.id ?? index, [rows]),
    overscan,
    initialRect: { height: 600, width: 1200 },
    /**
     * The rows are not the first thing in the scroll container - the header,
     * the entry block and the pinned top block come before them. The margin is
     * what puts an item's offset in the container's own scroll coordinates;
     * the two paddings are the sticky blocks at either end, which cover the
     * viewport without shrinking it, so `align: "auto"` has to scroll past
     * them rather than stopping underneath.
     */
    scrollMargin: bodyOffsetTop,
    scrollPaddingStart: stickyCoverTop,
    scrollPaddingEnd: stickyCoverBottom,
  });

  /**
   * A live `size` (or `meta.rowHeight`) change moves what `estimateSize`
   * answers, but the virtualizer's measurement cache does not list that option
   * among its dependencies - by its own docs, changing the estimate means
   * calling `measure()`. Without this the spacers keep the old height until
   * something else invalidates the cache, so the scroll range and the window
   * disagree with the rows actually painted.
   */
  const prevRowHeightRef = useRef(rowHeight);
  useEffect(() => {
    if (prevRowHeightRef.current === rowHeight) return;
    prevRowHeightRef.current = rowHeight;
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  // The spacers stand in for the rows that are not mounted, so they measure
  // from the first row rather than from the top of the scroll container:
  // `scrollMargin` is included in every item's `start` and `end` and excluded
  // from `getTotalSize()`, and taking it back off here is what keeps a spacer
  // the height of the rows it replaces.
  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = (virtualItems[0]?.start ?? bodyOffsetTop) - bodyOffsetTop;
  const paddingBottom =
    virtualizer.getTotalSize() -
    ((virtualItems.at(-1)?.end ?? bodyOffsetTop) - bodyOffsetTop);

  /**
   * `api.scrollToRow`, implemented where the virtualizer is.
   *
   * Registered in an effect rather than during render, and with no dependency
   * array so it re-registers on every one: the closure has to see this render's
   * `rows`, which sorting, filtering and paging all change. A grid whose Table
   * has unmounted leaves the hook's default behind, which answers `false`.
   */
  useEffect(() => {
    scrollerRef.current = ({ rowId, align = "auto" }) => {
      // Already parked at an edge, and outside the scrolling order - see
      // `getDisplayedRows`. Nothing to scroll, but the row *is* on screen, so
      // reporting failure would be the wrong answer.
      if (
        pinnedTopRows.some((row) => row.id === rowId) ||
        pinnedBottomRows.some((row) => row.id === rowId)
      ) {
        return true;
      }
      const index = rows.findIndex((row) => row.id === rowId);
      if (index < 0) return false;
      virtualizer.scrollToIndex(index, { align });
      return true;
    };
    return () => {
      scrollerRef.current = () => false;
    };
  });

  /**
   * Infinite scroll. Latched on the row count rather than debounced: one call
   * per count means a pending fetch is never asked twice, and the append that
   * resolves it changes the count, which re-arms the latch. A failed fetch
   * stays quiet until something changes the rows - retrying is the
   * consumer's call, not a scroll side effect.
   *
   * Effect (not render): `onReachEnd` sets consumer state.
   */
  const reachEndFiredForCountRef = useRef<number | null>(null);
  const warnedReachEndPaginationRef = useRef(false);
  const lastMountedIndex = virtualItems.at(-1)?.index ?? -1;
  useEffect(() => {
    if (onReachEnd === undefined || rows.length === 0) return;
    if (features.pagination && !warnedReachEndPaginationRef.current) {
      warnedReachEndPaginationRef.current = true;
      console.warn(
        "TMDataGrid: onReachEnd and pagination slice the same scroll - the pager caps the rows, so the end it reaches is the page's. Use one or the other.",
      );
    }
    if (lastMountedIndex < rows.length - 1 - reachEndThreshold) return;
    if (reachEndFiredForCountRef.current === rows.length) return;
    reachEndFiredForCountRef.current = rows.length;
    onReachEnd();
  });

  // The *Visible* variants throughout: `getStartLeafColumns()` and friends
  // include hidden columns, while the cells below come from
  // `row.getStartVisibleCells()`, which does not. Mixing the two would lay down
  // a grid track for a column that renders no cell, shifting every column after
  // it out of its header. The tree column is hidden exactly this way while
  // nothing is grouped.
  const leftLeafColumns = table.getStartVisibleLeafColumns();
  const rightLeafColumns = table.getEndVisibleLeafColumns();
  const centerLeafColumns = table.getCenterVisibleLeafColumns();

  const orderedColumns = [
    ...leftLeafColumns,
    ...centerLeafColumns,
    ...rightLeafColumns,
  ];

  // `meta.colSpan`, resolved per row over the displayed columns. Built from
  // the three leaf arrays rather than `column.getIsPinned()`, for the reason
  // the sticky offsets below give. `null` while no column asks to span, so a
  // plain grid never calls into it.
  const spanColumns = orderedColumns.some(
    (column) => column.columnDef.meta?.colSpan !== undefined,
  )
    ? orderedColumns.map((column, index) => ({
        id: column.id,
        colSpan: column.columnDef.meta?.colSpan,
        section: (index < leftLeafColumns.length
          ? "left"
          : index < leftLeafColumns.length + centerLeafColumns.length
            ? "center"
            : "right") as TMDataGridColumnSection,
      }))
    : null;
  /**
   * Row mode opens every editable cell of the row at once, and rows
   * accumulate: a second row opening leaves the first one open, so every row
   * holding a form shows its editors. Which of them holds the caret is not
   * decided here - see placeEditCaret, which places it once per gesture.
   *
   * A parked row is not one of them. It keeps its form, so it is still
   * "open", but it has been decided: it renders its draft through the
   * column's own renderer until `begin` reopens it. A committed entry row in
   * the body has a form too - every entry row does - but it is a value row
   * until reopened, and reopening takes it back to the entry block.
   *
   * Such a row also drops its spans: the form has an editor in every column.
   */
  const isRowEditing = (row: Row<TMDataGridFeatures, TMDataGridRowData>) =>
    features.editMode === "row" &&
    editOpenRowIdSet.has(row.id) &&
    !editDraftRowIdSet.has(row.id) &&
    !newRowIdSet.has(row.id);
  const colSpanCache = new Map<string, Array<number> | null>();
  /**
   * The spans of one row - see {@link resolveColSpans} - or `null` when every
   * cell is one column wide. Group rows keep their cells: the tree cell and
   * the aggregates are the grid's, not a record's.
   */
  const colSpansOf = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
  ): Array<number> | null => {
    if (spanColumns === null || row.getIsGrouped() || isRowEditing(row)) {
      return null;
    }
    const cached = colSpanCache.get(row.id);
    if (cached !== undefined) return cached;
    const spans = resolveColSpans(spanColumns, (index) => {
      const colSpan = spanColumns[index]?.colSpan;
      return typeof colSpan === "function"
        ? colSpan({ row, table })
        : (colSpan ?? 1);
    });
    // The open cell editor lives in its column's cell. A span landing on that
    // column - the row expanding under the edit, say - would unmount the
    // editor without closing it, so the row keeps its cells until the edit
    // ends.
    const editIndex =
      editActive !== null && editActive.rowId === row.id
        ? orderedColumns.findIndex(
            (column) => column.id === editActive.columnId,
          )
        : -1;
    const resolved =
      spans.every((span) => span === 1) ||
      (editIndex >= 0 && spans[editIndex] === 0)
        ? null
        : spans;
    colSpanCache.set(row.id, resolved);
    return resolved;
  };
  /** Whether the column at `columnIndex` is covered by a span on `row`. */
  const isCoveredCell = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
    columnIndex: number,
  ): boolean => {
    const spans = colSpansOf(row);
    return spans !== null && spans[columnIndex] === 0;
  };
  /**
   * A position moved onto the cell that renders it, under spans: the input
   * itself when its cell renders, so a caller can compare by identity. `row`
   * is the position's row; `undefined` for a pinned row, which is not in
   * `rows` and keeps its position as it is.
   */
  const toRenderedCell = (
    position: TMDataGridCellPosition,
    row: Row<TMDataGridFeatures, TMDataGridRowData> | undefined,
  ): TMDataGridCellPosition => {
    if (spanColumns === null || row === undefined) return position;
    const spans = colSpansOf(row);
    if (spans === null) return position;
    const columnIndex = orderedColumns.findIndex(
      (column) => column.id === position.columnId,
    );
    if (columnIndex < 0) return position;
    const anchorIndex = spanAnchorIndex(spans, columnIndex);
    if (anchorIndex === columnIndex) return position;
    const anchor = orderedColumns[anchorIndex];
    return anchor ? { ...position, columnId: anchor.id } : position;
  };

  // Headers and cells must follow the same left → center → right order as the
  // column tracks, otherwise pinning a column would shuffle it out of its lane.
  const centerHeaderGroups = table.getCenterHeaderGroups();
  const leftHeaderGroups = table.getStartHeaderGroups();
  const rightHeaderGroups = table.getEndHeaderGroups();
  const headerGroups = centerHeaderGroups.map((group, index) => ({
    id: group.id,
    headers: [
      ...(leftHeaderGroups[index]?.headers ?? []),
      ...group.headers,
      ...(rightHeaderGroups[index]?.headers ?? []),
    ],
  }));
  // Unresized columns stay fluid (`minmax(min, flex fr)`) so the grid fills the
  // viewport; dragging a resize handle pins that column to an exact pixel width.
  // minWidth is the sum of those floors - anything wider and the grid would
  // force a horizontal scrollbar it doesn't need.
  //
  // Pinned columns are always exact: their sticky offsets come from
  // `getStart()` / `getAfter()`, which sum `getSize()` and cannot see an `fr`.
  const columnSizing = table.store.state.columnSizing;
  const columnTracks: Array<TMDataGridColumnTrack> = orderedColumns.map(
    (column) => {
      const isFixed = column.columnDef.minSize === column.columnDef.maxSize;
      const isResized = column.id in columnSizing;
      const isPinned = column.getIsPinned() !== false;
      const minWidth = column.columnDef.minSize ?? DEFAULT_COLUMN_MIN_SIZE;
      if (isFixed || isResized || isPinned) {
        return {
          id: column.id,
          track: `${column.getSize()}px`,
          minWidth: column.getSize(),
        };
      }
      return {
        id: column.id,
        track: `minmax(${minWidth}px, ${column.columnDef.meta?.flex ?? 1}fr)`,
        minWidth,
      };
    },
  );
  const gridTemplateColumns = columnTracks.map((c) => c.track).join(" ");
  const gridMinWidth = columnTracks.reduce((sum, c) => sum + c.minWidth, 0);

  /**
   * Sticky offsets are derived here, from state this component subscribes to,
   * and handed down as props.
   *
   * Deriving them inside the cell via `column.getIsPinned()` /
   * `column.getStart()` looks equivalent but isn't: those are plain calls on a
   * `column` object whose identity survives a pin, so the React Compiler caches
   * the result and the cell keeps rendering with stale pinning. Building the
   * offsets from the same widths as the grid tracks also guarantees the two
   * agree to the pixel.
   */
  const columnLayout = new Map<string, TMDataGridColumnLayout>();
  const widthOf = (columnId: string) =>
    columnTracks[orderedColumns.findIndex((c) => c.id === columnId)]?.minWidth ??
    0;

  let leftOffset = 0;
  for (const column of leftLeafColumns) {
    columnLayout.set(column.id, {
      pinnedAt: "left",
      offset: leftOffset,
      isBoundary: column.id === leftLeafColumns.at(-1)?.id,
    });
    leftOffset += widthOf(column.id);
  }
  let rightOffset = 0;
  for (const column of [...rightLeafColumns].reverse()) {
    columnLayout.set(column.id, {
      pinnedAt: "right",
      offset: rightOffset,
      isBoundary: column.id === rightLeafColumns[0]?.id,
    });
    rightOffset += widthOf(column.id);
  }
  for (const column of centerLeafColumns) {
    columnLayout.set(column.id, {
      pinnedAt: false,
      offset: 0,
      isBoundary: false,
    });
  }
  const layoutFor = (columnId: string) =>
    columnLayout.get(columnId) ?? UNPINNED_LAYOUT;
  /**
   * The layout of a cell spanning from `columnId` to the column at
   * `lastIndex`. A span never leaves its pinned block, so only the sticky
   * offset and the boundary shadow change: a right-pinned cell sticks at the
   * offset of the last column it covers, and the cell covering a block's
   * boundary column carries its shadow.
   */
  const spanLayout = (
    firstIndex: number,
    lastIndex: number,
  ): TMDataGridColumnLayout => {
    const first = layoutFor(orderedColumns[firstIndex]!.id);
    if (first.pinnedAt === false) return first;
    const covered = orderedColumns
      .slice(firstIndex, lastIndex + 1)
      .map((column) => layoutFor(column.id));
    return {
      ...first,
      offset:
        first.pinnedAt === "right"
          ? (covered.at(-1)?.offset ?? first.offset)
          : first.offset,
      isBoundary: covered.some((layout) => layout.isBoundary),
    };
  };

  /**
   * A running resize drag paints itself, straight onto the grid element.
   *
   * Every row sits on the grid's own column tracks through `subgrid`, so the
   * whole drag is one style write per frame. Letting the drag render instead -
   * `columnResizeMode: "onChange"`, which publishes a width on every pointer
   * move - costs a React pass over every mounted cell for each of those moves,
   * and the gesture turns choppy on a grid wide enough to be worth resizing.
   *
   * TanStack still owns the gesture and still commits the width into
   * `columnSizing` when the pointer is released; the render that follows lands
   * on the same numbers the last frame painted.
   */
  const previewRef = useRef<{
    tracks: Array<TMDataGridColumnTrack>;
    leftLane: Array<string>;
    rightLane: Array<string>;
  }>({ tracks: columnTracks, leftLane: [], rightLane: [] });
  useEffect(() => {
    previewRef.current = {
      tracks: columnTracks,
      leftLane: leftLeafColumns.map((column) => column.id),
      // Outermost last, the order the offsets above accumulate in.
      rightLane: [...rightLeafColumns].reverse().map((column) => column.id),
    };
  });
  useEffect(() => {
    const element = gridElementRef.current;
    if (!element) return;

    // Painted straight from the store's publish rather than on a frame of its
    // own: the browser already coalesces pointer moves to one per frame, and a
    // `requestAnimationFrame` stops firing altogether while the window is
    // occluded - which would leave the drag frozen under the pointer.
    let painted = "";
    const subscription = table.store.subscribe((state) => {
      const preview = resizePreview({
        progress: state.columnResizing,
        boundsOf: (columnId) => table.getColumn(columnId)?.columnDef ?? {},
        ...previewRef.current,
      });
      if (!preview || preview.gridTemplateColumns === painted) return;
      painted = preview.gridTemplateColumns;
      element.style.gridTemplateColumns = preview.gridTemplateColumns;
      element.style.minWidth = `${preview.minWidth}px`;
      // Only the pinned lanes, and only while the drag is resizing one of
      // them: their sticky offsets are the one measurement that does not
      // follow from the track list alone.
      for (const { columnId, side, offset } of preview.offsets) {
        for (const cell of element.querySelectorAll<HTMLElement>(
          `[data-column-id="${CSS.escape(columnId)}"]`,
        )) {
          cell.style[side] = `${offset}px`;
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [table]);

  // Pinned rows count as content: with every visible row pinned to an edge,
  // an empty-state message beside them would contradict what is on screen.
  const isEmpty = rows.length === 0 && pinnedRowCount === 0;
  // Which emptiness this is. A column filter counts by the rule the pills, the
  // header indicator and the page reset use, so the grid has one definition
  // of "active" - see `filterNarrowsRows`. The half-typed
  // `{ operator, value: "" }` the filter panel seeds filters nothing. The body
  // already subscribes to the whole table store, so these reads are reactive.
  const emptyGlobalFilter = table.store.state.globalFilter;
  const hasActiveFilters =
    table.store.state.columnFilters.some(filterNarrowsRows) ||
    (typeof emptyGlobalFilter === "string"
      ? emptyGlobalFilter.trim() !== ""
      : emptyGlobalFilter != null);

  /**
   * The summary row exists by declaration, not by flag: it renders exactly
   * when at least one visible leaf column defines a `footer`. Its cells come
   * from the leaf header group, whose headers sit in the same left → centre →
   * right order as `orderedColumns` - so `layoutFor` and the grid tracks
   * apply unchanged.
   */
  const leafHeaders = headerGroups.at(-1)?.headers ?? [];
  const hasSummaryRow = orderedColumns.some(
    (column) => column.columnDef.footer !== undefined,
  );
  /**
   * Rows above the first body row, which is what every `aria-rowindex` in the
   * body counts from and what `aria-rowcount` adds up. The header groups plus
   * the filter row, when there is one.
   */
  const headerRowCount = headerGroups.length + (hasHeaderFilterRow ? 1 : 0);

  /**
   * The summary row's height, published as `--dg-summary-height`, which two
   * things read: the pinned bottom block sticks above the summary row rather
   * than underneath it, and the summary row's own `top` inset holds it on the
   * bottom edge of a body too short to scroll. A layout effect, so the first
   * paint already has the measurement - `top` would otherwise resolve to 100%
   * for a frame and take an overflowing grid's summary row out of view. Down
   * here rather than beside the other measurements because `hasSummaryRow` is
   * only known this far into the render.
   */
  useLayoutEffect(() => {
    if (!hasSummaryRow) return;
    const grid = gridElementRef.current;
    if (grid === null) return;
    const summaryRow = grid.querySelector<HTMLElement>(
      '[data-dg-part="summary-row"]',
    );
    if (summaryRow === null) return;
    const measure = () =>
      grid.style.setProperty(
        "--dg-summary-height",
        `${summaryRow.offsetHeight}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(summaryRow);
    return () => {
      observer.disconnect();
      grid.style.removeProperty("--dg-summary-height");
    };
  }, [hasSummaryRow]);

  /**
   * The other end of the same story as `stickyCoverTop`: the pinned bottom
   * block and the summary row stick to the container's bottom edge, so the
   * virtualizer takes their height as `scrollPaddingEnd` and stops scrolling a
   * row to just underneath them. Down here for the same reason as the
   * measurement above.
   */
  useEffect(() => {
    const grid = gridElementRef.current;
    if (grid === null) return;
    const blocks = grid.querySelectorAll<HTMLElement>(
      '[data-dg-part="pinned-bottom"], [data-dg-part="summary-row"]',
    );
    const measure = () => {
      let total = 0;
      for (const block of blocks) total += block.offsetHeight;
      setStickyCoverBottom(total);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const block of blocks) observer.observe(block);
    return () => observer.disconnect();
  }, [pinnedBottomRows.length, hasSummaryRow]);

  // "row" mode: the row itself is the selection control, with the modifier
  // conventions of any desktop list - see resolveRowSelectionClick.
  const selectsOnRowClick = features.rowClickSelects;
  const rowIsInteractive =
    selectsOnRowClick || features.highlightRow || onRowClick !== undefined;

  /**
   * Group rows sit out every row-level gesture.
   *
   * Not squeamishness: TanStack builds a group row on top of its first leaf's
   * record (`constructRow(table, id, leafRows[0].original, …)`), so an
   * `onRowClick` firing here would hand a consumer a real-looking row that is
   * the wrong one - a detail panel would open on an arbitrary child. The same
   * goes for the highlight, which is what a detail panel follows.
   *
   * Selecting a group is still possible, through its checkbox, which resolves
   * to the descendants rather than to the group itself. See
   * getSelectableRowIds.
   */
  const rowGesturesFor = (row: Row<TMDataGridFeatures, TMDataGridRowData>) =>
    row.getIsGrouped() ? false : rowIsInteractive;

  const handleRowActivate = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
    modifiers: { toggle: boolean; extend: boolean },
  ) => {
    if (selectsOnRowClick && row.getCanSelect()) {
      const resolved = resolveRowSelectionClick({
        rows,
        rowId: row.id,
        anchorRowId: ui.state.selectionAnchorRowId,
        modifiers,
        selection: table.store.state.rowSelection,
        canReplaceSelection: true,
      });
      table.setRowSelection(resolved.selection);
      ui.actions.setSelectionAnchor(resolved.anchorRowId);
    }
    // Set, never toggle: a second click on the highlighted row must not close
    // the detail panel showing it. Clearing is
    // `ui.actions.setHighlightedRow(null)`.
    if (features.highlightRow) ui.actions.setHighlightedRow(row.id);
    onRowClick?.(row as unknown as Row<TMDataGridFeatures, TData>);
  };

  // The value-or-function pair resolved per row, across the same erasure
  // crossing `onRowClick` makes.
  const rowClassNameFor = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
  ): string | undefined =>
    typeof rowClassName === "function"
      ? rowClassName(row as unknown as Row<TMDataGridFeatures, TData>)
      : rowClassName;
  const rowStyleFor = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
  ): CSSProperties | undefined =>
    typeof rowStyle === "function"
      ? rowStyle(row as unknown as Row<TMDataGridFeatures, TData>)
      : rowStyle;

  // The same erasure crossing `onRowClick` makes, once for all three cell
  // handlers.
  const cellEventArgs = (
    cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>,
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
    event: MouseEvent<HTMLElement>,
  ): TMDataGridCellEventArgs<TData> =>
    ({
      cell,
      row,
      column: cell.column,
      event,
    }) as unknown as TMDataGridCellEventArgs<TData>;

  // ---------------------------------------------------------------------------
  // Cell selection
  //
  // Three pieces: the tab stop (which cell the browser can reach), the key
  // handler (which cell the state points at), and the effect (which cell the
  // DOM actually focuses). They are separate because under virtualization the
  // three can disagree for a frame - a move to row 4000 names a cell that has
  // no element yet - and the state is the one that is always right.
  // ---------------------------------------------------------------------------
  const cellSelection = features.cellSelection;
  const cellRangeSelection = features.cellRangeSelection;

  /**
   * That a move came from inside the grid, and so should take the DOM focus
   * with it.
   *
   * A ref rather than "is the focus in the grid?" asked at the time, because by
   * the time the effect runs the cell the key was pressed on may have unmounted
   * (a PageDown scrolls it away) and the focus with it. The intent survives
   * where the evidence does not.
   */
  const wantsCellFocusRef = useRef(false);
  /** The last position the effect acted on, so it can tell a move from a re-render. */
  const appliedCellRef = useRef<TMDataGridCellPosition | null>(null);

  /**
   * The two focusable elements that bracket the body, and the flag that says
   * which way focus is passing through one.
   *
   * They are what makes the body one tab stop without asking anything of the
   * cell renderers. Tab inside the body parks the focus on the guard past the
   * edge being left, and the browser's default Tab then continues from there -
   * so the next stop is whatever follows the grid, however many tabbable
   * controls the mounted rows happen to hold. Focus arriving at a guard any
   * other way came from outside the body, and is forwarded to the cursor cell.
   * `guardHopRef` is what tells the two apart; the grid raises it just before
   * it moves the focus itself.
   */
  const leadingGuardRef = useRef<HTMLDivElement>(null);
  const trailingGuardRef = useRef<HTMLDivElement>(null);
  const guardHopRef = useRef(false);

  /**
   * Keeps both guards at the scrollport's top-left corner as the body scrolls.
   *
   * A guard is out of flow, so left alone it sits at the top of the scrolled
   * content. Tab from outside focuses it without `preventScroll`, and the
   * browser then scrolls the body back to the top to show it - which unmounts
   * the cursor row the guard is about to hand the focus to, and drops the
   * focus on `<body>`. A guard already inside the scrollport is never
   * scrolled to. Written straight to the style, so a scroll costs no render.
   */
  const placeTabGuards = (container: HTMLElement) => {
    for (const guard of [leadingGuardRef.current, trailingGuardRef.current]) {
      if (guard === null) continue;
      guard.style.top = `${container.scrollTop}px`;
      guard.style.left = `${container.scrollLeft}px`;
    }
  };

  // O(n) per keystroke and per render while a cell is focused. Fine at any row
  // count a grid actually holds, and the alternative - an id→index map rebuilt
  // whenever sorting, filtering or grouping changes - costs more than it saves.
  const focusedRowIndex =
    cellSelection && focusedCell !== null
      ? rows.findIndex((row) => row.id === focusedCell.rowId)
      : -1;
  const focusedColumnIndex =
    cellSelection && focusedCell !== null
      ? orderedColumns.findIndex((column) => column.id === focusedCell.columnId)
      : -1;
  const focusedCellIsMounted =
    focusedRowIndex >= 0 &&
    virtualItems.some((item) => item.index === focusedRowIndex);

  /**
   * The cell the tab guards hand the focus to when Tab enters the body.
   *
   * The focused cell when it is on screen. When it is not - the grid has never
   * been entered, or the user scrolled the focus away with the wheel - the
   * first mounted cell stands in, so entering the body always lands somewhere.
   * No body cell is itself in the tab order: the guards are the body's only
   * tab stops, which is what keeps a cell from turning up between two of a
   * row's controls when Tab walks them.
   */
  const firstMountedRow = rows[virtualItems[0]?.index ?? -1];
  const tabStopCell: TMDataGridCellPosition | null = !cellSelection
    ? null
    : focusedCellIsMounted && focusedCell !== null
      ? focusedCell
      : firstMountedRow && orderedColumns[0]
        ? { rowId: firstMountedRow.id, columnId: orderedColumns[0].id }
        : null;

  /**
   * Focus landing on either guard.
   *
   * A raised hop flag means the grid put it there on its way out, so the
   * browser's default Tab is about to carry on from the guard - nothing to do
   * but lower the flag. Anything else is Tab off the last header control onto
   * the leading guard, or Shift+Tab from below the grid onto the trailing one:
   * both mean "enter the body", and the body is entered at the cursor cell.
   *
   * The state is moved as well as the DOM focus, because the cell may not be
   * the one the ring is on; the direct focus is so it happens in this event
   * rather than a frame later.
   *
   * With no rows there is no cell to hand it to. The guard keeps the focus and
   * the next Tab leaves the grid the way it came in.
   */
  const handleGuardFocus = () => {
    if (guardHopRef.current) {
      guardHopRef.current = false;
      return;
    }
    if (tabStopCell === null) return;
    wantsCellFocusRef.current = true;
    ui.actions.setFocusedCell(tabStopCell);
    const container = scrollContainerRef.current;
    if (container === null) return;
    findCellElement(container, tabStopCell)?.focus({ preventScroll: true });
  };

  /**
   * Whether the focused cell is on this row, in columns `first` to `last` -
   * one column for most cells, every column it covers for a spanning one.
   */
  const isFocusedWithin = (rowId: string, first: number, last: number) =>
    focusedCell !== null &&
    focusedCell.rowId === rowId &&
    focusedColumnIndex >= first &&
    focusedColumnIndex <= last;

  // The rectangle, resolved from ids to the indices the cells are rendered at.
  // `null` whenever a corner has been filtered or hidden away - the range keeps
  // its ids, so lifting the filter brings the selection back.
  const rangeBounds = resolveRangeBounds({
    range: cellRangeSelection ? cellRange : null,
    rowIndexOf: (rowId) => rows.findIndex((row) => row.id === rowId),
    columnIndexOf: (columnId) =>
      orderedColumns.findIndex((column) => column.id === columnId),
  });

  /**
   * Extends the rectangle to a cell, or lays a new one-cell rectangle down.
   *
   * The anchor is what tells the two apart: extending keeps it and moves the
   * far corner, starting drops it on the cell under the pointer. Every gesture
   * that selects cells is one of these two.
   */
  const setRangeTo = (
    cell: TMDataGridCellPosition,
    { extend }: { extend: boolean },
  ) => {
    if (!cellRangeSelection) return;
    const anchor = extend ? (cellRange?.anchor ?? cell) : cell;
    ui.actions.setCellRange({ anchor, focus: cell });
  };

  /**
   * What a copy or an export would take.
   *
   * The rectangle when there is one, and the focused cell on its own when there
   * is not - under `"single"` there never is one, and under `"range"` there is
   * none until the first gesture. Copying the one cell the user is on is what
   * every spreadsheet does, so the two cases collapse into the same block here
   * rather than into two paths through the export code.
   */
  const selectionBounds =
    rangeBounds ??
    (cellSelection && focusedRowIndex >= 0 && focusedColumnIndex >= 0
      ? {
          top: focusedRowIndex,
          bottom: focusedRowIndex,
          left: focusedColumnIndex,
          right: focusedColumnIndex,
        }
      : null);
  const selectedCellCount = boundsCellCount(selectionBounds);
  /**
   * How many of the selected columns have anything to export.
   *
   * The generated lanes are part of the selection - they take the tint and the
   * outline, so the block stays a rectangle and the keyboard still reaches the
   * checkbox - but they hold controls rather than values. A rectangle covering
   * only those has nothing to copy, and the items that would say otherwise are
   * disabled rather than quietly doing nothing.
   */
  const selectedDataColumnCount =
    selectionBounds === null
      ? 0
      : orderedColumns
          .slice(selectionBounds.left, selectionBounds.right + 1)
          .filter(
            (column) =>
              !isGeneratedColumn(column.id) &&
              column.columnDef.meta?.enableExport !== false,
          ).length;

  const exportOptions = resolveExportOptions(gridExportOptions);
  // Sticky across menus, the way a checkbox in a dialog is: a user who exports
  // with headers once almost always wants them the next time too.
  const [exportIncludesHeaders, setExportIncludesHeaders] = useState(
    exportOptions.includeHeaders,
  );
  // The rectangle's values, over the displayed rows the bounds index into.
  const buildSelectionData = () =>
    selectionBounds === null
      ? null
      : buildExportData({ table, rows, bounds: selectionBounds });

  /**
   * Ctrl+C. Values only, no header row - Excel's own copy does not include one
   * either, and a header pasted into the middle of a sheet is a row of text
   * where numbers were expected. The export menu is where headers are offered,
   * because a file is a document and a clipboard is a fragment.
   */
  const copySelection = async () => {
    const data = buildSelectionData();
    if (data === null || data.columnIds.length === 0) return;
    await writeClipboardText(
      toClipboardText(data, {
        decimalComma: exportOptions.format.decimalComma,
      }),
    );
  };

  /**
   * Whether a drag is laying down a rectangle right now.
   *
   * State rather than a ref, because the cells only listen for `mouseenter`
   * while it is true - one re-render at each end of the gesture buys a body
   * that is not running a handler per cell the rest of the time.
   */
  const [isDraggingRange, setIsDraggingRange] = useState(false);

  // The drag ends wherever the button comes up, which is routinely outside the
  // grid - over the scrollbar, or past the window edge. Only the window hears
  // that, so only the window can end it. The grid's own window, not the
  // global one: rendered through a portal into a window opened with
  // `window.open`, the global is the opener and never hears the release.
  useEffect(() => {
    if (!isDraggingRange) return;
    const stop = () => setIsDraggingRange(false);
    const view = gridElementRef.current?.ownerDocument.defaultView ?? window;
    view.addEventListener("mouseup", stop);
    return () => view.removeEventListener("mouseup", stop);
  }, [isDraggingRange]);

  const startRangeDrag = (
    position: TMDataGridCellPosition,
    { extend }: { extend: boolean },
  ) => {
    ui.actions.setFocusedCell(position);
    setRangeTo(position, { extend });
    // A Shift+click is a single act, not the start of one - there is nothing
    // left to drag once the far corner has been named.
    if (!extend) setIsDraggingRange(true);
  };

  /** The export item: the rectangle, in the grid's export format. */
  const exportSelection = () => {
    const data = buildSelectionData();
    if (data === null || data.columnIds.length === 0) return;
    void writeExportFile(data, {
      ...exportOptions,
      includeHeaders: exportIncludesHeaders,
    });
  };

  /**
   * Moves the focus, and takes the selection with it.
   *
   * `extend` is the Shift key: held, the rectangle grows from wherever it was
   * anchored; released, it collapses onto the cell just moved to. Collapsing
   * rather than clearing keeps the invariant the copy path relies on - the
   * selection is always the block Ctrl+C would take, even when that block is
   * one cell.
   */
  const moveFocusedCell = (
    coords: { rowIndex: number; columnIndex: number },
    { extend }: { extend: boolean } = { extend: false },
  ) => {
    const row = rows[coords.rowIndex];
    const column = orderedColumns[coords.columnIndex];
    if (!row || !column) return;
    // A column covered by a span on this row has no cell; the one covering it
    // takes the focus.
    const cell = toRenderedCell({ rowId: row.id, columnId: column.id }, row);
    // The state moves; the effect below is what makes the DOM follow, because
    // the element for an off-screen row does not exist yet to be focused.
    wantsCellFocusRef.current = true;
    ui.actions.setFocusedCell(cell);
    setRangeTo(cell, { extend });
  };

  // ---------------------------------------------------------------------------
  // Cell editing - the gestures. The engine owns the forms; this component
  // owns where the editor opens from (keys, double-click) and where the
  // focus lands when it closes.
  // ---------------------------------------------------------------------------

  /** The pending type-to-edit seed, consumed by the editor host on mount. */
  const editSeedRef = useRef<string | undefined>(undefined);
  const takeEditSeed = () => {
    const seed = editSeedRef.current;
    editSeedRef.current = undefined;
    return seed;
  };

  /**
   * The row's first cell that edits, in visual order - where the caret goes
   * for a gesture that named no column, which is the edit lane's pencil.
   */
  const firstEditableColumnId = (rowId: string): string | null => {
    const row = rows.find((candidate) => candidate.id === rowId);
    if (row === undefined) return null;
    const cells = [
      ...row.getStartVisibleCells(),
      ...row.getCenterVisibleCells(),
      ...row.getEndVisibleCells(),
    ];
    return (
      cells.find((cell) => edit.canEditCell(row, cell.column))?.column.id ??
      null
    );
  };

  /**
   * The `active` the caret has already been placed for. Identity, not value:
   * `beginOn` publishes a fresh object per gesture, so re-opening the same
   * cell is a new intent, while every later render for the same gesture - a
   * remount as the virtualizer scrolls among open rows - is not.
   */
  const placedEditCaretRef = useRef<TMDataGridEditState["active"]>(null);

  /**
   * Puts the caret in the cell the open gesture named, once per gesture.
   * See `focusEditorContent` for where inside the editor it lands.
   *
   * A layout effect, ahead of the focused-cell effect below: the ring follows
   * the caret there rather than fighting it.
   */
  useLayoutEffect(() => {
    if (editActive === null) {
      placedEditCaretRef.current = null;
      return;
    }
    if (placedEditCaretRef.current === editActive) return;
    const container = scrollContainerRef.current;
    if (container === null) return;
    // The lane's pencil names no column - the row's first editable cell.
    const columnId =
      editActive.columnId ?? firstEditableColumnId(editActive.rowId);
    if (columnId === null) {
      placedEditCaretRef.current = editActive;
      return;
    }
    const editor = container.querySelector<HTMLElement>(
      `[data-dg-part="editor"][data-row-id="${CSS.escape(editActive.rowId)}"]` +
        `[data-column-id="${CSS.escape(columnId)}"]`,
    );
    // Not mounted yet - the virtualizer is still bringing the row in. The
    // intent stays up, and the next render tries again.
    if (editor === null) return;
    placedEditCaretRef.current = editActive;
    focusEditorContent(editor);
  });

  /** DOM focus back onto a cell - after Escape, or a commit with nowhere to go. */
  const refocusCell = (position: TMDataGridCellPosition) => {
    const container = scrollContainerRef.current;
    if (container === null) return;
    wantsCellFocusRef.current = true;
    findCellElement(container, position)?.focus();
  };

  const openEditor = (position: TMDataGridCellPosition) => {
    if (cellSelection) ui.actions.setFocusedCell(position);
    // Row mode edits whole rows: any editable cell's open gesture opens all of
    // them, exactly as the lane's pencil does. The column still travels, as
    // the cell the caret belongs in - the one the gesture named. Dropping it
    // here sent the caret to the row's first editable cell instead, which the
    // focused-cell effect above then pulled back onto the cell just clicked,
    // leaving the row open with the caret in none of its editors.
    edit.begin({ rowId: position.rowId, columnId: position.columnId });
  };

  const handleEditorClose = (
    position: TMDataGridCellPosition,
    close: TMDataGridCellEditorClose,
  ) => {
    // Where the keyboard goes: Enter moves down, Tab to the next editable
    // cell (cellConfirm's deferring variants move the same way, draft kept) -
    // everything else, and a saved row, goes back to where the edit was.
    const move =
      close.via === "enter"
        ? "down"
        : close.via === "tab" || close.via === "defer-tab"
          ? 1
          : close.via === "shift-tab" || close.via === "defer-shift-tab"
            ? -1
            : null;
    if (move === null || features.editMode === "row") {
      refocusCell(position);
      return;
    }
    const rowIndex = rows.findIndex((row) => row.id === position.rowId);
    const columnIndex = orderedColumns.findIndex(
      (column) => column.id === position.columnId,
    );
    if (rowIndex < 0 || columnIndex < 0) {
      refocusCell(position);
      return;
    }
    if (move === "down") {
      if (rowIndex + 1 < rows.length) {
        moveFocusedCell({ rowIndex: rowIndex + 1, columnIndex });
      } else {
        refocusCell(position);
      }
      return;
    }
    const next = getNextEditableCell({
      from: { rowIndex, columnIndex },
      direction: move,
      rowCount: rows.length,
      columnCount: orderedColumns.length,
      // A column covered by a span on its row has no cell to hold an editor,
      // and a move onto it would land back on the spanning cell just left.
      isEditable: (coords) => {
        const row = rows[coords.rowIndex];
        const column = orderedColumns[coords.columnIndex];
        return (
          row !== undefined &&
          column !== undefined &&
          !isCoveredCell(row, coords.columnIndex) &&
          edit.canEditCell(row, column)
        );
      },
    });
    if (next !== null) moveFocusedCell(next);
    else refocusCell(position);
  };

  /**
   * Space, from a cell. Checkbox semantics rather than click semantics: it adds
   * to the selection instead of replacing it, so a keyboard user builds one the
   * way they would by ticking boxes - which is what the key has taken over from.
   *
   * Group rows work because the resolver expands a tick to the descendants they
   * stand for. A grid with no selection at all falls back to the highlight,
   * which is the only thing "pick this row" can mean there.
   */
  const selectRowFromCell = (
    row: Row<TMDataGridFeatures, TMDataGridRowData>,
    { extend }: { extend: boolean },
  ) => {
    if (features.rowSelection && getSelectableRowIds(row).length > 0) {
      const resolved = resolveRowSelectionClick({
        rows,
        rowId: row.id,
        anchorRowId: ui.state.selectionAnchorRowId,
        modifiers: { toggle: !extend, extend },
        selection: table.store.state.rowSelection,
        canReplaceSelection: false,
      });
      table.setRowSelection(resolved.selection);
      ui.actions.setSelectionAnchor(resolved.anchorRowId);
      return;
    }
    if (features.highlightRow && !row.getIsGrouped()) {
      ui.actions.setHighlightedRow(row.id);
    }
  };

  /**
   * One handler on the grid rather than one per cell: the body mounts a few
   * hundred cells and remounts them on every scroll frame, and this closes over
   * `rows` and `orderedColumns` - which every cell would otherwise have to be
   * handed just in case it is the one that gets a key.
   *
   * The cell it is about comes off `event.target`, which is where the
   * coordinate attributes are for.
   */
  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // The body cell the key was pressed in, whether the focus is on the cell
    // itself or on a control inside it. `null` for a header control or a tab
    // guard, neither of which is part of cell navigation.
    const keyCellElement =
      target.dataset.cell === "true"
        ? target
        : target.closest<HTMLElement>('[data-cell="true"]');
    if (keyCellElement === null) return;

    if (event.key === "Tab") {
      // Inside a row's controls the row is a form, and Tab walks it the way
      // the browser walks any form: through the row's open editors, the
      // buttons in its cells and, on an open row, the lane's save and cancel.
      // That part is left to the browser. What the grid decides is the two
      // ends: past the row's last control the cursor moves to the next row's
      // first cell, and before its first control to the previous row's last -
      // the cell is put on the cursor and left alone, whatever it holds. A cell
      // editor never gets here, it claims Tab itself to commit and move on.
      if (target.dataset.cell !== "true") {
        const rowElement = keyCellElement.closest<HTMLElement>(
          '[data-dg-part="row"]',
        );
        const tabbables =
          rowElement === null
            ? []
            : Array.from(
                rowElement.querySelectorAll<HTMLElement>(FOCUSABLE_IN_CELL),
              ).filter((element) => element.tabIndex >= 0);
        const index = tabbables.indexOf(target);
        // A control the walk cannot place is left to the browser rather than
        // guessed about.
        if (index < 0) return;
        // The step itself is taken here rather than left to the browser: a
        // select editor keeps its option list in the row, and the browser's
        // Tab lands on that scrollable list, which the editor then closes
        // under the focus. Walking the controls, and only the controls, is
        // what the browser would do if the list were not there.
        const nextControl = tabbables[index + (event.shiftKey ? -1 : 1)];
        if (nextControl !== undefined) {
          event.preventDefault();
          nextControl.focus();
          // What Tab does on a text field, and what the caret otherwise loses.
          if (isInputElement(nextControl)) nextControl.select();
          return;
        }
        const rowIndex = rows.findIndex(
          (row) => row.id === keyCellElement.dataset.rowId,
        );
        const nextRowIndex = rowIndex + (event.shiftKey ? -1 : 1);
        const nextRow = rowIndex < 0 ? undefined : rows[nextRowIndex];
        const nextColumn = event.shiftKey
          ? orderedColumns[orderedColumns.length - 1]
          : orderedColumns[0];
        if (nextRow !== undefined && nextColumn !== undefined) {
          event.preventDefault();
          moveFocusedCell({
            rowIndex: nextRowIndex,
            columnIndex: event.shiftKey ? orderedColumns.length - 1 : 0,
          });
          // The focus-following effect stands down while the focus sits in an
          // editor, which is exactly where it sits now: move it by hand. The
          // adjacent row is mounted whenever there is any overscan; without
          // one, letting go of the editor is what lets the effect take over.
          const container = scrollContainerRef.current;
          const nextCell =
            container === null
              ? null
              : findCellElement(
                  container,
                  toRenderedCell(
                    { rowId: nextRow.id, columnId: nextColumn.id },
                    nextRow,
                  ),
                );
          if (nextCell !== null) nextCell.focus({ preventScroll: true });
          else target.blur();
          return;
        }
        // No row past this one: the body is left, below.
      }

      // Tab leaves the body in one hop, from a cell or from the last control
      // of the last row. Not prevented: the focus is moved onto the guard past
      // the edge being left and the browser's own Tab then runs from there,
      // which is what puts it on the next thing after the grid - or, going
      // back, on the last header control, since the leading guard sits below
      // them.
      const guard = event.shiftKey
        ? leadingGuardRef.current
        : trailingGuardRef.current;
      if (guard === null) return;
      guardHopRef.current = true;
      guard.focus({ preventScroll: true });
      return;
    }

    // An open editor owns the rest of its keys; the cell editor stops the
    // ones it acts on before they get here, a row-shaped one lets them pass.
    if (target.closest('[data-dg-part="editor"]') !== null) return;

    // Focus is on something inside a cell - a checkbox, a link. Its keys are
    // its own; the one the grid still answers is the way back out.
    if (target.dataset.cell !== "true") {
      if (event.key !== "Escape") return;
      event.preventDefault();
      keyCellElement.focus();
      return;
    }

    const { rowId, columnId } = target.dataset;
    if (rowId === undefined || columnId === undefined) return;
    const rowIndex = rows.findIndex((row) => row.id === rowId);
    const columnIndex = orderedColumns.findIndex(
      (column) => column.id === columnId,
    );
    if (rowIndex < 0 || columnIndex < 0) return;

    // Ctrl+C over the selection. Claimed rather than left to the browser: the
    // native copy of a grid whose rows are mostly not in the DOM would take the
    // twenty that happen to be mounted, in whatever shape the CSS left them.
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "c" || event.key === "C")
    ) {
      if (selectionBounds === null) return;
      event.preventDefault();
      void copySelection();
      return;
    }

    // Editing keys, ahead of the step-into pair - an editable cell's Enter
    // opens its editor, and only a non-editable cell's falls through to the
    // control it holds.
    const keyRow = rows[rowIndex];
    const keyColumn = orderedColumns[columnIndex];
    if (
      features.editing &&
      keyRow !== undefined &&
      keyColumn !== undefined &&
      edit.canEditCell(keyRow, keyColumn)
    ) {
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        openEditor({ rowId, columnId });
        return;
      }
      // The quick single-cell gestures - Delete-to-clear and type-to-edit -
      // sit out row mode, whose whole point is that nothing commits until
      // the row's explicit save.
      if (features.editMode !== "row") {
        // Clear-and-commit, without opening anything - the spreadsheet Delete.
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          void edit
            .clearCell(rowId, columnId)
            .then(() => refocusCell({ rowId, columnId }));
          return;
        }
        // Type-to-edit: a printable character opens the editor seeded with
        // itself. Space stays the row-selection key, modifiers stay shortcuts.
        if (
          event.key.length === 1 &&
          event.key !== " " &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          editSeedRef.current = event.key;
          openEditor({ rowId, columnId });
          return;
        }
      }
    }

    // Step into the cell. The pair Excel and AG Grid both use, and the pair the
    // editor will take over: F2 has never meant anything else, and Enter is
    // what a keyboard user reaches for. Nothing to step into leaves the key
    // alone rather than swallowing it.
    if (event.key === "Enter" || event.key === "F2") {
      const interactive = target.querySelector<HTMLElement>(FOCUSABLE_IN_CELL);
      if (interactive === null) return;
      event.preventDefault();
      interactive.focus();
      return;
    }

    // Escape drops the rectangle back to the one cell, as it drops the marching
    // ants in a spreadsheet. The focus stays where it is - Escape is about the
    // selection, not about leaving the grid.
    if (event.key === "Escape") {
      if (cellRange === null) return;
      event.preventDefault();
      setRangeTo({ rowId, columnId }, { extend: false });
      return;
    }

    // Space selects the row, from any of its cells.
    //
    // Not routed through `handleRowActivate`, which is the *click* path and only
    // selects in `"row"` mode: the checkbox is not in the page's tab order, so
    // this is the keyboard's way to a selection under every mode that has one -
    // checkbox included.
    if (event.key === " ") {
      event.preventDefault();
      const row = rows[rowIndex];
      if (row) selectRowFromCell(row, { extend: event.shiftKey });
      return;
    }

    // Right steps off a spanning cell from the last column it covers, or it
    // would land back on itself.
    const spans = rows[rowIndex] ? colSpansOf(rows[rowIndex]) : null;
    const next = resolveCellMove({
      key: event.key,
      ctrlKey: event.ctrlKey || event.metaKey,
      from: {
        rowIndex,
        columnIndex:
          spans !== null && event.key === "ArrowRight"
            ? spanEndIndex(spans, columnIndex)
            : columnIndex,
      },
      rowCount: rows.length,
      columnCount: orderedColumns.length,
      pageRows: Math.max(
        1,
        Math.floor((scrollContainerRef.current?.clientHeight ?? 0) / rowHeight) -
          1,
      ),
    });
    if (next === null) return;
    // Claimed even when the move was clamped at an edge: letting an arrow
    // through at the last row would scroll the body out from under a focus that
    // did not move.
    event.preventDefault();
    // A move landing on this cell again - clamped at an edge, or onto a column
    // this cell covers - changes nothing, the rectangle included.
    const landing =
      spans === null ? next.columnIndex : spanAnchorIndex(spans, next.columnIndex);
    if (next.rowIndex === rowIndex && landing === columnIndex) return;
    // Shift extends the rectangle instead of collapsing it - the same key that
    // extends a text selection, a file list and a spreadsheet range.
    moveFocusedCell(next, { extend: event.shiftKey && cellRangeSelection });
  };

  /**
   * Puts the DOM where the state says, once the state has moved.
   *
   * No dependency array, like the page-clamp effect above: the interesting
   * moment is not a state change but the render after the virtualizer mounted
   * the row that was scrolled to, and a scroll is not in any dependency list.
   * Every path out of here is a ref comparison, so the cost of running it on
   * each frame is nil.
   */
  useEffect(() => {
    if (!cellSelection) return;
    const container = scrollContainerRef.current;
    if (container === null) return;

    if (focusedCell !== appliedCellRef.current) {
      appliedCellRef.current = focusedCell;
      // Bring the row on screen first - this is what makes a cell that is not
      // mounted focusable at all, one frame later.
      if (focusedRowIndex >= 0) {
        virtualizer.scrollToIndex(focusedRowIndex, { align: "auto" });
      }
    }
    if (focusedCell === null) {
      wantsCellFocusRef.current = false;
      return;
    }

    // The grid's own document, not the global one: in a window opened with
    // `window.open` the global document is the opener's, and its focus is
    // never in this grid.
    const activeElement = container.ownerDocument.activeElement;

    // The column the focus sits on has just been covered by a span - the row
    // expanded under it, say. Its cell is gone, and the browser dropped the
    // focus with it, so the state follows the cell that now stands for the
    // column, and the render after this one puts the focus there. A focus
    // that had moved elsewhere on the page stays there: only the ring moves.
    const rendered = toRenderedCell(focusedCell, rows[focusedRowIndex]);
    if (rendered !== focusedCell) {
      if (
        activeElement === null ||
        activeElement === container.ownerDocument.body
      ) {
        wantsCellFocusRef.current = true;
      }
      ui.actions.setFocusedCell(rendered);
      return;
    }

    // Never take the focus from elsewhere on the page. A consumer moving the
    // cell while the user is typing in a form somewhere means "move the ring",
    // not "move the caret" - the scroll above already did the visible part.
    if (!wantsCellFocusRef.current && !container.contains(activeElement)) {
      return;
    }
    // Mid-hop: Tab parked the focus on a guard and the browser is about to
    // carry it out of the grid. This effect can run in between - a discrete
    // event flushes its renders before the default action - and pulling the
    // focus back onto the cell here would send the browser's Tab off from
    // the cell instead. A guard the user *arrived* on has already asked for
    // the cell, and that intent is honoured.
    if (
      !wantsCellFocusRef.current &&
      activeElement !== null &&
      activeElement.closest('[data-dg-part="tab-guard"]') !== null
    ) {
      return;
    }

    const cellElement = findCellElement(container, rendered);
    // Still scrolling. The intent stays up, and the next render tries again.
    if (cellElement === null) return;
    wantsCellFocusRef.current = false;
    // Focus is already inside - on the control Enter stepped into. The cell is
    // where the ring belongs, so there is nothing to move.
    if (cellElement.contains(activeElement)) return;
    // An open editor outranks the ring, wherever it is. Row mode opens a whole
    // row from one gesture, so the caret legitimately sits in a cell other
    // than the one that gesture landed the ring on - the lane's pencil is the
    // plain case, focusing its own cell on the way to opening the row. Pulling
    // the caret back onto that cell would leave the row open with the caret in
    // none of its editors, and the user with nothing to type into.
    if (
      activeElement !== null &&
      activeElement.closest('[data-dg-part="editor"]') !== null
    ) {
      return;
    }

    // The vertical half is the virtualizer's, and it has already been asked.
    cellElement.focus({ preventScroll: true });
    if (layoutFor(focusedCell.columnId).pinnedAt === false) {
      keepColumnInView({
        container,
        cellElement,
        leftPinnedWidth: leftOffset,
        rightPinnedWidth: rightOffset,
      });
    }
  });

  // Which row's context menu is open, and which cell it was opened from.
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    rowId: string;
    columnId: string | null;
  } | null>(null);
  const closeContextMenu = () => setContextMenuTarget(null);

  // Row and cell each record themselves on the way up, so that by the time the
  // rowgroup's handler opens the menu it knows what was hit. Refs rather than
  // state: written and read inside the same event, before the render it causes.
  const contextMenuRowRef = useRef<string | null>(null);
  const contextMenuColumnRef = useRef<string | null>(null);

  const handleContextMenu = () => {
    const rowId = contextMenuRowRef.current;
    const columnId = contextMenuColumnRef.current;
    contextMenuRowRef.current = null;
    contextMenuColumnRef.current = null;

    // A right-click inside the selection is about the selection and leaves it
    // alone; one outside moves it first, so the menu never offers to copy a
    // block somewhere else on the screen. Spreadsheets and file managers both
    // behave this way, and the alternative - exporting cells the user cannot
    // see the outline of - is the kind of surprise that ends in a support call.
    if (cellSelection && rowId !== null && columnId !== null) {
      const rowIndex = rows.findIndex((row) => row.id === rowId);
      const columnIndex = orderedColumns.findIndex(
        (column) => column.id === columnId,
      );
      // `rowIndex < 0` is a pinned row: those sit out the cell range, so
      // moving the selection onto one would resolve to no rectangle at all
      // and drop the selection the user could still see at the edge.
      if (
        rowIndex >= 0 &&
        !isWithinBounds(selectionBounds, rowIndex, columnIndex)
      ) {
        ui.actions.setFocusedCell({ rowId, columnId });
        setRangeTo({ rowId, columnId }, { extend: false });
      }
    }

    setContextMenuTarget(rowId === null ? null : { rowId, columnId });
  };

  // The body list, then the edge blocks: pinning takes a row out of the
  // scrolling order, and unpinning is the first thing its menu exists to
  // offer, so a menu that could not resolve a pinned row would strand it
  // there. Searched in that order because the body holds nearly every row.
  const contextMenuRow =
    contextMenuTarget === null
      ? undefined
      : (rows.find((row) => row.id === contextMenuTarget.rowId) ??
        pinnedTopRows.find((row) => row.id === contextMenuTarget.rowId) ??
        pinnedBottomRows.find((row) => row.id === contextMenuTarget.rowId));

  const canRenderRowMenu =
    renderRowContextMenu !== undefined &&
    contextMenuTarget !== null &&
    contextMenuRow !== undefined &&
    !contextMenuRow.getIsGrouped();



  /**
   * The built-in half of the menu: what to do with the cells that are selected.
   *
   * Offered under `"range"` only. Under `"single"` the selection is always the
   * one cell the user is standing on, and a menu whose every item acts on it
   * would be a menu about nothing much - Ctrl+C still copies it.
   */
  const cellMenuContent =
    cellRangeSelection && contextMenuTarget !== null && selectionBounds !== null ? (
      <>
        <Menu.Label>{labels.cellCount(selectedCellCount)}</Menu.Label>
        <Menu.Item
          disabled={selectedDataColumnCount === 0}
          onClick={() => void copySelection()}
        >
          {labels.copy}
        </Menu.Item>
        <Menu.Item
          disabled={selectedDataColumnCount === 0}
          onClick={exportSelection}
        >
          {labels.exportCells}
        </Menu.Item>
        {/* Stays open on click: it is the setting the item above reads, and
            reopening the menu to change your mind about headers is a worse
            answer than one that lets you see the box tick. */}
        <Menu.Item
          closeMenuOnClick={false}
          onClick={() => setExportIncludesHeaders((previous) => !previous)}
        >
          <Checkbox
            size="xs"
            checked={exportIncludesHeaders}
            label={labels.includeHeaders}
            // The item owns the click; the box only shows what it did.
            readOnly
            styles={{ input: { cursor: "pointer" } }}
          />
        </Menu.Item>
      </>
    ) : null;

  /**
   * The consumer's half, built for the open row only - so the render prop runs
   * once per opened menu rather than once per mounted row. `null` back from it
   * means this row has no menu, which is also how the menu stays shut.
   *
   * `internalItems` is a getter, and reading it is the signal: a consumer who
   * touches it has taken the composition over, so the grid stops prepending
   * its own half. One who never mentions it gets today's behavior, the cell
   * items above a divider. The alternative - a second prop declaring intent -
   * asks people to say twice what the placement already says.
   *
   * The casts put back the concrete row type the context boundary erased - the
   * same crossing `onRowClick` makes.
   */
  let tookOverMenu = false;
  const rowMenuContent = canRenderRowMenu
    ? (renderRowContextMenu({
        table: table as unknown as Table<TMDataGridFeatures, TData>,
        row: contextMenuRow as unknown as Row<TMDataGridFeatures, TData>,
        cell: (contextMenuRow
          ?.getAllCells()
          .find((cell) => cell.column.id === contextMenuTarget?.columnId) ??
          null) as unknown as Cell<TMDataGridFeatures, TData, unknown> | null,
        close: closeContextMenu,
        get internalItems() {
          tookOverMenu = true;
          return cellMenuContent;
        },
      }) ?? null)
    : null;

  /**
   * The two halves, in the order they apply to: the cells first, since the
   * right-click landed on one, then whatever the consumer offers for the row.
   * When the consumer takes the composition over, what they returned is the
   * entire menu.
   */
  const contextMenuContent = tookOverMenu
    ? rowMenuContent
    : cellMenuContent === null && rowMenuContent === null
      ? null
      : (
          <>
            {cellMenuContent}
            {cellMenuContent !== null && rowMenuContent !== null && (
              <Menu.Divider />
            )}
            {rowMenuContent}
          </>
        );

  /**
   * Which edges the scroll position is currently at. Seeded "at top-left",
   * which is where a grid mounts - so the callbacks report *arrivals*, and
   * mounting fires nothing.
   */
  const scrollEdgesRef = useRef({
    top: true,
    bottom: false,
    left: true,
    right: false,
  });
  const hasEdgeCallbacks =
    onScrollToTop !== undefined ||
    onScrollToBottom !== undefined ||
    onScrollToLeft !== undefined ||
    onScrollToRight !== undefined;

  /**
   * The context menu's dropdown is anchored to a fixed viewport point, so it
   * does not travel with the row when the body scrolls - and under
   * virtualization the row it belongs to may unmount entirely. It therefore
   * closes on scroll, as a desktop context menu does.
   *
   * The edge callbacks share the handler. Reading scroll offsets here costs
   * no layout; the 1px tolerance absorbs fractional offsets under browser
   * zoom, where a "fully scrolled" position can land at 799.5 of 800.
   */
  const handleScroll =
    contextMenuTarget || hasEdgeCallbacks || cellSelection
      ? (event: UIEvent<HTMLDivElement>) => {
          if (cellSelection) placeTabGuards(event.currentTarget);
          if (contextMenuTarget) closeContextMenu();
          if (!hasEdgeCallbacks) return;
          const el = event.currentTarget;
          const next = {
            top: el.scrollTop <= 1,
            bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
            left: el.scrollLeft <= 1,
            right: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
          };
          const previous = scrollEdgesRef.current;
          scrollEdgesRef.current = next;
          if (next.top && !previous.top) onScrollToTop?.();
          if (next.bottom && !previous.bottom) onScrollToBottom?.();
          if (next.left && !previous.left) onScrollToLeft?.();
          if (next.right && !previous.right) onScrollToRight?.();
        }
      : undefined;

  return (
    <div
      ref={tableWrapperRef}
      className={classes.tableWrapper}
      data-dg-filter-sidebar={filters.surface === "sidebar" || undefined}
    >
      <div
        ref={scrollContainerRef}
        className={classes.scrollContainer}
        // How autosize finds the measurable subtree from a header cell.
        data-dg-scroll-container
        onScroll={handleScroll}
      >
        <div
          ref={gridElementRef}
          // A `table` is content; a `grid` is a widget with a keyboard cursor
          // in it. Which one this is depends on whether cell selection is on,
          // and saying `grid` without one would promise arrow keys that do
          // nothing.
          role={cellSelection ? "grid" : "table"}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          // Set while `meta.loading` is, whether or not the body has rows to
          // show - a refetch over existing rows is still a fetch, and a test
          // waiting for the grid to settle has nothing else to wait on.
          aria-busy={loading === true ? true : undefined}
          aria-multiselectable={
            cellSelection && features.rowSelection && features.multiRowSelection
              ? true
              : undefined
          }
          onKeyDown={cellSelection ? handleGridKeyDown : undefined}
          // A drag across cells is a selection gesture, and the browser's own
          // text selection would follow the pointer through it. Only while the
          // drag runs, so copying a cell value with the mouse still works.
          data-range-dragging={isDraggingRange || undefined}
          className={classes.grid}
          // Virtualization means most rows are not in the DOM, so the counts
          // have to be stated rather than inferred from what is rendered. Every
          // row carries its aria-rowindex for the same reason.
          aria-rowcount={
            rows.length +
            pinnedRowCount +
            headerRowCount +
            (hasSummaryRow ? 1 : 0)
          }
          aria-colcount={orderedColumns.length}
          // Body rows the grid is currently showing - the page under
          // pagination, everything the filters left otherwise, edge blocks
          // included. Most of them are not in the DOM, so this is what a test
          // waits on rather than counting nodes.
          data-dg-row-count={rows.length + pinnedRowCount}
          style={{ gridTemplateColumns, minWidth: gridMinWidth }}
        >
          <div role="rowgroup" style={{ display: "contents" }}>
            {headerGroups.map((headerGroup, groupIndex) => (
              <div
                key={headerGroup.id}
                role="row"
                aria-rowindex={groupIndex + 1}
                data-dg-header-row
                // The scrolled-under shadow belongs to the boundary between
                // header and body - the last header row, not every stacked
                // group row above it, and not this one at all when the filter
                // row is below it. See sticky.module.css.
                className={[
                  classes.headerRow,
                  !hasHeaderFilterRow && groupIndex === headerGroups.length - 1
                    ? sticky.headerBoundary
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {headerGroup.headers.map((header) => (
                  <TMDataGridHeaderCell
                    renderColumnMenuItems={renderColumnMenuItems}
                    key={header.id}
                    header={header}
                    layout={layoutFor(header.column.id)}
                  />
                ))}
              </div>
            ))}

            {hasHeaderFilterRow && (
              <TMDataGridHeaderFilterRow
                leafHeaders={leafHeaders}
                layoutFor={layoutFor}
                ariaRowIndex={headerRowCount}
              />
            )}
          </div>

          {/* The leading tab guard, below the header controls and above the
              first body row - see `handleGuardFocus`. Not `aria-hidden`: it
              is focusable, and a focusable node hidden from the tree is what
              screen readers have no way to describe.
              Out of the tab order while there is no cell to hand focus to,
              so an empty body is not two dead stops. */}
          {cellSelection && (
            <div
              ref={leadingGuardRef}
              tabIndex={tabStopCell === null ? -1 : 0}
              role="presentation"
              data-dg-part="tab-guard"
              data-guard="leading"
              className={classes.tabGuard}
              onFocus={handleGuardFocus}
            />
          )}

          {/* The entry block - new rows being typed, stuck under the header.
              Present only while `edit.addRow()` has open entries. */}
          {features.editing && newRowCount > 0 && (
            <TMDataGridEntryRows
              orderedColumns={orderedColumns}
              layoutFor={layoutFor}
              rowHeight={rowHeight}
            />
          )}

          <TMDataGridBodyRowGroup
            // Under `"range"` the grid has a menu of its own to offer, so the
            // wrapper goes on even without a consumer's `renderRowContextMenu`.
            enabled={renderRowContextMenu !== undefined || cellRangeSelection}
            menuContent={contextMenuContent}
            menuProps={rowContextMenuProps}
            onContextMenu={handleContextMenu}
            onClose={closeContextMenu}
          >
            {(() => {
              /**
               * One renderer for every body row, wherever it sits: the
               * virtualized centre, or a pinned edge block. `viewIndex` is the
               * row's index in the scrolling view - `-1` for a pinned row,
               * which takes it out of striping, row measurement and the cell
               * range, all of which are statements about the scrolling order.
               * Scoped here rather than a component so the row keeps closing
               * over the body's handlers without threading them as props.
               */
              const renderBodyRow = (
                row: Row<TMDataGridFeatures, TMDataGridRowData>,
                viewIndex: number,
                ariaRowIndex: number,
                pinnedAt?: "top" | "bottom",
              ) => {
              const isGroupRow = row.getIsGrouped();
              const isInteractive = rowGesturesFor(row);
              // The hover tint promises that the row answers the pointer, so
              // by default it follows the gestures the row takes: the ones
              // behind `isInteractive`, and the context menu - which a group
              // row sits out as well, see the row's onContextMenu below.
              const highlightsOnHover =
                highlightOnHover ??
                (isInteractive ||
                  (renderRowContextMenu !== undefined && !isGroupRow));
              const rowCells = [
                ...row.getStartVisibleCells(),
                ...row.getCenterVisibleCells(),
                ...row.getEndVisibleCells(),
              ];
              const rowEditing = isRowEditing(row);
              const spans = colSpansOf(row);
              // Cell selection takes the body's tab stop off the row and puts
              // it on a cell - two stops per row would make Tab a way of
              // walking the grid, which is what the arrow keys are for. Space
              // on a cell keeps the selection reachable; see handleGridKeyDown.
              const takesKeyboard =
                !isGroupRow &&
                !cellSelection &&
                (selectsOnRowClick || features.highlightRow);
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={ariaRowIndex}
                  data-dg-part="row"
                  data-row-id={row.id}
                  // Only measured when details are on: without them every row
                  // is exactly `rowHeight`, and the estimate above is already
                  // the answer - so a plain grid keeps its ResizeObserver-free
                  // body. `measureElement` is a stable instance method and
                  // returns nothing, so it can be the ref itself.
                  //
                  // `data-index` is how the virtualizer maps the observed
                  // element back to its item. The panel is inside this element,
                  // so what gets measured is the row *and* its detail, which
                  // is why no second virtual item is needed.
                  data-index={
                    renderDetails && viewIndex >= 0 ? viewIndex : undefined
                  }
                  ref={
                    renderDetails && viewIndex >= 0
                      ? virtualizer.measureElement
                      : undefined
                  }
                  // The tree's own rows. `data-grouped` rather than a class, to
                  // match how the rest of the row's state is published - and so
                  // a consumer can restyle them without reaching into modules.
                  data-grouped={isGroupRow || undefined}
                  data-depth={row.depth}
                  // Which edge block the row sits in, for styling hooks.
                  data-pinned={pinnedAt}
                  // Gated on the flag, not just on `getIsSelected()`: under
                  // `"highlight"` there is no selection, but `rowSelection` may
                  // still hold ids from before the mode changed - TanStack never
                  // prunes it - and a row must not report itself selected in a
                  // mode where selecting is not a thing.
                  data-selected={
                    (features.rowSelection && row.getIsSelected()) || undefined
                  }
                  // Being selected is state; painting it is a display choice, so
                  // the two are separate attributes.
                  data-selected-bg={
                    (features.rowSelection &&
                      features.showSelectedBackground &&
                      row.getIsSelected()) ||
                    undefined
                  }
                  // The highlighted row is its own concept, so its own attribute
                  // pair - `data-highlighted` / `aria-current` against
                  // `data-selected` / `aria-selected` for selection. Under
                  // `"checkboxAndHighlight"` a row can carry both.
                  //
                  // Not `data-active`: header cells already use that for
                  // sorted-or-filtered, and Mantine puts it on its own controls,
                  // so a consumer styling or querying rows by it would cast far
                  // wider than they meant to.
                  data-highlighted={
                    (features.highlightRow && row.id === highlightedRowId) ||
                    undefined
                  }
                  // Marked deleted under draft: struck through and inert
                  // until saveDrafts reports it, or the mark is toggled back.
                  data-deleted={
                    (deletedRowIds.length > 0 && deletedRowIds.includes(row.id)) ||
                    undefined
                  }
                  // Carrying a dirty draft - the row-level face of the cells'
                  // own data-dirty markers, for row-scoped styling.
                  data-dirty={editDirtyRowIdSet.has(row.id) || undefined}
                  // Committed into the draft store, waiting for Save. A
                  // committed entry row is one too - it is in the body
                  // because it is committed - and carries `data-new` besides.
                  data-draft={
                    editDraftRowIdSet.has(row.id) ||
                    newRowIdSet.has(row.id) ||
                    undefined
                  }
                  // An entered row not yet in `data`, committed into the draft
                  // store and sorted, filtered and grouped with the rest.
                  data-new={newRowIdSet.has(row.id) || undefined}
                  // The menu is anchored to the rowgroup, so Mantine's own
                  // `data-expanded` lands there rather than on a row. This is
                  // what says which row the open menu is about.
                  data-context-menu={
                    (contextMenuContent !== null &&
                      contextMenuTarget?.rowId === row.id) ||
                    undefined
                  }
                  data-selects-on-click={
                    (selectsOnRowClick && !isGroupRow) || undefined
                  }
                  data-highlight-on-hover={highlightsOnHover || undefined}
                  aria-selected={
                    features.rowSelection ? row.getIsSelected() : undefined
                  }
                  aria-current={
                    features.highlightRow && row.id === highlightedRowId
                      ? true
                      : undefined
                  }
                  // From the row's position in the whole view, so the stripes
                  // survive the virtualizer's moving window - see the prop.
                  data-striped={
                    (striped && viewIndex >= 0 && viewIndex % 2 === 1) || undefined
                  }
                  className={[classes.bodyRow, rowClassNameFor(row)]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    minHeight: rowHeight,
                    cursor: isInteractive ? "pointer" : undefined,
                    ...rowStyleFor(row),
                  }}
                  // Keyboard parity with the checkbox the row replaces.
                  tabIndex={takesKeyboard ? 0 : undefined}
                  // Shift-click extends the browser's text selection across
                  // every row it passes. `user-select: none` would fix that too,
                  // but would also stop cell values being copied, so it is
                  // prevented on the one gesture that causes it.
                  onMouseDown={
                    selectsOnRowClick && !isGroupRow
                      ? (event) => {
                          if (event.shiftKey) event.preventDefault();
                        }
                      : undefined
                  }
                  onClick={
                    isInteractive
                      ? (event) =>
                          handleRowActivate(row, {
                            toggle: event.ctrlKey || event.metaKey,
                            extend: event.shiftKey,
                          })
                      : undefined
                  }
                  onKeyDown={
                    takesKeyboard
                      ? (event) => {
                          if (event.key !== " " && event.key !== "Enter") return;
                          if (event.target !== event.currentTarget) return;
                          event.preventDefault();
                          // Space/Enter toggle rather than replace, so a
                          // keyboard-only user can still build a selection.
                          handleRowActivate(row, {
                            toggle: true,
                            extend: event.shiftKey,
                          });
                        }
                      : undefined
                  }
                  // Bubbles to the rowgroup, where the menu opens - so the row
                  // is recorded before the dropdown is built.
                  //
                  // A group row records itself only for the cell menu, which is
                  // about the cells it covers. `renderRowContextMenu` is still never
                  // called for one: TanStack builds a group row on its first
                  // child's record, so a render prop reaching for `row.original`
                  // would be handed a real employee that has nothing to do with
                  // the group - see where the content is built. The browser menu
                  // stays suppressed over them either way.
                  onContextMenu={
                    (renderRowContextMenu && !isGroupRow) || cellRangeSelection
                      ? () => {
                          contextMenuRowRef.current = row.id;
                        }
                      : undefined
                  }
                >
                  {rowCells.map((cell, cellIndex) => {
                    // Covered by a spanning cell to its left - see colSpansOf.
                    if (spans !== null && spans[cellIndex] === 0) return null;
                    const colSpan = spans?.[cellIndex] ?? 1;
                    const lastIndex = cellIndex + colSpan - 1;
                    const isEditingCell =
                      (editActive !== null &&
                        editActive.rowId === row.id &&
                        editActive.columnId === cell.column.id) ||
                      (rowEditing && edit.canEditCell(row, cell.column));
                    return (
                    <TMDataGridBodyCell
                      key={cell.id}
                      cell={cell}
                      rowHeight={rowHeight}
                      colSpan={colSpan}
                      layout={
                        colSpan > 1
                          ? spanLayout(cellIndex, lastIndex)
                          : layoutFor(cell.column.id)
                      }
                      contentOverride={
                        rowNumberById !== null &&
                        cell.column.id === ROW_NUMBER_COLUMN_ID
                          ? rowNumberById.get(row.id)
                          : undefined
                      }
                      highlightNeedles={matchNeedles?.get(cell.column.id)}
                      editor={
                        isEditingCell ? (
                          <TMDataGridCellEditor
                            cell={cell}
                            row={row}
                            takeSeedText={takeEditSeed}
                            onClose={(close) =>
                              handleEditorClose(
                                { rowId: row.id, columnId: cell.column.id },
                                close,
                              )
                            }
                          />
                        ) : undefined
                      }
                      onClick={
                        onCellClick && !isGroupRow
                          ? (event) =>
                              onCellClick(cellEventArgs(cell, row, event))
                          : undefined
                      }
                      onDoubleClick={
                        (features.editing || onCellDoubleClick) && !isGroupRow
                          ? (event) => {
                              onCellDoubleClick?.(
                                cellEventArgs(cell, row, event),
                              );
                              if (!features.editing) return;
                              if (!edit.canEditCell(row, cell.column)) return;
                              openEditor({
                                rowId: row.id,
                                columnId: cell.column.id,
                              });
                            }
                          : undefined
                      }
                      // The cells come out in the same left → centre → right
                      // order as `orderedColumns`, which is what lets the index
                      // here stand for the column index everywhere else.
                      nav={
                        cellSelection
                          ? {
                              rowId: row.id,
                              columnIndex: cellIndex + 1,
                              // A spanning cell stands for every column it
                              // covers, wherever the focus was put.
                              focused: isFocusedWithin(
                                row.id,
                                cellIndex,
                                lastIndex,
                              ),
                              // Focusable by click and by the grid, never by
                              // Tab - the guards are the way in. See
                              // `tabStopCell`.
                              tabIndex: -1,
                              // "Selected" means "in the block Ctrl+C would
                              // take" - which under `"single"` is the one cell
                              // the user is standing on. A spanning cell is in
                              // it by its first column alone - see
                              // isWithinBounds.
                              selected: cellRangeSelection
                                ? isWithinBounds(rangeBounds, viewIndex, cellIndex)
                                : isFocusedWithin(row.id, cellIndex, lastIndex),
                              edges: boundsEdges(
                                rangeBounds,
                                viewIndex,
                                cellIndex,
                                lastIndex,
                              ),
                            }
                          : undefined
                      }
                      onFocus={
                        cellSelection
                          ? () =>
                              ui.actions.setFocusedCell({
                                rowId: row.id,
                                columnId: cell.column.id,
                              })
                          : undefined
                      }
                      onMouseDown={
                        cellRangeSelection
                          ? (event) => {
                              // Right-click is the menu's; the middle button is
                              // the browser's.
                              if (event.button !== 0) return;
                              // Pressing a control in the cell - a checkbox, a
                              // chevron, a button a renderer put there - is not
                              // a selection gesture, and a block the user built
                              // should not pay for it. The focus still follows
                              // the press, through the bubbling `onFocus`, so
                              // the cursor ends up on the row acted on; only
                              // the range survives.
                              const pressed = event.target as HTMLElement;
                              const control =
                                pressed === event.currentTarget
                                  ? null
                                  : pressed.closest(FOCUSABLE_IN_CELL);
                              if (
                                control !== null &&
                                event.currentTarget.contains(control)
                              ) {
                                return;
                              }
                              // Shift+click would otherwise smear the browser's
                              // own text selection across everything between
                              // the two cells.
                              if (event.shiftKey) event.preventDefault();
                              wantsCellFocusRef.current = true;
                              startRangeDrag(
                                { rowId: row.id, columnId: cell.column.id },
                                { extend: event.shiftKey },
                              );
                            }
                          : undefined
                      }
                      // Only bound while a drag is running, so the other 99% of
                      // the time the body carries no pointer handlers per cell.
                      onMouseEnter={
                        cellRangeSelection && isDraggingRange
                          ? () =>
                              setRangeTo(
                                { rowId: row.id, columnId: cell.column.id },
                                { extend: true },
                              )
                          : undefined
                      }
                      onContextMenu={
                        renderRowContextMenu || cellRangeSelection || onCellContextMenu
                          ? (event) => {
                              contextMenuColumnRef.current = cell.column.id;
                              if (isGroupRow) return;
                              onCellContextMenu?.(
                                cellEventArgs(cell, row, event),
                              );
                            }
                          : undefined
                      }
                    />
                    );
                  })}

                  {/* A second grid row inside the row element, on the same
                      subgrid tracks - which is what lets one measurement cover
                      both. A cell spanning every column rather than a row of
                      its own, so the row keeps holding exactly one row's worth
                      of content and `aria-rowcount` still counts records. */}
                  {showsDetails(row) && (
                    <div
                      role="cell"
                      aria-colspan={orderedColumns.length}
                      data-dg-part="details"
                      data-row-id={row.id}
                      className={classes.detailsCell}
                      // The row underneath may select, highlight or open a
                      // context menu. A panel is content, not part of that
                      // gesture surface - and stopping the right-click here is
                      // what leaves the browser's own menu working for a link
                      // or an input inside it.
                      onClick={(event) => event.stopPropagation()}
                      onContextMenu={(event) => event.stopPropagation()}
                    >
                      {/* No cast back to `TData`: the context erased the row
                          type, and the renderer reaching this point was typed
                          against the consumer's own at the `useTMDataGrid`
                          call. */}
                      {renderDetails?.({ table, row })}
                    </div>
                  )}
                </div>
              );
              };

              return (
                <>
                  {/* The pinned edge blocks. Same sticky mechanics as the
                      entry block - the *block* is the sticky element, its rows
                      flow normally inside it. `role="presentation"` keeps the
                      wrapper out of the accessibility tree, so the rows stay
                      direct children of the rowgroup. Inside the rowgroup so
                      a right-click on a pinned row still opens the menu. */}
                  {pinnedTopRows.length > 0 && (
                    <div
                      role="presentation"
                      data-dg-part="pinned-top"
                      className={classes.pinnedTopBlock}
                    >
                      {pinnedTopRows.map((row, index) =>
                        renderBodyRow(
                          row,
                          -1,
                          headerRowCount + index + 1,
                          "top",
                        ),
                      )}
                    </div>
                  )}

                  {paddingTop > 0 && (
                    <div
                      aria-hidden
                      style={{ gridColumn: "1/-1", height: paddingTop }}
                    />
                  )}

                  {virtualItems.map((virtualItem) => {
                    const row = rows[virtualItem.index];
                    if (!row) return null;
                    return renderBodyRow(
                      row,
                      virtualItem.index,
                      virtualItem.index +
                        headerRowCount +
                        pinnedTopRows.length +
                        1,
                    );
                  })}

                  {paddingBottom > 0 && (
                    <div
                      aria-hidden
                      style={{ gridColumn: "1/-1", height: paddingBottom }}
                    />
                  )}

                  {pinnedBottomRows.length > 0 && (
                    <div
                      role="presentation"
                      data-dg-part="pinned-bottom"
                      className={classes.pinnedBottomBlock}
                    >
                      {pinnedBottomRows.map((row, index) =>
                        renderBodyRow(
                          row,
                          -1,
                          headerRowCount +
                            pinnedTopRows.length +
                            rows.length +
                            index +
                            1,
                          "bottom",
                        ),
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </TMDataGridBodyRowGroup>

          {/* The empty matrix, one state at a time: loading wins (data is on
              its way, "empty" would be a lie), open entry rows show only
              themselves (a "no rows" under the row being typed reads as a
              contradiction), then the consumer's blank slate, then the two
              defaults - filtered-empty with its search icon, truly-empty as
              plain text, because only one of them is the user's own doing. */}
          {isEmpty && loading === true && (
            <div role="row" className={classes.messageRow}>
              <Loader size="lg" aria-label={labels.loading} />
            </div>
          )}

          {isEmpty && loading !== true && newRowCount === 0 && (
            <div role="row" className={classes.messageRow}>
              {renderEmptyState !== undefined ? (
                renderEmptyState({
                  hasActiveFilters,
                  table: table as unknown as Table<TMDataGridFeatures, TData>,
                })
              ) : hasActiveFilters ? (
                <>
                  <SearchIcon size={40} stroke={1.4} opacity={0.4} />
                  <Text span size={controlSize} c="dimmed">
                    {noResultsLabel}
                  </Text>
                </>
              ) : (
                <Text span size={controlSize} c="dimmed">
                  {labels.noRows}
                </Text>
              )}
            </div>
          )}

          {/* Sticky along the bottom edge, the way the header is along the
              top. `flexRender` with the header context, which is what a
              TanStack `footer` renderer is written against. */}
          {hasSummaryRow && (
            <div
              role="row"
              aria-rowindex={
                rows.length + pinnedRowCount + headerRowCount + 1
              }
              // Also what the height measurement above looks for. One
              // attribute serves both now that the part name *is* the
              // published contract rather than a testing-only alias.
              data-dg-part="summary-row"
              className={classes.summaryRow}
            >
              {leafHeaders.map((header) => {
                const layout = layoutFor(header.column.id);
                return (
                  <div
                    key={header.id}
                    role="cell"
                    data-column-id={header.column.id}
                    data-align={getColumnAlign(header.column)}
                    data-control-column={
                      isControlColumn(header.column.id) || undefined
                    }
                    className={[
                      classes.summaryCell,
                      layout.isBoundary && layout.pinnedAt === "left"
                        ? sticky.stickyLeft
                        : "",
                      layout.isBoundary && layout.pinnedAt === "right"
                        ? sticky.stickyRight
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      minHeight: rowHeight,
                      left:
                        layout.pinnedAt === "left" ? layout.offset : undefined,
                      right:
                        layout.pinnedAt === "right" ? layout.offset : undefined,
                      position: layout.pinnedAt ? "sticky" : undefined,
                      zIndex: layout.pinnedAt
                        ? "var(--dg-z-summary-pinned-cell, 5)"
                        : undefined,
                    }}
                  >
                    <span className={classes.cellContent}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.footer,
                            header.getContext(),
                          )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* The trailing tab guard, last child of the grid so that Shift+Tab
              from below the grid meets it before any cell. */}
          {cellSelection && (
            <div
              ref={trailingGuardRef}
              tabIndex={tabStopCell === null ? -1 : 0}
              role="presentation"
              data-dg-part="tab-guard"
              data-guard="trailing"
              className={classes.tabGuard}
              onFocus={handleGuardFocus}
            />
          )}
        </div>
      </div>

      {/* The automatic filter surfaces. The popup floats over the first body
          rows, anchored to the wrapper; the sidebar is a second column of it,
          which is why the wrapper turns into a flex row for one. Under
          `filters.surface: "none"` neither renders and the consumer's own
          `TMDataGrid.FilterPanel` is the only panel on the page. */}
      {filters.surface === "popup" && <TMDataGridFilterPopup />}
      {filters.surface === "sidebar" && <TMDataGridFilterSidebar />}
    </div>
  );
}
