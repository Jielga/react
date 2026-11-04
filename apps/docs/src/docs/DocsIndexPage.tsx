import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { findDemoFences } from "docs-shell/docs/demoFence.ts";
import classes from "docs-shell/docs/DocsPage.module.css";
import { docsIndexSections, docsPageHref } from "./docsPages";

/**
 * Every page as a card, grouped the way the sidebar groups them. A tree of
 * two dozen entries answers "where is the thing I need" badly on a first
 * visit; this is the same tree with room for each page's sentence.
 *
 * The demo count comes from the page's own fences, so it cannot drift.
 */
export function DocsIndexPage() {
  return (
    <div className={classes.scroller}>
      <Stack gap="xl" p={{ base: "sm", md: "xl" }} maw={1100} mx="auto">
        <Stack gap={4}>
          <Title order={1}>Documentation</Title>
          <Text c="dimmed">
            One page per topic - what it is, a live demo, and every option,
            prop and CSS variable it owns.
          </Text>
        </Stack>

        {docsIndexSections().map(({ section, pages }) => (
          <Stack key={section} gap="sm">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              {section}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {pages.map((page) => {
                const demos = findDemoFences(page.source).length;

                return (
                  <Card
                    key={page.id}
                    component={Link}
                    to={docsPageHref(page)}
                    withBorder
                    padding="md"
                    radius="sm"
                  >
                    <Text fw={600} size="sm">
                      {page.label}
                    </Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      {page.description}
                    </Text>
                    {demos > 0 && (
                      <Text size="xs" c="dimmed" mt="sm">
                        {demos} {demos === 1 ? "demo" : "demos"}
                      </Text>
                    )}
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        ))}
      </Stack>
    </div>
  );
}
