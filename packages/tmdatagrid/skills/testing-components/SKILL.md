---
name: testing-components
description: >
  Test a TMDataGrid in a real browser with Playwright component tests: the
  stories-and-gallery model of Playwright 1.62+, the mount fixture, how a story
  wraps the grid (MantineProvider env="test", a fixed-size container, the api on
  window for scrollToRow), and the browser-only behaviour worth testing there -
  virtualization, column resize through header-resize, column reorder by drag,
  sticky pinned columns, the clipboard. Load when setting up or writing
  Playwright component tests for a grid, or when a jsdom test cannot observe
  layout, scrolling or drag.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.4.0'
sources:
  - 'Jielga/react:packages/tmdatagrid/docs/testing.md'
  - 'Jielga/react:packages/tmdatagrid/test/gallery/main.tsx'
  - 'Jielga/react:packages/tmdatagrid/test/stories/Grid.story.tsx'
  - 'Jielga/react:playwright/components/virtualization.spec.ts'
---

# TMDataGrid - Component tests in a browser

Builds on the `testing` skill: parts are `[data-dg-part]`, coordinates are
`[data-row-id]` / `[data-column-id]`, and `DataGrid` is the page object.

jsdom has no layout. The virtualizer mounts a handful of rows whatever the data
says, a drag never moves anything, and jsdom does not apply `position: sticky`.
The behaviour below needs a browser:

- virtualization - rows mount and unmount as the body scrolls; `scrollToRow`
- column resize - a drag on `header-resize`, and double-click to fit
- column reorder - a header dragged onto another header (native HTML5 drag)
- pinned columns - sticky offsets while the body scrolls horizontally
- sticky header and summary row while the body scrolls vertically
- the clipboard - Ctrl+C on a cell selection

## The model

Playwright 1.62 replaced `@playwright/experimental-ct-react` with three pieces
that live in plain `@playwright/test`:

- **a story** - a `*.story.tsx` file; each named export is one scenario, a
  component with hard-coded data, options and providers
- **a gallery** - one page served by your own dev server that discovers the
  story files, exposes `window.mount({ story, props })` and `window.unmount()`,
  and renders into `#root` through one reused React root
- **`mount`** - a built-in fixture: `await mount("Orders/Virtualized")`
  navigates to the gallery (`baseURL`), mounts the story and returns a
  `Locator` for the gallery root

The story id is the file path under the stories folder without `.story.tsx`,
then `/` and the export name. `mount` accepts any string, so a renamed story
fails at run time, not under `tsc`; registering the ids in Playwright's
`Stories` interface gives completion and prop checking:

```ts
declare module "@playwright/test" {
  interface Stories {
    "Orders/Virtualized": typeof Virtualized;
  }
}
```

What the gallery page must expose is in Playwright's docs
(https://playwright.dev/docs/test-components); the grid's own gallery is a few
dozen lines over `import.meta.glob`.

Project config, next to the page project:

```ts
{
  name: "components",
  testDir: "playwright/components",
  use: {
    baseURL: "http://localhost:5274/",
    serviceWorkers: "block",
    permissions: ["clipboard-read", "clipboard-write"],
  },
}
```

with a `webServer` entry such as
`{ command: "npm run gallery", url: "http://localhost:5274/" }`. Every
`webServer` entry starts on every run; Playwright does not scope them to a
project.

## Writing a story for the grid

The story owns everything the grid needs:

```tsx
// Orders.story.tsx
declare global {
  interface Window {
    __grid?: TMDataGridApi<Order>; // for scrollToRow from the test
  }
}

export const Virtualized = () => {
  const grid = useTMDataGrid<Order>({
    data: orders, // 5000 rows
    columns,
    getRowId: (row) => row.id,
  });
  useEffect(() => {
    window.__grid = grid;
  }, [grid]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: 400 }}>
      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }} data-testid="orders">
        <TMDataGrid.Table<Order> />
      </TMDataGrid>
    </div>
  );
};
```

- **`<MantineProvider env="test">`** around every story, in the gallery or in
  the story. It turns Mantine's transitions off, so a panel is open the moment
  the click lands.
- **A flex column of fixed height,** with `flex: 1` and `minHeight: 0` on the
  grid. The grid root is a shrinkable flex item; in a plain block it grows to
  fit every row, nothing scrolls, and the virtualization test proves nothing.
  Give the pinned story a width smaller than its columns (`minSize` sets a
  fluid column's floor; `size` alone does not widen it), so the body overflows
  horizontally.
- **The api on `window`** only where a test calls `scrollToRow`. Everything
  else is reachable through the DOM contract. Declare the global in the story
  and again in the spec, which is typechecked apart from it.
- **No props unless needed.** One export per scenario, and `mount(id)` needs
  no generic.

## Writing the test

`mount` returns the gallery root; the page object takes the grid root inside it:

```ts
declare global {
  interface Window {
    __grid?: { scrollToRow(target: { rowId: string; align?: "start" | "center" | "end" }): boolean };
  }
}

test("reaches a row past the viewport", async ({ mount, page }) => {
  const component = await mount("Orders/Virtualized");
  const grid = new DataGrid(component.locator("[data-dg-root]"));
  await grid.expectRowCount(5000);
  await expect(grid.part("row", { rowId: "4500" })).toHaveCount(0);

  const found = await page.evaluate(() => {
    return window.__grid!.scrollToRow({ rowId: "4500", align: "center" });
  });
  expect(found).toBe(true);
  await expect(grid.part("row", { rowId: "4500" })).toBeVisible();
});
```

### Recipes

**Virtualization.** `data-dg-row-count` is the data; the number of
`[data-dg-part="row"]` elements is the window. Asserting that the second is
far below the first is the one place counting row elements is right. Scroll
the element carrying `data-dg-scroll-container` to its `scrollHeight` and the
last row appears.

**Resize.** `header-resize` is the handle, keyed by `data-column-id`:

```ts
const handle = grid.part("header-resize", { columnId: "name" });
const box = (await handle.boundingBox())!;
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + 80, box.y, { steps: 8 });
await page.mouse.up();
```

Then compare the header's `boundingBox().width` before and after. A
`dblclick()` on the handle fits the column to its content.

**Reorder.** `await grid.part("header", { columnId: "city" }).dragTo(grid.part("header", { columnId: "name" }), { targetPosition: { x: 10, y: 10 } })`
drops `city` before `name`; read the new order from `[data-dg-part="header"]`
`data-column-id`s. A header dragged across a pinned lane does not move.

**Pinning.** Scroll the scroll container horizontally (`scrollLeft`) and compare
`boundingBox().x` of a pinned header before and after: unchanged, while an
unpinned header moved. A pinned header and a body cell of the same column share
the same `x`.

**Sticky header and summary row.** Scroll vertically; `boundingBox().y` of the
header row (`[data-dg-header-row]`) and of `summary-row` do not change, and
both stay inside the scroll container's box.

**Clipboard.** In a story with `cellSelection` on: click a cell, shift-click
another, `page.keyboard.press("Control+C")`, then
`page.evaluate(() => navigator.clipboard.readText())`. Cells are separated by
a tab and rows by `\r\n`. Needs the `permissions` above; Chromium only.

## Common mistakes

### Mounting without a provider

A story rendered outside `MantineProvider` throws on the first Mantine
component. Put the provider in the gallery's `window.mount`, so no story can
forget it.

### A story with no height

The grid fills its container. With `height: auto` the container grows with the
rows, nothing scrolls, and the virtualizer mounts everything; the test passes
for the wrong reason or hangs on 5000 rows.

### Building JSX in the test

The test runs in Node and the component in the browser; there is no JSX across
that boundary. A scenario is a story export. A test that needs a different
composition gets another export.

### Passing a callback as a prop

Callbacks do not cross to the browser either. The story owns the state and the
callbacks, and writes what a test must see into the DOM - a hidden input, or
the grid's own `data-*` attributes, which already carry most of it.

### Counting row elements everywhere

Outside the virtualization claim itself, assert `data-dg-row-count`. The
window size depends on the viewport, overscan and row height, and changes with
`devices` presets.