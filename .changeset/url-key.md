---
"@jielga/tmdatagrid": minor
---

- `persist.urlKey` keeps selected data slices in a URL search param, written with `history.replaceState`.
- `persist.urlStorage` replaces the default URL access, for routers that own the URL.
- `meta.filter.url: false` keeps a column's filter out of the link.
- A global filter cleared over an `initialState.globalFilter` is persisted as cleared; before, a reload came back on the initial value.
- Persistence writes are debounced across re-renders, as intended; before, a re-render wrote at once.
