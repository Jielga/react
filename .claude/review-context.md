# Review context: TMDataGrid

## What ships

`package.json` `files` publishes four things:

- `dist/` - the built bundle, `dist/index.d.ts`, `dist/styles.css`, `dist/styles.layer.css`.
- `src/tmdatagrid/` minus its `*.test.*` files - so the consumer has the library source, not only the types.
- `skills/` minus `_artifacts` - so `skills/*/SKILL.md` sits in the consumer's `node_modules`.
- `package.json`, with `exports` limited to `.`, `./styles.css`, `./styles.layer.css`.

`src/docs/` is **not** published.
The `sources:` in each `SKILL.md` name repo paths (`Jielga/TMDataGrid:src/docs/columns.md`), so they resolve through GitHub or through `intent`, not from the installed package.
Confirm that before a review leans on it.

## Personas

| Persona                 | Has                                                                                | Does not have                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Site reader**         | The docs site, the README, npm's package page                                      | Anything in the repo, the skills, the source                                    |
| **Installed developer** | Everything under "What ships", plus the docs site                                  | The repo, `CLAUDE.md`, the demo sources, `src/docs/*.md` as files               |
| **Agent consumer**      | The installed `skills/*/SKILL.md`, the published source, whatever `intent` fetches | The repo's own instruction files                                                |
| **Maintainer**          | Everything                                                                         | -                                                                               |

Default to **site reader** for anything about docs, and to **installed developer** for anything about the API.
A review that reads as "agent consumer" has to say so, because it changes what counts as a dead end.

## Internal, for every persona below maintainer

`CLAUDE.md`, `AGENTS.md`, `plans/`, `user-feedback/`, `.changeset/`, the Vite configs, `src/test/`, `src/examples/` as source files, and every `*.test.tsx`.

The demo _source_ is internal.
The demo _rendered on the docs page_ is not: the site reader sees the code fence and the live grid.

## Channels

| Channel      | How                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Browser      | `npm run dev`, then http://localhost:5173. The docs site, the examples and the playground all live there.                                 |
| Docs as code | `src/docs/*.md`, registered in `src/docs/docsPages.ts`. Plain markdown, no MDX.                                                           |
| Public API   | `src/tmdatagrid/index.ts` is the only entry point. 200-odd exports; a consumer meets them through editor completion on `dist/index.d.ts`. |
| Skills       | `skills/*/SKILL.md`. List them with `node scripts/intent.mjs list`, never `npx intent`.                                                   |
| Package      | `npm pack --dry-run` shows the tarball without publishing.                                                                                |

The grid publishes `data-dg-part`, `data-row-id` and `data-column-id` and no `data-testid`.
Roles are `table`/`cell`, flipping to `grid`/`gridcell` when cell selection is on.
See [src/docs/testing.md](../src/docs/testing.md).

## Cost limits

Playwright is expensive.
Open it when the review is about what a page looks like or how a flow feels, not to find things.

Do not run `npm run build`, `build:lib`, `tsc -b` or the test suite inside a review unless the brief says to.
A review reports; the maintainer runs the checks.

## Where reports go

- `user-feedback/reviews/<YYYY-MM-DD>-<slug>.md` - a fresh-eyes review. A snapshot, it ages out.
- `user-feedback/proposals/<slug>.md` - a proposal that is still live work.

`user-feedback/` is gitignored, like `plans/`.
Nothing committed may depend on a report.
Anything that survives a review becomes a GitHub issue on `Jielga/TMDataGrid`, which is the only place item status lives.
