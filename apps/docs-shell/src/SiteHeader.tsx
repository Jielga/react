import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconBrandGithub,
  IconCheck,
  IconChevronDown,
  IconExternalLink,
  IconLayoutGrid,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { ColorSchemeSwitch } from "./ColorSchemeSwitch";
import {
  currentEntry,
  currentLabel,
  DOCS_SLUG,
  docsMenu,
  useDocsManifest,
  versionHref,
  type DocsEntry,
} from "./docsVersions";
import { headlineVersion, useDistTags } from "./packageStatus";
import {
  findSite,
  npmHref,
  REPO_URL,
  SITES_ROOT,
  siteHref,
  siteSourceHref,
  useSites,
  type Site,
} from "./sites";
import classes from "./SiteHeader.module.css";

/**
 * The header every package site shares: which package this is, which version
 * of its documentation, and the way to every other package.
 *
 * Moving between packages is a full page load, never a router navigation:
 * each site is a separate build with its own base path.
 *
 * The version badge names the copy of the documentation you are reading, not
 * the version on npm. Several copies are published side by side, so "which one
 * is this" is the question the header has to answer; what the registry is
 * serving today is one line inside the menu.
 */

/** The title of the index page at the Pages root. */
const INDEX_TITLE = "@jielga packages";

/**
 * The path inside this build, without its base. Read when a menu opens rather
 * than subscribed to: Mantine mounts a dropdown only while it is open, so the
 * value is always the current page's.
 */
function appPathname(): string {
  const base = import.meta.env.BASE_URL;
  const path = window.location.pathname;
  return path.startsWith(base) ? `/${path.slice(base.length)}` : "/";
}

function PackageMenu({
  sites,
  site,
  mark,
}: {
  sites: ReadonlyArray<Site>;
  site: Site | undefined;
  mark: ReactNode;
}) {
  return (
    <Menu shadow="md" width={320} position="bottom-start" withinPortal>
      <Menu.Target>
        <UnstyledButton
          className={classes.packageButton}
          aria-label="Switch package"
        >
          {mark ?? <IconLayoutGrid size={20} stroke={1.8} />}
          <Text fw={700} size="sm" className={classes.wordmark}>
            {site?.title ?? INDEX_TITLE}
          </Text>
          <IconChevronDown size={14} stroke={2} className={classes.chevron} />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Packages</Menu.Label>
        {sites.map((entry) => (
          <Menu.Item
            key={entry.slug}
            component="a"
            href={siteHref(entry)}
            rightSection={
              entry.slug === site?.slug ? (
                <IconCheck size={14} stroke={2} />
              ) : undefined
            }
          >
            <Text size="sm" fw={500}>
              {entry.title}
            </Text>
            <Text size="xs" c="dimmed">
              {entry.description}
            </Text>
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item component="a" href={SITES_ROOT}>
          All packages
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** One deployed copy, as a link that leaves this bundle for that one. */
function VersionItem({
  entry,
  current,
}: {
  entry: DocsEntry;
  current: boolean;
}) {
  return (
    <Menu.Item
      component="a"
      href={versionHref(entry, appPathname())}
      // A full page load, not a router navigation: the destination is a
      // separate build with its own base path.
      rightSection={current ? <IconCheck size={14} stroke={2} /> : undefined}
    >
      {entry.label}
    </Menu.Item>
  );
}

/** What npm serves today. Rendered only for a published package, so nothing asks the registry about one it does not have. */
function NpmItem({ packageName }: { packageName: string }) {
  const npmVersion = headlineVersion(useDistTags(packageName));

  return (
    <Menu.Item
      component="a"
      href={npmHref(packageName)}
      target="_blank"
      rel="noreferrer"
      rightSection={<IconExternalLink size={13} stroke={1.8} />}
    >
      {npmVersion ? `v${npmVersion} on npm` : "This package on npm"}
    </Menu.Item>
  );
}

function VersionMenu({
  packageName,
  published,
}: {
  packageName: string;
  published: boolean;
}) {
  const manifest = useDocsManifest();
  const { versions, previews } = docsMenu(manifest, DOCS_SLUG);
  const here = currentEntry(manifest, DOCS_SLUG);

  return (
    <Menu shadow="md" width={240} position="bottom-start" withinPortal>
      <Menu.Target>
        <Badge
          component="button"
          type="button"
          size="sm"
          variant="light"
          color="grape"
          // Mantine uppercases a badge by default; a semver string is not a
          // label, and "1.0.0-BETA.0" is not the version anyone installs.
          tt="none"
          rightSection={<IconChevronDown size={12} stroke={2.2} />}
          className={classes.version}
          aria-label="Documentation version"
        >
          {currentLabel(manifest, DOCS_SLUG)}
        </Badge>
      </Menu.Target>

      <Menu.Dropdown>
        {versions.length > 0 && (
          <>
            <Menu.Label>Documentation</Menu.Label>
            {versions.map((entry) => (
              <VersionItem
                key={entry.path}
                entry={entry}
                current={entry.path === here?.path}
              />
            ))}
          </>
        )}

        {previews.length > 0 && (
          <>
            <Menu.Label>Previews</Menu.Label>
            {previews.map((entry) => (
              <VersionItem
                key={entry.path}
                entry={entry}
                current={entry.path === here?.path}
              />
            ))}
          </>
        )}

        {versions.length + previews.length > 0 && <Menu.Divider />}
        {/* Not a copy of the documentation and not somewhere this menu can
            navigate to. Under the same heading as the copies it read as one
            more of them, which is the one thing it must not do. */}
        <Menu.Label>Package</Menu.Label>
        {published ? (
          <NpmItem packageName={packageName} />
        ) : (
          <Menu.Item disabled>Not on npm yet</Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

export type SiteHeaderProps = {
  /**
   * The `slug` of this site in `sites.json`. `null` on the index page at the
   * Pages root, which has no version menu.
   */
  site: string | null;
  /** Shown before the package title. Defaults to a generic package icon. */
  mark?: ReactNode;
  /** Before everything else, for a site's own control such as a navigation toggle. */
  start?: ReactNode;
  /** The centre of the header, for a site's search. */
  children?: ReactNode;
};

export function SiteHeader({
  site: slug,
  mark,
  start,
  children,
}: SiteHeaderProps) {
  const sites = useSites();
  const site = slug === null ? undefined : findSite(sites, slug);

  return (
    <header className={classes.header}>
      <Group gap="sm" wrap="nowrap" className={classes.brand}>
        {start}
        <PackageMenu sites={sites} site={site} mark={mark} />
        {site && (
          <VersionMenu
            packageName={site.packages[0]}
            published={site.published}
          />
        )}
      </Group>

      <div className={classes.centre}>{children}</div>

      <Group gap={4} wrap="nowrap" className={classes.actions}>
        <Tooltip label="GitHub" withArrow>
          <ActionIcon
            component="a"
            href={site ? siteSourceHref(site) : REPO_URL}
            target="_blank"
            rel="noreferrer"
            variant="subtle"
            color="gray"
            size="lg"
            aria-label="GitHub repository"
          >
            <IconBrandGithub size={18} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
        <ColorSchemeSwitch />
      </Group>
    </header>
  );
}
