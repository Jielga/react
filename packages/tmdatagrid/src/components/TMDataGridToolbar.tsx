import {
  ActionIcon,
  Box,
  type BoxProps,
  Loader,
  Text,
  Tooltip,
} from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
import classes from "./TMDataGridToolbar.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getGridCapabilities } from "../core/capabilities";
import { useSettledTableState } from "../core/useSettledTableState";
import { isFilterActive } from "../core/filterOperators";
import { FilterIcon } from "./icons";
import { seedColumnFilter } from "../useTMDataGrid";

export type TMDataGridToolbarProps = BoxProps & {
  children?: ReactNode;
  /**
   * Draws a 1px line under the toolbar in the theme's default border colour -
   * the same line the header draws under itself. Defaults to `false`.
   */
  withBottomBorder?: boolean;
};

/**
 * Row above the grid. Compose it from the pieces below, or anything else.
 * Takes Mantine's style props (`mb="sm"`, `px="md"`, `hiddenFrom="sm"`) and
 * sets them on the row.
 */
export function TMDataGridToolbar({
  children,
  withBottomBorder = false,
  className,
  mod,
  ...others
}: TMDataGridToolbarProps) {
  return (
    <Box
      data-dg-part="toolbar"
      className={[classes.toolbar, className].filter(Boolean).join(" ")}
      mod={[{ "with-bottom-border": withBottomBorder }, mod]}
      {...others}
    >
      {children}
    </Box>
  );
}

/** Pushes the following toolbar items to the right. Takes Mantine's style props. */
export function TMDataGridToolbarSpacer({ className, ...others }: BoxProps) {
  return (
    <Box
      className={[classes.toolbarSpacer, className].filter(Boolean).join(" ")}
      {...others}
    />
  );
}

/**
 * A small spinner shown while `meta.loading` is true, and nothing otherwise.
 *
 * The body only shows its loading state while the grid is *empty* - a
 * server-driven grid refetching with rows on screen keeps showing them, which
 * is right, but leaves nothing saying a fetch is running. This is that signal,
 * and the consumer decides where it sits by placing it in the toolbar:
 *
 * ```tsx
 * <TMDataGrid.Toolbar>
 *   <TMDataGrid.SummaryCount />
 *   <TMDataGrid.Spacer />
 *   <TMDataGrid.LoadingIndicator />
 *   <TMDataGrid.FilterButton />
 * </TMDataGrid.Toolbar>
 * ```
 */
export function TMDataGridLoadingIndicator() {
  const { table, labels } = useTMDataGridContext();
  if (table.options.meta?.loading !== true) return null;
  return <Loader size="xs" data-dg-part="loading" aria-label={labels.loading} />;
}

/**
 * Visible rows over total rows. On a server-driven grid, set
 * `meta.totalRowCount` for the denominator - the client never sees every row.
 * Without it the count is rendered alone, since the fallback denominator would
 * be the rows the server sent for the current page: a plausible-looking wrong
 * total, and on an unfiltered first page the same number twice.
 */
export function TMDataGridSummaryCount({ children }: { children?: ReactNode }) {
  const { table, controlSize } = useTMDataGridContext();
  useSettledTableState(table.store);

  const serverDriven =
    table.options.manualFiltering === true ||
    table.options.manualPagination === true;
  const shown = table.getRowCount();
  const total =
    table.options.meta?.totalRowCount ??
    (serverDriven ? undefined : table.getPreFilteredRowModel().rows.length);

  return (
    <Text
      span
      size={controlSize}
      c="dimmed"
      className={classes.summaryCount}
      data-dg-part="summary-count"
    >
      {children !== undefined
        ? children
        : total === undefined
          ? `${shown}`
          : `${shown} / ${total}`}
    </Text>
  );
}

/**
 * Toggles the grid's filter surface - the popup or the sidebar, whichever
 * `filters.surface` names - seeding a filter row on the first filterable
 * column. The count of active filters tints it.
 *
 * Renders nothing when no column can be filtered (`enableColumnFilters:
 * false`), and nothing under `filters.surface: "none"`, where there is no
 * automatic surface for it to toggle. Read `ui.state.filterPanelOpen` and
 * render your own control if a hand-placed panel wants one.
 */
export function TMDataGridFilterButton() {
  const api = useTMDataGridContext();
  const { table, ui, features, filters, labels, controlSize } = api;
  const opened = useSelector(ui, (state) => state.filterPanelOpen);
  const columnFilters = useSelector(
    table.store,
    (state) => state.columnFilters,
  );
  const activeCount = columnFilters.filter((filter) =>
    isFilterActive(filter.value),
  ).length;

  if (!getGridCapabilities(table, features).canFilterAny) return null;
  if (filters.surface === "none") return null;

  return (
    <Tooltip label={labels.filters} openDelay={400}>
      <ActionIcon
        variant={opened || activeCount > 0 ? "light" : "subtle"}
        color={activeCount > 0 ? undefined : "gray"}
        size={controlSize}
        aria-label={labels.filters}
        // Also what the panel's click-away handler tests for, so that a click
        // here reads as a toggle rather than as a click outside.
        data-dg-part="filter-button"
        onClick={() => {
          if (opened) {
            ui.actions.closeFilterPanel();
            return;
          }
          // Not `openColumnFilter`: that one honours header filters and
          // focuses the header control instead of opening anything. This
          // button's whole job is to open the surface it belongs to, which a
          // grid may well have alongside header filters.
          //
          // Seeded only when the panel would otherwise be empty: with filters
          // already in state it has rows to show, and seeding would stack a
          // blank row on the first filterable column on top of them.
          const seedColumn =
            columnFilters.length === 0
              ? table.getAllLeafColumns().find((column) => column.getCanFilter())
              : undefined;
          if (seedColumn) seedColumnFilter(api, seedColumn.id);
          ui.actions.openFilterPanel(seedColumn?.id ?? null);
        }}
      >
        <FilterIcon size={16} stroke={1.6} />
      </ActionIcon>
    </Tooltip>
  );
}
