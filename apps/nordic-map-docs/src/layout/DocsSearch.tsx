import { Spotlight } from "@mantine/spotlight";
import type { SpotlightActionData } from "@mantine/spotlight";
import { IconSearch } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { extractHeadings } from "docs-shell/docs/headings.ts";
import { DOCS_PAGES, docsPageHref } from "../docs/docsPages.ts";

/** Search over every docs page and its headings. Ctrl + K opens it from anywhere. */
export function DocsSearch() {
  const navigate = useNavigate();

  const actions: SpotlightActionData[] = DOCS_PAGES.flatMap((page) => {
    const href = docsPageHref(page);
    return [
      {
        id: page.id,
        label: page.label,
        description: page.description,
        keywords: [page.section],
        onClick: () => {
          void navigate({ to: href });
        },
      },
      ...extractHeadings(page.source).map((heading) => {
        return {
          id: `${page.id}#${heading.slug}`,
          label: heading.text,
          description: page.label,
          onClick: () => {
            void navigate({ to: href, hash: heading.slug });
          },
        };
      }),
    ];
  });

  return (
    <Spotlight
      actions={actions}
      limit={12}
      nothingFound="Nothing found"
      searchProps={{
        leftSection: <IconSearch size={18} stroke={1.5} />,
        placeholder: "Search the docs...",
      }}
    />
  );
}
