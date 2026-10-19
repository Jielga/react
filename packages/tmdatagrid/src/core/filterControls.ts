import type { Column } from "@tanstack/react-table";
import type { ComponentType } from "react";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";
import type { TMDataGridOption } from "./columnOptions";
import type { TMDataGridFilterOperator } from "./filterOperators";
import type { TMDataGridLabels } from "./labels";
import type { TMDataGridSize } from "./sizes";

/**
 * What a filter control is handed - the value slot of one filter-panel row.
 *
 * The contract is value-only: the control reads `operator` to shape itself
 * (a `between` pair renders two ends, an `equals` a single input) and calls
 * `onChange` with the bare value; the grid composes the operator-aware
 * `TMDataGridFilterValue` around it. A control never builds that wrapper and
 * never writes the operator - `table` is the escape hatch for the rare
 * control that must.
 */
export type TMDataGridFilterControlArgs = {
  column: Column<TMDataGridFeatures, TMDataGridRowData, unknown>;
  table: TMDataGridTable<TMDataGridRowData>;
  /** The row's currently selected operator. Read-only for the control. */
  operator: TMDataGridFilterOperator;
  /** The bare filter value - never the `{ operator, value }` wrapper. */
  value: string | ReadonlyArray<string>;
  /** Writes the bare value; the grid pairs it with the current operator. */
  onChange: (next: string | ReadonlyArray<string>) => void;
  /**
   * The column's options through `resolveColumnOptions`, pre-resolved for a
   * column that declares `meta.options` or is select-shaped. Empty otherwise -
   * a control wanting faceted values on other columns resolves them itself.
   */
  options: ReadonlyArray<TMDataGridOption>;
  size: TMDataGridSize;
  labels: TMDataGridLabels;
  /**
   * How much room the control has, and whether it names itself. The same
   * vocabulary as `TMDataGrid.FilterPanel`'s own `layout` prop, plus the one
   * value only a header cell can be in.
   *
   * | Layout | Where | Field |
   * | --- | --- | --- |
   * | `"row"` | A filter row laid out side by side | Labelled, fixed width |
   * | `"stacked"` | A filter row in a narrow host - the sidebar | Labelled, full width |
   * | `"header"` | One header cell, under `filters.inHeader` | `aria-label`, full width |
   *
   * Every built-in control honours it. A custom control that ignores it still
   * works - it will simply look the same everywhere.
   */
  layout: TMDataGridFilterControlLayout;
};

/** How much room a filter control has. See `layout`. */
export type TMDataGridFilterControlLayout = "row" | "stacked" | "header";

/**
 * The two a filter *panel* can be in - {@link TMDataGridFilterControlLayout}
 * without the header cell, which is not a panel. `TMDataGrid.FilterPanel`'s
 * `layout` prop.
 */
export type TMDataGridFilterPanelLayout = Exclude<
  TMDataGridFilterControlLayout,
  "header"
>;

/**
 * `meta.filter.control` - replaces the built-in value control for this column.
 * Rendered as JSX, never invoked as a bare function, so hooks are legal
 * inside. Define it at module scope so its identity is stable across renders.
 */
export type TMDataGridFilterControlComponent =
  ComponentType<TMDataGridFilterControlArgs>;

/**
 * `meta.filter` - everything about how this column filters, in one place.
 *
 * ```tsx
 * meta: {
 *   type: "number",
 *   filter: { defaultOperator: "between", control: DgRangeSliderFilter },
 * }
 * ```
 *
 * `meta.type` and `meta.options` stay outside this namespace on purpose: one
 * declaration of each feeds the filter panel and the cell editor alike.
 */
export type TMDataGridColumnFilterOptions = {
  /**
   * The operators this column offers, a subset of the type's own. For a
   * column backed by an endpoint that answers only some of them - `contains`
   * and `equals`, say - so the panel and the header funnel never offer an
   * operator the query cannot express. Kept in the type's order; one the type
   * does not offer is ignored, and a list that leaves nothing falls back to
   * the type's full set.
   */
  operators?: readonly TMDataGridFilterOperator[];
  /**
   * The operator a fresh filter on this column starts with, instead of the
   * type's default - a salary column can open on `"between"`. Must be one of
   * the operators the column offers.
   */
  defaultOperator?: TMDataGridFilterOperator;
  /**
   * Replaces the built-in value control in this column's filter-panel row.
   * See {@link TMDataGridFilterControlComponent}.
   */
  control?: TMDataGridFilterControlComponent;
  /**
   * Whether this column's filter goes into the `persist.urlKey` search param.
   * Defaults to `true`. `false` keeps it out of the param, on read and on
   * write. Only has an effect when `urlKey` carries `columnFilters`, and since such
   * a slice is not stored under `dataKey` either, the filter is then not
   * persisted anywhere.
   */
  url?: boolean;
};
