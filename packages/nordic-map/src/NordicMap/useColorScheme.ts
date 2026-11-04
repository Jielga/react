import { useSyncExternalStore } from "react";

/** `auto` follows the operating system's light or dark setting */
export type MapColorScheme = "light" | "dark" | "auto";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

/** The scheme to draw with. `auto` reads the system setting, and follows it when it changes. */
export function useColorScheme(scheme: MapColorScheme): "light" | "dark" {
  const systemDark = useSyncExternalStore(subscribe, prefersDark, () => {
    return false;
  });
  if (scheme === "auto") {
    return systemDark ? "dark" : "light";
  }
  return scheme;
}
