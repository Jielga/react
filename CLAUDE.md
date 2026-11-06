# jielga/react

The bun workspaces monorepo for the `@jielga` React packages, each published on npm on its own.
`packages/<name>/` is a library with its docs and skills, `apps/` holds the sites that render them, and `scripts/` is the tooling they share.

- `@jielga/tmdatagrid` - a React data grid built on TanStack Table v9 (beta) and Mantine v9; `apps/docs/` is its site.
- `@jielga/tmdatagrid-xlsx` - xlsx export for the grid.
- `@jielga/react-popup-window` - a hook that renders part of the UI in a separate browser window; `apps/popup-docs/` is its demo site.
- `@jielga/nordic-map` - an offline map of Sweden with GPS pins, areas and paths; `apps/nordic-map-docs/` is its site.

Most of this file is about the grid, because that is where the rules were learned; the workspace, test, docs and release rules hold for every package.

## Where work is tracked

Start here after a break, or on a cold session:

- The GitHub issues of `Jielga/react` - `gh issue list` is the backlog, and an issue is the only place item status lives.
  `held` marks planned work waiting on the stakeholder's go, `icebox` a known gap with no decision to build; an issue without either label is cleared.
  Close the issue from the pull request that ships it, and put what shipped in the changeset, not in a file here.

Do not start held or iceboxed work without the stakeholder's go.

`plans/` is gitignored. Working notes may live there, but they stay local and nothing committed may depend on them.

## Branches

All work lands on `main`, and every pull request targets it.
The repository's default branch is `public`, so `gh pr create` needs `--base main`.

`public` holds one `jielga[bot]` commit per sync, which keeps the App as the only author on the first page and in the Contributors list.
[sync-public.yml](.github/workflows/sync-public.yml) writes it on each push to `main`, so never commit to it.
The two branches share no history, so never merge one into the other.

GitHub honours closing keywords only on a pull request into the default branch, so [close-issues.yml](.github/workflows/close-issues.yml) reads them from the description of a pull request merged into `main`.

## Commands

All from the repository root.

| Command | What it does |
| --- | --- |
| `bun run dev` | Every docs site at once, each on its fixed port |
| `bun run dev:grid` / `dev:popup` / `dev:map` / `dev:home` | One docs site |
| `bun run gallery` | The grid's Playwright story gallery |
| `bun run test` | Vitest once, every workspace project (`test:watch` to iterate) |
| `bun run test:e2e` | Playwright, Chromium: the grid docs-site specs, the component specs, the popup demo specs, the nordic-map site specs and the index page specs (`--project=docs`, `components`, `popup`, `nordic-map` or `home` for one of them) |
| `bun run lint` | oxlint - types are **not** checked here |
| `bun run format` | Prettier over everything but Markdown, written in place |
| `bun run format:check` | The same, reporting instead of writing |
| `bun run check:skills` | `intent validate` over every package's `skills/*/SKILL.md` |
| `bun run typecheck` | `tsc -b` over every project |
| `bun run build:lib` | Every published package into its `dist/`, each after the packages it depends on |
| `bun run build:docs` | Every docs site and the index page, each into its `apps/<app>/dist/` |
| `bun run build` | Both |

The pre-commit hook runs lint, the format check, the skills check, the typecheck, the changeset check, and `build:lib` when a `packages/*/src/` path changed.
Run those before committing rather than discovering them at the hook.

All code is formatted by Prettier with its defaults, and CI fails on anything else.
Markdown is left out in `.prettierignore`: the docs tests and the skill line limit read those files by exact row and line.
A `// @ts-expect-error` covers only the next line, so when Prettier splits a call the directive goes above the line that holds the error.

Run intent through `scripts/intent.mjs`, never `npx intent`.
Two installed packages declare a bin by that name and the one that wins is an install-order accident; the wrong one crashes on startup.

Driving a browser by hand through the Playwright MCP tools is expensive.
Use it deliberately, not as a way to look around; a spec under `playwright/` is the cheap way to check behaviour in a browser.

## The workspace

Shared dependency versions live in the root `package.json` `catalog`; a package declares `"catalog:"` and the root decides the version.
Peer dependency ranges of a published package stay literal - they are policy, not the installed version.

The site depends on `@jielga/tmdatagrid` by name, as a user does, and resolves it to source: `apps/docs/vite.alias.ts` for Vite and Vitest, `paths` in `apps/docs/tsconfig.json` for TypeScript.
The published manifest knows nothing of this.
A new package that tests against the grid copies that pair; its declaration build must not, so that the grid resolves to the published `dist/index.d.ts` and stays external in its dts rollup.

`@jielga/tmdatagrid` and `@jielga/tmdatagrid-xlsx` form one changesets `fixed` group: one version, released together, each package published on its own.
Every other published package is versioned on its own.
The xlsx package has a peer dependency on the grid, and changesets majors a peer dependent on any minor of its peer unless `onlyUpdatePeerDependentsWhenOutOfRange` is on; the config sets it, so a minor of the grid stays a minor for the group.
A private package never carries the `@jielga/` scope (the docs apps are `tmdatagrid-docs`, `react-popup-window-docs`, `nordic-map-docs`, `docs-shell` and `docs-home`), so no changesets glob can ever pull it into a release.
The one exception is a library waiting for its first release: it is `"private": true` under its final name, and `privatePackages.version: false` in `.changeset/config.json` keeps changesets from versioning it until the flag is removed.
Its first release does not go through a changeset; the last item of [Adding a package](#adding-a-package) has the steps.
In pre mode `changeset version` crashes on any fixed-group member missing from `.changeset/pre.json`, so a package added to the group during a prerelease wave goes into `initialVersions` there before the next `chore: version packages` run.

## The library boundary

`packages/tmdatagrid/src/index.ts` is the only entry point the package exposes.
An export added there is public API: it needs docs and a changeset, and it cannot quietly change again.

Nothing but the library and its `*.test.ts(x)` files may live under `packages/tmdatagrid/src/` - the test harness (`gridHarness.tsx`, `fixtures.tsx`), the Playwright gallery and the stories live in `packages/tmdatagrid/test/`, which keeps them out of the tarball and the declaration build.

Peer dependencies stay external in `packages/tmdatagrid/vite.config.ts`.
Bundling `react`, `@mantine/*` or `@tanstack/*` hands the consumer a second copy of the React runtime, the Mantine theme context or the TanStack feature registry, and each fails at runtime rather than at build time.

The `tmdatagrid` CSS layer name in `styles.layer.css` is public API - never rename it.

## Conventions specific to this repo

Styling is co-located CSS Modules (`Component.module.css`), not Emotion.

TanStack Table v9 is beta and the grid uses its feature-registry API; check `useTMDataGrid.tsx` before assuming a v8 shape carries over.

The React Compiler runs in both Vite configs and in the Playwright gallery but not under Vitest, so a jsdom component test proves the wiring, not the memoization; a Playwright spec sees the compiled output.

The grid publishes `data-dg-part` plus `data-row-id` / `data-column-id`, and no `data-testid` of its own.
Roles flip from `table`/`cell` to `grid`/`gridcell` when cell selection is on.
Renaming or dropping a part breaks a documented contract - see [testing.md](packages/tmdatagrid/docs/testing.md).

## Tests

Vitest and React Testing Library in jsdom, co-located as `*.test.ts(x)`.
Use the harness in [gridHarness.tsx](packages/tmdatagrid/test/gridHarness.tsx) - `renderGridUi`, `part()`, `gridRowCount()` - rather than re-deriving selectors.

Two jsdom facts decide how a grid test has to be written:

- There is no layout, so the virtualizer mounts a handful of rows whatever the data says.
  Assert on `aria-rowcount` / `data-dg-row-count`, never on the number of row elements.
- Mantine transitions never settle, so a popover panel mounts empty outside `<MantineProvider env="test">`.
  The harness sets it; a bespoke render has to as well.

[demos.test.tsx](apps/docs/src/examples/demos.test.tsx) mounts every demo, fails on any `console.error`, and checks that every demo fence, topic link and docs link resolves.
A broken demo or a dead link fails the suite, so run the tests after touching docs or examples, not just after touching code.

Playwright covers what jsdom cannot, in Chromium, from `bun run test:e2e`; the config is [playwright.config.ts](playwright.config.ts).

- [playwright/docs/](playwright/docs) drives the docs demos through the `DataGrid` page object in [DataGrid.ts](playwright/support/DataGrid.ts).
  Every spec there is a template a consumer copies into their own suite, so it uses parts and coordinates, never text, and never counts row elements.
  A demo is reached by `data-demo="<file>"` on its `DemoBlock`.
- [playwright/components/](playwright/components) mounts stories from `packages/tmdatagrid/test/stories/` through the gallery in `packages/tmdatagrid/test/gallery/`.
  `bun run --cwd packages/tmdatagrid gallery` serves the gallery alone; `?story=Grid/Default` mounts one story for a manual look.
- The page object is embedded verbatim in [testing.md](packages/tmdatagrid/docs/testing.md) below a `<!-- source: playwright/support/DataGrid.ts -->` marker, and [testingPageObject.test.ts](apps/docs/src/docs/testingPageObject.test.ts) fails when the two drift.
  Change the file, then paste it into the fence.
- [playwright/popup/](playwright/popup) drives the popup demo site in `apps/popup-docs/`: real browser windows, stylesheet copying and Mantine context across windows, which jsdom cannot model at all.
- [playwright/nordic-map/](playwright/nordic-map) checks the nordic-map site in `apps/nordic-map-docs/`, and [playwright/home/](playwright/home) the index page in `apps/docs-home/`.
- Every server runs on a fixed port with `--strictPort` (5273 for the grid docs site, 5274 for the gallery, 5275 for the popup demo site, 5276 for the index page, 5277 for the nordic-map site), so a `bun run dev` on 5173 never interferes and a taken port fails the run instead of drifting.
- The shared fixtures in [playwright/support/test.ts](playwright/support/test.ts) answer the npm registry and the published site list, and fail a test on any console error.
  Once a page routes any request, Playwright stalls the requests of a scripted about:blank popup, so a popup spec that times stylesheet loads uses the base `test` instead.

## Docs and demos

Grid docs are markdown under [packages/tmdatagrid/docs/](packages/tmdatagrid/docs), registered in [docsPages.ts](apps/docs/src/docs/docsPages.ts) as `@jielga/tmdatagrid/docs/<page>.md?raw` imports.
They stay plain markdown: they ship in the package and the `SKILL.md` files cite them as sources, so no MDX.

The popup window package documents itself in its `README.md`, and `apps/popup-docs/` is a demo site, not a docs renderer.

Nordic-map docs are markdown under [packages/nordic-map/docs/](packages/nordic-map/docs), registered in [docsPages.ts](apps/nordic-map-docs/src/docs/docsPages.ts), with the same demo fences and the same one-topic-one-page rule as the grid docs.
Each prop of `NordicMap` has its row, `| \`name\` | Prop |`, in the reference table of one page only, and [demos.test.tsx](apps/nordic-map-docs/src/examples/demos.test.tsx) fails when a prop has no such row, has two, or a row names no prop.
In this site `@jielga/nordic-map` resolves to [nordicMapForDemos.tsx](apps/nordic-map-docs/src/examples/nordicMapForDemos.tsx), which re-exports the library source and wraps `NordicMap` so the demos follow the reader's demo map settings from the navigation; the playground and the area editor sit outside that scope.
Its map data in `packages/nordic-map/src/data/` is generated by the Python scripts in `packages/nordic-map/scripts/map-data/`; never edit it by hand.
The cell files ship in `dist/cells/` and the county and municipality files in `dist/regions/` because their `new URL(..., import.meta.url)` carries `?no-inline`: without it, Vite's library mode inlines every asset into `index.js`.

## Docs sites

Every package has its own docs site, a separate Vite app under `apps/`, and they share a frame and a markdown renderer from `docs-shell`.

- [apps/docs-shell/sites.json](apps/docs-shell/sites.json) is the one list of sites.
  `"published": false` on an entry stops the header and the index page from asking npm about a package that is not there yet; remove it with the package's first release.
  The header's package menu, the index page and the deploy all read it, and the deploy publishes it at the Pages root so a frozen copy of one site still lists packages added after it was built.
- `apps/docs-shell/` (private, `docs-shell`) holds the shared `SiteHeader`: the package menu, the version menu, the GitHub link and the colour scheme switch.
  A site imports its modules by path, `docs-shell/SiteHeader.tsx`, and lists `../docs-shell/src/env.d.ts` in its tsconfig `include`.
- `apps/docs-shell/src/docs/` holds the shared markdown renderer: `DocsPage` and `DocsMarkdown`, `DemoBlock`, `CodeBlock`, the demo fence parser in `demoFence.ts`, the heading slugs and the table of contents, and the shiki adapter in `codeHighlight.ts`.
  A site wraps its app in `DocsSiteProvider` from `docs-shell/docs/DocsSite.ts` and passes it its own demo registry (`loadDemo`, `loadSharedSource`) and, if it has a router, `renderLink` for root-relative links.
  The grid site's value is in `apps/docs/src/docsSite.tsx`.
- `apps/docs-home/` is the index page at <https://jielga.github.io/react/>.
- A site lives at `/react/<slug>/` and is versioned by the first package it lists: the slug directory serves the newest release, `next/` the tip of `main`, `v<major>.<minor>/` each line, `b/<branch>/` a build published by hand.
  [scripts/docs-plan.mjs](scripts/docs-plan.mjs) decides what a push builds, and builds a release line from its `<name>@<version>` tag.
  Versions released before that tag scheme (the grid's 2.1.2 and older) are not published.
- GitHub Pages serves the root's `404.html` for every missing path.
  That page runs `docs-shell/static/docs-spa-path.js`, which sends a deep link to the copy that owns it, and sends any path under no site to the grid site, which used to be served from the root.
- A back version or a branch preview is published with a `workflow_dispatch` of `deploy-docs.yml`, giving the site, the ref and the slug.

One topic, one page - the option, prop, column meta, callback, CSS variable and the live demo all sit on the page for the thing they belong to.

That rule decides who owns a component's prop table.
A part whose props belong to one topic is written up on that topic's page, in the `## TMDataGrid.X` layout, and [components.md](packages/tmdatagrid/docs/components.md) lists it with a link instead of repeating it.
`components.md` carries the full entry only for what belongs to no single page: the root, the Table, the hooks, and the parts whose props scatter across every topic.
The `## TMDataGrid.X` heading is what marks ownership, so it may appear on one page only - `demos.test.tsx` fails the build otherwise.
Two copies of a prop table drift within one release; that is how `TMDataGrid.FilterPanel` came to read "No props." on one page and list `layout` on another.

Write them as reference documentation for a library, and nothing looser.
State what an option does and what its default is; give a reason only where it changes a decision.
The person using the grid is "the user", the person reading the page is "you", and nobody is "the reader".
No closing flourishes, no design commentary, no jokes.

A demo is one file under `apps/docs/src/examples/demos/` holding code and nothing else: no headings, no prose, nothing you would not paste.
It imports the grid as `@jielga/tmdatagrid`, and its source is shown verbatim.
Prose lives in the docs page that shows it.
Put a demo where the prose explains it with a fence naming the file:

````markdown
```demo
file: rows/Grouping.tsx
hint: “Group by …” lives in every column menu.
```
````

Every demo file must be reachable from exactly one place, a topic or a docs page, and the registry pairs each module with its own source, so adding a demo is adding a file.

`packages/tmdatagrid/skills/*/SKILL.md` cite `packages/tmdatagrid/docs/*.md` by path.
Splitting or renaming a docs page means fixing the `sources:` of every skill that cites it.

## Releasing

Changesets, and a change under a `packages/*/src/` needs one - the pre-commit hook refuses the commit otherwise.
A comment, a test or a refactor with no observable effect is the case for `git commit --no-verify`.

Keep a changeset short: what changed, in a line or a short list.
Leave the reasoning out; the only thing worth spelling out is a workaround a consumer has to know about.

Each package's `CHANGELOG.md` and the `library_version` in each `SKILL.md` are generated; `bun run version-packages` writes both.
Never edit them by hand.
The same script refreshes `bun.lock`, because `changeset version` bumps the workspace versions without touching the lockfile.

Nothing publishes from an ordinary push.
Merging the **chore: version packages** PR is the release: `scripts/publish-missing.mjs` packs each public package whose version is missing from the registry with bun and publishes the tarball with npm under trusted publishing.
A new package's first version is published by hand and its trusted-publishing config (repo `Jielga/react`, workflow `release.yml`) added on npmjs.com before the workflow can take it over.

Each published version gets its own git tag and GitHub release named `<name>@<version>`, for example `@jielga/react-popup-window@0.3.0`.
`scripts/publish-missing.mjs` writes `published=<JSON array>` to `$GITHUB_OUTPUT`, one `{ name, version, changelog }` entry per package it published, and the Release workflow loops over it.
The release notes are that version's section of the package's own `CHANGELOG.md`, read by `scripts/changelog-entry.mjs`; a package without a `CHANGELOG.md` gets GitHub's generated notes instead.
A version with a hyphen is marked as a prerelease.
The step is idempotent: an existing tag is not created again, and an existing release is skipped.
The older `v2.x` tags and releases come from when all packages shared one version line, and they stay as history.

## Adding a package

Copy the closest existing package: `packages/tmdatagrid-xlsx` for a package without React, `packages/react-popup-window` for a React package without Mantine, `packages/tmdatagrid` for one with CSS.
Then go through this list; every item has bitten once.

- `package.json`: `name @jielga/<name>`, `repository` with `directory`, `homepage`, `bugs`, `sideEffects`, `files` (`dist`, `src` without tests, docs, `skills` without `_artifacts`), `exports` with `types` first and `./package.json`, `publishConfig.access public`, literal peer ranges, devDependencies from `catalog:`.
- `vite.config.ts` in lib mode with every peer external; `tsconfig.json` extending `tsconfig.base.json`; `tsconfig.build.json` plus `rolldown.dts.config.mjs` flattening the declarations into one `dist/index.d.ts`.
- `vitest.config.ts` with a `name`; the root config picks up `packages/*/vitest.config.ts` and `apps/*/vitest.config.ts` by glob.
- Root wiring by hand: `build:lib` in the root `package.json` (xlsx needs the grid's `dist` first, so order matters) and `references` in the root `tsconfig.json`.
- A site under `apps/` is private, named without the `@jielga/` scope, aliases the package to source, renders `SiteHeader` from `docs-shell`, gets a fixed port with `--strictPort`, a Playwright project and a `webServer` entry, a step in the root `build:docs`, and an entry in `apps/docs-shell/sites.json`.
  The entry is all the deploy needs: it builds every registered site with `bun run --cwd <app> build --base=<path>`.
- At least one `skills/<name>/SKILL.md` whose `sources:` cite `Jielga/react:<repo path>`; `bun run check:skills` validates it.
- Changesets: only a package that must release with another joins a `fixed` group in `.changeset/config.json`; everything else versions on its own.
- Release: one pull request sets the first version in `package.json` by hand and removes `"private"` there and `"published": false` from the `sites.json` entry, with no changeset.
  A changeset does not work here: the merge would make the Release workflow publish the package at its old version, and trusted publishing fails for a package that is not on npm yet.
  Before merging, build the package, pack it with `bun pm pack` (it resolves `catalog:`, which a plain `npm publish` ships unchanged), `npm publish` the tarball with `--access public`, and add the trusted publisher on npmjs.com.
  After merging, push the `<name>@<version>` tag on the merge commit and create its GitHub release, because the workflow tags only what it published itself and the docs build a release line only from its tag.
  From then on the Release workflow publishes it.

## Skill Loading

Before editing files for a substantial task:

- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

## Code Style

**Comments Guidelines:**
- **Do not include inline comments** that describe logic or implementation details unless explicitly requested
- **Always preserve documentation comments** on interfaces, types, and function parameters (JSDoc-style comments with `/** */`)
- The codebase prefers clean, self-documenting code for implementation
- Type definitions and public APIs should maintain their documentation comments
- Keep an inline comment only for what the code cannot show: a browser or library workaround, an external constraint, or a trap that the obvious simplification would fall into
- CSS follows the same rule, and a comment that documents a public `--dg-*` variable stays