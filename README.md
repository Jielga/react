# jielga/react

This repository holds the `@jielga` React packages.

| Package | Contents | Docs |
| ------- | -------- | ---- |
| [`@jielga/tmdatagrid`](packages/tmdatagrid/README.md) | Mantine + TanStack data grid | <https://jielga.github.io/react/tmdatagrid/> |
| [`@jielga/tmdatagrid-xlsx`](packages/tmdatagrid-xlsx/README.md) | xlsx export for the grid | <https://jielga.github.io/react/tmdatagrid/docs/xlsx> |
| [`@jielga/react-popup-window`](packages/react-popup-window/README.md) | Hook that renders part of the UI in a separate browser window | <https://jielga.github.io/react/react-popup-window/> |
| [`@jielga/nordic-map`](packages/nordic-map/README.md) | An offline map of Sweden with GPS pins, areas and paths | <https://jielga.github.io/react/nordic-map/> |

`@jielga/tmdatagrid` and `@jielga/tmdatagrid-xlsx` release together at one version.
Every other package has its own version line, and every release is tagged `<name>@<version>`.

## Documentation sites

Each package has its own documentation site, published to GitHub Pages under <https://jielga.github.io/react/>.
That root page lists every site, and the header of every site has a menu that switches between them.

| Path | Contents |
| ---- | -------- |
| [`apps/docs-shell/sites.json`](apps/docs-shell/sites.json) | The registry of sites: slug, title, description, packages, app |
| [`apps/docs-shell/`](apps/docs-shell) | What every site shares: the header with its package and version menus, and the deploy's browser scripts |
| [`apps/docs-home/`](apps/docs-home) | The index page at the Pages root |
| [`apps/docs/`](apps/docs) | The TMDataGrid site, at `/react/tmdatagrid/` |
| [`apps/popup-docs/`](apps/popup-docs) | The react-popup-window site, at `/react/react-popup-window/` |
| [`apps/nordic-map-docs/`](apps/nordic-map-docs) | The nordic-map site, at `/react/nordic-map/` |

Every site is versioned by the first package it lists.
The site's own directory serves the newest release, `next/` serves the tip of `main`, and each minor line has a directory such as `v2.0/`.
[`deploy-docs.yml`](.github/workflows/deploy-docs.yml) builds every registered site on each push to `main`.

## TMDataGrid

A data grid for React built on [TanStack Table v9](https://tanstack.com/table)
and [Mantine](https://mantine.dev). Rows are always virtualized, columns are
resizable, reorderable, sortable, filterable, hideable and pinnable, and every
part of the grid interface is a component you render yourself.

### Installation

```sh
npm install @jielga/tmdatagrid
```

Peer dependencies: `react` and `react-dom` (19.1 or later), `@mantine/core`,
`@tanstack/react-table` (v9), `@tanstack/react-store`, `@tanstack/store`,
`@tanstack/react-virtual` and `@tabler/icons-react`.

> **TanStack Table v9 is still in beta.** The grid is built against
> `^9.0.0-beta.21` and uses its feature-registry API, which beta releases may
> change without a major bump. Pin `@tanstack/react-table` and
> `@tanstack/table-core` to an exact version if you need reproducible installs.

Import both stylesheets once in your app, Mantine's first:

```ts
import "@mantine/core/styles.css";
import "@jielga/tmdatagrid/styles.css";
```

The grid must be rendered inside a Mantine `MantineProvider`.

### Usage

`useTMDataGrid` creates the table, `TMDataGrid` provides it through context, and
the parts rendered inside read what they need from that context.

```tsx
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";

type Employee = { id: number; firstName: string; age: number };

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", { header: "ID", meta: { type: "number" } }),
  columnHelper.accessor("firstName", { header: "First name" }),
  columnHelper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right" },
  }),
]);

export function Employees({ data }: { data: Employee[] }) {
  const grid = useTMDataGrid({
    data,
    columns,
    getRowId: (row) => String(row.id),
    enablePagination: true,
  });

  return (
    <TMDataGrid {...grid} size="md" style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
        <TMDataGrid.ColumnsButton />
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}
```

Only the parts you render exist, and only the features you enable have state.
Pagination is opt in through `enablePagination` (implied by `manualPagination`);
by default every row renders, virtualized. A column that defines no filter shows
no filter control.

### Documentation

The documentation is markdown under [`packages/tmdatagrid/docs/`](packages/tmdatagrid/docs),
shipped in the package and served by the docs site. There is one page per topic,
each holding the prose, its demos and a reference table.
[`docsPages.ts`](apps/docs/src/docs/docsPages.ts) is the registry and the sidebar
order.

| Section              | Pages                                                            |
| -------------------- | ---------------------------------------------------------------- |
| Start here           | [Getting started](packages/tmdatagrid/docs/getting-started.md), [Grid anatomy](packages/tmdatagrid/docs/anatomy.md) |
| Columns              | [Defining columns](packages/tmdatagrid/docs/columns.md), [Sorting](packages/tmdatagrid/docs/sorting.md), [Filtering](packages/tmdatagrid/docs/filtering.md), [Visibility, pinning, ordering and size](packages/tmdatagrid/docs/column-layout.md) |
| Rows                 | [Selection](packages/tmdatagrid/docs/row-selection.md), [Details](packages/tmdatagrid/docs/row-details.md), [Grouping](packages/tmdatagrid/docs/grouping.md), [Summary row](packages/tmdatagrid/docs/summary-row.md), [Row pinning and numbering](packages/tmdatagrid/docs/row-pinning.md), [Clicks and context menus](packages/tmdatagrid/docs/row-interaction.md), [Row styling](packages/tmdatagrid/docs/row-styling.md) |
| Cells and editing    | [Cell selection](packages/tmdatagrid/docs/cell-selection.md), [Editing](packages/tmdatagrid/docs/editing.md), [Editors and validation](packages/tmdatagrid/docs/editors.md) |
| Data                 | [Pagination](packages/tmdatagrid/docs/pagination.md), [Quick search](packages/tmdatagrid/docs/quick-search.md), [Persistence](packages/tmdatagrid/docs/persistence.md), [Server-side](packages/tmdatagrid/docs/server-side.md), [Loading and empty states](packages/tmdatagrid/docs/loading-and-empty.md), [Scrolling and virtualization](packages/tmdatagrid/docs/scrolling.md), [Excel export (xlsx)](packages/tmdatagrid-xlsx/docs/xlsx.md) |
| Appearance           | [Size, styling and theming](packages/tmdatagrid/docs/styling.md), [Toolbar](packages/tmdatagrid/docs/toolbar.md), [Localization](packages/tmdatagrid/docs/localization.md) |
| Reference            | [useTMDataGrid](packages/tmdatagrid/docs/use-tm-data-grid.md), [Testing](packages/tmdatagrid/docs/testing.md) |

### Development

A [bun](https://bun.sh) workspaces monorepo:

| Path                   | Contents                                                        |
| ---------------------- | --------------------------------------------------------------- |
| `packages/tmdatagrid/` | The published package: `src/`, its `docs/` and its `skills/`     |
| `apps/docs/`           | The grid's docs site: pages, live demos and the playground       |
| `apps/docs-shell/`     | The header and registry every docs site shares                   |
| `scripts/`             | Tooling shared by the hooks and the workflows                    |

Inside `packages/tmdatagrid/src/`:

| Path                | Contents                                                     |
| ------------------- | ------------------------------------------------------------ |
| `index.ts`          | The public API, and the only entry point the package exposes  |
| `useTMDataGrid.tsx` | The hook that builds the table, and the types it is built on  |
| `core/`             | Headless logic: filtering, ordering, persistence, capabilities |
| `components/`       | The React components and their co-located CSS modules         |

The site imports the grid as `@jielga/tmdatagrid`, the way an application
does, and resolves it to the workspace source through
[`vite.alias.ts`](apps/docs/vite.alias.ts) and the `paths` in its tsconfig, so
`bun run dev` hot-reloads library files and nothing has to be built first.

#### Examples

The site's examples live in [`apps/docs/src/examples/`](apps/docs/src/examples):

| Path              | Contents                                                       |
| ----------------- | -------------------------------------------------------------- |
| `demoRegistry.ts` | Pairs each demo module with its own source through `import.meta.glob` |
| `demos/`          | One file per demo: one idea, no headings, no explanation        |
| `data/`           | Shared datasets, and the column set used by unrelated demos     |
| `playground/`     | Every feature at once, behind switches                          |

To add a demo, add a file under `demos/` and name it from a ` ```demo ` fence on
the docs page that explains it. The registry pairs each module with its own
source, so the code on screen cannot drift from the code running.
[`demos.test.tsx`](apps/docs/src/examples/demos.test.tsx) mounts every registered
demo, so a demo that stops working fails the suite whether or not it still
compiles.

```sh
bun install
bun run dev        # docs site: examples, playground and docs
bun run lint       # oxlint
bun run typecheck  # tsc -b over every project
bun run test       # vitest, once, every project
bun run test:watch
```

### Testing

For testing an application that *uses* the grid, including the test ids, roles
and ARIA attributes it publishes and how to drive it from Playwright, see
[Testing](packages/tmdatagrid/docs/testing.md). What follows is about this repo's
own suite.

Vitest with React Testing Library, in jsdom. Tests sit next to the code they
cover as `*.test.ts(x)` and are excluded from both the package and the
declaration build; the shared harness lives in
[`packages/tmdatagrid/test/`](packages/tmdatagrid/test), outside `src/`.

Two things to know before adding to them:

- `vitest.setup.ts` installs what jsdom does not provide: an in-memory
  `Storage`, `matchMedia`, `ResizeObserver`, and element sizes. Element sizes
  matter, because without a measurable box the virtualizer renders no rows.
- The Mantine provider in the harness runs with `env="test"`, which disables
  transitions. Without it a popover never finishes mounting and its panel is
  never found.

### Building

Two independent outputs, neither committed:

| Command              | Output                       | Contents              |
| -------------------- | ---------------------------- | --------------------- |
| `bun run build:lib`  | `packages/tmdatagrid/dist/`  | The published package |
| `bun run build:docs` | `apps/*/dist/`               | Every docs site and the index page |

`build:lib` runs three steps in the package. Vite bundles `src/index.ts` into
`dist/index.js` with every peer dependency left external, and emits the CSS
modules as a single `dist/styles.css`. TypeScript then writes per-file
declarations to `.types-tmp/`, and rolldown flattens those into one
`dist/index.d.ts`.

The declarations are flattened rather than shipped as a tree because
TypeScript emits relative imports verbatim: an extensionless `./TMDataGrid`
resolves only under `moduleResolution: bundler` and breaks for anyone on
`node16`/`nodenext`. A single file has no relative imports to resolve, so it
works everywhere without putting `.js` extensions in the sources.

### Publishing

Releases are managed by [Changesets](https://github.com/changesets/changesets).
`@jielga/tmdatagrid` and `@jielga/tmdatagrid-xlsx` sit in one fixed group, so a
release moves both to the same version; each is still published as its own npm
package, and each published version gets its own `<name>@<version>` tag and
GitHub release. Nothing publishes from an ordinary push. A release happens only
when the version PR is merged.

Describe your change in the same PR that makes it:

```sh
bun run changeset      # pick patch/minor/major, write a summary
```

That writes a markdown file under `.changeset/`. Commit it alongside the code.

Once on `main`, [`release.yml`](.github/workflows/release.yml) opens a
**chore: version packages** PR that collects every pending changeset, bumps the
package manifests, writes each `CHANGELOG.md` and syncs the skills. Review the
version it picked and the changelog it wrote, then merge it to publish to npm
with provenance.

The publish is [`scripts/publish-missing.mjs`](scripts/publish-missing.mjs): for
every public package whose version the registry lacks, it packs with `bun pm
pack`, which resolves the `workspace:` and `catalog:` protocols, and publishes
the tarball with `npm publish` under trusted publishing. A brand-new package is
published by hand once and its trusted-publishing config added on npmjs.com
before the workflow can take it over.

#### Skill versions

`bun run version-packages` is `changeset version` followed by
[`scripts/sync-skill-version.mjs`](scripts/sync-skill-version.mjs), which sets
`metadata.library_version` in every `skills/*/SKILL.md` to its package's new
version.

Intent reports a skill as stale when its `library_version` trails the package
version, so without that step every release would leave every skill stale.
Because it runs inside the version command, the bump and the skill sync land in
the same PR.

To check what a release would contain without publishing anything:

```sh
node scripts/publish-missing.mjs --dry-run
```
