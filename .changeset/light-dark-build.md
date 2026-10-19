---
"@jielga/tmdatagrid": patch
---

The pinned-lane edge band, the filter pills and the match highlight get their colours back in the built stylesheet.
`light-dark()` was lowered by the library build into an invalid declaration, so every dev server showed them and `dist/styles.css` did not.
