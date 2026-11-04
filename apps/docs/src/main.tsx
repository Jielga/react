import { CodeHighlightAdapterProvider } from "@mantine/code-highlight";
import "@mantine/code-highlight/styles.css";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { RouterProvider } from "@tanstack/react-router";
import { docsCodeHighlightAdapter } from "docs-shell/docs/codeHighlight.ts";
import { DocsSiteProvider } from "docs-shell/docs/DocsSite.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { docsSite } from "./docsSite";
import { router } from "./router";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <CodeHighlightAdapterProvider adapter={docsCodeHighlightAdapter}>
        <DocsSiteProvider value={docsSite}>
          <RouterProvider router={router} />
        </DocsSiteProvider>
      </CodeHighlightAdapterProvider>
    </MantineProvider>
  </StrictMode>,
);
