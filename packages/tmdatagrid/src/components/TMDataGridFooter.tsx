import {
  ActionIcon,
  Box,
  type BoxProps,
  Group,
  Select,
  Text,
  Tooltip,
} from "@mantine/core";
import { useMemo, type ReactNode } from "react";
import classes from "./TMDataGridFooter.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getGridCapabilities } from "../core/capabilities";
import { useSettledTableState } from "../core/useSettledTableState";
import { isPagingActive } from "../core/rowSelection";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import {
  getTMDataGridPaginationApi,
  type TMDataGridPaginationApi,
} from "../core/pagination";

/**
 * The pre-bound pieces of the built-in pager.
 *
 * Each renders exactly what the default footer renders, already wired to the
 * table and already respecting the suspended-paging state - so a custom layout
 * keeps the parts it likes rather than rebuilding them to look the same.
 */
export type TMDataGridPaginationControls = {
  /** "Rows per page" and its select. */
  PageSize: () => ReactNode;
  /** The "1–25 of 300" range label. */
  Range: () => ReactNode;
  /**
   * The "Page 3 of 200" label - what a server-paged grid usually shows in
   * place of a row range. Not in the default footer; put it in a
   * `renderPagination` layout.
   */
  PageNumber: () => ReactNode;
  /** The previous/next buttons. */
  Pager: () => ReactNode;
};

/** What {@link TMDataGridFooterProps.renderPagination} is handed. */
export type TMDataGridPaginationSlotArgs = TMDataGridPaginationApi & {
  Controls: TMDataGridPaginationControls;
};

/*
 * The three controls are module-scope components on purpose. Defined inside
 * the Footer they would be a new component type on every render, so React
 * would unmount and remount the pager between one render and the next - which
 * detaches the button a click is landing on mid-interaction.
 */

function PaginationPageSize({
  pageSizeOptions,
}: {
  pageSizeOptions: ReadonlyArray<number>;
}) {
  const { table, features, labels, controlSize } = useTMDataGridContext();
  useSettledTableState(table.store);
  const paging = isPagingActive(table, features);
  const { pageSize } = table.store.state.pagination;
  // A page size from storage or `initialState` need not be one of the offered
  // sizes, and the Select renders blank without it in the list.
  const sizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <Group gap="xs" wrap="nowrap">
      {/* `span`, here and in every other label the grid renders: Mantine's Text
          is a `<p>` by default, and a grid inside prose picks up that context's
          `p` margins, which push a flex item off centre. */}
      <Text span size={controlSize} c="dimmed">
        {labels.rowsPerPage}
      </Text>
      <Select
        size={controlSize}
        w={78}
        allowDeselect={false}
        variant="unstyled"
        disabled={!paging}
        data-dg-part="page-size"
        data={sizeOptions.map(String)}
        value={String(pageSize)}
        onChange={(value) => {
          table.setPageSize(Number(value) || pageSizeOptions[0]);
          table.setPageIndex(0);
        }}
      />
    </Group>
  );
}

function PaginationRange() {
  const { table, features, labels, controlSize } = useTMDataGridContext();
  useSettledTableState(table.store);
  const paging = isPagingActive(table, features);
  const { pageIndex, pageSize } = table.store.state.pagination;
  const total = table.getRowCount();
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <Text span size={controlSize} c="dimmed" data-dg-part="page-range">
      {paging
        ? labels.pageRange({ from, to, total })
        : // `getRowCount()` would count the tree, so a collapsed grid would
          // claim to hold eight rows.
          labels.groupedAllRows(table.getFilteredRowModel().rows.length)}
    </Text>
  );
}

function PaginationPageNumber() {
  const { table, features, labels, controlSize } = useTMDataGridContext();
  useSettledTableState(table.store);
  const paging = isPagingActive(table, features);
  const { pageIndex } = table.store.state.pagination;

  return (
    <Text span size={controlSize} c="dimmed" data-dg-part="page-number">
      {paging
        ? labels.pageNumber({
            page: pageIndex + 1,
            pageCount: table.getPageCount(),
          })
        : labels.groupedAllRows(table.getFilteredRowModel().rows.length)}
    </Text>
  );
}

function PaginationPager() {
  const { table, features, labels } = useTMDataGridContext();
  useSettledTableState(table.store);
  const paging = isPagingActive(table, features);

  return (
    <Group gap={4} wrap="nowrap">
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={labels.previousPage}
        data-dg-part="page-prev"
        disabled={!paging || !table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        <ChevronLeftIcon size={18} stroke={1.6} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={labels.nextPage}
        data-dg-part="page-next"
        disabled={!paging || !table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        <ChevronRightIcon size={18} stroke={1.6} />
      </ActionIcon>
    </Group>
  );
}

/** Mantine's style props (`mt="sm"`, `px="md"`) are set on the footer bar. */
export type TMDataGridFooterProps = BoxProps & {
  pageSizeOptions?: ReadonlyArray<number>;
  /**
   * Replaces the built-in pager, and is handed the pieces of it.
   *
   * ```tsx
   * <TMDataGrid.Footer
   *   renderPagination={({ state, actions, Controls }) => (
   *     <Group>
   *       <Controls.PageSize />
   *       <Controls.PageNumber />
   *       <Controls.Pager />
   *     </Group>
   *   )}
   * />
   * ```
   */
  renderPagination?: (args: TMDataGridPaginationSlotArgs) => ReactNode;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * MUI-style pager: "Rows per page · from–to of total · ‹ ›".
 *
 * Renders nothing unless pagination is enabled (`enablePagination` or
 * `manualPagination`) - the footer is a pager; extra footer content belongs in
 * your own layout.
 *
 * Row totals come from `table.getRowCount()`, which prefers `options.rowCount`
 * - so a server-paged grid shows the server's total without changes here.
 */
export function TMDataGridFooter({
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  renderPagination,
  className,
  ...others
}: TMDataGridFooterProps) {
  const footerClassName = [classes.footer, className].filter(Boolean).join(" ");
  const { table, features, labels } = useTMDataGridContext();
  useSettledTableState(table.store);

  // Bound once per option list rather than per render, so the controls keep
  // their identity and the elements they render keep theirs.
  const Controls = useMemo<TMDataGridPaginationControls>(
    () => ({
      PageSize: () => <PaginationPageSize pageSizeOptions={pageSizeOptions} />,
      Range: PaginationRange,
      PageNumber: PaginationPageNumber,
      Pager: PaginationPager,
    }),
    [pageSizeOptions],
  );

  if (!getGridCapabilities(table, features).canPaginate) return null;

  const paging = isPagingActive(table, features);

  if (renderPagination) {
    const { state, actions } = getTMDataGridPaginationApi(table, paging);
    return (
      <Box data-dg-part="footer" className={footerClassName} {...others}>
        {renderPagination({ state, actions, Controls })}
      </Box>
    );
  }

  return (
    <Tooltip
      label={labels.pagingSuspendedHint}
      disabled={paging}
      withArrow
      multiline
      w={260}
      position="top"
    >
      <Box
        data-dg-part="footer"
        className={footerClassName}
        data-paging-suspended={!paging || undefined}
        {...others}
      >
        <Controls.PageSize />
        <Controls.Range />
        <Controls.Pager />
      </Box>
    </Tooltip>
  );
}
