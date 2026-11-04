import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import { findDemoFences } from "docs-shell/docs/demoFence.ts";
import { extractHeadings } from "docs-shell/docs/headings.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import libraryIndexSource from "../../../../packages/nordic-map/src/index.ts?raw";
import nordicMapSource from "../../../../packages/nordic-map/src/NordicMap/NordicMap.tsx?raw";
import { DOCS_PAGES } from "../docs/docsPages.ts";
import { listDemoFiles, loadDemo, loadSharedSource } from "./demoRegistry.ts";

/** The library's skills, by path */
const librarySkills = import.meta.glob<string>("../../../../packages/nordic-map/skills/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Every name `packages/nordic-map/src/index.ts` exports, values and types */
function publicExportNames(source: string): string[] {
  if (/^export\s+(?:type\s+)?\*/m.test(source)) {
    throw new Error("index.ts uses `export *`; list its names explicitly");
  }
  const names = new Set<string>();
  for (const [, list = ""] of source.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const raw of list.split(",")) {
      const entry = raw.trim().replace(/^type\s+/, "");
      if (entry !== "") {
        names.add(entry.split(/\s+as\s+/).at(-1)?.trim() ?? entry);
      }
    }
  }
  return [...names];
}

/** The prop names of `NordicMapProps`, read from its source */
function propNames(source: string): string[] {
  // A Windows checkout with core.autocrlf has CRLF line ends
  const block = /^export type NordicMapProps<[^>]*> = \{\r?\n([\s\S]*?)\r?\n\};/m.exec(source)?.[1] ?? "";
  return [...block.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => {
    return match[1] ?? "";
  });
}

function docsFences(): { page: string; file: string; extraSources: string[] }[] {
  return DOCS_PAGES.flatMap((page) => {
    return findDemoFences(page.source).map((demo) => {
      return { page: page.id, file: demo.file, extraSources: demo.extraSources ?? [] };
    });
  });
}

/**
 * jsdom has no canvas, no Path2D and no map cell files. The demos mount, load nothing and show their loader,
 * which is enough to catch a demo that throws or logs an error. What they draw is checked by Playwright.
 */
class Path2DStub {
  addPath() {}
}

describe("demos", () => {
  const errors: string[] = [];

  beforeEach(() => {
    errors.length = 0;
    vi.stubGlobal("Path2D", Path2DStub);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        return new Promise<Response>(() => {});
      }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(String(args[0]));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const demoFiles = listDemoFiles();

  it("finds demo files to test", () => {
    expect(demoFiles.length).toBeGreaterThan(0);
  });

  it.each(demoFiles)("%s mounts cleanly", (file) => {
    const { Component } = loadDemo(file);
    render(
      <MantineProvider env="test">
        <Component />
      </MantineProvider>,
    );
    expect(document.querySelector("[data-nordic-map]")).not.toBeNull();
    expect(errors).toEqual([]);
  });
});

describe("docs pages", () => {
  it("every public export is named on a docs page", () => {
    const names = publicExportNames(libraryIndexSource);
    expect(names.length).toBeGreaterThan(0);
    const undocumented = names.filter((name) => {
      return !DOCS_PAGES.some((page) => {
        return new RegExp(`\\b${name}\\b`).test(page.source);
      });
    });
    expect(undocumented).toEqual([]);
  });

  it("every public export is named in a skill", () => {
    const names = publicExportNames(libraryIndexSource);
    const skills = Object.values(librarySkills);
    const missing = names.filter((name) => {
      return !skills.some((skill) => {
        return new RegExp(`\\b${name}\\b`).test(skill);
      });
    });
    expect(missing).toEqual([]);
  });

  /**
   * One page owns each prop: its row in a reference table, `| \`name\` | Prop |`, may appear on one page only.
   * Two copies of a prop table drift within one release.
   */
  it("every prop is written up on exactly one page, and nothing else is", () => {
    const props = propNames(nordicMapSource);
    expect(props.length).toBeGreaterThan(20);
    const owners = new Map<string, string[]>();
    for (const page of DOCS_PAGES) {
      for (const [, name = ""] of page.source.matchAll(/^\| `(\w+)` \| Prop \|/gm)) {
        owners.set(name, [...(owners.get(name) ?? []), page.id]);
      }
    }
    const problems = [
      ...props
        .filter((prop) => {
          return (owners.get(prop)?.length ?? 0) !== 1;
        })
        .map((prop) => {
          return `${prop} on ${owners.get(prop)?.join(" and ") || "no page"}`;
        }),
      ...[...owners.keys()]
        .filter((name) => {
          return !props.includes(name);
        })
        .map((name) => {
          return `${name} is documented but is not a prop`;
        }),
    ];
    expect(problems).toEqual([]);
  });

  it("every demo file is shown on exactly one page", () => {
    const files = docsFences().map((fence) => {
      return fence.file;
    });
    expect(
      listDemoFiles().filter((file) => {
        return !files.includes(file);
      }),
    ).toEqual([]);
    expect(
      files.filter((file, index) => {
        return files.indexOf(file) !== index;
      }),
    ).toEqual([]);
  });

  it("every demo fence resolves", () => {
    for (const { page, file, extraSources } of docsFences()) {
      expect(() => loadDemo(file), `${page}.md → ${file}`).not.toThrow();
      for (const source of extraSources) {
        expect(() => loadSharedSource(source), `${page}.md → ${source}`).not.toThrow();
      }
    }
  });

  it("page ids are unique", () => {
    const ids = DOCS_PAGES.map((page) => {
      return page.id;
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every /docs link points at a page that exists, and at a heading on it", () => {
    const byId = new Map(
      DOCS_PAGES.map((page) => {
        return [page.id, page.source];
      }),
    );
    const broken = DOCS_PAGES.flatMap((page) => {
      return [...page.source.matchAll(/\]\(\/docs\/([a-z-]+)(?:#([a-z0-9-]+))?\)/g)]
        .filter(([, id = "", slug]) => {
          const target = byId.get(id);
          if (target === undefined) {
            return true;
          }
          return (
            slug !== undefined &&
            !extractHeadings(target).some((heading) => {
              return heading.slug === slug;
            })
          );
        })
        .map(([link]) => {
          return `${page.id}.md → ${link}`;
        });
    });
    expect(broken).toEqual([]);
  });

  it("every in-page anchor resolves to a heading on that page", () => {
    const broken = DOCS_PAGES.flatMap((page) => {
      const slugs = new Set(
        extractHeadings(page.source).map((heading) => {
          return heading.slug;
        }),
      );
      return [...page.source.matchAll(/\]\(#([a-z0-9-]+)\)/g)]
        .map((match) => {
          return match[1] ?? "";
        })
        .filter((slug) => {
          return !slugs.has(slug);
        })
        .map((slug) => {
          return `${page.id}.md → #${slug}`;
        });
    });
    expect(broken).toEqual([]);
  });
});
