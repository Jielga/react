/**
 * Calls `callback` once every stylesheet in `links` that applies has loaded
 * or failed, or after `timeoutMs`, whichever comes first.
 *
 * When none of them is still loading, `callback` runs synchronously, before
 * this function returns. Links that do not apply are not waited for: an
 * alternate stylesheet, or a `media` query that does not match, such as
 * `print`. Browsers fetch those at the lowest priority.
 *
 * Returns a function that stops waiting without calling `callback`.
 */
export function whenStylesheetsLoad(
  links: readonly HTMLLinkElement[],
  timeoutMs: number,
  callback: () => void,
): () => void {
  const pending = links.filter((link) => link.sheet === null && applies(link))
  if (pending.length === 0) {
    callback()
    return () => {}
  }

  let remaining = pending.length
  const settle = () => {
    remaining--
    if (remaining === 0) finish()
  }
  const stop = () => {
    window.clearTimeout(timeout)
    for (const link of pending) {
      link.removeEventListener('load', settle)
      link.removeEventListener('error', settle)
    }
  }
  const finish = () => {
    stop()
    callback()
  }

  for (const link of pending) {
    link.addEventListener('load', settle)
    // A broken stylesheet must not keep the popup blank.
    link.addEventListener('error', settle)
  }
  const timeout = window.setTimeout(finish, timeoutMs)
  return stop
}

function applies(link: HTMLLinkElement): boolean {
  if (/\balternate\b/i.test(link.rel)) return false
  const view = link.ownerDocument.defaultView
  return !link.media || !view?.matchMedia || view.matchMedia(link.media).matches
}
