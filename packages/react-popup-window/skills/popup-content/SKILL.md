---
name: popup-content
description: >
  Render real application UI inside the popup window: stylesheet synchronization
  (copyStyles, CSSOM serialization, root class and data-* attributes,
  adoptedStyleSheets), theme switching across windows, bounded-height layouts
  for virtualized content, and third-party component libraries whose overlays
  portal to document.body (Mantine, Radix, MUI). Load when popup content renders
  unstyled, a theme change does not reach the popup, or menus, popovers, modals,
  and tooltips open in the main window instead of the popup — including when a
  portal redirect is already in place but has no effect.
metadata:
  type: sub-skill
  library: '@jielga/react-popup-window'
  library_version: '0.3.1'
requires:
  - '@jielga/react-popup-window/getting-started'
sources:
  - 'Jielga/react:packages/react-popup-window/README.md'
  - 'Jielga/react:packages/react-popup-window/src/copyStyles.ts'
  - 'Jielga/react:apps/popup-docs/src/examples/SameWindowPortals.tsx'
---

# react-popup-window — Popup content

This skill builds on getting-started. Read it first for the portal model
and hook API.

The popup document starts as an unstyled page: `about:blank`, or the empty
page set with `url`. While it is open, the library mirrors the opener's
styling into it and keeps the mirror current:

- `<style>` and `<link rel="stylesheet">` elements are copied into the
  popup `<head>`. `<style>` contents are serialized from the CSSOM, so
  rules injected with `insertRule` are included.
- Rules added to or removed from a `<style>` sheet later with `insertRule`
  and `deleteRule` are applied to the popup's copy as they happen. Emotion
  (including MUI and `@mantine/emotion`) and styled-components add rules
  this way in production builds, often while popup content renders for the
  first time.
- Additions, removals, and edits of style nodes in the opener's `<head>`
  are observed and re-mirrored. This covers Vite HMR and lazily loaded
  chunk CSS.
- `class`, `style`, and `data-*` attributes on `<html>` and `<body>` are
  mirrored and kept in sync. Theme systems keyed on a root class or data
  attribute (for example Mantine's `data-mantine-color-scheme`) follow
  automatically.
- `document.adoptedStyleSheets` are reconstructed in the popup document.

The popup loads each copied `<link>` stylesheet again. `Popup` renders once
they have loaded or failed (at most 3 seconds), so the first frame shown is
styled. Alternate stylesheets and non-matching `media` are not waited for.
A `<link>` added to the opener while the popup is open, such as lazily loaded
chunk CSS, is loaded by the popup again; until then the popup applies the
rules the opener already loaded. A cross-origin stylesheet without CORS
cannot be read that way and is unstyled until the popup has loaded it.

`copyStyles: false` disables all of it. The mechanism is also exported
standalone as `copyStyles(source, target, watch?)`, returning a `stop`
function, for windows managed outside the hook.

## Setup

Redirect portal-based overlays into the popup document. Component libraries
mount menus, popovers, modals, and tooltips into `document.body`. Popup
content executes in the opener's realm, so the bare `document` global is
the main window's document even for components rendered in the popup,
while `ownerDocument` of a mounted node is the popup's document. For
Mantine, a wrapper can supply the correct body through theme default
props:

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

The wrapper resolves its own `ownerDocument` after mount, so the same
component works inline (main body, the default behavior) and inside
`<Popup>` (popup body). This covers `Modal` too: it portals through the
same theme-resolved `Portal`. Because the target resolves in an effect, an
overlay that opens during the very first render still lands in the main
body; user-triggered overlays open after mount and are unaffected.

For other libraries, use their per-component portal container prop
(`container` in Radix and MUI) with an element of the popup document:
`popupWindow.document.body` where the hook's result is in scope, or
`node.ownerDocument.body` from a ref on any rendered node deeper in the
tree (the same probe the wrapper uses).

The rule is the same for any portal, including a raw `createPortal` in
application code: the container element must belong to the popup document.

To verify a redirect, open the overlay and check its mounted node's
`ownerDocument`. With an explicit `target`, Mantine portals directly into
the target and appends no `[data-portal]` node; that node exists only for
the default, untargeted portal.

## Core patterns

### Full-height popup layout

```tsx
<Popup>
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <VirtualizedGrid style={{ flex: 1, minHeight: 0 }} />
  </div>
</Popup>
```

The portal container is an unsized `<div>` in the popup body. Content that
measures itself — virtualized lists, grids, editors — needs an explicit
bounded height; the popup viewport (`100vh`) is the natural bound.

### Theme switching across windows

```tsx
// A root-attribute theme reaches the popup with no additional wiring:
document.documentElement.classList.toggle('dark', dark)
```

Root `class` and `data-*` attributes are mirrored while the popup is open,
so any CSS keyed on them applies in both windows.

## Common mistakes

### HIGH Overlays from UI libraries open in the main window

Wrong:

```tsx
<Popup>
  <DataGrid /> {/* column menu portals to the main window's document.body */}
</Popup>
```

Correct:

```tsx
<Popup>
  <SameWindowPortals>
    <DataGrid />
  </SameWindowPortals>
</Popup>
```

Portal-based overlays default to the global `document.body`. The content
sits in the popup document, but the overlay mounts — and positions itself —
in the main window. Supply a portal target inside the popup document.

Source: docs/src/examples/SameWindowPortals.tsx

### HIGH Portal target resolved outside the Popup

Wrong:

```tsx
<SameWindowPortals> {/* probe mounts in the MAIN document */}
  <Popup>
    <DataGrid />
  </Popup>
</SameWindowPortals>
```

Correct:

```tsx
<Popup>
  <SameWindowPortals>
    <DataGrid />
  </SameWindowPortals>
</Popup>
```

Whatever supplies the portal container (a wrapper like this, a ref, a
`useMemo`) must itself run inside `<Popup>`, because it resolves the
container from the tree it mounts in.
Outside `<Popup>` it resolves the main document's body, which is the
default behavior, so overlays still open in the main window.

Source: docs/src/examples/SameWindowPortals.tsx

### HIGH Provider between the redirect and the overlay resets it

Wrong:

```tsx
<Popup>
  <SameWindowPortals>
    <MantineProvider theme={theme}> {/* replaces theme.components */}
      <DataGrid />
    </MantineProvider>
  </SameWindowPortals>
</Popup>
```

Correct:

```tsx
<Popup>
  <SameWindowPortals>
    {/* the main window's providers reach popup content through context */}
    <DataGrid />
  </SameWindowPortals>
</Popup>
```

A context-based portal redirect is lost when a provider below it replaces
that context instead of merging with it.
In Mantine, `MantineProvider` (and `MantineThemeProvider` without
`inherit`) rebuilds the theme and drops the `Portal` default props.
Popup content already receives the main window's providers through context;
for a local theme override, use `MantineThemeProvider` with `inherit`
inside the wrapper.

Source: docs/src/examples/SameWindowPortals.tsx

### HIGH Expecting Escape and scroll lock to follow a redirected modal

Wrong:

```tsx
// inside <Popup>, portal redirect in place
<Modal opened={opened} onClose={closeModal} />
{/* renders in the popup, but Escape pressed there does not close it */}
```

Correct:

```tsx
<Modal opened={opened} onClose={closeModal} />
```

```tsx
// plus: bind Escape on the window the content is rendered in
useEffect(() => {
  if (!opened) return
  const win = hostRef.current?.ownerDocument.defaultView
  const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && closeModal()
  win?.addEventListener('keydown', onKeyDown)
  return () => win?.removeEventListener('keydown', onKeyDown)
}, [opened, closeModal])
```

A redirected portal moves only the overlay's DOM. Handlers the component
binds on the bare `window` still attach to the opener: Mantine's `Modal`
listens for Escape there and locks scroll on the main window's body, so
Escape pressed in the popup does not close a modal that renders correctly
in it. (The popup body appears scroll-locked as well only because root
attributes are mirrored.)
This cannot be redirected from outside the component; re-implement
window-level behavior you own with listeners on the popup window.
Same failure family as "Listening on the wrong window object" below; here
the listener sits inside the third-party component.

Source: docs/src/examples/DataTableExample.tsx, @mantine/core ModalBase (useWindowEvent)

### HIGH Unbounded height collapses measured content

Wrong:

```tsx
<Popup>
  <VirtualizedGrid style={{ flex: 1, minHeight: 0 }} /> {/* parent has no height */}
</Popup>
```

Correct:

```tsx
<Popup>
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <VirtualizedGrid style={{ flex: 1, minHeight: 0 }} />
  </div>
</Popup>
```

`flex: 1` resolves against a sized parent. Without one, a virtualizer
measures zero height and renders no rows, or the content renders at full
natural height and scrolls the popup body instead.

Source: README.md

### MEDIUM Per-component portal props override the redirect

Wrong:

```tsx
// inside <SameWindowPortals>
<Menu portalProps={{ target: document.body }}> {/* the MAIN window's body */}
```

Correct:

```tsx
<Menu> {/* no portal props; the redirected default applies */}
```

A theme- or context-level default applies only where the component does not
set the prop itself.
An explicit `portalProps`, `container`, or `target` overrides the
redirect, including one hardcoded inside an intermediate library
component.
`withinPortal={false}` is safe: the overlay renders inline, inside the
popup document.

Source: @mantine/core Portal (theme defaultProps resolution)

### MEDIUM Duplicate copies of the UI library

Wrong:

```text
$ npm ls @mantine/core
├── @mantine/core@9.5.1
└─┬ some-grid-library@2.0.0
  └── @mantine/core@9.4.0
```

Correct:

```text
$ npm ls @mantine/core
└── @mantine/core@9.5.1   # one copy, deduped everywhere
```

Each installed copy of a UI library creates its own React context, so the
redirect is written into one copy's context and the overlay reads the
other's.
No error is raised; the redirect is silently ignored.

Source: @mantine/core (one theme context per installed copy)

### MEDIUM Selector string as portal target

Wrong:

```tsx
Portal.extend({ defaultProps: { target: '#popup-root' } }) // resolved in the MAIN document
```

Correct:

```tsx
Portal.extend({ defaultProps: { target: probeRef.current.ownerDocument.body } })
```

Portal code runs in the opener's realm, so a selector string is resolved
with the main document's `querySelector` regardless of where the component
renders.
Pass an element that belongs to the popup document.

Source: @mantine/core Portal (getTargetNode)

### MEDIUM Listening on the wrong window object

Wrong:

```tsx
// inside <Popup> content
useEffect(() => {
  window.addEventListener('resize', onResize) // main window: closures keep the opener's globals
  return () => window.removeEventListener('resize', onResize)
}, [])
```

Correct:

```tsx
const { popupWindow } = usePopupWindow(/* ... */)

useEffect(() => {
  if (!popupWindow) return
  popupWindow.addEventListener('resize', onResize)
  return () => popupWindow.removeEventListener('resize', onResize)
}, [popupWindow])
```

Portal content executes in the main window's realm; `window` in its
closures is the opener. Window-level events of the popup — resize, scroll,
message — require listeners on the `popupWindow` object.

Source: README.md (Communication)

### MEDIUM Expecting in-place CSSOM edits to sync after open

Wrong:

```tsx
// after the popup is open
rule.style.setProperty('color', 'red') // edits an existing rule; not mirrored
mediaRule.insertRule('.late { color: red }') // nested rule; not mirrored
```

Correct:

```tsx
// add a rule to the <style> sheet itself; insertRule on the sheet is mirrored
const sheet = styleElement.sheet!
sheet.insertRule('.late { color: red }', sheet.cssRules.length)
```

Style synchronization copies each sheet when the popup opens, applies
`insertRule`/`deleteRule` calls on a `<style>` sheet as they happen, and
copies a sheet again when its node changes. Edits inside an existing rule,
rules inserted into a nested rule such as `@media`, and changes to
`document.adoptedStyleSheets` after the popup opened are not mirrored.

Source: src/copyStyles.ts
