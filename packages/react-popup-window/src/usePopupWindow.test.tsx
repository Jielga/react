import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePopupWindow } from './usePopupWindow'
import type { PopupWindowApi, UsePopupWindowOptions } from './types'

interface FakePopup {
  win: Window
  /** The initial about:blank document. */
  doc: Document
  /** Simulate the user closing the window. */
  closeByUser: () => void
  /** Simulate the window navigating to `url`; the new document starts out parsing. */
  navigate: (url: string) => Document
  /** Finish parsing the document `navigate` created. */
  finishLoading: () => void
  /** Make the document throw on access, as after a cross-origin redirect. */
  makeUnscriptable: () => void
}

function createFakePopup(): FakePopup {
  let doc = document.implementation.createHTMLDocument('popup')
  const listeners = new Map<string, Set<EventListener>>()
  let closed = false
  let unscriptable = false
  let finish = () => {}

  const win = {
    get document() {
      if (unscriptable) {
        throw new DOMException(
          'Blocked a frame with origin "http://localhost" from accessing a cross-origin frame.',
          'SecurityError',
        )
      }
      return doc
    },
    get closed() {
      return closed
    },
    close() {
      closed = true
    },
    focus: vi.fn(),
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
  } as unknown as Window

  return {
    win,
    doc,
    closeByUser() {
      closed = true
      for (const listener of listeners.get('pagehide') ?? []) {
        listener(new Event('pagehide'))
      }
    },
    navigate(url) {
      const next = document.implementation.createHTMLDocument('popup')
      let readyState: DocumentReadyState = 'loading'
      Object.defineProperty(next, 'URL', { get: () => url })
      Object.defineProperty(next, 'readyState', { get: () => readyState })
      finish = () => {
        readyState = 'complete'
      }
      doc = next
      return next
    },
    finishLoading() {
      finish()
    },
    makeUnscriptable() {
      unscriptable = true
    },
  }
}

function Harness({
  onApi,
  options,
}: {
  onApi: (api: PopupWindowApi) => void
  options?: UsePopupWindowOptions
}) {
  const api = usePopupWindow(options)
  const { Popup } = api
  onApi(api)
  return (
    <Popup>
      <span data-testid="popup-content">hello from popup</span>
    </Popup>
  )
}

describe('usePopupWindow', () => {
  let fake: FakePopup

  beforeEach(() => {
    fake = createFakePopup()
    vi.spyOn(window, 'open').mockReturnValue(fake.win)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function renderHarness(options?: UsePopupWindowOptions) {
    let api!: PopupWindowApi
    render(<Harness onApi={(a) => (api = a)} options={options} />)
    return () => api
  }

  it('opens a popup and portals children into it', () => {
    const getApi = renderHarness({ title: 'Test panel' })
    expect(getApi().isOpen).toBe(false)

    act(() => {
      getApi().open()
    })

    expect(getApi().isOpen).toBe(true)
    expect(getApi().popupWindow).toBe(fake.win)
    expect(fake.doc.title).toBe('Test panel')
    expect(fake.doc.body.textContent).toContain('hello from popup')
    expect(fake.doc.querySelector('[data-popup-window-root]')).not.toBeNull()
  })

  it('writes a doctype into the about:blank document, so it lays out in standards mode', () => {
    const write = vi.spyOn(fake.doc, 'write')
    const getApi = renderHarness()
    act(() => {
      getApi().open()
    })
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/^<!DOCTYPE html>/))
    expect(fake.doc.body.textContent).toContain('hello from popup')
  })

  it('focuses instead of reopening when already open', () => {
    const getApi = renderHarness()
    act(() => {
      getApi().open()
    })
    act(() => {
      getApi().open()
    })
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(fake.win.focus).toHaveBeenCalledTimes(1)
  })

  it('close() closes the window, unmounts the portal and calls onClose', () => {
    const onClose = vi.fn()
    const getApi = renderHarness({ onClose })
    act(() => {
      getApi().open()
    })
    act(() => {
      getApi().close()
    })
    expect(getApi().isOpen).toBe(false)
    expect(fake.win.closed).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(fake.doc.body.textContent).not.toContain('hello from popup')
  })

  it('detects the user closing the window', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const getApi = renderHarness({ onClose })
    act(() => {
      getApi().open()
    })
    act(() => {
      fake.closeByUser()
      vi.runOnlyPendingTimers()
    })
    expect(getApi().isOpen).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('reports blocked popups', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const onBlocked = vi.fn()
    const getApi = renderHarness({ onBlocked })
    let result: Window | null = fake.win
    act(() => {
      result = getApi().open()
    })
    expect(result).toBeNull()
    expect(getApi().isBlocked).toBe(true)
    expect(getApi().isOpen).toBe(false)
    expect(onBlocked).toHaveBeenCalledTimes(1)
  })

  it('reports blocked when the popup document is not scriptable (sandboxed embedder)', () => {
    let closed = false
    const sandboxedWin = {
      get document(): Document {
        throw new DOMException(
          'Blocked a frame with origin "null" from accessing a cross-origin frame.',
          'SecurityError',
        )
      },
      get closed() {
        return closed
      },
      close() {
        closed = true
      },
    } as unknown as Window
    vi.spyOn(window, 'open').mockReturnValue(sandboxedWin)

    const onBlocked = vi.fn()
    const getApi = renderHarness({ onBlocked })
    let result: Window | null = sandboxedWin
    act(() => {
      result = getApi().open()
    })
    expect(result).toBeNull()
    expect(getApi().isBlocked).toBe(true)
    expect(getApi().isOpen).toBe(false)
    expect(onBlocked).toHaveBeenCalledTimes(1)
    expect(closed).toBe(true)
  })

  it('renders into the page given by url once it has loaded', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    const getApi = renderHarness({ url: '/popup.html', title: 'Loaded panel', onOpen })
    act(() => {
      getApi().open()
    })
    expect(window.open).toHaveBeenCalledWith('/popup.html', '_blank', expect.any(String))
    expect(getApi().isOpen).toBe(true)
    expect(getApi().popupWindow).toBe(fake.win)

    // Still on the initial about:blank document: nothing is rendered yet.
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(fake.doc.querySelector('[data-popup-window-root]')).toBeNull()
    expect(onOpen).not.toHaveBeenCalled()

    // The page has replaced it but is still parsing.
    const page = fake.navigate('http://localhost/popup.html')
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(page.querySelector('[data-popup-window-root]')).toBeNull()

    const write = vi.spyOn(page, 'write')
    fake.finishLoading()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(write).not.toHaveBeenCalled()
    expect(page.title).toBe('Loaded panel')
    expect(page.body.textContent).toContain('hello from popup')
    expect(onOpen).toHaveBeenCalledWith(fake.win)
    vi.useRealTimers()
  })

  it('close() before the url page has loaded leaves nothing behind', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const getApi = renderHarness({ url: '/popup.html', onOpen, onClose })
    act(() => {
      getApi().open()
    })
    act(() => {
      getApi().close()
    })
    expect(getApi().isOpen).toBe(false)
    expect(fake.win.closed).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)

    const page = fake.navigate('http://localhost/popup.html')
    fake.finishLoading()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(page.querySelector('[data-popup-window-root]')).toBeNull()
    expect(onOpen).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('reports blocked when the url page ends up on another origin', () => {
    vi.useFakeTimers()
    const onBlocked = vi.fn()
    const onClose = vi.fn()
    const getApi = renderHarness({ url: '/popup.html', onBlocked, onClose })
    act(() => {
      getApi().open()
    })
    expect(getApi().isOpen).toBe(true)

    fake.makeUnscriptable()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(getApi().isOpen).toBe(false)
    expect(getApi().isBlocked).toBe(true)
    expect(fake.win.closed).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onBlocked).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  describe('with a linked stylesheet in the opener', () => {
    let openerLink: HTMLLinkElement

    beforeEach(() => {
      openerLink = document.createElement('link')
      openerLink.rel = 'stylesheet'
      openerLink.href = '/app.css'
      document.head.appendChild(openerLink)
    })

    afterEach(() => {
      openerLink.remove()
    })

    // jsdom does not load stylesheets: the popup's copy stays pending until a
    // test dispatches `load` or `error` on it.
    const popupLink = () => fake.doc.head.querySelector('link')!

    it('renders once the copied stylesheet has loaded', () => {
      const onOpen = vi.fn()
      const getApi = renderHarness({ onOpen })
      act(() => {
        getApi().open()
      })
      expect(getApi().isOpen).toBe(true)
      expect(fake.doc.body.textContent).not.toContain('hello from popup')
      expect(onOpen).not.toHaveBeenCalled()

      act(() => {
        popupLink().dispatchEvent(new Event('load'))
      })
      expect(fake.doc.body.textContent).toContain('hello from popup')
      expect(onOpen).toHaveBeenCalledWith(fake.win)
    })

    it('renders when the copied stylesheet fails to load', () => {
      const getApi = renderHarness()
      act(() => {
        getApi().open()
      })
      act(() => {
        popupLink().dispatchEvent(new Event('error'))
      })
      expect(fake.doc.body.textContent).toContain('hello from popup')
    })

    it('renders after 3 seconds when the copied stylesheet never loads', () => {
      vi.useFakeTimers()
      const getApi = renderHarness()
      act(() => {
        getApi().open()
      })
      act(() => {
        vi.advanceTimersByTime(2999)
      })
      expect(fake.doc.body.textContent).not.toContain('hello from popup')
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(fake.doc.body.textContent).toContain('hello from popup')
      vi.useRealTimers()
    })

    it('close() while the stylesheet loads leaves nothing behind', () => {
      const onOpen = vi.fn()
      const getApi = renderHarness({ onOpen })
      act(() => {
        getApi().open()
      })
      const link = popupLink()
      act(() => {
        getApi().close()
      })
      act(() => {
        link.dispatchEvent(new Event('load'))
      })
      expect(getApi().isOpen).toBe(false)
      expect(fake.doc.body.textContent).not.toContain('hello from popup')
      expect(onOpen).not.toHaveBeenCalled()
    })

    it('renders at once with copyStyles: false', () => {
      const getApi = renderHarness({ copyStyles: false })
      act(() => {
        getApi().open()
      })
      expect(fake.doc.head.querySelector('link')).toBeNull()
      expect(fake.doc.body.textContent).toContain('hello from popup')
    })
  })

  it('closes the popup when the owning component unmounts', () => {
    const getApi = renderHarness()
    act(() => {
      getApi().open()
    })
    cleanup()
    expect(fake.win.closed).toBe(true)
  })

  it('popup content shares state with the opener tree', () => {
    function Shared() {
      const [count, setCount] = useState(0)
      const { open, Popup } = usePopupWindow()
      useEffect(() => {
        open()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return (
        <>
          <span data-testid="parent-count">{count}</span>
          <Popup>
            <button onClick={() => setCount((c) => c + 1)}>inc</button>
            <span data-testid="popup-count">{count}</span>
          </Popup>
        </>
      )
    }
    render(<Shared />)
    const button = fake.doc.querySelector('button')!
    act(() => {
      button.click()
    })
    expect(screen.getByTestId('parent-count').textContent).toBe('1')
    expect(fake.doc.querySelector('[data-testid="popup-count"]')!.textContent).toBe('1')
  })
})
