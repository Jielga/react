import { Button, Group, Stack, Text, Title } from "@mantine/core";
import gettingStartedDoc from "@jielga/nordic-map/docs/getting-started.md?raw";
import { Link } from "@tanstack/react-router";
import { DocsMarkdown } from "docs-shell/docs/DocsPage.tsx";
import classes from "docs-shell/docs/DocsPage.module.css";
import { DemoMapSettingsScope } from "./examples/DemoMapSettings.tsx";

/**
 * The hero renders the page's h1 and its first paragraph, so both are cut from the markdown before it renders
 * (`\r?`, because the checkout may be CRLF). The markdown file keeps them, since it is also read as a plain file.
 */
const doc = gettingStartedDoc.replace(/^# .+\r?\n\r?\n(?:.+\r?\n)+/, "");

/** The front page: what the package is, how to install it, and a first map */
export function GettingStartedPage() {
  return (
    <div className={classes.scroller}>
      <article className={classes.article}>
        <Stack gap="md" mb="xl">
          <Title order={1} mb={0}>
            Nordic Map
          </Title>
          <Text c="dimmed" size="lg">
            An offline map of Sweden for React, with GPS pins, labels, clusters, areas and paths. The map data ships with
            the package, so no tile server or API key is needed.
          </Text>
          <Group gap="sm">
            <Button component={Link} to="/docs">
              Browse the docs
            </Button>
            <Button component={Link} to="/playground" variant="default">
              Open the playground
            </Button>
            <Button component="a" href="https://github.com/Jielga/react/tree/main/packages/nordic-map" variant="default">
              GitHub
            </Button>
          </Group>
        </Stack>

        <DemoMapSettingsScope>
          <DocsMarkdown source={doc} />
        </DemoMapSettingsScope>
      </article>
    </div>
  );
}
