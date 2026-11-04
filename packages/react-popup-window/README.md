# @jielga/react-popup-window

[![CI](https://github.com/Jielga/react/actions/workflows/ci.yml/badge.svg)](https://github.com/Jielga/react/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40jielga%2Freact-popup-window)](https://www.npmjs.com/package/@jielga/react-popup-window)
[![license](https://img.shields.io/npm/l/%40jielga%2Freact-popup-window)](./LICENSE)

React hook for rendering part of a component tree in a separate browser
window. Content is rendered through a portal into the popup document, so it
remains part of the calling tree: state, context, and event handlers work
across windows without bridging.

[Documentation and live examples](https://jielga.github.io/react/react-popup-window/)

## Features

- Portal-based rendering — popup content keeps access to all ancestor
  context (state managers, data fetching, theming, routing)
- Stylesheet synchronization — `<style>` and `<link>` elements, root
  `class`/`data-*` attributes, and `adoptedStyleSheets` are mirrored into
  the popup and kept current while it is open
- Lifecycle management — detects the user closing the window, closes the
  popup on owner unmount and opener unload, reports blocked popups
- No dependencies beyond `react` and `react-dom`
- TypeScript, ESM and CJS builds, SSR-safe

## Installation

```sh
npm install @jielga/react-popup-window
```

Requires React 19.2 or later.

## Usage

```tsx
import { usePopupWindow } from '@jielga/react-popup-window'

function Dashboard() {
  const { open, close, isOpen, Popup } = usePopupWindow({
    title: 'Detached panel',
    features: { width: 640, height: 480 },
  })

  return (
    <>
      <button onClick={open}>Open in new window</button>
      <Popup>
        <MyPanel />
      </Popup>
    </>
  )
}
```

`Popup` renders its children into the popup window while open and nothing
otherwise. It has a stable identity and can be destructured from the hook
result.

### Detaching a section

To hide a section in the main window while it is popped out, render it in
one of two places depending on `isOpen`:

```tsx
const { open, close, focus, isOpen, Popup } = usePopupWindow({ title: 'People' })

const table = <DataTable />

return (
  <>
    {isOpen ? (
      <div>
        <button onClick={focus}>Focus window</button>
        <button onClick={close}>Bring back</button>
      </div>
    ) : (
      <>
        <button onClick={open}>Open in new window</button>
        {table}
      </>
    )}
    <Popup>{table}</Popup>
  </>
)
```

`isOpen` also updates when the user closes the window directly, so the
inline branch is restored in every case.

### Show your own URL in the address bar

By default, the popup loads `about:blank`, and its address bar shows that.
To show your own domain instead, set `url` to an empty page served on the same origin.
For a Vite app, add `public/popup.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Loading</title>
  </head>
  <body></body>
</html>
```

```tsx
const { open, Popup } = usePopupWindow({ title: 'Panel', url: '/popup.html' })
```

`isOpen` turns `true` as soon as the window opens; `Popup` renders once the page has loaded.
Important: do not point `url` at a route of the app, as that starts a second copy of the app inside the popup.
Start the page with `<!doctype html>`: without it, the popup lays out in quirks mode.
If the page redirects to another origin, the popup closes and `onBlocked` is called.

## How it works

The hook opens a same-origin window, `about:blank` by default or the page
set with `url`, and creates a container element in its body. The
`about:blank` document is written with an HTML5 doctype first, so the popup
lays out in standards mode, like the opener. The `Popup` component renders its children with
`createPortal` into that container. A portal changes where DOM output is
placed, not where the components sit in the tree, so popup content
participates in the calling tree's state, context, and event system. React
supports cross-document portals: it attaches its event delegation to the
portal container when the container belongs to another document.

Physically moving DOM nodes into another document is not a viable
alternative: React delegates events on the root container in the main
document, and a node moved elsewhere stops receiving synthetic events.

The popup document runs no JavaScript of its own. All rendering and event
handling execute in the opener window.

## API

### `usePopupWindow(options?)`

```ts
interface UsePopupWindowOptions {
  /** Popup document title. Defaults to the opener document's title. */
  title?: string
  /** window.open target name. The same name reuses the window. Default: '_blank'. */
  name?: string
  /** Same-origin URL to load instead of about:blank, such as an empty /popup.html. Default: 'about:blank'. */
  url?: string
  /** window.open features, merged over { popup: true, width: 640, height: 480 }. */
  features?: PopupWindowFeatures
  /** Center the popup over the opener when no left/top feature is given. Default: true. */
  center?: boolean
  /** Mirror and synchronize stylesheets into the popup. Default: true. */
  copyStyles?: boolean
  /** Called when Popup starts rendering into the popup window. */
  onOpen?: (popupWindow: Window) => void
  /** Called when the popup closes: close(), user close, or opener unload. */
  onClose?: () => void
  /** Called when the popup is blocked or its document is not scriptable. */
  onBlocked?: () => void
}
```

Returns:

| Member        | Type                       | Description                                                                                       |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| `Popup`       | `FC<{ children? }>`        | Portal component. Renders children into the popup while open.                                      |
| `open`        | `() => Window \| null`     | Opens the popup, or focuses it if already open. Returns `null` when blocked. Requires a user gesture. |
| `close`       | `() => void`               | Closes the popup.                                                                                  |
| `toggle`      | `() => void`               | Opens if closed, closes if open.                                                                   |
| `focus`       | `() => void`               | Focuses the popup window.                                                                          |
| `isOpen`      | `boolean`                  | Whether the popup is open.                                                                         |
| `isBlocked`   | `boolean`                  | Whether the last `open()` call was blocked.                                                        |
| `popupWindow` | `Window \| null`           | The popup `Window` while open.                                                                     |

### `copyStyles(source, target, watch?)`

The style synchronization used by the hook, exported for windows managed
outside of it. Copies stylesheets from `source` to `target` and, when
`watch` is true (default), observes the source document for changes.
Returns a function that stops observing.

## Style synchronization

While the popup is open, the following are mirrored from the opener
document and kept current:

- `<style>` and `<link rel="stylesheet">` elements. `<style>` contents are
  serialized from the CSSOM, so rules injected with `insertRule` are
  included.
- Rules added to or removed from a `<style>` sheet with `insertRule` and
  `deleteRule`, applied to the popup as they happen. CSS-in-JS libraries
  such as Emotion and styled-components add rules this way in production
  builds.
- Additions, removals, and text edits of style nodes in `<head>`. This
  covers Vite HMR, lazily loaded chunk CSS, and CSS-in-JS libraries in
  development builds.
- `class`, `style`, and `data-*` attributes on `<html>` and `<body>`.
  Theme systems keyed on root attributes propagate to the popup.
- `document.adoptedStyleSheets`.

The popup loads each copied `<link>` stylesheet again.
`Popup` renders once they have loaded or failed, so the first frame shown is styled.
Alternate stylesheets and stylesheets whose `media` does not match are not waited for.
If a stylesheet takes longer than 3 seconds, `Popup` renders without it.
A `<link>` added to the opener while the popup is open, such as lazily loaded chunk CSS, is loaded by the popup again.
Until that copy has loaded, the popup applies the rules the opener already loaded, so content rendered after the opener's load is styled.
Note that a cross-origin stylesheet served without CORS cannot be read that way, and its content is unstyled until the popup has loaded it.
Edits inside an existing rule, rules inserted into a nested rule such as `@media`, and changes to `document.adoptedStyleSheets` after the popup opened are not mirrored.

Set `copyStyles: false` to disable.

## Communication

Popup content rendered through `Popup` is part of the calling component
tree and executes in the opener's JavaScript realm. Props, state, and
context are the communication mechanism; no message channel is required or
provided.

`postMessage` remains relevant only for scripts hosted in the popup
document itself (for example, an injected non-React widget). Such scripts
run in the popup's realm and can post to `window.opener`; the exposed
`popupWindow` handle can be used from the opener side. Note that calling
`opener.postMessage` from a portal event handler posts from the opener's
own realm — the browser reports the main window, not the popup, as
`event.source`.

## Keep overlays in the popup window

Component libraries mount overlays - menus, popovers, modals, tooltips -
through portals into `document.body`. Popup content executes in the
opener's JavaScript realm, so the bare `document` global is the main
window's document even for components rendered inside the popup, and the
overlay opens in the main window. The `ownerDocument` of a node rendered
inside the popup is the popup's document; the portal container must come
from there. The rule covers any portal, including a raw `createPortal` in
application code.

### Mantine

Mantine reads portal defaults from the theme. The following wrapper
resolves its own `ownerDocument` after mount and supplies that document's
body as the default `Portal` target, so `Menu`, `Popover`, `Tooltip`, and
`Modal` open in the window they are rendered in:

```tsx
import { MantineThemeProvider, Portal } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function SameWindowPortals({ children }: { children: ReactNode }) {
  const probeRef = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(probeRef.current?.ownerDocument.body ?? null)
  }, [])

  const theme = useMemo(
    () => ({
      components: {
        Portal: Portal.extend({ defaultProps: target ? { target } : {} }),
      },
    }),
    [target],
  )

  return (
    <div ref={probeRef} style={{ display: 'contents' }}>
      <MantineThemeProvider inherit theme={theme}>
        {children}
      </MantineThemeProvider>
    </div>
  )
}
```

Render the wrapper inside `<Popup>`, around the content that opens
overlays; it resolves the container from the tree it mounts in, so the
same component also works inline. The
[live examples](https://jielga.github.io/react/react-popup-window/) use it
around each grid, including a `Modal` opened from a popped-out grid; the
shipped `popup-content` skill contains the same code and the common
mistakes around it.

Mantine's own portal props interact with the wrapper as follows:

- An explicit `target` or `portalProps` on a component overrides the
  theme default, so the overlay opens in the main window again.
- `withinPortal={false}` needs no wrapper: the overlay renders inline and
  therefore inside the popup document. It then clips against
  `overflow: hidden` ancestors and local stacking contexts, which is why
  the theme default is preferred.

### Radix, MUI, and similar

Pass the per-component portal `container` prop an element of the popup
document: `popupWindow.document.body` where the hook's result is in
scope, or `node.ownerDocument.body` from a ref on any rendered node
deeper in the tree - the same probe the wrapper above uses.

### Window-bound overlay behavior

A correctly placed overlay can still bind window-level behavior to the
main window, because those bindings also run in the opener's realm.
Mantine's `Modal` listens for Escape with `window.addEventListener` and
locks scroll on the main window's body, so Escape pressed in the popup
does not close the modal. This cannot be redirected from outside the
component; for state you own, add a listener on the popup window:

```tsx
// Close our own modal on Escape pressed in the popup.
useEffect(() => {
  if (!opened) return
  const win = hostRef.current?.ownerDocument.defaultView
  const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpened(false)
  win?.addEventListener('keydown', onKeyDown)
  return () => win?.removeEventListener('keydown', onKeyDown)
}, [opened])
```

## Limitations

- Browsers do not allow hiding the address bar entirely. `popup: true`
  (the default) requests the minimal window chrome the platform provides.
  By default, the bar shows `about:blank`; `url` replaces that with a page
  of your own, see
  [Show your own URL in the address bar](#show-your-own-url-in-the-address-bar).
- `open()` must be called from a user gesture; otherwise the browser's
  popup blocker intervenes and `open()` returns `null`.
- Popup content unmounts and remounts when it moves between windows. State
  that should survive detaching belongs in the component that owns the
  hook, or in an external store.
- The popup closes when the owning component unmounts and when the opener
  window unloads. The popup document cannot outlive the opener.
- Sandboxed embedders — VS Code's built-in browser, CodeSandbox and
  StackBlitz previews, iframes sandboxed without
  `allow-popups-to-escape-sandbox` — open popups with an opaque origin the
  opener cannot script, so the portal cannot render into them. `open()`
  detects this, closes the window, reports it through `isBlocked` and
  `onBlocked`, and returns `null`. Use a real browser tab instead.

## Agent skills

The package ships [Agent Skills](https://agentskills.io) for AI coding
agents, managed with [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent):

```sh
npx @tanstack/intent@latest list
npx @tanstack/intent@latest load @jielga/react-popup-window#getting-started
```

| Skill             | Contents                                                             |
| ----------------- | -------------------------------------------------------------------- |
| `getting-started` | Hook API, options, lifecycle, common mistakes                        |
| `popup-content`   | Style synchronization, bounded-height layouts, portal-based overlays |

## Development

The package lives in the [`Jielga/react`](https://github.com/Jielga/react)
monorepo. All paths below are relative to the repository root.

| Path                                  | Contents                                                         |
| ------------------------------------- | ---------------------------------------------------------------- |
| `packages/react-popup-window/src/`    | Library source. Vite library mode; ESM, CJS, and declarations.   |
| `packages/react-popup-window/skills/` | Agent skills shipped with the package.                           |
| `apps/popup-docs/`                    | Documentation site with live examples, deployed to GitHub Pages. |
| `playwright/popup/`                   | Playwright tests that exercise real popup windows in Chromium.   |

```sh
git clone https://github.com/Jielga/react.git
cd react
bun install
bun run --cwd apps/popup-docs dev                # documentation site on port 5275, with the library aliased to source
bun run --cwd packages/react-popup-window test   # unit tests (Vitest, jsdom)
bun run test:e2e --project popup                 # end-to-end tests (Playwright)
bun run build:lib                                # build every published package, this one into packages/react-popup-window/dist/
bun run check:skills                             # validate agent skills
bun run changeset                                # describe a change for the changelog and the next release
```

Releases are published to npm by Changesets when the **chore: version packages**
pull request is merged.

## License

[MIT](./LICENSE)
