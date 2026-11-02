import type { RowData } from "@tanstack/react-table";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import classes from "./TMDataGrid.module.css";
import { TMDataGridColumnsPanel } from "./TMDataGridColumnsPanel";
import { TMDataGridContextProvider } from "../TMDataGridContext";
import { TMDataGridDraftActions } from "./TMDataGridDraftActions";
import { TMDataGridFilterPanel } from "./TMDataGridFilterPanel";
import { TMDataGridFilterPills } from "./TMDataGridFilterPills";
import { TMDataGridFooter } from "./TMDataGridFooter";
import { TMDataGridMenu } from "./TMDataGridMenu";
import { TMDataGridSearch } from "./TMDataGridSearch";
import { TMDataGridTable } from "./TMDataGridTable";
import {
  TMDataGridFilterButton,
  TMDataGridLoadingIndicator,
  TMDataGridSummaryCount,
  TMDataGridToolbar,
  TMDataGridToolbarSpacer,
} from "./TMDataGridToolbar";
import { TMDataGridExportPicker } from "./TMDataGridExportPicker";
import { TMDataGridViewsMenu } from "./TMDataGridViews";
import {
  DEFAULT_TMDATAGRID_SIZE,
  SIZE_CONTROL_SIZE,
  SIZE_ROW_HEIGHT,
  type TMDataGridSize,
} from "../core/sizes";
import type { TMDataGridApi } from "../useTMDataGrid";

export type TMDataGridProps<TData extends RowData> = TMDataGridApi<TData> & {
  children: ReactNode;
  /**
   * Mantine size scale. Drives row height, font size, cell padding and the
   * size of the controls in the chrome. `meta.rowHeight` still wins if set.
   */
  size?: TMDataGridSize;
  className?: string;
  /**
   * Inline styles. Widened to accept CSS variables, which is how the grid's
   * colours are themed - `--dg-row-selected-bg` for the selected row
   * background. Plain `CSSProperties` rejects `--*` keys.
   */
  style?: CSSProperties & Record<`--${string}`, string | number>;
  /** Set on the root element. */
  id?: string;
  /**
   * Names this grid for tests. The grid names its own pieces with
   * `data-dg-part` rather than minting test ids, and those repeat across
   * grids - scope through this one and they stop colliding:
   *
   * ```ts
   * page.getByTestId("orders").locator('[data-dg-part="row"][data-row-id="42"]')
   * ```
   *
   * See the Testing docs page for the full attribute contract.
   */
  "data-testid"?: string;
};

// Documented on the `TMDataGrid` export below.
// oxlint-disable-next-line react/only-export-components -- exported as the Object.assign compound `TMDataGrid`, which the rule cannot see as a component
function TMDataGridRoot<TData extends RowData>({
  table,
  ui,
  edit,
  features,
  filters,
  exportOptions,
  labels,
  renderDetails,
  renderDetailsEstHeight,
  overscan,
  resetSettings,
  views,
  scrollToRow,
  scrollerRef,
  size = DEFAULT_TMDATAGRID_SIZE,
  children,
  className,
  style,
  id,
  "data-testid": testId,
}: TMDataGridProps<TData>) {
  const rowHeight = table.options.meta?.rowHeight ?? SIZE_ROW_HEIGHT[size];

  const api = useMemo(
    () => ({
      table,
      ui,
      edit,
      features,
      filters,
      exportOptions,
      labels,
      renderDetails,
      renderDetailsEstHeight,
      overscan,
      resetSettings,
      views,
      scrollToRow,
      scrollerRef,
      size,
      rowHeight,
      controlSize: SIZE_CONTROL_SIZE[size],
    }),
    [
      table,
      ui,
      edit,
      features,
      filters,
      exportOptions,
      labels,
      renderDetails,
      renderDetailsEstHeight,
      overscan,
      resetSettings,
      views,
      scrollToRow,
      scrollerRef,
      size,
      rowHeight,
    ],
  );

  return (
    <TMDataGridContextProvider value={api}>
      <div
        id={id}
        data-testid={testId}
        // The handle everything else scopes off - see the `data-testid` prop.
        data-dg-root
        data-size={size}
        className={[classes.root, className].filter(Boolean).join(" ")}
        style={style}
      >
        {children}
      </div>
      {/* Portaled by Mantine, so outside the root element; inside the
          provider, since it reads the grid. */}
      <TMDataGridExportPicker />
    </TMDataGridContextProvider>
  );
}

/**
 * Root of the grid. Takes the object returned by `useTMDataGrid` - spread it -
 * and publishes it to the compound components below it:
 *
 * ```tsx
 * const grid = useTMDataGrid({ data, columns });
 *
 * <TMDataGrid {...grid}>
 *   <TMDataGrid.Toolbar>
 *     <TMDataGrid.SummaryCount />
 *     <TMDataGrid.Spacer />
 *     <TMDataGrid.Menu>
 *       <TMDataGrid.Menu.Columns />
 *     </TMDataGrid.Menu>
 *   </TMDataGrid.Toolbar>
 *   <TMDataGrid.Table />
 *   <TMDataGrid.Footer />
 * </TMDataGrid>
 * ```
 */
export const TMDataGrid = Object.assign(TMDataGridRoot, {
  Toolbar: TMDataGridToolbar,
  Spacer: TMDataGridToolbarSpacer,
  SummaryCount: TMDataGridSummaryCount,
  LoadingIndicator: TMDataGridLoadingIndicator,
  Search: TMDataGridSearch,
  DraftActions: TMDataGridDraftActions,
  Menu: TMDataGridMenu,
  FilterButton: TMDataGridFilterButton,
  Table: TMDataGridTable,
  Footer: TMDataGridFooter,
  /** Rendered by `TMDataGrid.Table`; exported for custom layouts. */
  FilterPanel: TMDataGridFilterPanel,
  /**
   * Takes the grid as an `api` prop rather than from context, so it can be
   * rendered outside `<TMDataGrid>` - a page header, for instance.
   */
  FilterPills: TMDataGridFilterPills,
  /**
   * The column chooser as plain controls, for a Popover, a Drawer or an
   * inline layout; `TMDataGrid.Menu.Columns` is the same thing as menu items.
   */
  ColumnsPanel: TMDataGridColumnsPanel,
  /**
   * The saved views behind a toolbar button of their own;
   * `TMDataGrid.Menu.Views` is the same thing as items for any menu.
   */
  ViewsMenu: TMDataGridViewsMenu,
});
