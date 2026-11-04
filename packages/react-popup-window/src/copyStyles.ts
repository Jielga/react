/**
 * Copy all stylesheets from `source` into `target` and (optionally) keep them
 * in sync while the popup is open:
 *
 * - `<link rel="stylesheet">` and `<style>` elements are mirrored into the
 *   target `<head>`. `<style>` contents are serialized from the CSSOM when
 *   possible, so rules injected via `insertRule` are included.
 * - Rules added to or removed from a `<style>` sheet later with
 *   `insertRule`/`deleteRule` are applied to its mirror as they happen. This
 *   is how CSS-in-JS libraries (Emotion, styled-components) add rules in
 *   production builds, and it changes no DOM.
 * - Additions/removals/edits of style nodes in the source `<head>` are
 *   observed (covers Vite HMR, lazily loaded chunk CSS, CSS-in-JS in
 *   development builds).
 * - A `<link>` added while watching is loaded by the target again. Until
 *   that copy has loaded, the rules the source already loaded are applied
 *   to the target through a constructed stylesheet.
 * - `class`/`style`/`data-*` attributes on `<html>` and `<body>` are mirrored
 *   and kept in sync, so theme switching (e.g. a `dark` class) propagates.
 * - `document.adoptedStyleSheets` are re-constructed in the target document.
 *
 * Returns a function that stops observing.
 */
export function copyStyles(source: Document, target: Document, watch = true): () => void {
  return mirrorStyles(source, target, watch).stop
}

type RuleChange = { type: 'insert'; rule: string; index: number } | { type: 'delete'; index: number }
type RuleListener = (change: RuleChange) => void

const ruleListeners = new WeakMap<CSSStyleSheet, Set<RuleListener>>()

/**
 * Calls `listener` after each `insertRule`/`deleteRule` call on `sheet`.
 * Wraps the two methods on this sheet object only, not on the prototype, and
 * restores them once the sheet's last listener is removed. Returns a function
 * that removes the listener.
 */
function onRuleChange(sheet: CSSStyleSheet, listener: RuleListener): () => void {
  let listeners = ruleListeners.get(sheet)
  if (!listeners) {
    const all = new Set<RuleListener>()
    listeners = all
    ruleListeners.set(sheet, all)
    const proto = Object.getPrototypeOf(sheet) as CSSStyleSheet
    sheet.insertRule = function (this: CSSStyleSheet, rule: string, index?: number): number {
      const inserted = proto.insertRule.call(this, rule, index)
      for (const notify of [...all]) notify({ type: 'insert', rule, index: inserted })
      return inserted
    }
    sheet.deleteRule = function (this: CSSStyleSheet, index: number): void {
      proto.deleteRule.call(this, index)
      for (const notify of [...all]) notify({ type: 'delete', index })
    }
  }
  const own = listeners
  own.add(listener)
  return () => {
    own.delete(listener)
    if (own.size > 0) return
    ruleListeners.delete(sheet)
    const wrapped = sheet as { insertRule?: unknown; deleteRule?: unknown }
    delete wrapped.insertRule
    delete wrapped.deleteRule
  }
}

/** Attributes copied from a source `<link>` onto its mirror. */
const LINK_ATTRS = ['rel', 'media', 'title', 'crossorigin', 'referrerpolicy', 'integrity']

export interface StyleMirror {
  /** Stops observing the source document. */
  stop: () => void
  /**
   * The `<link>` elements created in `target` by the initial copy. The target
   * fetches each of them asynchronously.
   */
  links: HTMLLinkElement[]
}

/** {@link copyStyles}, plus the `<link>` elements the initial copy created. */
export function mirrorStyles(source: Document, target: Document, watch = true): StyleMirror {
  const mirrors = new Map<Element, Element>()
  const observing = watch && typeof MutationObserver !== 'undefined'

  const isStyleNode = (node: Node): node is HTMLStyleElement | HTMLLinkElement => {
    if (node.nodeType !== Node.ELEMENT_NODE) return false
    const el = node as Element
    return (
      el.tagName === 'STYLE' ||
      (el.tagName === 'LINK' && (el.getAttribute('rel') ?? '').toLowerCase().includes('stylesheet'))
    )
  }

  const serializeStyle = (el: HTMLStyleElement): string => {
    const sheet = el.sheet
    if (sheet) {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n')
      } catch {
        // Inaccessible cssRules — fall back to the raw text below.
      }
    }
    return el.textContent ?? ''
  }

  interface RuleSync {
    sheet: CSSStyleSheet
    /** Rule count of `sheet` that the mirror reflects. */
    count: number
    stop: () => void
  }
  const ruleSyncs = new Map<HTMLStyleElement, RuleSync>()

  // CSS-in-JS libraries in production builds add rules with insertRule, which
  // changes no DOM. Apply each change to the mirror as it happens, so content
  // that renders in the same task, such as the popup's first render, is
  // already styled.
  const syncRules = (el: HTMLStyleElement, clone: HTMLStyleElement): void => {
    const sheet = el.sheet
    const current = ruleSyncs.get(el)
    if (current && current.sheet === sheet) {
      current.count = sheet.cssRules.length
      return
    }
    current?.stop()
    ruleSyncs.delete(el)
    if (!observing || !sheet) return
    const sync: RuleSync = {
      sheet,
      count: sheet.cssRules.length,
      stop: onRuleChange(sheet, (change) => {
        const copy = clone.sheet
        try {
          if (copy) {
            if (change.type === 'insert') copy.insertRule(change.rule, change.index)
            else copy.deleteRule(change.index)
            if (copy.cssRules.length === sheet.cssRules.length) {
              sync.count = sheet.cssRules.length
              return
            }
          }
        } catch {
          // Out of step with the source - copy the whole sheet again below.
        }
        refresh(el)
      }),
    }
    ruleSyncs.set(el, sync)
  }

  const unsyncRules = (el: Element): void => {
    ruleSyncs.get(el as HTMLStyleElement)?.stop()
    ruleSyncs.delete(el as HTMLStyleElement)
  }

  // A <link> added while watching, such as lazily loaded chunk CSS: the
  // target loads its copy separately, and content that waits only for the
  // source's copy, as bundlers do, can render before the target's has
  // loaded. Until it has, apply the rules the source already parsed through a
  // constructed sheet. `baseURL` keeps relative url()s resolving against the
  // stylesheet. Adopted sheets come last in the cascade, which can change
  // precedence for that short time. Unreadable cross-origin sheets are left
  // to load normally.
  const unbridgeLinks = new Map<Element, () => void>()
  const bridgeLink = (el: HTMLLinkElement, clone: HTMLLinkElement): void => {
    const view = target.defaultView as (Window & typeof globalThis) | null
    if (!view || typeof view.CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in target)) {
      return
    }
    if (/\balternate\b/i.test(el.rel)) return
    let bridge: CSSStyleSheet | null = null
    const add = (): void => {
      if (clone.sheet !== null || !el.sheet) return
      try {
        const text = Array.from(el.sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n')
        const sheet = new view.CSSStyleSheet({ baseURL: el.href, media: el.media || undefined })
        sheet.replaceSync(text)
        target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet]
        bridge = sheet
      } catch {
        // Cross-origin rules or no constructable stylesheets - wait for the copy.
      }
    }
    const remove = (): void => {
      el.removeEventListener('load', add)
      clone.removeEventListener('load', remove)
      clone.removeEventListener('error', remove)
      unbridgeLinks.delete(el)
      const sheet = bridge
      if (sheet) target.adoptedStyleSheets = target.adoptedStyleSheets.filter((s) => s !== sheet)
      bridge = null
    }
    clone.addEventListener('load', remove)
    clone.addEventListener('error', remove)
    unbridgeLinks.set(el, remove)
    if (el.sheet) add()
    else el.addEventListener('load', add)
  }

  // True during the initial copy. `usePopupWindow` waits for those links
  // itself before rendering.
  let copying = true

  const mirror = (el: HTMLStyleElement | HTMLLinkElement): void => {
    if (mirrors.has(el)) return
    let clone: Element
    if (el.tagName === 'LINK') {
      const link = target.createElement('link')
      // `rel` is copied as is, so an alternate stylesheet stays disabled.
      // `crossorigin` and `referrerpolicy` make the popup send the same request
      // as the opener, so it can reuse the cached response.
      for (const name of LINK_ATTRS) {
        const value = el.getAttribute(name)
        if (value !== null) link.setAttribute(name, value)
      }
      // .href resolves to an absolute URL, so relative hrefs keep working
      // from the popup's `about:blank` document.
      link.href = (el as HTMLLinkElement).href
      clone = link
    } else {
      const style = target.createElement('style')
      style.textContent = serializeStyle(el as HTMLStyleElement)
      const media = el.getAttribute('media')
      if (media) style.setAttribute('media', media)
      clone = style
    }
    target.head.appendChild(clone)
    mirrors.set(el, clone)
    if (el.tagName === 'STYLE') syncRules(el as HTMLStyleElement, clone as HTMLStyleElement)
    else if (!copying && observing) bridgeLink(el as HTMLLinkElement, clone as HTMLLinkElement)
  }

  const refresh = (el: HTMLStyleElement): void => {
    const clone = mirrors.get(el)
    if (!clone) return
    clone.textContent = serializeStyle(el)
    // New text gives the source a new sheet object.
    syncRules(el, clone as HTMLStyleElement)
  }

  const unmirrorSubtree = (removed: Node): void => {
    for (const [src, clone] of mirrors) {
      if (removed === src || (removed.nodeType === Node.ELEMENT_NODE && removed.contains(src))) {
        clone.remove()
        mirrors.delete(src)
        unsyncRules(src)
        unbridgeLinks.get(src)?.()
      }
    }
  }

  const ROOT_ATTRS = ['class', 'style']
  const syncRootAttrs = (): void => {
    const pairs: Array<[Element | null, Element | null]> = [
      [source.documentElement, target.documentElement],
      [source.body, target.body],
    ]
    for (const [from, to] of pairs) {
      if (!from || !to) continue
      for (const attr of from.attributes) {
        if (ROOT_ATTRS.includes(attr.name) || attr.name.startsWith('data-')) {
          to.setAttribute(attr.name, attr.value)
        }
      }
      for (const attr of Array.from(to.attributes)) {
        if (
          (ROOT_ATTRS.includes(attr.name) || attr.name.startsWith('data-')) &&
          !from.hasAttribute(attr.name)
        ) {
          to.removeAttribute(attr.name)
        }
      }
    }
  }

  const syncAdoptedSheets = (): void => {
    const targetWindow = target.defaultView as (Window & { CSSStyleSheet?: typeof CSSStyleSheet }) | null
    if (!targetWindow?.CSSStyleSheet || !('adoptedStyleSheets' in source)) return
    try {
      target.adoptedStyleSheets = source.adoptedStyleSheets.map((sheet) => {
        const copy = new targetWindow.CSSStyleSheet!()
        copy.replaceSync(
          Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n'),
        )
        return copy
      })
    } catch {
      // Best effort — older browsers or cross-origin rules.
    }
  }

  for (const el of source.querySelectorAll('style, link[rel~="stylesheet" i]')) {
    mirror(el as HTMLStyleElement | HTMLLinkElement)
  }
  copying = false
  const links = Array.from(mirrors.values()).filter(
    (clone): clone is HTMLLinkElement => clone.tagName === 'LINK',
  )
  syncRootAttrs()
  syncAdoptedSheets()

  if (!observing) {
    return { stop: () => {}, links }
  }

  const headObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') {
        const parent = record.target.parentElement
        if (parent?.tagName === 'STYLE') refresh(parent as HTMLStyleElement)
        continue
      }
      // childList
      if (isStyleNode(record.target) && record.target.tagName === 'STYLE') {
        // textContent assignment replaces the text node → childList on <style>
        refresh(record.target as HTMLStyleElement)
      }
      for (const added of record.addedNodes) {
        if (isStyleNode(added)) {
          mirror(added)
        } else if (added.nodeType === Node.ELEMENT_NODE) {
          for (const el of (added as Element).querySelectorAll('style, link[rel~="stylesheet" i]')) {
            mirror(el as HTMLStyleElement | HTMLLinkElement)
          }
        }
      }
      for (const removed of record.removedNodes) {
        unmirrorSubtree(removed)
      }
    }
  })
  headObserver.observe(source.head, { childList: true, subtree: true, characterData: true })

  const rootObserver = new MutationObserver(() => syncRootAttrs())
  rootObserver.observe(source.documentElement, { attributes: true })
  if (source.body) rootObserver.observe(source.body, { attributes: true })

  // Fallback for rule changes that bypass the sheet's own methods, such as
  // CSSStyleSheet.prototype.insertRule.call(sheet, ...): once per frame of the
  // target window, copy again any sheet whose rule count changed.
  const view = target.defaultView
  let frame: number | undefined
  const checkRuleCounts = (): void => {
    for (const [el, sync] of ruleSyncs) {
      if (el.sheet === sync.sheet && sync.sheet.cssRules.length !== sync.count) refresh(el)
    }
    frame = view?.requestAnimationFrame(checkRuleCounts)
  }
  if (view && typeof view.requestAnimationFrame === 'function') {
    frame = view.requestAnimationFrame(checkRuleCounts)
  }

  return {
    stop: () => {
      headObserver.disconnect()
      rootObserver.disconnect()
      if (frame !== undefined) view?.cancelAnimationFrame(frame)
      for (const sync of ruleSyncs.values()) sync.stop()
      for (const remove of [...unbridgeLinks.values()]) remove()
      ruleSyncs.clear()
    },
    links,
  }
}
