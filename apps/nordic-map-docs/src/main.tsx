import "@mantine/core/styles.css";
import "@mantine/code-highlight/styles.css";
import "@mantine/spotlight/styles.css";

import { CodeHighlightAdapterProvider } from "@mantine/code-highlight";
import { MantineProvider } from "@mantine/core";
import { RouterProvider } from "@tanstack/react-router";
import { docsCodeHighlightAdapter } from "docs-shell/docs/codeHighlight.ts";
import { DocsSiteProvider } from "docs-shell/docs/DocsSite.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { docsSite } from "./docsSite.tsx";
import { router } from "./router.tsx";
import { theme } from "./theme.ts";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <CodeHighlightAdapterProvider adapter={docsCodeHighlightAdapter}>
        <DocsSiteProvider value={docsSite}>
          <RouterProvider router={router} />
        </DocsSiteProvider>
      </CodeHighlightAdapterProvider>
    </MantineProvider>
  </StrictMode>,
);
