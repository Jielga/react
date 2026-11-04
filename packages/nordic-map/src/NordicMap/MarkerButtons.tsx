import { useLayoutEffect } from "react";
import classes from "./MarkerButtons.module.css";

/** One marker on screen, as a button */
export type MarkerButton = {
  key: string;
  label: string;
  /** Whether the pin is selected. Left out for clusters, and when pins can not be selected. */
  pressed?: boolean;
};

type MarkerButtonsProps = {
  buttons: MarkerButton[];
  focusedKey: string | null;
  onFocusChange: (key: string | null) => void;
  onActivate: (key: string) => void;
  /** Called when the focused button goes away, because its marker left the view or its cluster split */
  onFocusLost: () => void;
};

/**
 * The pins and clusters on screen as buttons, in `pins` order, so the keyboard and screen readers reach them.
 * The buttons are visually hidden: the canvas draws the markers, and a ring around the focused one.
 */
export function MarkerButtons({ buttons, focusedKey, onFocusChange, onActivate, onFocusLost }: MarkerButtonsProps) {
  const focusedIsGone =
    focusedKey !== null &&
    !buttons.some((button) => {
      return button.key === focusedKey;
    });
  useLayoutEffect(() => {
    if (focusedIsGone) {
      onFocusLost();
    }
  });

  return (
    <div className={classes.hidden}>
      {buttons.map((button) => {
        return (
          <button
            key={button.key}
            type="button"
            tabIndex={0}
            aria-label={button.label}
            aria-pressed={button.pressed}
            onFocus={() => {
              onFocusChange(button.key);
            }}
            onBlur={() => {
              onFocusChange(null);
            }}
            onClick={() => {
              onActivate(button.key);
            }}
          />
        );
      })}
    </div>
  );
}
