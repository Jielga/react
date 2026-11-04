import { describe, expect, it } from 'vitest'
import { copyStyles, mirrorStyles } from './copyStyles'

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0))

function createTarget(): Document {
  return document.implementation.createHTMLDocument('popup')
}

function addStyle(css: string): HTMLStyleElement {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  return style
}

/**
 * The document of an iframe: unlike `createHTMLDocument`, jsdom gives it a
 * CSSOM and `requestAnimationFrame`, as a popup window has.
 */
function createWindowTarget(): { target: Document; nextFrame: () => Promise<void>; remove: () => void } {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  const view = iframe.contentWindow!
  return {
    target: iframe.contentDocument!,
    nextFrame: () => new Promise((resolve) => view.requestAnimationFrame(() => resolve())),
    remove: () => iframe.remove(),
  }
}

/** Rules of every <style> in `target`, read from the CSSOM. */
function mirroredRules(target: Document): string[] {
  return Array.from(target.head.querySelectorAll('style')).flatMap((el) =>
    Array.from(el.sheet?.cssRules ?? []).map((rule) => rule.cssText),
  )
}

describe('copyStyles', () => {
  it('copies existing <style> elements into the target head', () => {
    const style = addStyle('.a { color: red; }')
    const target = createTarget()
    const stop = copyStyles(document, target, false)

    const copied = target.head.querySelectorAll('style')
    expect(copied.length).toBeGreaterThanOrEqual(1)
    expect(Array.from(copied).some((el) => el.textContent?.includes('color: red'))).toBe(true)

    stop()
    style.remove()
  })

  it('copies <link rel="stylesheet"> with absolute href', () => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/styles/app.css'
    document.head.appendChild(link)
    const target = createTarget()
    const stop = copyStyles(document, target, false)

    const copied = target.head.querySelector('link[rel="stylesheet"]') as HTMLLinkElement
    expect(copied).not.toBeNull()
    expect(copied.getAttribute('href')).toMatch(/^https?:\/\/.+\/styles\/app\.css$/)

    stop()
    link.remove()
  })

  it('copies the attributes that shape the <link> request and whether it applies', () => {
    const link = document.createElement('link')
    link.rel = 'alternate stylesheet'
    link.title = 'High contrast'
    link.href = '/styles/contrast.css'
    link.media = 'screen'
    link.setAttribute('crossorigin', '')
    link.setAttribute('referrerpolicy', 'no-referrer')
    document.head.appendChild(link)
    const target = createTarget()
    const stop = copyStyles(document, target, false)

    const copied = target.head.querySelector('link') as HTMLLinkElement
    expect(copied.rel).toBe('alternate stylesheet')
    expect(copied.title).toBe('High contrast')
    expect(copied.media).toBe('screen')
    expect(copied.getAttribute('crossorigin')).toBe('')
    expect(copied.getAttribute('referrerpolicy')).toBe('no-referrer')

    stop()
    link.remove()
  })

  it('mirrorStyles returns the <link> elements it created', () => {
    const style = addStyle('.a { color: red; }')
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/styles/app.css'
    document.head.appendChild(link)
    const target = createTarget()
    const { stop, links } = mirrorStyles(document, target, false)

    expect(links).toEqual([target.head.querySelector('link')])

    stop()
    style.remove()
    link.remove()
  })

  it('mirrors added and removed style nodes while watching', async () => {
    const target = createTarget()
    const stop = copyStyles(document, target)

    const style = addStyle('.late { display: none; }')
    await nextTick()
    expect(
      Array.from(target.head.querySelectorAll('style')).some((el) =>
        el.textContent?.includes('.late'),
      ),
    ).toBe(true)

    style.remove()
    await nextTick()
    expect(
      Array.from(target.head.querySelectorAll('style')).some((el) =>
        el.textContent?.includes('.late'),
      ),
    ).toBe(false)

    stop()
  })

  it('updates the mirror when style text changes (HMR)', async () => {
    const style = addStyle('.hmr { color: blue; }')
    const target = createTarget()
    const stop = copyStyles(document, target)

    style.textContent = '.hmr { color: green; }'
    await nextTick()
    expect(
      Array.from(target.head.querySelectorAll('style')).some((el) =>
        el.textContent?.includes('color: green'),
      ),
    ).toBe(true)

    stop()
    style.remove()
  })

  // CSS-in-JS libraries add rules this way in production builds. The rules
  // must reach the mirror in the same task, before the content that uses
  // them renders.
  it('applies insertRule and deleteRule on a <style> sheet to the mirror at once', () => {
    const style = addStyle('.a { color: red; }')
    const { target, remove } = createWindowTarget()
    const stop = copyStyles(document, target)

    style.sheet!.insertRule('.b { color: blue; }', 1)
    expect(mirroredRules(target)).toEqual(
      expect.arrayContaining(['.a { color: red; }', '.b { color: blue; }']),
    )

    style.sheet!.deleteRule(0)
    expect(mirroredRules(target)).not.toContain('.a { color: red; }')
    expect(mirroredRules(target)).toContain('.b { color: blue; }')

    stop()
    style.remove()
    remove()
  })

  it('forwards rules to every mirror and restores the sheet methods after the last stop', () => {
    const style = addStyle('.a { color: red; }')
    const sheet = style.sheet!
    const first = createWindowTarget()
    const second = createWindowTarget()
    const stopFirst = copyStyles(document, first.target)
    const stopSecond = copyStyles(document, second.target)

    sheet.insertRule('.b { color: blue; }', 1)
    expect(mirroredRules(first.target)).toContain('.b { color: blue; }')
    expect(mirroredRules(second.target)).toContain('.b { color: blue; }')

    stopFirst()
    sheet.insertRule('.c { color: green; }', 2)
    expect(mirroredRules(first.target)).not.toContain('.c { color: green; }')
    expect(mirroredRules(second.target)).toContain('.c { color: green; }')

    stopSecond()
    expect(Object.hasOwn(sheet, 'insertRule')).toBe(false)
    expect(Object.hasOwn(sheet, 'deleteRule')).toBe(false)
    style.remove()
    first.remove()
    second.remove()
  })

  it('copies a sheet again on the next frame when its rules change without its own methods', async () => {
    const style = addStyle('.a { color: red; }')
    const { target, nextFrame, remove } = createWindowTarget()
    const stop = copyStyles(document, target)

    CSSStyleSheet.prototype.insertRule.call(style.sheet!, '.b { color: blue; }', 1)
    expect(mirroredRules(target)).not.toContain('.b { color: blue; }')
    await nextFrame()
    expect(mirroredRules(target)).toContain('.b { color: blue; }')

    stop()
    style.remove()
    remove()
  })

  it('mirrors class attributes on <html> and <body>', async () => {
    document.documentElement.classList.add('dark')
    const target = createTarget()
    const stop = copyStyles(document, target)

    expect(target.documentElement.classList.contains('dark')).toBe(true)

    document.documentElement.classList.remove('dark')
    document.body.classList.add('compact')
    await nextTick()
    expect(target.documentElement.classList.contains('dark')).toBe(false)
    expect(target.body.classList.contains('compact')).toBe(true)

    stop()
    document.body.classList.remove('compact')
  })
})
