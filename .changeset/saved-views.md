---
"@jielga/tmdatagrid": minor
---

Saved views: named column layouts the user switches between.

- `views` option: read-only `presets`, `defaultView`, `allowUserViews`, the `slices` a view holds, and a `store` for the user's own views.
- `createLocalStorageViewStore`, or any async `TMDataGridViewStore`.
- `grid.views` / `useTMDataGridViews` with `modified`, `select`, `saveAs`, `overwrite` and `remove`.
- `TMDataGrid.ViewsMenu` and `TMDataGrid.Menu.Views`; `TMDataGrid.Menu.Columns` shows the views in a Views submenu and `TMDataGrid.ColumnsPanel` lists them, both take `views={false}`.
- New `views*` labels, in English and Swedish.
