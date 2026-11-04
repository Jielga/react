import { useState } from "react";

const PREFIX = "nordic-map-docs:";

/**
 * State kept in local storage under `key`, so a reload keeps it. A stored value that `isValid` rejects, for
 * example one from an older playground, falls back to `initial`.
 */
export function useStoredState<T>({
  key,
  initial,
  isValid,
}: {
  key: string;
  initial: T;
  isValid: (value: unknown) => value is T;
}): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(PREFIX + key);
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored);
        if (isValid(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Unreadable or blocked storage: start from the default
    }
    return initial;
  });
  const update = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(next));
    } catch {
      // Storage may be full or blocked. The setting still applies until the page reloads.
    }
  };
  return [value, update];
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
