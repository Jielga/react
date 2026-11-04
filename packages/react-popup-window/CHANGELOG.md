# @jielga/react-popup-window

## 0.3.1

### Patch Changes

- [#152](https://github.com/Jielga/react/pull/152) [`e9645c4`](https://github.com/Jielga/react/commit/e9645c498530d04d6552b79b31344dda45e4ce4a) Thanks [@Psvensso](https://github.com/Psvensso)! - The package moved into the `Jielga/react` monorepo; the manifest's `repository`, `homepage` and `bugs` fields and the README links point at the new repository and documentation URL.

## 0.3.0

### Minor Changes

- [#149](https://github.com/Jielga/react/pull/149) [`e6a6d80`](https://github.com/Jielga/react/commit/e6a6d805a8a624f60e5030f135dd310c3e36b947) Thanks [@Psvensso](https://github.com/Psvensso)! - Lay out the default `about:blank` popup in standards mode.
  The initial `about:blank` document has no doctype, so the popup was in quirks mode while the app was in standards mode, and some content laid out differently than in the main window.
  The document is now written with an HTML5 doctype before the popup content renders.
  Popup content can lay out slightly differently than before; it now matches the main window.
  In Chromium, `popupWindow.document.URL` now reports the opener's URL instead of `about:blank`; a reload of the popup still loads `about:blank`.

### Patch Changes

- [#149](https://github.com/Jielga/react/pull/149) [`e6a6d80`](https://github.com/Jielga/react/commit/e6a6d805a8a624f60e5030f135dd310c3e36b947) Thanks [@Psvensso](https://github.com/Psvensso)! - Style content that renders right after a stylesheet `<link>` is added while the popup is open.
  Bundlers add lazily loaded chunk CSS as a new `<link>` and render the chunk's content once the opener has loaded it.
  The popup loads its own copy of that `<link>`, so the content could render there unstyled until the copy finished loading.
  Until the popup's copy has loaded, the rules the opener already loaded are now applied to the popup through a constructed stylesheet.
  A cross-origin stylesheet served without CORS cannot be read this way and still loads normally.

## 0.2.1

### Patch Changes

- [`f1b27be`](https://github.com/Jielga/react-popup-window/commit/f1b27be723cd087c75e281b7288b16a7312978a8) Thanks [@Psvensso](https://github.com/Psvensso)! - Copy CSS-in-JS rules into the popup as they are added.
  In production builds, Emotion (including MUI and `@mantine/emotion`) and styled-components add rules with `insertRule()`, which changes no DOM.
  The popup only copied a `<style>` when it opened or when its DOM changed, so components that rendered for the first time inside the popup stayed unstyled until the popup was opened again.
  Rules added to or removed from a `<style>` sheet with `insertRule` and `deleteRule` are now applied to the popup's copy as they happen, before the content that uses them is painted.
  A once-per-frame check also copies a sheet again if its rule count changed in any other way.

## 0.2.0

### Minor Changes

- [`cf5ad79`](https://github.com/Jielga/react-popup-window/commit/cf5ad79f54627c708d47fe0525b305fe3787e2bc) Thanks [@Psvensso](https://github.com/Psvensso)! - Add the `url` option: a same-origin page the popup loads instead of `about:blank`, so the address bar shows the app's own URL.
  `isOpen` turns `true` when the window opens; `Popup` renders once the page has loaded.
  If the page ends up on another origin, the popup closes and is reported through `onBlocked`.

### Patch Changes

- [`0173441`](https://github.com/Jielga/react-popup-window/commit/0173441f3b7bf3f97a7ce22d983e37140ae92c9a) Thanks [@Psvensso](https://github.com/Psvensso)! - Show popup content only once its copied stylesheets have loaded.
  The popup loads each `<link rel="stylesheet">` from the opener again, and `Popup` used to render before that finished, so the first frame showed unstyled content (every time in production builds, where the CSS is a `<link>`).
  `Popup` now renders once those stylesheets have loaded or failed, or after 3 seconds.
  `isOpen` still turns `true` when the window opens; `onOpen` is now called when `Popup` starts rendering, which can be after `open()` returns.
  Copied `<link>` elements now keep `rel`, `title`, `crossorigin`, `referrerpolicy`, and `integrity`, so an alternate stylesheet stays disabled in the popup and the popup sends the same request as the opener.

## 0.1.1

### Patch Changes

- [#3](https://github.com/Jielga/react-popup-window/pull/3) [`f283d4d`](https://github.com/Jielga/react-popup-window/commit/f283d4d9b920812e335236e7d3befb94d4d860d7) Thanks [@Psvensso](https://github.com/Psvensso)! - Document modals and window-bound overlay behavior for popup content.
  The README now states the realm rule (bare `document` is the opener's document, `ownerDocument` of a mounted node is the popup's), inlines the Mantine `SameWindowPortals` wrapper instead of linking a file that is not shipped, covers `withinPortal`, `portalProps` and `target`, gives a general `ownerDocument` recipe for Radix and MUI, and explains why Escape and scroll lock stay bound to the main window (with the popup-window listener workaround).
  The popup-content skill gains a matching mistake entry, the dead `reuseTargetNode: false` prop is removed from the wrapper, and skill source citations now match the README headings.
  The docs site shows a Mantine `Modal` opened from the detached grid, covered by an e2e test.

- [#3](https://github.com/Jielga/react-popup-window/pull/3) [`d8e0a40`](https://github.com/Jielga/react-popup-window/commit/d8e0a405582e34fcacee52fa66f1fef446f685bd) Thanks [@Psvensso](https://github.com/Psvensso)! - Correct the GitHub organization casing in the `repository` and `bugs` URLs, which pointed at `jielga` instead of `Jielga`.

- [#3](https://github.com/Jielga/react-popup-window/pull/3) [`bfb64df`](https://github.com/Jielga/react-popup-window/commit/bfb64dfdca717320867c543ee33265018678f270) Thanks [@Psvensso](https://github.com/Psvensso)! - Treat a popup whose document is not scriptable as blocked.
  Sandboxed embedders (VS Code's built-in browser, CodeSandbox and StackBlitz previews, iframes sandboxed without `allow-popups-to-escape-sandbox`) open popups with an opaque origin, so reading `popupWindow.document` throws.
  `open()` now catches that, closes the stranded window, sets `isBlocked`, calls `onBlocked`, and returns `null` instead of throwing and leaving a blank window behind.
