import { createShikiAdapter } from "@mantine/code-highlight";

/**
 * The highlighter behind every `CodeBlock`. A site registers it once, around
 * everything it renders:
 *
 * ```tsx
 * <CodeHighlightAdapterProvider adapter={docsCodeHighlightAdapter}>
 * ```
 *
 * Shiki is loaded on demand - the first code block on screen pays for it, and
 * a visitor who only ever looks at the demos never downloads it at all.
 *
 * Built from `shiki/core` rather than the `shiki` entry point, which would
 * bundle every grammar it knows. Five grammars are what the docs sites show.
 * The JavaScript regex engine keeps the 600 kB oniguruma WASM out of the build
 * too; it handles these grammars without it.
 *
 * Both GitHub themes are registered so `CodeBlock` can ask for them by name.
 * Mantine's adapter only substitutes its own bundled theme objects for the
 * literal strings "light" and "dark" - any other value is passed through to
 * shiki as a theme name. That matters: the bundled dark theme renders
 * comments at #676867 on a #2e2e2e background, a contrast ratio of 2.4:1.
 */
export const docsCodeHighlightAdapter = createShikiAdapter(async () => {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] =
    await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);

  return createHighlighterCore({
    langs: [
      import("@shikijs/langs/tsx"),
      import("@shikijs/langs/typescript"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/bash"),
      import("@shikijs/langs/json"),
    ],
    themes: [
      import("@shikijs/themes/github-light-default"),
      import("@shikijs/themes/github-dark-default"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
});
