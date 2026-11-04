import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FC } from 'react'
import { createPortal } from 'react-dom'
import { mirrorStyles } from './copyStyles'
import type {
  PopupProps,
  PopupWindowApi,
  PopupWindowFeatures,
  UsePopupWindowOptions,
} from './types'
import { whenStylesheetsLoad } from './whenStylesheetsLoad'

interface PopupState {
  popupWindow: Window | null
  container: HTMLElement | null
  blocked: boolean
}

const INITIAL_STATE: PopupState = { popupWindow: null, container: null, blocked: false }

class PopupStore {
  state: PopupState = INITIAL_STATE
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): PopupState => this.state

  getServerSnapshot = (): PopupState => INITIAL_STATE

  setState(partial: Partial<PopupState>): void {
    this.state = { ...this.state, ...partial }
    for (const listener of this.listeners) listener()
  }
}

const DEFAULT_FEATURES: PopupWindowFeatures = { popup: true, width: 640, height: 480 }

function buildFeatures(options: UsePopupWindowOptions): string {
  const merged: PopupWindowFeatures = { ...DEFAULT_FEATURES, ...options.features }
  if (
    options.center !== false &&
    merged.left === undefined &&
    merged.top === undefined &&
    typeof merged.width === 'number' &&
    typeof merged.height === 'number'
  ) {
    merged.left = Math.max(0, Math.round(window.screenX + (window.outerWidth - merged.width) / 2))
    merged.top = Math.max(0, Math.round(window.screenY + (window.outerHeight - merged.height) / 2))
  }
  return Object.entries(merged)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => (value === true ? `${key}=yes` : `${key}=${value}`))
    .join(',')
}

const ABOUT_BLANK = 'about:blank'
/** Interval for checking whether the page given by `url` has loaded. */
const LOAD_POLL_MS = 20
/** Longest time `Popup` waits for copied stylesheets before rendering anyway. */
const STYLES_TIMEOUT_MS = 3000

/**
 * Gives the initial `about:blank` document an HTML5 doctype, so the popup
 * lays out in standards mode like the opener instead of in quirks mode. Only
 * the parser can set the mode, so the document is written again. In Chromium
 * its `URL` then reports the opener's URL; a reload still loads `about:blank`.
 */
function writeStandardsDocument(doc: Document): void {
  doc.open()
  doc.write('<!DOCTYPE html><html><head></head><body></body></html>')
  doc.close()
}

/**
 * The popup's document once the page given by `url` has replaced the initial
 * `about:blank` document and finished parsing, otherwise `null`. Throws when
 * the document is not scriptable.
 */
function loadedDocument(popupWindow: Window): Document | null {
  const doc = popupWindow.document
  if (doc.URL === ABOUT_BLANK || doc.readyState === 'loading') return null
  return doc
}

function createPopupComponent(store: PopupStore): FC<PopupProps> {
  function Popup({ children }: PopupProps) {
    const { container } = useSyncExternalStore(
      store.subscribe,
      store.getSnapshot,
      store.getServerSnapshot,
    )
    return container ? createPortal(children, container) : null
  }
  Popup.displayName = 'PopupWindow.Popup'
  return Popup
}

/**
 * Open part of your React tree in a separate browser window.
 *
 * The popup content is rendered with a portal into the popup's document, so
 * it stays part of your component tree: state, context and event handlers
 * all keep working across windows.
 *
 * ```tsx
 * const { open, close, isOpen, Popup } = usePopupWindow({ title: 'Panel' })
 *
 * return (
 *   <>
 *     <button onClick={open}>Open panel</button>
 *     <Popup>
 *       <MyPanel />
 *     </Popup>
 *   </>
 * )
 * ```
 */
export function usePopupWindow(options: UsePopupWindowOptions = {}): PopupWindowApi {
  const [store] = useState(() => new PopupStore())
  const [Popup] = useState(() => createPopupComponent(store))

  const optionsRef = useRef(options)
  optionsRef.current = options

  const cleanupRef = useRef<(() => void) | null>(null)

  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  // `userClosed` is true when the window was closed outside our control
  // (user hit the close button, opener unloaded) — then we must not touch it.
  const closePopup = useCallback(
    (userClosed: boolean) => {
      const { popupWindow } = store.getSnapshot()
      cleanupRef.current?.()
      cleanupRef.current = null
      if (!popupWindow) return
      if (!userClosed && !popupWindow.closed) popupWindow.close()
      store.setState({ popupWindow: null, container: null })
      optionsRef.current.onClose?.()
    },
    [store],
  )

  const open = useCallback((): Window | null => {
    if (typeof window === 'undefined') return null
    const current = store.getSnapshot()
    if (current.popupWindow && !current.popupWindow.closed) {
      current.popupWindow.focus()
      return current.popupWindow
    }

    const opts = optionsRef.current
    const url = opts.url ?? ABOUT_BLANK
    const popupWindow = window.open(url, opts.name ?? '_blank', buildFeatures(opts))
    if (!popupWindow) {
      store.setState({ blocked: true })
      opts.onBlocked?.()
      return null
    }

    // Sandboxed embedders (VS Code's built-in browser, CodeSandbox/StackBlitz
    // previews, iframes sandboxed without popup-escape) open the popup with an
    // opaque origin, so reading its document throws a SecurityError. Treat
    // that as blocked instead of stranding a blank window the portal can
    // never reach.
    let initialDoc: Document
    try {
      initialDoc = popupWindow.document
    } catch {
      popupWindow.close()
      store.setState({ blocked: true })
      opts.onBlocked?.()
      return null
    }

    const handleExternalClose = () => closePopup(true)
    const onPopupPagehide = () => {
      // pagehide also fires on navigation; only treat it as a close when the
      // window really is gone a tick later.
      setTimeout(() => {
        if (popupWindow.closed) handleExternalClose()
      }, 0)
    }

    // Belt and braces: some browsers don't fire pagehide reliably for popups.
    const closePoll = window.setInterval(() => {
      if (popupWindow.closed) handleExternalClose()
    }, 250)

    const onOpenerPagehide = () => popupWindow.close()
    window.addEventListener('pagehide', onOpenerPagehide)

    let loadPoll: number | undefined
    let prepared = false
    let stopStyleSync: (() => void) | undefined
    let stopStylesWait: (() => void) | undefined

    cleanupRef.current = () => {
      window.clearInterval(closePoll)
      window.clearInterval(loadPoll)
      window.removeEventListener('pagehide', onOpenerPagehide)
      if (prepared) popupWindow.removeEventListener('pagehide', onPopupPagehide)
      stopStyleSync?.()
      stopStylesWait?.()
    }

    // Title, styles and the portal container go into the document that
    // stays: `about:blank` itself, or the page `url` loads in its place.
    const prepare = (doc: Document) => {
      prepared = true
      popupWindow.addEventListener('pagehide', onPopupPagehide)
      doc.title = opts.title ?? document.title
      let links: HTMLLinkElement[] = []
      if (opts.copyStyles !== false) {
        const styles = mirrorStyles(document, doc)
        stopStyleSync = styles.stop
        links = styles.links
      }
      const container = doc.createElement('div')
      container.setAttribute('data-popup-window-root', '')
      doc.body.appendChild(container)
      // The popup fetches copied <link> stylesheets asynchronously. Render
      // only once they have loaded, so the first paint is not unstyled.
      stopStylesWait = whenStylesheetsLoad(links, STYLES_TIMEOUT_MS, () => {
        store.setState({ container })
        opts.onOpen?.(popupWindow)
      })
    }

    store.setState({ popupWindow, container: null, blocked: false })

    if (url === ABOUT_BLANK) {
      // Before prepare(): writing the document removes event listeners on the
      // popup window.
      writeStandardsDocument(initialDoc)
      prepare(initialDoc)
    } else {
      // The window starts on an initial about:blank document and then
      // navigates to `url`. Wait until that page has replaced it and parsed.
      loadPoll = window.setInterval(() => {
        if (popupWindow.closed) {
          handleExternalClose()
          return
        }
        let doc: Document | null
        try {
          doc = loadedDocument(popupWindow)
        } catch {
          // The page went somewhere the opener cannot script, such as a
          // cross-origin redirect: nothing can ever render there.
          closePopup(false)
          store.setState({ blocked: true })
          opts.onBlocked?.()
          return
        }
        if (!doc) return
        window.clearInterval(loadPoll)
        prepare(doc)
      }, LOAD_POLL_MS)
    }

    return popupWindow
  }, [store, closePopup])

  const close = useCallback(() => closePopup(false), [closePopup])

  const toggle = useCallback(() => {
    if (store.getSnapshot().popupWindow) {
      closePopup(false)
    } else {
      open()
    }
  }, [store, closePopup, open])

  const focus = useCallback(() => {
    const { popupWindow } = store.getSnapshot()
    if (popupWindow && !popupWindow.closed) popupWindow.focus()
  }, [store])

  // Close the popup when the owning component unmounts — its portal content
  // would unmount anyway, leaving an empty window behind.
  useEffect(() => {
    return () => closePopup(false)
  }, [closePopup])

  return {
    open,
    close,
    toggle,
    focus,
    isOpen: state.popupWindow !== null,
    isBlocked: state.blocked,
    popupWindow: state.popupWindow,
    Popup,
  }
}
