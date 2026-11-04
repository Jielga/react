import type { ReactNode } from "react";
import classes from "./MapTooltip.module.css";

type MapTooltipProps = {
  x: number;
  y: number;
  /** Below the point instead of above it, near the top edge of the map */
  below: boolean;
  children: ReactNode;
};

/**
 * Tooltip over a pin, cluster, area or path. Hidden from screen readers, which get the same name from the
 * marker's button.
 */
export function MapTooltip({ x, y, below, children }: MapTooltipProps) {
  return (
    <div
      className={classes.tooltip}
      data-below={below || undefined}
      style={{ left: x, top: y }}
      aria-hidden
    >
      {children}
    </div>
  );
}
