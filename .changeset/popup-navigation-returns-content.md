---
"@jielga/react-popup-window": patch
---

Reloading the popup or navigating it to another page now ends the popup session like a close: `Popup` renders back in the opener, `onClose` is called, and the window is left open. `close()` and `open()` no longer break after the popup navigated to another origin.
