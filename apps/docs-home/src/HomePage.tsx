import {
  Anchor,
  Button,
  Card,
  Code,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowRight, IconBrandGithub } from "@tabler/icons-react";
import { SiteHeader } from "docs-shell/SiteHeader.tsx";
import {
  npmHref,
  siteHref,
  siteSourceHref,
  useSites,
  type Site,
} from "docs-shell/sites.ts";
import classes from "./HomePage.module.css";

function SiteCard({ site }: { site: Site }) {
  return (
    <Card withBorder radius="md" padding="lg" className={classes.card}>
      <Stack gap="sm" h="100%">
        <Title order={2} size="h3">
          <Anchor href={siteHref(site)} inherit underline="hover">
            {site.title}
          </Anchor>
        </Title>
        <Text c="dimmed" size="sm">
          {site.description}
        </Text>
        <Stack gap={4} component="ul" className={classes.packages}>
          {site.packages.map((name) => (
            <li key={name}>
              {site.published ? (
                <Anchor href={npmHref(name)} target="_blank" rel="noreferrer">
                  <Code>{name}</Code>
                </Anchor>
              ) : (
                <Code>{name}</Code>
              )}
            </li>
          ))}
          {!site.published && (
            <Text component="li" size="xs" c="dimmed">
              Not on npm yet
            </Text>
          )}
        </Stack>
        <Group gap="xs" mt="auto">
          <Button
            component="a"
            href={siteHref(site)}
            size="xs"
            rightSection={<IconArrowRight size={14} stroke={2} />}
          >
            Documentation
          </Button>
          <Button
            component="a"
            href={siteSourceHref(site)}
            target="_blank"
            rel="noreferrer"
            size="xs"
            variant="default"
            leftSection={<IconBrandGithub size={14} stroke={1.8} />}
          >
            Source
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/** Every package site, from the published registry. */
export function HomePage() {
  const sites = useSites();

  return (
    <>
      <SiteHeader site={null} />
      <main className={classes.main}>
        <div className={classes.grid}>
          {sites.map((site) => (
            <SiteCard key={site.slug} site={site} />
          ))}
        </div>
      </main>
    </>
  );
}
