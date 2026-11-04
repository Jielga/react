import { createContext, useContext } from "react";
import type { TMDataGridSize } from "./core/sizes";
import type { TMDataGridViewsApi } from "./core/views";
import type { TMDataGridApi } from "./useTMDataGrid";

/**
 * Row shape the chrome components work against. They only ever touch columns,
 * rows and cells generically, so the concrete row type is erased at the context
 * boundary - the same trick Mantine uses for its compound components.
 */
export type TMDataGridRowData = Record<string, unknown>;

export type TMDataGridContextValue = TMDataGridApi<TMDataGridRowData> & {
  size: TMDataGridSize;
  /** Row height in px, already resolved from `size` and `meta.rowHeight`. */
  rowHeight: number;
  /** Mantine control size that pairs with `size`. */
  controlSize: TMDataGridSize;
};

const TMDataGridContext = createContext<unknown>(null);

export const TMDataGridContextProvider = TMDataGridContext.Provider;

export function useTMDataGridContext(): TMDataGridContextValue {
  const api = useContext(TMDataGridContext);
  if (!api) {
    throw new Error(
      "TMDataGrid compound components must be rendered inside <TMDataGrid>",
    );
  }
  return api as TMDataGridContextValue;
}

/**
 * `grid.views` from inside `<TMDataGrid>`, for a views control of your own.
 * Outside the grid, read `views` off what `useTMDataGrid` returned.
 */
export function useTMDataGridViews(): TMDataGridViewsApi {
  return useTMDataGridContext().views;
}

/**
 * What a control inside a body cell puts in its `tabIndex`. Internal: a
 * consumer's own control needs nothing, the tab guards keep the body one stop.
 *
 * `-1` under cell selection: the control is reached by stepping into the cell
 * with Enter or by the Tab walk within the row, never by the page's tab order,
 * so a row does not add one tab stop per mounted row. `0` without it - there
 * is no cursor to step in from, so the page's tab order is the only route.
 */
export function useBodyControlTabIndex(): 0 | -1 {
  const { features } = useTMDataGridContext();
  return features.cellSelection ? -1 : 0;
}
