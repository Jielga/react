import { Badge, Group } from "@mantine/core";
import { betaIsAhead, useDistTags } from "docs-shell/packageStatus.ts";
import { npmHref } from "docs-shell/sites.ts";

const PACKAGE = "@jielga/tmdatagrid";
const NPM_PAGE = npmHref(PACKAGE);

/**
 * The published versions, for the front page.
 *
 * While the package is in prerelease both are worth showing: `latest` alone
 * reads as abandoned, `beta` alone hides what `npm install` actually gives
 * you. Once `latest` overtakes the beta tag the beta badge is dropped - a
 * stale prerelease left on the registry is not news, and shown beside a newer
 * `latest` it reads as the current version. The header shows only the
 * headline one.
 */
export function ProjectStatus() {
  const tags = useDistTags(PACKAGE);

  const beta = betaIsAhead(tags) ? tags?.beta : undefined;

  return (
    <Group gap="xs">
      {tags?.latest && (
        <Badge
          component="a"
          href={NPM_PAGE}
          variant="light"
          color="gray"
          style={{ cursor: "pointer" }}
        >
          npm {tags.latest}
        </Badge>
      )}
      {beta && (
        <Badge
          component="a"
          href={`${NPM_PAGE}/v/${beta}`}
          variant="light"
          color="grape"
          style={{ cursor: "pointer" }}
        >
          beta {beta}
        </Badge>
      )}
    </Group>
  );
}
