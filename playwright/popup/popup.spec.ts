import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test as baseTest } from '@playwright/test'
import { expect, test } from '../support/test'
import type { Page } from '@playwright/test'
import { generatePeople } from '../../apps/popup-docs/src/examples/people'

const PEOPLE_12 = generatePeople(12)
const PEOPLE_400 = generatePeople(400)

test.beforeEach(async ({ page }) => {
  await page.goto('./')
})

async function openPopup(page: Page, openTestId: string): Promise<Page> {
  const popupPromise = page.waitForEvent('popup')
  await page.getByTestId(openTestId).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  return popup
}

test('counter: events and state work across windows', async ({ page }) => {
  const popup = await openPopup(page, 'open-counter')

  await expect(popup.getByTestId('popup-count')).toHaveText('0')
  await popup.getByTestId('increment').click()
  await popup.getByTestId('increment').click()

  // The click in the popup updated state owned by the main window.
  await expect(popup.getByTestId('popup-count')).toHaveText('2')
  await expect(page.getByTestId('parent-count')).toHaveText('2')

  // Styles were copied - the button is not an unstyled default.
  const radius = await popup
    .getByTestId('increment')
    .evaluate((el) => getComputedStyle(el).borderRadius)
  expect(radius).toBe('6px')

  await page.getByTestId('close-counter').click()
  await expect.poll(() => popup.isClosed()).toBe(true)
})

test('data grid detaches into popup with TanStack Query and Mantine context intact', async ({
  page,
}) => {
  const grid = page.getByTestId('people-grid')
  await expect(grid).toBeVisible()
  await expect(grid.getByText(PEOPLE_12[0].name)).toBeVisible()

  const popup = await openPopup(page, 'open-table')

  // Main window hides the grid and shows the note.
  await expect(page.getByTestId('table-detached-note')).toBeVisible()
  await expect(page.getByTestId('people-grid')).toHaveCount(0)

  // The TMDataGrid renders in the popup with data from useQuery.
  await expect(popup.getByTestId('people-grid')).toBeVisible()
  await expect(popup.getByText(PEOPLE_12[0].name)).toBeVisible()
  await expect(popup.getByText(PEOPLE_12[11].name)).toBeVisible()

  // Refetch goes through the QueryClientProvider mounted in the main window.
  await popup.getByRole('button', { name: /Refetch/ }).click()
  await expect(popup.getByRole('button', { name: /Refetch/ })).toBeEnabled()

  // Bring it back: popup closes, inline grid returns.
  await page.getByTestId('bring-back').click()
  await expect(page.getByTestId('people-grid')).toBeVisible()
  await expect.poll(() => popup.isClosed()).toBe(true)
})

test('columns can be resized by dragging inside the popup window', async ({ page }) => {
  const popup = await openPopup(page, 'open-table')
  const grid = popup.getByTestId('people-grid')
  await expect(grid).toBeVisible()
  await grid.scrollIntoViewIfNeeded()

  // A pointer drag started in the popup only works when the grid attaches its
  // move/up listeners to the POPUP document. Attached to the opener's document
  // - the bare `document` global - the drag is dead in the popup.
  const header = grid.getByRole('columnheader').nth(1)
  const separator = header.locator('[class*="columnSeparator"]')
  const before = await header.boundingBox()
  const handle = await separator.boundingBox()
  if (!before || !handle) throw new Error('header or resize handle not rendered')

  await popup.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await popup.mouse.down()
  await popup.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2, { steps: 5 })
  await popup.mouse.move(handle.x + handle.width / 2 + 80, handle.y + handle.height / 2, { steps: 5 })
  await popup.mouse.up()

  await expect.poll(async () => (await header.boundingBox())?.width ?? 0).toBeGreaterThan(
    before.width + 50,
  )
})

test('closing the popup window itself restores the main window grid', async ({ page }) => {
  const popup = await openPopup(page, 'open-table')
  await expect(page.getByTestId('table-detached-note')).toBeVisible()

  await popup.close()

  await expect(page.getByTestId('people-grid')).toBeVisible()
  await expect(page.getByTestId('table-detached-note')).toHaveCount(0)
})

test('panels: popped-out grid follows filters edited in the main window', async ({ page }) => {
  // Inline to start: the results grid renders in the right panel.
  const host = page.getByTestId('results-host')
  await expect(host).toBeVisible()
  await expect(host.getByText('400 / 400')).toBeVisible()
  await expect(host.getByText(PEOPLE_400[0].name)).toBeVisible()

  const popup = await openPopup(page, 'open-results')

  // The popup loads the site's empty popup.html instead of about:blank.
  await expect(popup).toHaveURL(/^http:\/\/[^/]+\/popup\.html$/)

  // The right panel collapses to the control strip; the grid now lives in the popup.
  await expect(page.getByTestId('panel-strip')).toBeVisible()
  await expect(page.getByTestId('results-host')).toHaveCount(0)
  await expect(popup.getByText('400 / 400')).toBeVisible()
  await expect(popup.getByText(PEOPLE_400[0].name)).toBeVisible()

  // Filter from the MAIN window - the popped-out grid updates live.
  const needle = 'lindqvist'
  const byName = PEOPLE_400.filter((p) => p.name.toLowerCase().includes(needle)).length
  expect(byName).toBeGreaterThan(0)
  await page.getByTestId('filter-search').fill(needle)
  await expect(popup.getByText(`${byName} / ${byName}`)).toBeVisible()

  await page.getByTestId('filter-search').fill('')
  const engineersActive = PEOPLE_400.filter(
    (p) => p.role === 'Engineer' && p.status === 'active',
  ).length
  await page.getByTestId('filter-role').selectOption('Engineer')
  await page.getByTestId('filter-active').check()
  await expect(popup.getByText(`${engineersActive} / ${engineersActive}`)).toBeVisible()

  // Bring it back via the strip: popup closes, panel expands with the grid inline.
  await page.getByTestId('panel-bring-back').click()
  await expect.poll(() => popup.isClosed()).toBe(true)
  await expect(page.getByTestId('panel-strip')).toHaveCount(0)
  await expect(
    page.getByTestId('results-host').getByText(`${engineersActive} / ${engineersActive}`),
  ).toBeVisible()
})

test('mantine popovers opened from the popped-out grid stay in the popup window', async ({
  page,
}) => {
  const popup = await openPopup(page, 'open-results')
  await expect(popup.getByText(PEOPLE_400[0].name)).toBeVisible()

  // The column manager popover portals - thanks to the SameWindowPortals
  // wrapper it must land in the POPUP document, not the main window's body.
  await popup.getByRole('button', { name: 'Menu' }).click()
  await expect(popup.getByText('Show/Hide All')).toBeVisible()
  await expect(page.getByText('Show/Hide All')).toHaveCount(0)
})

test('mantine modal opened from the popped-out grid stays in the popup window', async ({
  page,
}) => {
  const popup = await openPopup(page, 'open-table')
  await expect(popup.getByText(PEOPLE_12[0].name)).toBeVisible()

  await popup.getByTestId('open-details').click()

  // The Modal portals - with the SameWindowPortals wrapper it must render in
  // the POPUP document, not in the main window's body.
  await expect(popup.getByTestId('details-body')).toBeVisible()
  await expect(page.getByTestId('details-body')).toHaveCount(0)

  // Escape closes it. Mantine binds its Escape handler on the opener window,
  // so this passes only because the example listens on the popup window too.
  await popup.keyboard.press('Escape')
  await expect(popup.getByTestId('details-body')).toHaveCount(0)
})

test('dark mode switched in the main window propagates to the popup', async ({ page }) => {
  const popup = await openPopup(page, 'open-counter')

  // Mantine keeps the radio itself hidden; its label is what takes the click.
  await page.locator('label').filter({ hasText: /^Dark$/ }).click()
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked()
  await expect
    .poll(() =>
      popup.evaluate(() => document.documentElement.getAttribute('data-mantine-color-scheme')),
    )
    .toBe('dark')

  const bg = await popup.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(36, 36, 36)') // --mantine-color-body in dark mode
})

for (const openTestId of ['open-counter', 'open-results']) {
  test(`${openTestId}: popup document lays out in standards mode`, async ({ page }) => {
    const popup = await openPopup(page, openTestId)
    await expect(popup.locator('[data-popup-window-root] > *').first()).toBeAttached()
    expect(await popup.evaluate(() => document.compatMode)).toBe('CSS1Compat')
  })
}

test('rules inserted into an opener <style> after opening apply in the popup at once', async ({
  page,
}) => {
  // CSS-in-JS libraries in production builds keep one <style> per app and
  // add each component's rules with insertRule the first time it renders.
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.id = 'css-in-js'
    style.textContent = '.unused {}'
    document.head.appendChild(style)
  })
  const popup = await openPopup(page, 'open-counter')

  // Inserted and read in one synchronous call: no frame passes in between.
  const outline = await popup.getByTestId('popup-count').evaluate((el) => {
    const sheet = (window.opener as Window).document.querySelector<HTMLStyleElement>('#css-in-js')!
      .sheet!
    sheet.insertRule(
      '[data-testid="popup-count"] { outline: 3px solid rgb(255, 0, 0) }',
      sheet.cssRules.length,
    )
    return getComputedStyle(el).outlineColor
  })
  expect(outline).toBe('rgb(255, 0, 0)')
})

test('a <link> added while the popup is open applies before the popup has loaded it', async ({
  page,
}) => {
  // Lazily loaded chunk CSS: the bundler adds a <link> to the opener and
  // renders the content once the opener has loaded it. The server answers
  // the opener at once and the popup's own copy after 1 s. It tells them
  // apart by the Referer: the `url` popup's page is popup.html. Playwright's
  // request routing cannot be used: it stalls requests from the popup.
  const server = createServer((req, res) => {
    const fromPopup = req.headers.referer?.endsWith('/popup.html') ?? false
    setTimeout(
      () => {
        res.writeHead(200, {
          'content-type': 'text/css',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        })
        res.end('[data-popup-window-root] { outline: 3px solid rgb(255, 0, 0); }')
      },
      fromPopup ? 1000 : 0,
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const href = `http://127.0.0.1:${(server.address() as AddressInfo).port}/chunk.css`
    const popup = await openPopup(page, 'open-results')
    const root = popup.locator('[data-popup-window-root]')
    await expect(root.locator('> *').first()).toBeAttached()
    const adoptedBefore = await popup.evaluate(() => document.adoptedStyleSheets.length)

    await page.evaluate(
      (href) =>
        new Promise((resolve) => {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.crossOrigin = 'anonymous'
          link.referrerPolicy = 'unsafe-url'
          link.href = href
          // The content renders in a later task than the load event.
          link.addEventListener('load', () => setTimeout(resolve, 0))
          document.head.appendChild(link)
        }),
      href,
    )
    const outline = () => root.evaluate((el) => getComputedStyle(el).outlineColor)
    expect(await outline()).toBe('rgb(255, 0, 0)')

    // Once the popup's own copy has loaded, the temporary sheet is removed.
    await expect
      .poll(() => popup.evaluate(() => document.adoptedStyleSheets.length))
      .toBe(adoptedBefore)
    expect(await outline()).toBe('rgb(255, 0, 0)')
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})

interface FirstContentFrame {
  /** Stylesheets of the popup that had not loaded when the frame was painted. */
  pendingStylesheets: string[]
}

type ProbedWindow = Window & { __firstContentFrame?: FirstContentFrame }

/**
 * Records, in the opener, which stylesheets of the next popup had not loaded
 * yet in the first frame that shows popup content. `requestAnimationFrame`
 * callbacks run right before a frame is painted.
 */
async function probeFirstContentFrame(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probed = window as ProbedWindow
    const open = window.open.bind(window)
    window.open = (...args) => {
      const popup = open(...args)
      if (!popup) return popup
      const probe = () => {
        if (popup.closed || probed.__firstContentFrame) return
        const doc = popup.document
        if (doc.querySelector('[data-popup-window-root]')?.childElementCount) {
          probed.__firstContentFrame = {
            pendingStylesheets: Array.from(
              doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'),
            )
              .filter((link) => link.sheet === null)
              .map((link) => link.href),
          }
          return
        }
        popup.requestAnimationFrame(probe)
      }
      // Loading `url` replaces the document and drops its pending frame
      // callbacks, so keep requesting new ones.
      const rearm = window.setInterval(() => {
        if (popup.closed || probed.__firstContentFrame) window.clearInterval(rearm)
        else popup.requestAnimationFrame(probe)
      }, 5)
      probe()
      return popup
    }
  })
}

// The base `test`, without the shared fixtures: they route requests, and once
// a page routes anything, Playwright stalls the requests of a scripted
// about:blank popup - which is the very load these tests time.
baseTest.describe('first popup paint', () => {
  // Vite dev injects CSS as <style>. Production builds use <link>, which the
  // popup loads again after it opens. Serve a slow one to cover that path.
  // Playwright's request routing cannot be used for it: it stalls requests
  // from a scripted about:blank popup.
  let server: Server
  let slowCssUrl: string

  baseTest.beforeEach(async ({ page }) => {
    await page.goto('./')
  })

  baseTest.beforeAll(async () => {
    server = createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' })
        res.end('[data-popup-window-root] { outline: 3px solid rgb(255, 0, 0); }')
      }, 300)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    slowCssUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/slow.css`
  })

  baseTest.afterAll(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  for (const openTestId of ['open-counter', 'open-results']) {
    baseTest(`${openTestId}: linked stylesheets are applied`, async ({ page }) => {
      await page.evaluate(
        (href) =>
          new Promise((resolve) => {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = href
            link.addEventListener('load', resolve)
            document.head.appendChild(link)
          }),
        slowCssUrl,
      )
      await probeFirstContentFrame(page)

      const popup = await openPopup(page, openTestId)

      const frame = await page
        .waitForFunction(() => (window as ProbedWindow).__firstContentFrame ?? null)
        .then((handle) => handle.jsonValue())
      expect(frame?.pendingStylesheets).toEqual([])
      await expect(popup.locator('[data-popup-window-root]')).toHaveCSS(
        'outline-color',
        'rgb(255, 0, 0)',
      )
    })
  }
})
