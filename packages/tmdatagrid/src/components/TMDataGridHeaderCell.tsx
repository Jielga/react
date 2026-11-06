import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { flexRender, type Header } from "@tanstack/react-table";
import { shallow } from "@tanstack/store";
import { type DragEvent, type ReactNode, useRef, useState } from "react";
import { autosizeColumn } from "../core/autosize";
import {
  getColumnCapabilities,
  getGridCapabilities,
} from "../core/capabilities";
import {
  getColumnRegion,
  getStepTargetColumn,
  keepGeneratedColumnsOutermost,
  moveColumn,
  moveColumnByStep,
  pinningPositionOfSide,
  type TMDataGridDropSide,
} from "../core/columnOrdering";
import {
  getColumnAlign,
  getColumnLabel,
  isControlColumn,
} from "../core/columnUtils";
import { isNode } from "../core/dom";
import { resolveExpandAll } from "../core/expanding";
import { isFilterActive } from "../core/filterOperators";
import {
  type TMDataGridRowData,
  useTMDataGridContext,
} from "../TMDataGridContext";
import { openColumnFilter, type TMDataGridFeatures } from "../useTMDataGrid";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  AutosizeIcon,
  CollapseAllIcon,
  ColumnsIcon,
  DotsVerticalIcon,
  ExpandAllIcon,
  EyeOffIcon,
  FilterIcon,
  GroupIcon,
  MoveLeftIcon,
  MoveRightIcon,
  PinLeftIcon,
  PinOffIcon,
  PinRightIcon,
  SortAgainIcon,
  UngroupIcon,
} from "./icons";
import sticky from "./sticky.module.css";
import { GROUP_COLUMN_ID } from "./TMDataGridGroupColumn";
import classes from "./TMDataGridHeaderCell.module.css";
import { TMDataGridMenuColumns } from "./TMDataGridMenu";
import type { TMDataGridColumnLayout } from "./TMDataGridTable";

/** The table as the header cell sees it, after the context type erasure. */
type TMDataGridTableInstance = ReturnType<typeof useTMDataGridContext>["table"];

export type TMDataGridHeader = Header<
  TMDataGridFeatures,
  TMDataGridRowData,
  unknown
>;

/** What {@link TMDataGridColumnMenuItemsRenderer} is handed. */
export type TMDataGridColumnMenuItemsArgs = {
  column: TMDataGridHeader["column"];
  table: TMDataGridTableInstance;
  /**
   * The items the grid would have rendered, in order, dividers included.
   * Return them to keep the built-in menu, splice around them to extend it,
   * or drop them to replace it.
   */
  internalItems: Array<ReactNode>;
};

/**
 * Replaces a column's menu contents. Returning an empty list leaves the column
 * with no menu button at all, the same as a column whose every feature is off.
 */
export type TMDataGridColumnMenuItemsRenderer = (
  args: TMDataGridColumnMenuItemsArgs,
) => Array<ReactNode>;

export function TMDataGridHeaderCell({
  header,
  layout,
  renderColumnMenuItems,
}: {
  header: TMDataGridHeader;
  layout: TMDataGridColumnLayout;
  renderColumnMenuItems?: TMDataGridColumnMenuItemsRenderer;
}) {
  const api = useTMDataGridContext();
  const { table, features, filters, labels } = api;
  const column = header.column;
  const [menuOpened, setMenuOpened] = useState(false);
  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [dropSide, setDropSide] = useState<TMDataGridDropSide | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  // A resize drag ends with a click that bubbles to the header - without this
  // every resize would also toggle the column's sort order.
  const suppressSortRef = useRef(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);

  // Subscribing to the slices this cell renders from keeps it live even when the
  // surrounding tree is memoized (React Compiler) or the table lives elsewhere.
  // `columnOrder` is in the list because the move menu items are derived from
  // the column's neighbours, which is exactly what an order change invalidates.
  const { sorting, columnFilters, resizingColumnId, columnPinning, grouping } =
    useSelector(
      table.store,
      (state) => ({
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        resizingColumnId: state.columnResizing.isResizingColumn,
        columnPinning: state.columnPinning,
        columnOrder: state.columnOrder,
        grouping: state.grouping,
      }),
      { compare: shallow },
    );
  const draggedColumnId = useSelector(api.ui, (state) => state.draggedColumnId);

  const isLeaf = header.subHeaders.length === 0;
  const label = getColumnLabel(column);
  const align = getColumnAlign(column);
  const sortDirection = sorting.find((sort) => sort.id === column.id)?.desc;
  const isSorted = sortDirection !== undefined;
  // Read off the api, which every render of the grid rebuilds - not computed
  // here, where the React Compiler would cache it on `table`.
  const isSortStale = isSorted && api.sortStale;
  const sortIndex =
    isSorted && sorting.length > 1
      ? sorting.findIndex((sort) => sort.id === column.id) + 1
      : null;
  const isFiltered = columnFilters.some(
    (filter) => filter.id === column.id && isFilterActive(filter.value),
  );
  const isResizing = resizingColumnId === column.id;
  const isAnyResizing = resizingColumnId !== false;
  const pinnedAt = layout.pinnedAt;

  const capabilities = getColumnCapabilities(column, features);
  const canSort = isLeaf && capabilities.canSort;
  const canFilter = isLeaf && capabilities.canFilter;
  const canHide = isLeaf && capabilities.canHide;
  const canPin = isLeaf && capabilities.canPin;
  const canResize = capabilities.canResize;
  const canReorder = isLeaf && capabilities.canReorder;
  const canGroup = isLeaf && capabilities.canGroup;
  const canManageColumns =
    isLeaf && getGridCapabilities(table, features).canHideAny;

  // Read off the subscribed slice, not from `column.getIsGrouped()`: that is a
  // call on a `column` whose identity survives a grouping change, so the React
  // Compiler would cache the answer and the menu would keep offering to group
  // a column that already is. Same reason the sort and filter flags above are
  // derived from state rather than from `getIsSorted()`.
  const isGrouped = grouping.includes(column.id);
  const isGroupingActive = grouping.length > 0;

  const isDragged = draggedColumnId === column.id;
  const isDropTarget =
    canReorder &&
    draggedColumnId !== null &&
    !isDragged &&
    getColumnRegion(columnPinning, draggedColumnId) ===
      getColumnRegion(columnPinning, column.id);

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.effectAllowed = "move";
    // Some browsers refuse to start a drag with an empty payload.
    event.dataTransfer.setData("text/plain", column.id);
    api.ui.actions.startColumnDrag(column.id);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!isDropTarget) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = cellRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setDropSide(
      event.clientX < bounds.left + bounds.width / 2 ? "before" : "after",
    );
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (isNode(next) && event.currentTarget.contains(next)) return;
    setDropSide(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropSide(null);
    api.ui.actions.endColumnDrag();
    if (!isDropTarget || !dropSide || !draggedColumnId) return;
    moveColumn({
      table,
      columnId: draggedColumnId,
      targetId: column.id,
      side: dropSide,
    });
  }

  function handleDragEnd() {
    setDropSide(null);
    api.ui.actions.endColumnDrag();
  }

  /**
   * Sizes the column to its widest mounted content. The container is found
   * from the cell rather than passed down - the header always renders inside
   * the grid's scroll container, and that is the subtree autosize measures.
   */
  function autosize() {
    const container = cellRef.current?.closest<HTMLElement>(
      "[data-dg-scroll-container]",
    );
    if (container) autosizeColumn({ table, columnId: column.id, container });
  }

  /**
   * Writes the width this header's columns are rendered with into
   * `columnSizing`, for the ones that have no width there yet.
   *
   * An unresized column is a fluid (`fr`) track: it renders at whatever share
   * of the grid it is given, while `column.getSize()` keeps reporting the
   * declared `size`. Anything that switches a column to exact pixels has to
   * close that gap first, or the column jumps from the width on screen to the
   * declared one.
   *
   * Under a held pointer that jump is more than cosmetic: it slides the
   * divider out from under the cursor onto the neighbouring header, where the
   * browser starts a native column-move drag instead. That drag swallows the
   * `mouseup` the resize listens for, so the resize keeps running after the
   * button is released.
   */
  function freezeRenderedWidths() {
    const container = cellRef.current?.closest<HTMLElement>(
      "[data-dg-scroll-container]",
    );
    if (!container) return;
    const sizing = table.store.state.columnSizing;
    const frozen: Record<string, number> = {};
    for (const leaf of header.getLeafHeaders()) {
      const id = leaf.column.id;
      if (id in sizing) continue;
      const width = container
        .querySelector<HTMLElement>(
          `[role="columnheader"][data-column-id="${CSS.escape(id)}"]`,
        )
        ?.getBoundingClientRect().width;
      if (width) frozen[id] = Math.round(width);
    }
    if (Object.keys(frozen).length === 0) return;
    table.setColumnSizing((previous) => ({ ...previous, ...frozen }));
  }

  /**
   * Pinned columns are positioned with `getStart()` / `getAfter()`, which sum
   * `column.getSize()`. Fluid (`fr`) columns don't report their rendered width
   * there, so freeze the measured width into `columnSizing` as we pin - that
   * keeps the column looking the same and keeps the offsets exact.
   */
  function setPinned(position: "left" | "right" | false) {
    if (position) freezeRenderedWidths();
    column.pin(pinningPositionOfSide(position));
    // `pin("end")` appends, which would leave the column outside the edit
    // lane. Normalising after the pin rather than writing the lane by hand
    // keeps TanStack's own handling of a header group's leaves.
    table.setColumnPinning(keepGeneratedColumnsOutermost);
  }

  function sortBy(desc: boolean) {
    if (features.frozenSort && sorting.length === 1 && sortDirection === desc) {
      api.sortAgain();
    } else {
      column.toggleSorting(desc);
    }
  }

  const menuItems: ReactNode[] = [];
  if (canSort) {
    menuItems.push(
      <Menu.Item
        key="sort-asc"
        leftSection={<ArrowUpIcon size={16} stroke={1.6} />}
        onClick={() => sortBy(false)}
      >
        {labels.sortAsc}
      </Menu.Item>,
      <Menu.Item
        key="sort-desc"
        leftSection={<ArrowDownIcon size={16} stroke={1.6} />}
        onClick={() => sortBy(true)}
      >
        {labels.sortDesc}
      </Menu.Item>,
    );
    if (features.frozenSort && isSorted) {
      menuItems.push(
        <Menu.Item
          key="sort-again"
          leftSection={<SortAgainIcon size={16} stroke={1.6} />}
          onClick={api.sortAgain}
        >
          {labels.sortAgain}
        </Menu.Item>,
      );
    }
    menuItems.push(<Menu.Divider key="sort-divider" />);
  }
  if (canFilter && !filters.inHeader) {
    menuItems.push(
      <Menu.Item
        key="filter"
        leftSection={<FilterIcon size={16} stroke={1.6} />}
        onClick={() => openColumnFilter(api, column.id)}
      >
        {labels.filterMenuItem}
      </Menu.Item>,
      <Menu.Divider key="filter-divider" />,
    );
  }
  if (canGroup) {
    menuItems.push(
      <Menu.Item
        key="group"
        className={isGrouped ? classes.menuItemActive : undefined}
        leftSection={
          isGrouped ? (
            <UngroupIcon size={16} stroke={1.6} />
          ) : (
            <GroupIcon size={16} stroke={1.6} />
          )
        }
        onClick={column.getToggleGroupingHandler()}
      >
        {isGrouped ? labels.ungroup(label) : labels.groupBy(label)}
      </Menu.Item>,
    );
  }
  if (isGroupingActive) {
    if (column.id === GROUP_COLUMN_ID) {
      for (const groupedId of grouping) {
        const groupedColumn = table.getColumn(groupedId);
        if (!groupedColumn) continue;
        menuItems.push(
          <Menu.Item
            key={`ungroup-${groupedId}`}
            leftSection={<UngroupIcon size={16} stroke={1.6} />}
            onClick={() => groupedColumn.toggleGrouping()}
          >
            {labels.ungroup(getColumnLabel(groupedColumn))}
          </Menu.Item>,
        );
      }
    }
    // Groups only, though `expanded` also holds which rows have their detail
    // panel open - `toggleAllRowsExpanded` would open every one of them from an
    // item that says "groups". See resolveExpandAll.
    const expandAllGroups = (expand: boolean) =>
      table.setExpanded(
        resolveExpandAll({
          rows: table.getPrePaginatedRowModel().flatRows,
          expanded: table.store.state.expanded,
          target: "groups",
          expand,
        }),
      );

    menuItems.push(
      <Menu.Item
        key="expand-all"
        leftSection={<ExpandAllIcon size={16} stroke={1.6} />}
        onClick={() => expandAllGroups(true)}
      >
        {labels.expandAllGroups}
      </Menu.Item>,
      <Menu.Item
        key="collapse-all"
        leftSection={<CollapseAllIcon size={16} stroke={1.6} />}
        onClick={() => expandAllGroups(false)}
      >
        {labels.collapseAllGroups}
      </Menu.Item>,
    );
  }
  if (canGroup || isGroupingActive) {
    menuItems.push(<Menu.Divider key="group-divider" />);
  }
  if (canPin) {
    menuItems.push(
      <Menu.Item
        key="pin-left"
        className={pinnedAt === "left" ? classes.menuItemActive : undefined}
        leftSection={<PinLeftIcon size={16} stroke={1.6} />}
        onClick={() => setPinned(pinnedAt === "left" ? false : "left")}
      >
        {labels.pinLeft}
      </Menu.Item>,
      <Menu.Item
        key="pin-right"
        className={pinnedAt === "right" ? classes.menuItemActive : undefined}
        leftSection={<PinRightIcon size={16} stroke={1.6} />}
        onClick={() => setPinned(pinnedAt === "right" ? false : "right")}
      >
        {labels.pinRight}
      </Menu.Item>,
    );
    if (pinnedAt) {
      menuItems.push(
        <Menu.Item
          key="unpin"
          leftSection={<PinOffIcon size={16} stroke={1.6} />}
          onClick={() => setPinned(false)}
        >
          {labels.unpin}
        </Menu.Item>,
      );
    }
    menuItems.push(<Menu.Divider key="pin-divider" />);
  }
  if (canReorder) {
    const previous = getStepTargetColumn({
      table,
      columnId: column.id,
      direction: -1,
    });
    const next = getStepTargetColumn({
      table,
      columnId: column.id,
      direction: 1,
    });
    if (previous || next) {
      menuItems.push(
        <Menu.Item
          key="move-left"
          disabled={!previous}
          leftSection={<MoveLeftIcon size={16} stroke={1.6} />}
          onClick={() =>
            moveColumnByStep({ table, columnId: column.id, direction: -1 })
          }
        >
          {labels.moveLeft}
        </Menu.Item>,
        <Menu.Item
          key="move-right"
          disabled={!next}
          leftSection={<MoveRightIcon size={16} stroke={1.6} />}
          onClick={() =>
            moveColumnByStep({ table, columnId: column.id, direction: 1 })
          }
        >
          {labels.moveRight}
        </Menu.Item>,
        <Menu.Divider key="move-divider" />,
      );
    }
  }
  if (canResize && isLeaf) {
    menuItems.push(
      <Menu.Item
        key="autosize"
        leftSection={<AutosizeIcon size={16} stroke={1.6} />}
        onClick={autosize}
      >
        {labels.autosizeColumn}
      </Menu.Item>,
      <Menu.Divider key="autosize-divider" />,
    );
  }
  if (canHide) {
    menuItems.push(
      <Menu.Item
        key="hide"
        leftSection={<EyeOffIcon size={16} stroke={1.6} />}
        onClick={() => column.toggleVisibility(false)}
      >
        {labels.hideColumn}
      </Menu.Item>,
    );
  }
  if (canManageColumns) {
    menuItems.push(
      <Menu.Sub key="manage">
        <Menu.Sub.Target>
          <Menu.Sub.Item leftSection={<ColumnsIcon size={16} stroke={1.6} />}>
            {labels.manageColumns}
          </Menu.Sub.Item>
        </Menu.Sub.Target>
        <Menu.Sub.Dropdown>
          {/* No search box: `Menu.Search` registers on the root menu context,
              which switches off type-ahead and the arrow-key handling of every
              dropdown of this menu - the column menu's included. */}
          <TMDataGridMenuColumns searchable={false} />
        </Menu.Sub.Dropdown>
      </Menu.Sub>,
    );
  }
  while (menuItems.length > 0 && isDivider(menuItems.at(-1))) {
    menuItems.pop();
  }

  const finalItems = renderColumnMenuItems
    ? [...renderColumnMenuItems({ column, table, internalItems: menuItems })]
    : menuItems;
  while (finalItems.length > 0 && isDivider(finalItems.at(-1))) {
    finalItems.pop();
  }

  const hasMenu =
    isLeaf && finalItems.length > 0 && !isControlColumn(column.id);

  const cellClass = [
    classes.headerCell,
    canSort ? classes.headerCellSortable : "",
    isFiltered ? classes.headerCellFiltered : "",
    isDragged ? classes.headerCellDragging : "",
    dropSide === "before" ? classes.headerCellDropBefore : "",
    dropSide === "after" ? classes.headerCellDropAfter : "",
    layout.isBoundary && pinnedAt === "left" ? sticky.stickyLeft : "",
    layout.isBoundary && pinnedAt === "right" ? sticky.stickyRight : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cell = (
    <div
      ref={cellRef}
      role="columnheader"
      data-dg-part="header"
      data-column-id={column.id}
      data-active={isSorted || isFiltered || undefined}
      data-align={align}
      data-control-column={isControlColumn(column.id) || undefined}
      // Only meaningful on a sortable column: "none" announces that this
      // header sorts, which is wrong on one that does not.
      aria-sort={
        canSort
          ? isSorted
            ? sortDirection
              ? "descending"
              : "ascending"
            : "none"
          : undefined
      }
      className={cellClass}
      // Dropped while any column is resizing, so dragging the separator resizes
      // the column instead of moving it, and a header the divider passes under
      // cannot start a move of its own.
      draggable={canReorder && !isAnyResizing}
      onDragStart={canReorder ? handleDragStart : undefined}
      onDragEnd={canReorder ? handleDragEnd : undefined}
      onDragOver={isDropTarget ? handleDragOver : undefined}
      onDragLeave={isDropTarget ? handleDragLeave : undefined}
      onDrop={isDropTarget ? handleDrop : undefined}
      style={{
        gridColumn: header.colSpan > 1 ? `span ${header.colSpan}` : undefined,
        left: pinnedAt === "left" ? layout.offset : undefined,
        right: pinnedAt === "right" ? layout.offset : undefined,
        position: pinnedAt ? "sticky" : undefined,
        // From the stacking ladder in TMDataGrid.module.css.
        zIndex: pinnedAt ? "var(--dg-z-header-pinned-cell, 7)" : undefined,
      }}
      onMouseDown={
        canSort
          ? (event) => {
              if (event.shiftKey) event.preventDefault();
            }
          : undefined
      }
      onClick={
        canSort
          ? (event) => {
              if (suppressSortRef.current) {
                suppressSortRef.current = false;
                return;
              }
              column.getToggleSortingHandler()?.(event);
            }
          : undefined
      }
    >
      {header.isPlaceholder ? null : (
        <Tooltip label={label} openDelay={600} withinPortal disabled={!isLeaf}>
          <span className={classes.headerTitle} data-dg-header-title>
            {flexRender(column.columnDef.header, header.getContext())}
          </span>
        </Tooltip>
      )}

      {isLeaf && (
        <div className={classes.headerActions}>
          {isFiltered && !filters.inHeader && (
            <ActionIcon
              className={classes.headerAction}
              data-pinned-visible="true"
              variant="subtle"
              color="gray"
              size="xs"
              aria-label={labels.filterOn(label)}
              data-dg-part="header-filter"
              data-column-id={column.id}
              onClick={(event) => {
                event.stopPropagation();
                openColumnFilter(api, column.id);
              }}
            >
              <FilterIcon size={14} stroke={1.6} />
            </ActionIcon>
          )}

          {canSort && (
            <ActionIcon
              ref={sortButtonRef}
              className={`${classes.headerAction} ${classes.sortAction}`}
              data-pinned-visible={isSorted || undefined}
              data-sorted={isSorted || undefined}
              variant="subtle"
              color={isSorted ? undefined : "gray"}
              size="xs"
              aria-label={labels.sortColumn(label)}
              data-dg-part="header-sort"
              data-column-id={column.id}
              onClick={(event) => {
                event.stopPropagation();
                column.getToggleSortingHandler()?.(event);
              }}
            >
              {sortDirection ? (
                <ArrowDownIcon size={14} stroke={1.6} />
              ) : (
                <ArrowUpIcon size={14} stroke={1.6} />
              )}
            </ActionIcon>
          )}

          {isSortStale && (
            <Tooltip label={labels.sortAgainHint} openDelay={300} withinPortal>
              <ActionIcon
                className={classes.headerAction}
                data-pinned-visible="true"
                variant="subtle"
                color="gray"
                size="xs"
                aria-label={labels.sortAgain}
                data-dg-part="sort-again"
                data-column-id={column.id}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.currentTarget === document.activeElement) {
                    sortButtonRef.current?.focus();
                  }
                  api.sortAgain();
                }}
              >
                <SortAgainIcon size={14} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
          )}

          {sortIndex !== null && (
            <span className={classes.sortIndex} data-dg-part="sort-index">
              {sortIndex}
            </span>
          )}

          {hasMenu && (
            <Menu
              opened={menuOpened}
              onChange={setMenuOpened}
              position="bottom-start"
              shadow="md"
              width={220}
              withinPortal
            >
              <Menu.Target>
                <ActionIcon
                  className={classes.headerAction}
                  // Held visible for the right-click menu too: that one opens at
                  // the pointer and is portaled, so the hover that revealed the
                  // actions is lost the moment the pointer enters the dropdown.
                  data-pinned-visible={
                    menuOpened || contextMenuOpened || undefined
                  }
                  variant="subtle"
                  color="gray"
                  size="xs"
                  aria-label={labels.columnMenu(label)}
                  data-dg-part="header-menu"
                  data-column-id={column.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuOpened((opened) => !opened);
                  }}
                >
                  <DotsVerticalIcon size={14} stroke={1.6} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                {finalItems}
              </Menu.Dropdown>
            </Menu>
          )}
        </div>
      )}

      {!isControlColumn(column.id) && (
        <div
          className={[
            classes.columnSeparator,
            canResize ? classes.columnSeparatorResizable : "",
            isResizing ? classes.columnSeparatorActive : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-dg-part={canResize ? "header-resize" : undefined}
          data-column-id={canResize ? column.id : undefined}
          draggable={false}
          // The drag starts from `column.getSize()`, so the rendered width has
          // to be in `columnSizing` before the handler reads it - otherwise
          // the first pointer move snaps a fluid column to its declared size.
          //
          // The handler listens for the moves and the release on the document
          // it is given - the separator's own, not the global one, which is
          // the opener's when the grid is rendered through a portal into a
          // window opened with `window.open`.
          onMouseDown={
            canResize
              ? (event) => {
                  suppressSortRef.current = true;
                  freezeRenderedWidths();
                  header.getResizeHandler(event.currentTarget.ownerDocument)(
                    event,
                  );
                }
              : undefined
          }
          onTouchStart={
            canResize
              ? (event) => {
                  freezeRenderedWidths();
                  header.getResizeHandler(event.currentTarget.ownerDocument)(
                    event,
                  );
                }
              : undefined
          }
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={
            canResize
              ? (event) => {
                  event.stopPropagation();
                  autosize();
                }
              : undefined
          }
        />
      )}
    </div>
  );

  if (!hasMenu) return cell;

  // A second Menu rather than one serving both ways in: a Mantine Menu has one
  // target, the button's dropdown hangs off the button, and a context menu
  // belongs at the pointer.
  return (
    <Menu
      opened={contextMenuOpened}
      onChange={(opened) => {
        setContextMenuOpened(opened);
        if (opened) setMenuOpened(false);
      }}
      position="bottom-start"
      shadow="md"
      width={220}
      withinPortal
    >
      <Menu.ContextMenu>{cell}</Menu.ContextMenu>
      <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
        {finalItems}
      </Menu.Dropdown>
    </Menu>
  );
}

function isDivider(node: ReactNode): boolean {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    node.type === Menu.Divider
  );
}
