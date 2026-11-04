import type { FC, ReactNode } from 'react'

/**
 * Features passed to `window.open`. Numbers and strings are serialized as
 * `key=value`, `true` as `key=yes`. `false`/`undefined` entries are omitted.
 */
export interface PopupWindowFeatures {
  width?: number
  height?: number
  left?: number
  top?: number
  [feature: string]: string | number | boolean | undefined
}

export interface UsePopupWindowOptions {
  /** Title of the popup window. Defaults to the opener document's title. */
  title?: string
  /**
   * `window.open` target name. Opening twice with the same name reuses the
   * window. Defaults to `_blank` (a fresh window every time).
   */
  name?: string
  /**
   * URL the popup loads instead of `about:blank`: an empty page served on the
   * same origin, such as `/popup.html`. The popup's address bar shows that
   * URL. `isOpen` turns `true` at once; `Popup` renders once the page has
   * loaded. If the page redirects to another origin, the popup closes and is
   * reported through `onBlocked`. Defaults to `about:blank`.
   */
  url?: string
  /** Extra `window.open` features. Defaults to `{ popup: true, width: 640, height: 480 }` merged with what you pass. */
  features?: PopupWindowFeatures
  /**
   * Center the popup over the opener window when no explicit `left`/`top`
   * feature is given. Defaults to `true`.
   */
  center?: boolean
  /**
   * Copy the opener document's stylesheets into the popup and keep them in
   * sync (new/changed `<style>`/`<link>` tags, `class`/`style` attributes on
   * `<html>`/`<body>`, adopted stylesheets). `Popup` renders once the copied
   * `<link>` stylesheets have loaded, or after 3 seconds, so the first frame
   * shown is styled. Defaults to `true`.
   */
  copyStyles?: boolean
  /**
   * Called when `Popup` starts rendering into the popup: once the window has
   * opened, the `url` page has loaded, and copied `<link>` stylesheets have
   * loaded.
   */
  onOpen?: (popupWindow: Window) => void
  /** Called when the popup closes — via `close()`, the user, or the opener unloading. */
  onClose?: () => void
  /**
   * Called when the popup cannot be used: `window.open` returned `null`
   * (blocked by the browser), or the popup's document is not scriptable
   * because a sandboxed embedder gave it an opaque origin or `url` led to
   * another origin.
   */
  onBlocked?: () => void
}

export interface PopupProps {
  children?: ReactNode
}

export interface PopupWindowApi {
  /**
   * Open the popup (focuses it if already open). Call this from a user
   * gesture (e.g. a click handler) or browsers will block it.
   * Returns the `Window`, or `null` when blocked / not in a browser.
   */
  open: () => Window | null
  /** Close the popup. No-op when it is not open. */
  close: () => void
  /** Open if closed, close if open. */
  toggle: () => void
  /** Focus the popup window. No-op when it is not open. */
  focus: () => void
  /** Whether the popup window is currently open. */
  isOpen: boolean
  /**
   * Whether the last `open()` attempt was blocked — by the browser, or by a
   * sandboxed embedder whose popups are not scriptable.
   */
  isBlocked: boolean
  /**
   * The popup `Window` while open, otherwise `null`. Escape hatch for
   * anything window-level — sizing, focus tricks, or `postMessage` when the
   * popup hosts non-React scripts of its own.
   */
  popupWindow: Window | null
  /**
   * Portal component with a stable identity. Renders its children into the
   * popup's document while the popup is open, and nothing otherwise.
   */
  Popup: FC<PopupProps>
}
