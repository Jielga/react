import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { whenStylesheetsLoad } from './whenStylesheetsLoad'

// jsdom does not load stylesheets, so every <link> stays pending (`sheet` is
// null) until a test dispatches `load` or `error` on it.
function addLink(attrs: { rel?: string; media?: string } = {}): HTMLLinkElement {
  const link = document.createElement('link')
  link.rel = attrs.rel ?? 'stylesheet'
  link.href = '/app.css'
  if (attrs.media) link.media = attrs.media
  document.head.appendChild(link)
  return link
}

describe('whenStylesheetsLoad', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.head.innerHTML = ''
  })

  it('calls back synchronously when no stylesheet is pending', () => {
    const callback = vi.fn()
    whenStylesheetsLoad([], 3000, callback)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('calls back once every pending stylesheet has loaded or failed', () => {
    const first = addLink()
    const second = addLink()
    const callback = vi.fn()
    whenStylesheetsLoad([first, second], 3000, callback)
    expect(callback).not.toHaveBeenCalled()

    first.dispatchEvent(new Event('load'))
    expect(callback).not.toHaveBeenCalled()

    second.dispatchEvent(new Event('error'))
    expect(callback).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3000)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('calls back after the timeout when a stylesheet never loads', () => {
    const callback = vi.fn()
    whenStylesheetsLoad([addLink()], 3000, callback)
    vi.advanceTimersByTime(2999)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not wait for alternate stylesheets or media that does not match', () => {
    window.matchMedia = vi.fn((query: string) => ({ matches: query !== 'print' }) as MediaQueryList)
    try {
      const callback = vi.fn()
      whenStylesheetsLoad(
        [addLink({ rel: 'alternate stylesheet' }), addLink({ media: 'print' })],
        3000,
        callback,
      )
      expect(callback).toHaveBeenCalledTimes(1)
    } finally {
      // jsdom has no matchMedia of its own.
      delete (window as Partial<Window>).matchMedia
    }
  })

  it('never calls back once stopped', () => {
    const link = addLink()
    const callback = vi.fn()
    const stop = whenStylesheetsLoad([link], 3000, callback)
    stop()
    link.dispatchEvent(new Event('load'))
    vi.advanceTimersByTime(3000)
    expect(callback).not.toHaveBeenCalled()
  })
})
