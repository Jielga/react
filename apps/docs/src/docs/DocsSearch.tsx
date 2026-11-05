import {
  Badge,
  Group,
  Kbd,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import classes from "./DocsSearch.module.css";
import {
  excerpt,
  searchDocs,
  type SearchEntry,
  type SearchKind,
} from "./searchIndex";

/**
 * The Ctrl+K palette.
 *
 * Built on Mantine's `Modal` rather than `@mantine/spotlight`: the ranking is
 * the interesting part and it already lives in `searchIndex`, so the shell
 * only has to be a text input, a list and four keys.
 */

const KIND_LABEL: Record<SearchKind, string> = {
  page: "Page",
  section: "Section",
  symbol: "API",
  text: "Text",
};

const KIND_COLOR: Record<SearchKind, string> = {
  page: "blue",
  section: "gray",
  symbol: "grape",
  text: "gray",
};

export function DocsSearch({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const results = searchDocs(query);

  // A fresh query starts at the top; without this the cursor can point past
  // the end of a shorter result list.
  useEffect(() => setCursor(0), [query]);

  // Reopening should not show the last search. Clearing on close instead
  // would empty the list while the modal is still fading out.
  useEffect(() => {
    if (opened) setQuery("");
  }, [opened]);

  const go = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    onClose();
    // The router writes the hash with `pushState`, which does not move
    // `:target`, so the reference row a symbol links to would not show as the
    // one landed on. `DocsPage` redoes the fragment navigation when the page
    // changes; a hit on the page already open needs it done here.
    void navigate({ to: entry.to, hash: entry.hash }).then(() => {
      const { hash } = entry;
      if (hash && document.getElementById(hash))
        window.location.replace(`#${hash}`);
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size="lg"
      padding={0}
      // The palette belongs near the top of the window, where the header it
      // opens from is, rather than centred over the page.
      yOffset="12vh"
      transitionProps={{ duration: 120 }}
    >
      <TextInput
        data-autofocus
        variant="unstyled"
        size="md"
        placeholder="Search the documentation…"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setCursor((index) => Math.min(index + 1, results.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setCursor((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            go(results[cursor]);
          }
        }}
        className={classes.input}
      />

      {query.trim().length >= 2 && (
        <Stack gap={0} className={classes.results}>
          {results.length === 0 && (
            <Text size="sm" c="dimmed" p="md">
              Nothing matches “{query}”.
            </Text>
          )}
          {results.map((entry, index) => (
            <button
              key={`${entry.kind}-${entry.to}-${entry.hash ?? ""}-${entry.title}`}
              type="button"
              className={classes.result}
              data-active={index === cursor || undefined}
              // Pointer moves the cursor too, so the keyboard and the mouse
              // never disagree about which row Enter would open.
              onMouseMove={() => setCursor(index)}
              onClick={() => go(entry)}
            >
              <Group gap="sm" wrap="nowrap" justify="space-between">
                <div className={classes.text}>
                  <Text size="sm" fw={500} truncate>
                    {entry.title}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {entry.context}
                  </Text>
                  {/* A prose hit is unreadable without the line it matched
                      on - the heading above it says only where it is. */}
                  {entry.body !== undefined && (
                    <Text size="xs" c="dimmed" truncate>
                      {excerpt(entry.body, query)}
                    </Text>
                  )}
                </div>
                <Badge
                  size="xs"
                  variant="light"
                  color={KIND_COLOR[entry.kind]}
                  className={classes.kind}
                >
                  {KIND_LABEL[entry.kind]}
                </Badge>
              </Group>
            </button>
          ))}
        </Stack>
      )}

      <Group gap="xs" className={classes.footer} justify="flex-end">
        <Text size="xs" c="dimmed">
          <Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> to navigate ·{" "}
          <Kbd size="xs">↵</Kbd> to open · <Kbd size="xs">esc</Kbd> to close
        </Text>
      </Group>
    </Modal>
  );
}
