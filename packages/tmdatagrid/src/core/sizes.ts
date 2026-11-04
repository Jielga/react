import type { MantineSize } from "@mantine/core";

export type TMDataGridSize = MantineSize;

export const DEFAULT_TMDATAGRID_SIZE: TMDataGridSize = "md";

/**
 * Row height per size, in px.
 *
 * The virtualizer needs this as a number - it cannot read the CSS variable -
 * so the scale lives here and `TMDataGrid.module.css` mirrors it. `meta.rowHeight`
 * overrides it when a grid needs a height the scale doesn't offer.
 */
export const SIZE_ROW_HEIGHT: Record<TMDataGridSize, number> = {
  xs: 34,
  sm: 42,
  md: 52,
  lg: 62,
  xl: 72,
};

/** Size of the Mantine controls rendered inside the grid chrome. */
export const SIZE_CONTROL_SIZE: Record<TMDataGridSize, MantineSize> = {
  xs: "xs",
  sm: "xs",
  md: "sm",
  lg: "sm",
  xl: "md",
};
