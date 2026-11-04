import { cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findDemoFences } from "docs-shell/docs/demoFence.ts";
import { extractHeadings } from "docs-shell/docs/headings.ts";
import { DOCS_PAGES } from "../docs/docsPages";
import libraryIndexSource from "../../../../packages/tmdatagrid/src/index.ts?raw";
import { renderWithMantine } from "../test/renderWithMantine";
import { listDemoFiles, loadDemo, loadSharedSource } from "./demoRegistry";

/** Every demo named by a ```demo fence on a docs page, with its page id. */
function docsFences(): Array<{
  page: string;
  file: string;
  extraSources: Array<string>;
}> {
  return DOCS_PAGES.flatMap((page) =>
    findDemoFences(page.source).map((demo) => ({
      page: page.id,
      file: demo.file,
      extraSources: demo.extraSources ?? [],
    })),
  );
}

/**
 * One test for every demo on the site, from one loop.
 *
 * This is what makes 30-odd example files affordable to keep: the compiler
 * catches an API that was renamed, and this catches one that still typechecks
 * but throws - a required option dropped, a helper that now returns null.
 * Neither cost grows when a demo is added.
 */

afterEach(cleanup);

const demoFiles = listDemoFiles();

/** The library's own docs pages, `packages/tmdatagrid/docs/*.md`. */
const libraryDocs = Object.values(
  import.meta.glob<string>("../../../../packages/tmdatagrid/docs/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

/** The library's skills, `packages/tmdatagrid/skills/**\/*.md`, by path. */
const librarySkills = import.meta.glob<string>(
  "../../../../packages/tmdatagrid/skills/**/*.md",
  { query: "?raw", import: "default", eager: true },
);

/** Every name `packages/tmdatagrid/src/index.ts` exports, values and types. */
function publicExportNames(source: string): Array<string> {
  // A star export hides its names from this list, so it is refused outright.
  if (/^export\s+(?:type\s+)?\*/m.test(source)) {
    throw new Error("index.ts uses `export *`; list its names explicitly");
  }
  const names = new Set<string>();
  for (const [, list] of source.matchAll(
    /^export\s+(?:type\s+)?\{([^}]*)\}/gm,
  )) {
    for (const raw of list.split(",")) {
      const entry = raw.trim().replace(/^type\s+/, "");
      if (entry === "") continue;
      // `a as b` exports `b`.
      names.add(entry.split(/\s+as\s+/).at(-1)!.trim());
    }
  }
  for (const [, name] of source.matchAll(
    /^export\s+(?:declare\s+)?(?:const|let|function|class|type|interface|enum)\s+(\w+)/gm,
  )) {
    names.add(name);
  }
  return [...names];
}

describe("example demos", () => {
  const errors: Array<string> = [];

  beforeEach(() => {
    errors.length = 0;
    // React reports a duplicate key, a bad prop or an update outside `act`
    // through console.error and carries on rendering. On a page of examples
    // that is exactly the class of bug nobody notices, so it fails here.
    // `restoreMocks` in the vitest config puts console.error back afterwards.
    vi.spyOn(console, "error").mockImplementation((...args: Array<unknown>) => {
      errors.push(String(args[0]));
    });
  });

  it("finds demo files to test", () => {
    expect(demoFiles.length).toBeGreaterThan(0);
  });

  /**
   * Renders a demo and waits for its grid root. Every demo renders one; not
   * every one renders a Table, so the root is what proves the mount got that
   * far. A demo inside a router renders its first route a tick later.
   */
  async function mountDemo(file: string) {
    const { Component } = loadDemo(file);
    renderWithMantine(<Component />);
    await waitFor(() =>
      expect(document.querySelector("[data-dg-root]")).not.toBeNull(),
    );
  }

  it.each(demoFiles)("%s mounts cleanly", async (file) => {
    await mountDemo(file);
    expect(errors).toEqual([]);
  });

  it.each(demoFiles)("%s survives a sort", async (file) => {
    await mountDemo(file);

    // Mounting is half a smoke test. What only a state change produces - a
    // store publish landing mid-render, a callback that throws the second
    // time it is called - needs one interaction, and a sort is the
    // interaction every grid has. `aria-sort` is on sortable headers only.
    const sortable = document.querySelector<HTMLElement>(
      '[data-dg-part="header"][aria-sort]',
    );
    // A demo with nothing sortable still asserts its mount stayed clean.
    if (sortable !== null) await userEvent.setup().click(sortable);

    expect(errors).toEqual([]);
  });
});

describe("docs pages", () => {
  it("every public export is named on a docs page", () => {
    const names = publicExportNames(libraryIndexSource);
    expect(names.length).toBeGreaterThan(0);
    // An export no page names is public API nobody can find. The migration
    // guide does not count: it names what is gone, and a type it names only
    // to say it was renamed has no page of its own.
    const pages = libraryDocs.filter(
      (doc) => !doc.startsWith("# Migrating from the 2.0 beta"),
    );
    const undocumented = names.filter(
      (name) => !pages.some((doc) => new RegExp(`\\b${name}\\b`).test(doc)),
    );
    expect(undocumented).toEqual([]);
  });

  it("every public export is named in a skill", () => {
    const names = publicExportNames(libraryIndexSource);
    expect(names.length).toBeGreaterThan(0);
    // The skills are what a coding agent loads; an export none of them names
    // is one the agent cannot find. As with the pages, the migration skill
    // does not count: it names what is gone and what replaced it.
    const skills = Object.entries(librarySkills)
      .filter(([path]) => !path.includes("/skills/migrating-to-2/"))
      .map(([, source]) => source);
    const missing = names.filter(
      (name) => !skills.some((doc) => new RegExp(`\\b${name}\\b`).test(doc)),
    );
    expect(missing).toEqual([]);
  });

  it("every demo file is shown on some page", () => {
    const referenced = new Set(docsFences().map((fence) => fence.file));
    // A demo nothing links to is a demo nobody sees.
    expect([...demoFiles].filter((file) => !referenced.has(file))).toEqual([]);
  });

  it("no demo is shown on two pages", () => {
    const files = docsFences().map((fence) => fence.file);
    expect(files.filter((file, i) => files.indexOf(file) !== i)).toEqual([]);
  });

  it("every demo fence resolves", () => {
    // Parsing throws on a malformed fence, so reaching the loop is half the
    // assertion; the other half is that the file it names exists.
    for (const { page, file, extraSources } of docsFences()) {
      expect(() => loadDemo(file), `${page}.md → ${file}`).not.toThrow();
      for (const source of extraSources) {
        expect(
          () => loadSharedSource(source),
          `${page}.md → ${source}`,
        ).not.toThrow();
      }
    }
  });

  it("page ids are unique - they are the route", () => {
    const ids = DOCS_PAGES.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * One page owns a component's props, and the `## TMDataGrid.X` heading is
   * what says which - so the same heading may not appear twice.
   *
   * Two copies drift inside one release. `TMDataGrid.FilterPanel` was written
   * up on both Filtering and Components and Components read "No props." for a
   * component that had gained `layout`. Nothing failed, because nothing was
   * checking.
   */
  it("no component is written up on two pages", () => {
    const owners = new Map<string, Array<string>>();
    for (const page of DOCS_PAGES) {
      for (const [, heading] of page.source.matchAll(
        /^## (TMDataGrid[\w.]*)\s*$/gm,
      )) {
        // `TMDataGrid.FilterPills` and `TMDataGridFilterPills` are one
        // component under two exported names, so they are one owner.
        const key = heading.replace(".", "");
        owners.set(key, [...(owners.get(key) ?? []), page.id]);
      }
    }

    const doubled = [...owners]
      .filter(([, pages]) => pages.length > 1)
      .map(([name, pages]) => `${name} on ${pages.join(" and ")}`);

    expect(doubled).toEqual([]);
  });

  it("every /docs link points at a page that exists", () => {
    const ids = new Set(DOCS_PAGES.map((page) => page.id));
    const broken = DOCS_PAGES.flatMap((page) =>
      [...page.source.matchAll(/\]\(\/docs\/([a-z-]+)/g)]
        .map((match) => match[1])
        .filter((id) => !ids.has(id))
        .map((id) => `${page.id}.md → /docs/${id}`),
    );

    expect(broken).toEqual([]);
  });

  it("every in-page anchor resolves to a heading on that page", () => {
    const broken = DOCS_PAGES.flatMap((page) => {
      const slugs = new Set(
        extractHeadings(page.source).map((heading) => heading.slug),
      );
      return [...page.source.matchAll(/\]\(#([a-z0-9-]+)\)/g)]
        .map((match) => match[1])
        .filter((slug) => !slugs.has(slug))
        .map((slug) => `${page.id}.md → #${slug}`);
    });

    expect(broken).toEqual([]);
  });

  it("every cross-page anchor resolves to a heading on the target page", () => {
    const byId = new Map(DOCS_PAGES.map((page) => [page.id, page.source]));
    const broken = DOCS_PAGES.flatMap((page) =>
      [...page.source.matchAll(/\]\(\/docs\/([a-z-]+)#([a-z0-9-]+)\)/g)]
        .filter(([, id, slug]) => {
          const target = byId.get(id);
          if (target === undefined) return false; // the link test covers this
          return !extractHeadings(target).some((h) => h.slug === slug);
        })
        .map(([, id, slug]) => `${page.id}.md → /docs/${id}#${slug}`),
    );

    expect(broken).toEqual([]);
  });
});
