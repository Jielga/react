import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { findDemoFences } from "docs-shell/docs/demoFence.ts";
import classes from "docs-shell/docs/DocsPage.module.css";
import { docsPageHref, docsSections } from "./docsPages.ts";

/** Every page as a card, grouped the way the navigation groups them. The demo count comes from the page's fences. */
export function DocsIndexPage() {
  return (
    <div className={classes.scroller}>
      <Stack gap="xl" p={{ base: "sm", md: "xl" }} maw={1100} mx="auto">
        <Stack gap={4}>
          <Title order={1}>Documentation</Title>
          <Text c="dimmed">One page per topic: what it does, a live demo, and every prop and type it owns.</Text>
        </Stack>

        {docsSections().map(({ section, pages }) => {
          return (
            <Stack key={section} gap="sm">
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                {section}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {pages.map((page) => {
                  const demos = findDemoFences(page.source).length;
                  return (
                    <Card key={page.id} component={Link} to={docsPageHref(page)} withBorder padding="md" radius="sm">
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
          );
        })}
      </Stack>
    </div>
  );
}
