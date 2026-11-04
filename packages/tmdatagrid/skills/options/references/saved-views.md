# Saved views

Reference for the `options` skill: the `views` option, `grid.views`, the
store, the components and every export.

## The option

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `store` | `TMDataGridViewStore` | – | Where the user's views and the selected id are kept. Without one they last as long as the grid is mounted. Keep it referentially stable. |
| `presets` | `TMDataGridViewPreset[]` | `[]` | Read-only views defined in code, `{ id, name, state }`, listed first. |
| `slices` | `TMDataGridSettingsSlice[]` | All five settings slices | What every view saves and applies. A slice left out is never captured or applied, even when a preset holds it. |
| `defaultView` | `string` | – | A preset id. Applied before the first paint on a first visit: no view selected before and nothing restored by `persist.settingsKey`. |
| `allowUserViews` | `boolean` | `true` | `false` leaves only picking presets. |

`TMDataGridViewsOptions` is the type. `TMDataGridViewState` is what a view
holds: `Partial<Pick<TableState, TMDataGridSettingsSlice>>`.

## Rules

- A view never holds sorting, filters, paging or expansion.
- Applying a view sets only the slices it holds (narrowed by `slices`); the
  rest of the layout stays as it is.
- Ids of columns that no longer exist are dropped on apply. A column added
  since the view was saved is shown, at the end of the order.
- The generated lanes (checkbox, details, edit, row number, tree) are never
  captured; the grid pins them and sets their visibility itself.
- Picking a view selects it. Later layout changes leave it selected and
  set `modified`: one of the slices the view holds no longer has the same
  effect (hiding a column and showing it again does not count). Selecting
  the selected view again applies it again and discards the changes.
  `resetSettings()` / Reset layout still goes back to the grid's original
  layout.
- Presets are never overwritten or deleted. `overwrite` and `remove` act on the
  user's own views only. The menus show the actions as icons on the selected
  view's row: Save changes to view while it is modified, Delete view always.
  Delete has no confirm.
- A name is compared trimmed and case-insensitively against every view,
  presets included. An empty or taken name cannot be saved; the reason shows
  under the field and the button is disabled.
- With `persist.settingsKey`, a reload comes back to the current layout and
  marks the stored view. Without it, a reload applies the stored view again.
- A stored view from another `VIEW_PAYLOAD_VERSION` is migrated, never dropped;
  a slice that fails its shape check is left out.

## grid.views

`TMDataGridViewsApi`, also `useTMDataGridViews()` inside the grid.

| Field | Type | What it is |
| --- | --- | --- |
| `enabled` | `boolean` | Whether `views` is set. Every views component renders nothing otherwise. |
| `status` | `"loading" \| "ready" \| "error"` | Whether the store answered. |
| `list` | `ReadonlyArray<TMDataGridViewEntry>` | Presets, then user views: `{ id, name, source: "preset" \| "user", state }`. |
| `activeId` · `active` | `string \| null` · `TMDataGridViewEntry \| null` | The selected view. |
| `modified` | `boolean` | Whether the layout has moved away from the selected view. `false` with none selected. |
| `allowUserViews` | `boolean` | The option. |
| `select(id)` | `void` | Applies and selects. On the selected view, discards its changes. |
| `validateName(name)` | `TMDataGridViewNameError \| null` | `"empty"`, `"duplicate"` or `null`. |
| `saveAs(name)` | `Promise<TMDataGridSaveViewResult>` | `{ ok: true, view }` or `{ ok: false, error }` with `"empty"`, `"duplicate"`, `"notAllowed"` or `"store"`. Never rejects. |
| `overwrite()` | `Promise<boolean>` | Saves the current layout into the selected user view. |
| `remove(id)` | `Promise<boolean>` | Deletes a user view and clears the selection if it was selected. |

## The store

`TMDataGridViewStore`: `list()`, `save(view)` (upsert by id), `remove(id)`,
`getActiveId()`, `setActiveId(id)`, all returning promises, and an optional
`subscribe(onChange)` returning the unsubscribe. `TMDataGridView` is
`{ id, name, version, state }`.

`createLocalStorageViewStore(key, { storageMode, serialize, deserialize })`
keeps `TMDataGridStoredViews` - `{ version, activeId, views }` - under one key
(`TMDataGridLocalViewStoreOptions` is the options type). Reads never throw; a
write storage refuses rejects, which the name field shows as
`labels.viewsSaveFailed`. Other tabs see changes through the `storage` event.
Put a user or tenant id in the key.

## Components

| Component | What it renders |
| --- | --- |
| `TMDataGrid.Menu.Columns` | A Views item under Reset layout (`data-dg-part="views-submenu"`) with the selected view's name and a dot while it is modified; the views open in its submenu. `views={false}` leaves it out. |
| `TMDataGrid.ColumnsPanel` | A picker, Discard changes / Save changes to view / Delete view icon buttons and the name field. `views={false}` leaves them out. |
| `TMDataGrid.ViewsMenu` | A toolbar button (`data-dg-part="views-button"`) and its dropdown. Props `TMDataGridViewsMenuProps`: `icon`, `label` (default `labels.views`), `withResetLayout` (default `true`) and Mantine `MenuProps`. |
| `TMDataGrid.Menu.Views` | The views as items, for any Mantine `Menu` inside the grid. No props. |

Use `TMDataGrid.ViewsMenu` with `<TMDataGrid.Menu.Columns views={false} />`
so the views are not listed twice.

## Helpers

- `captureViewState(state, slices?)` - the listed settings slices of a table
  state, generated lanes left out. What Save current layout as new view stores.
- `validateViewName(name, views, exceptId?)` - the name check.
- `VIEW_PAYLOAD_VERSION` - the version stamped into every saved view.

## Labels and parts

Labels: `views`, `viewsPresets`, `viewsMine`, `viewsNone`,
`viewsNoneSelected`, `viewsPresetLocked`, `viewsModified`,
`viewsDiscardChanges`, `viewsOverwrite`, `viewsSaveAs`, `viewsName`,
`viewsSave`, `viewsDelete`, `viewsNameEmpty`, `viewsNameDuplicate`,
`viewsSaveFailed`. All are strings. `TMDATAGRID_LABELS_SV` translates all of
them.

Parts: `views-button`, `views-submenu`, `views-item` (with `data-view-id`,
selected one `aria-checked="true"`, a modified one `data-modified="true"`),
`views-none`, `views-overwrite`, `views-delete`, `views-discard` (panel),
`views-save-as`, `views-save-form`, `views-name`, `views-save`,
`views-panel`, `views-select`.

Source: `packages/tmdatagrid/docs/saved-views.md`.
