import { useEffect, useState } from "react";

/** Ctrl+K / ⌘K anywhere on the site, and the state the header button drives. */
export function useDocsSearch() {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpened((open) => !open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    opened,
    open: () => setOpened(true),
    close: () => setOpened(false),
  };
}
