import { Box, Button, Collapse, Group, Paper, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { CodeBlockTabs, type CodeBlockFile } from "./CodeBlock";
import { useDocsSite } from "./DocsSite";
import classes from "./DemoBlock.module.css";

/**
 * The frame around one demo: what it is, the thing itself, and the source that
 * produced it.
 *
 * Deliberately minimal. Controls a demo needs (a mode switch, a toggle) live
 * inside the demo component, so they appear in the source shown beside it
 * rather than in a frame that is not part of the copied code.
 */

/** Tall enough for a header, a handful of rows and a footer. */
export const DEFAULT_DEMO_HEIGHT = 380;

export type DemoBlockDemo = {
  /**
   * Path under the site's demos folder, as its `loadDemo` takes it. Identifies
   * both the component and its source.
   */
  file: string;
  /**
   * Only on an example-tree page. Inside a docs page the heading above the
   * demo names it and the paragraph before it is the description, so both are
   * left off rather than said twice.
   */
  title?: string;
  description?: string;
  /**
   * What to *do* - "Shift+click a second header", "try Stckholm". Lives beside
   * the demo rather than in it, so the source stays code you would paste.
   */
  hint?: string;
  /**
   * Further files to show as tabs beside the demo - the shared modules it
   * imports, so nothing it depends on is hidden. Paths as the site's
   * `loadSharedSource` takes them.
   */
  extraSources?: Array<string>;
  /** Height of the live area. Defaults to {@link DEFAULT_DEMO_HEIGHT}. */
  height?: number;
};

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

const languageOf = (path: string) => (path.endsWith(".tsx") ? "tsx" : "ts");

export function DemoBlock({ demo }: { demo: DemoBlockDemo }) {
  const [showCode, setShowCode] = useState(false);
  const { loadDemo, loadSharedSource } = useDocsSite();
  const { Component, source } = loadDemo(demo.file);
  const titled = demo.title !== undefined || demo.description !== undefined;

  const files: Array<CodeBlockFile> = [
    {
      fileName: fileName(demo.file),
      language: "tsx",
      code: source,
    },
    ...(demo.extraSources ?? []).map((path) => ({
      fileName: fileName(path),
      language: languageOf(path),
      code: loadSharedSource(path),
    })),
  ];

  return (
    <Stack gap="xs">
      {/* On a docs page there is no title to sit opposite, so the button
          keeps the right edge on its own. */}
      <Group justify={titled ? "space-between" : "flex-end"} align="flex-end" wrap="nowrap" gap="md">
        {titled && (
          <Stack gap={2}>
            <Text fw={600}>{demo.title}</Text>
            <Text size="sm" c="dimmed">
              {demo.description}
            </Text>
          </Stack>
        )}
        <Button
          size="compact-sm"
          variant={showCode ? "light" : "subtle"}
          onClick={() => setShowCode((open) => !open)}
          aria-expanded={showCode}
        >
          {showCode ? "Hide code" : "Code"}
        </Button>
      </Group>

      {demo.hint && (
        <Text size="sm" c="dimmed" fs="italic">
          {demo.hint}
        </Text>
      )}

      <Paper
        withBorder
        radius="sm"
        p="sm"
        h={demo.height ?? DEFAULT_DEMO_HEIGHT}
        data-demo={demo.file}
        className={classes.live}
      >
        <Component />
      </Paper>

      <Collapse expanded={showCode}>
        {/* Mounted only once opened: highlighting a file nobody asked to see
            is the one cost worth not paying on every page. */}
        {showCode && (
          <Box pt={4}>
            <CodeBlockTabs files={files} />
          </Box>
        )}
      </Collapse>
    </Stack>
  );
}
