import {
  CodeHighlight,
  type CodeHighlightStylesNames,
  CodeHighlightTabs,
  type CodeHighlightTabsCode,
} from "@mantine/code-highlight";
import { useComputedColorScheme } from "@mantine/core";
import type { CSSProperties } from "react";

/**
 * Every piece of code the site shows goes through here - demo sources, the
 * starter snippet, and the fenced blocks in the markdown docs - so they are
 * highlighted, copyable and themed the same way everywhere.
 *
 * The highlighter itself is registered once by the site, with the adapter from
 * `codeHighlight.ts`; this is only the shape of the block.
 */

export type CodeBlockFile = CodeHighlightTabsCode;

/** Long enough to read the shape of a file, short enough not to own the page. */
const MAX_COLLAPSED_HEIGHT = 320;

/**
 * The docs render these blocks inside Mantine's `Typography`, which styles bare
 * `pre` and `pre code`. Both of its rules carry the same specificity as the
 * component's own part styles and its stylesheet loads later, so they win: the
 * `pre` picks up a border and a radius of its own - stacking a second, rounder
 * outline inside the one `withBorder` already draws - while the `code` loses
 * the shiki background to Typography's `background-color: transparent`.
 *
 * Restating the component's own values as inline styles outranks any sheet, so
 * the block keeps its appearance wherever it is mounted. The values are
 * Mantine's: the `pre` is a bare layout box, and the surface and padding belong
 * to the `code` inside it.
 */
const PART_STYLES: Partial<Record<CodeHighlightStylesNames, CSSProperties>> = {
  pre: {
    margin: 0,
    padding: 0,
    border: "none",
    borderRadius: 0,
    background: "none",
  },
  code: {
    padding: "var(--mantine-spacing-xs) var(--mantine-spacing-md)",
    backgroundColor: "var(--ch-background)",
  },
};

/**
 * Theme and surface together, because contrast is a property of the pair.
 *
 * The theme is named rather than left to Mantine's `light`/`dark` shorthand:
 * the shorthand selects Mantine's own bundled themes, which render comments at
 * #676867 on a #2e2e2e background - 2.4:1, where normal text wants 4.5:1. The
 * adapter only substitutes a bundled theme for the literal strings "light" and
 * "dark", so any other value reaches shiki as a theme name; both are
 * registered in `codeHighlight.ts`.
 *
 * The `-default` variants are GitHub's current themes. The older `github-dark`
 * puts comments at #6a737d, 3.9:1 even on its own background - and these demo
 * files are largely comments.
 *
 * The surface goes on twice, because two elements paint one. `bg` covers the
 * root - the tabs variant paints nothing of its own and would let the page show
 * through, which is how a token designed for #0d1117 ended up at 3.2:1 on the
 * page's #242424. `background` sets `--ch-background`, which is what the `code`
 * element and the line-number gutter paint; left at Mantine's gray-0/dark-8
 * default it covers the root with a surface these themes were not measured
 * against. On the surfaces set here the worst token measures 6.2:1 in dark and
 * 4.6:1 in light.
 *
 * `getInitialValueInEffect: false` resolves the scheme during the first render
 * rather than in an effect after it, so a block never paints its light palette
 * on a dark page before correcting itself.
 */
function useCodeTheme(): {
  codeColorScheme: string;
  bg: string;
  background: string;
} {
  const colorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: false,
  });

  const [codeColorScheme, surface] =
    colorScheme === "dark"
      ? ["github-dark-default", "#0d1117"]
      : ["github-light-default", "#ffffff"];

  return { codeColorScheme, bg: surface, background: surface };
}

export function CodeBlock({
  code,
  language = "tsx",
  collapsible = false,
}: {
  code: string;
  language?: string;
  /** Caps the height with an expand button. For the docs' short fences, off. */
  collapsible?: boolean;
}) {
  const theme = useCodeTheme();

  return (
    <CodeHighlight
      {...theme}
      code={code.trimEnd()}
      language={language}
      radius="sm"
      styles={PART_STYLES}
      withBorder
      withExpandButton={collapsible}
      defaultExpanded={!collapsible}
      maxCollapsedHeight={MAX_COLLAPSED_HEIGHT}
    />
  );
}

/**
 * The multi-file variant a demo uses when what it imports is worth reading
 * too - the shared data module, usually. The demo file is always first.
 */
export function CodeBlockTabs({ files }: { files: Array<CodeBlockFile> }) {
  const theme = useCodeTheme();

  return (
    <CodeHighlightTabs
      {...theme}
      code={files.map((file) => ({ ...file, code: file.code.trimEnd() }))}
      radius="sm"
      styles={PART_STYLES}
      withBorder
      withExpandButton
      maxCollapsedHeight={MAX_COLLAPSED_HEIGHT}
    />
  );
}
