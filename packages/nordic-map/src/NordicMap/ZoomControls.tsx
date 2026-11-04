import type { ReactNode } from "react";
import classes from "./ZoomControls.module.css";

type ZoomControlsProps = {
  zoomInLabel: string;
  zoomOutLabel: string;
  resetLabel: string;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
};

/** A 24 px stroke icon, drawn in the button's text color */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={classes.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Zoom in, zoom out and show the whole map, stacked in the map's top right corner */
export function ZoomControls({
  zoomInLabel,
  zoomOutLabel,
  resetLabel,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onReset,
}: ZoomControlsProps) {
  return (
    <div className={classes.controls}>
      <button type="button" className={classes.button} aria-label={zoomInLabel} disabled={!canZoomIn} onClick={onZoomIn}>
        <Icon>
          <path d="M12 5v14M5 12h14" />
        </Icon>
      </button>
      <button type="button" className={classes.button} aria-label={zoomOutLabel} disabled={!canZoomOut} onClick={onZoomOut}>
        <Icon>
          <path d="M5 12h14" />
        </Icon>
      </button>
      <button type="button" className={classes.button} aria-label={resetLabel} disabled={!canZoomOut} onClick={onReset}>
        <Icon>
          <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
          <path d="M9 12h6" />
        </Icon>
      </button>
    </div>
  );
}
