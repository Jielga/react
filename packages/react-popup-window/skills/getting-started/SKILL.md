---
name: getting-started
description: >
  Set up @jielga/react-popup-window: the usePopupWindow hook, the Popup portal
  component, window controls (open, close, toggle, focus), reactive state
  (isOpen, isBlocked, popupWindow), and hook options (title, name, url,
  features, center, copyStyles, onOpen, onClose, onBlocked). Load when opening
  part of a React tree in a separate browser window, building an "open in new
  window" or detachable panel, or when a popup is blocked, closes unexpectedly,
  loses state, or shows about:blank in its address bar.
metadata:
  type: core
  library: '@jielga/react-popup-window'
  library_version: '0.3.1'
sources:
  - 'Jielga/react:packages/react-popup-window/README.md'
  - 'Jielga/react:packages/react-popup-window/src/usePopupWindow.ts'
  - 'Jielga/react:packages/react-popup-window/src/types.ts'
---

# react-popup-window — Getting started

`usePopupWindow` opens part of a React tree in a separate browser window.
Content is rendered with a portal into the popup's document (`about:blank`,
or the empty page set with `url`), so it remains part of the calling
component tree: state, context, and event handlers work across windows
without bridging. The popup document runs no
JavaScript of its own; the opener's React instance renders into it.

## Setup

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

`Popup` renders its children into the popup while open and nothing
otherwise. It has a stable identity; destructuring it from the hook result
is safe.

## Core patterns

### Detach a section: hide it inline while popped out

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

The element is created once and mounted in exactly one of the two homes at
a time. `isOpen` also flips when the user closes the window by hand, so the
inline branch restores itself.

### Handle blocked popups

```tsx
const { open, isBlocked } = usePopupWindow({ onBlocked: () => notifyUser() })
// open() returns Window | null; null means blocked (or non-browser environment)
```

### Show the app's URL in the address bar

By default, the popup loads `about:blank`, and its address bar shows that.
Set `url` to an empty page served on the same origin; the bar then shows it:

```tsx
// public/popup.html:
// <!doctype html><html><head><meta charset="utf-8" /></head><body></body></html>
const { open, Popup } = usePopupWindow({ title: 'Panel', url: '/popup.html' })
```

`isOpen` turns `true` as soon as the window opens; `Popup` renders once the
page has loaded. Start the page with `<!doctype html>`, or the popup lays out
in quirks mode. Important: do not point `url` at a route of the app, as that
starts a second copy of the app inside the popup. If the page redirects to
another origin, the popup closes and `onBlocked` is called.

### Options

```ts
interface UsePopupWindowOptions {
  title?: string        // popup document title; defaults to the opener's title
  name?: string         // window.open target name; same name reuses the window
  url?: string          // same-origin empty page to load instead of about:blank
  features?: PopupWindowFeatures // merged over { popup: true, width: 640, height: 480 }
  center?: boolean      // center over the opener window; default true
  copyStyles?: boolean  // mirror and live-sync stylesheets; default true
  onOpen?: (popupWindow: Window) => void // Popup starts rendering into the popup
  onClose?: () => void  // close(), user close, or opener unload
  onBlocked?: () => void
}
```

Return value: `{ open, close, toggle, focus, isOpen, isBlocked, popupWindow,
Popup }`. `popupWindow` is the raw `Window` while open, otherwise `null`.

Lifecycle: the popup closes automatically when the component that owns the
hook unmounts and when the opener window unloads. Closing the window by
hand is detected (`pagehide` plus a `closed` poll); `isOpen` flips and the
portal unmounts.

## Common mistakes

### HIGH Calling open() outside a user gesture

Wrong:

```tsx
useEffect(() => {
  open() // blocked by the popup blocker on mount
}, [open])
```

Correct:

```tsx
<button onClick={open}>Open panel</button>
```

Browsers only allow `window.open` in response to a user gesture; outside
one, `open()` returns `null` and sets `isBlocked` without throwing.

Source: README.md, src/usePopupWindow.ts (open)

### HIGH Expecting component-local state to survive detaching

Wrong:

```tsx
function Panel() {
  const [sort, setSort] = useState('name') // resets when the panel moves windows
  return <SortedList sort={sort} onSort={setSort} />
}
```

Correct:

```tsx
function Owner() {
  const [sort, setSort] = useState('name') // owner stays mounted in the main window
  const { open, isOpen, Popup } = usePopupWindow()
  const panel = <SortedList sort={sort} onSort={setSort} />
  return <>{isOpen ? null : panel}<Popup>{panel}</Popup></>
}
```

Popup content unmounts and remounts when it moves between windows, so state
held inside it is discarded. State held by the component that owns the hook
persists, because that component never moves.

Source: README.md (Limitations)

### MEDIUM Messaging the opener from a portal event handler

Wrong:

```tsx
// inside <Popup> content
<button onClick={() => popupWindow.opener.postMessage(data, '*')}>Send</button>
```

Correct:

```tsx
// inside <Popup> content — same tree, same realm; call the handler directly
<button onClick={() => onData(data)}>Send</button>
```

Portal content executes in the main window's JavaScript realm, so the
message is posted by the main window to itself and `event.source` is the
main window. `postMessage` is only meaningful for scripts hosted in the
popup document itself; for portal content, props, state, and context are
the communication channel.

Source: README.md (Communication)

### MEDIUM Keeping the popup open across owner unmount or navigation

Wrong:

```tsx
// route A mounts the hook; navigating to route B is expected to keep the popup
<Route path="/a" element={<PanelWithPopup />} />
```

Correct:

```tsx
// mount the hook in a component that stays mounted across the interaction,
// e.g. a layout component above the route switch
```

The popup is closed deliberately when the owning component unmounts: its
portal content would unmount anyway, leaving an empty window. Place the
hook at a level that lives as long as the popup should.

Source: src/usePopupWindow.ts (unmount effect)
