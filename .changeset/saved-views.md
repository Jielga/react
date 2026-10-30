---
"@jielga/tmdatagrid": minor
---

Saved views: named column layouts the user switches between.

- `views` option: read-only `presets`, `defaultView`, `allowUserViews`, the `slices` a view holds, and a `store` for the user's own views.
- `createLocalStorageViewStore`, or any async `TMDataGridViewStore`.
- `grid.views` / `useTMDataGridViews` with `select`, `restore`, `saveAs`, `overwrite` and `remove`.
- `TMDataGrid.ViewsMenu` and `TMDataGrid.Menu.Views`; `TMDataGrid.Menu.Columns` and `TMDataGrid.ColumnsPanel` list the views and take `views={false}`.
- New `views*` labels, in English and Swedish.
