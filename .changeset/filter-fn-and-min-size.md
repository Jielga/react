---
"@jielga/tmdatagrid": minor
---

- `TMDataGridFilterFn` type, `tmDataGridFilterFn` and `matchesFilter` are exported: a column's own `filterFn` receives the `{ operator, value }` envelope and can delegate to the built-in matcher.
- A column with no `minSize` now has the documented floor of 80 for resizing and pinned widths as well as for its fluid track; TanStack's 20 applied before. Pass `defaultColumn: { minSize }` to change it.
- The empty-state message and `renderEmptyState`'s `hasActiveFilters` now use the same rule as the pills: a half-typed filter no longer counts as active, so an empty grid with the filter panel just opened shows `noRows`, not `noResults`.
