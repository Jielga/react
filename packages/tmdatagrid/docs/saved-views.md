# Saved views

Named column layouts the user switches between: developer presets defined in code, and views the user saves.
A view holds the grid's settings only: column visibility, widths, order, pinning and grouping.
Sorting, filters and paging are never part of a view.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  persist: { settingsKey: "employees.settings" },
  views: {
    store: viewStore,
    presets: [
      { id: "contact", name: "Contact", state: { columnVisibility: { salary: false } } },
    ],
  },
});
```

```demo
file: data/SavedViews.tsx
hint: Hide a column, then open the menu and save the layout as a new view. Switch between views, and reload the page.
```

Without the `views` option nothing changes: the menus show no views and `grid.views.enabled` is `false`.

## Presets and user views

| Kind | Defined by | What the user can do |
| --- | --- | --- |
| Preset | `views.presets`, in code | Pick it and restore it. Never overwrite, rename or delete it. |
| User view | The user, with **Save as new view** | Pick, restore, overwrite and delete it. |

`allowUserViews` decides whether the user can save views of their own. It defaults to `true`.
Set it to `false` for a grid that offers a fixed set of presets:

```tsx
views: {
  presets: PRESETS,
  defaultView: "contact",
  allowUserViews: false,
}
```

```demo
file: data/LockedViews.tsx
hint: The list holds the presets only. There is no Save as new view.
```

A preset holds only the slices you give it.
`{ columnVisibility: { salary: false } }` hides Salary and leaves the order, widths, pinning and grouping as they are.

## What a view holds

`views.slices` lists the settings slices a view saves and restores.
The default is all five: `columnVisibility`, `columnSizing`, `columnOrder`, `columnPinning` and `grouping`.

```tsx
// A view is which columns are shown, and nothing else.
views: { store, slices: ["columnVisibility"] }
```

A slice left out of `slices` is never captured by **Save as new view** or **Overwrite**, and never applied, even when a preset or a stored view holds it.
A slice a view does not hold is left as it is when the view is applied.

The generated lanes, such as the checkbox and the row numbers, are never part of a view.
Their visibility follows their features and the grid pins them itself.

Applying a view drops the ids of columns that no longer exist, the same way a restored layout is cleaned up under `persist`.
A column added since the view was saved is shown, at the end of the order.

## Selecting and restoring

Picking a view applies it and marks it as selected.
After that, changing the layout changes nothing in the list: the view stays selected, and **Restore** applies it again.
**Reset layout** still goes back to the grid's original layout, whatever view is selected.

**Overwrite** saves the current layout into the selected view, and **Delete** removes it.
Both show only while one of the user's own views is selected.
Delete takes effect at once, without a confirm.

### Names

A new view needs a name that no other view has, presets included.
Names are compared trimmed and case-insensitively, so `Finance` and ` finance ` are the same name.
The save button stays disabled while the name is empty or taken, and the reason shows under the field.

### First visit

`defaultView` names the preset a first visit starts on.
A visit counts as the first when no view has been selected before and `persist.settingsKey` restored nothing.
The preset is applied before the first paint.

## Where views are kept

`views.store` is where the user's views and the selected view are kept.
Without a store, views last as long as the grid is mounted.

`createLocalStorageViewStore(key)` keeps every view and the selected id under one key in `localStorage`:

```tsx
// Module scope, or useMemo: the store is a dependency of the load.
const viewStore = createLocalStorageViewStore("employees.views");
```

It takes `storageMode`, `serialize` and `deserialize`, with the same meaning as on `persist`.
Reads never throw: missing storage and a payload that does not parse read as no views.
A write that cannot reach storage rejects, and the name field shows `labels.viewsSaveFailed`.
Other tabs see a change through the browser's `storage` event.

Storage keys are not namespaced. Include a user or tenant id in the key if several people share a browser profile.

### A store of your own

A store is any object with these methods, so views can be kept on a server instead:

```ts
const serverStore: TMDataGridViewStore = {
  list: () => api.get(`/users/${userId}/grid-views`),
  save: (view) => api.put(`/users/${userId}/grid-views/${view.id}`, view),
  remove: (id) => api.delete(`/users/${userId}/grid-views/${id}`),
  getActiveId: () => api.get(`/users/${userId}/grid-views/active`),
  setActiveId: (id) => api.put(`/users/${userId}/grid-views/active`, { id }),
};
```

Every method returns a promise. `grid.views.status` is `"loading"` until `list` and `getActiveId` have answered, and `"error"` if either rejects.
`subscribe(onChange)` is optional: call `onChange` when the views change elsewhere, and return the unsubscribe.

Each saved view carries `version`.
A view from another version is migrated, never dropped, and a slice that fails its shape check is left out while the rest of the view is kept.

### With persist

`persist.settingsKey` and views work side by side.
`settingsKey` remembers the current layout, including changes made after a view was picked, and a reload comes back to it.
Without `settingsKey`, a reload applies the selected view again.

## Where the views show

| Where | What it is |
| --- | --- |
| `TMDataGrid.Menu.Columns` | The views under **Reset layout**, when `views` is set. `views={false}` leaves them out. |
| `TMDataGrid.ColumnsPanel` | A view picker, Restore, Overwrite, Delete and the name field, under the footer. `views={false}` leaves them out. |
| `TMDataGrid.ViewsMenu` | A toolbar button with the views in its own dropdown. |
| `TMDataGrid.Menu.Views` | The views as menu items, for any Mantine `Menu` inside the grid. |
| `grid.views` · `useTMDataGridViews` | The state and the verbs, for a control of your own. |

The list groups the views under **Presets** and **My views** when both kinds exist, and under **Views** otherwise.
A preset carries a lock icon while the user can save views of their own.

## TMDataGrid.ViewsMenu

The views behind a toolbar button of their own, beside the burger or anywhere else inside the grid.
It renders nothing when `views` is not set.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.Spacer />
  <TMDataGrid.ViewsMenu />
  <TMDataGrid.Menu>
    <TMDataGrid.Menu.Columns views={false} />
  </TMDataGrid.Menu>
</TMDataGrid.Toolbar>
```

```demo
file: data/ViewsMenu.tsx
hint: The views have a button of their own, next to the burger.
```

Pass `views={false}` to `TMDataGrid.Menu.Columns` beside it, so the views are not listed twice.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `icon` | `ReactNode` | A layout icon | The trigger's icon. |
| `label` | `string` | `labels.views` | The trigger's tooltip and `aria-label`. |
| `withResetLayout` | `boolean` | `true` | Adds **Reset layout** at the bottom of the dropdown. |
| Mantine `MenuProps` | | `position="bottom-end"`, `shadow="md"`, `width={260}`, `withinPortal` | Passed to the `Menu`. |

## TMDataGrid.Menu.Views

The views as menu items: the list, then **Restore**, **Overwrite**, **Save as new view** and **Delete** for the selected view.
**Save as new view** turns into the name field in place.
It needs a Mantine `Menu` around it and reads the grid from context:

```tsx
<Menu width={260} withinPortal>
  <Menu.Target>
    <Button size="compact-xs" variant="subtle">Layouts</Button>
  </Menu.Target>
  <Menu.Dropdown>
    <TMDataGrid.Menu.Views />
  </Menu.Dropdown>
</Menu>
```

No props. It renders nothing when `views` is not set.

## Your own controls

`grid.views`, or `useTMDataGridViews()` inside the grid, is everything the built-in controls use:

```tsx
function ViewTabs() {
  const views = useTMDataGridViews();
  return (
    <SegmentedControl
      data={views.list.map((view) => ({ value: view.id, label: view.name }))}
      value={views.activeId ?? ""}
      onChange={views.select}
    />
  );
}
```

| Field | Type | What it is |
| --- | --- | --- |
| `enabled` | `boolean` | Whether the `views` option is set. |
| `status` | `"loading" \| "ready" \| "error"` | Whether the store has answered. |
| `list` | `ReadonlyArray<TMDataGridViewEntry>` | Presets first, then the user's views, each `{ id, name, source, state }` with `source` `"preset"` or `"user"`. |
| `activeId` · `active` | `string \| null` · `TMDataGridViewEntry \| null` | The selected view. |
| `allowUserViews` | `boolean` | The option. |
| `select(id)` | `(id: string) => void` | Applies a view and selects it. |
| `restore()` | `() => void` | Applies the selected view again. |
| `validateName(name)` | `(name: string) => TMDataGridViewNameError \| null` | `"empty"`, `"duplicate"` or `null`. |
| `saveAs(name)` | `(name: string) => Promise<TMDataGridSaveViewResult>` | Saves the current layout as a new user view and selects it. Resolves to `{ ok: true, view }` or `{ ok: false, error }`, where `error` is `"empty"`, `"duplicate"`, `"notAllowed"` or `"store"`. Never rejects. |
| `overwrite()` | `() => Promise<boolean>` | Saves the current layout into the selected user view. `false` when a preset or nothing is selected, or the store rejected. |
| `remove(id)` | `(id: string) => Promise<boolean>` | Deletes a user view, and clears the selection if it was selected. `false` for a preset. |

`captureViewState(state, slices?)` is the capture behind **Save as new view**: the listed settings slices of a table state, with the generated lanes left out.
`validateViewName(name, views, exceptId?)` is the name check, for a name field of your own.

## Labels

| Key | Where it shows |
| --- | --- |
| `views` | The heading over a list of one kind, and the `ViewsMenu` tooltip |
| `viewsPresets` · `viewsMine` | The two headings when both kinds are listed |
| `viewsNone` · `viewsNoneSelected` | No views at all, and the panel's picker with nothing selected |
| `viewsPresetLocked` | The lock icon's `aria-label` |
| `viewsRestore` · `viewsOverwrite` · `viewsDelete` | The actions, given the view's name |
| `viewsSaveAs` · `viewsName` · `viewsSave` | Save as new view, the name field and its button |
| `viewsNameEmpty` · `viewsNameDuplicate` · `viewsSaveFailed` | The messages under the name field |

`TMDATAGRID_LABELS_SV` carries all of them in Swedish. See [Localization](/docs/localization).

## Testing

| `data-dg-part` | What it is |
| --- | --- |
| `views-button` | The `ViewsMenu` trigger |
| `views-item` | One view in a menu, with `data-view-id` and `aria-checked` |
| `views-none` | The text shown when there is no view |
| `views-restore` · `views-overwrite` · `views-delete` | The actions, in a menu or in the panel |
| `views-save-as` | The menu item that opens the name field |
| `views-save-form` · `views-name` · `views-save` | The name form, its field and its button |
| `views-panel` · `views-select` | The panel's views row and its picker |

See [Testing](/docs/testing).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `views` | Option | `TMDataGridViewsOptions` | – | Turns saved views on. |
| `views.store` | Option | `TMDataGridViewStore` | – | Where user views and the selection are kept. Keep it referentially stable. |
| `views.presets` | Option | `TMDataGridViewPreset[]` | `[]` | Read-only views defined in code, `{ id, name, state }`. |
| `views.slices` | Option | `TMDataGridSettingsSlice[]` | All five | The slices a view saves and restores. |
| `views.defaultView` | Option | `string` | – | The preset a first visit starts on. |
| `views.allowUserViews` | Option | `boolean` | `true` | Whether the user can save, overwrite and delete views. |
| `grid.views` | Hook return | `TMDataGridViewsApi` | – | The views, and the verbs. |
| `useTMDataGridViews` | Hook | `() => TMDataGridViewsApi` | – | `grid.views` from inside the grid. |
| `TMDataGrid.ViewsMenu` | Component | `TMDataGridViewsMenuProps` | – | The views behind a toolbar button. |
| `TMDataGrid.Menu.Views` | Component | – | – | The views as menu items. |
| `createLocalStorageViewStore` | Function | `(key, options?) => TMDataGridViewStore` | `localStorage` | A store over web storage. |
| `captureViewState` | Function | `(state, slices?) => TMDataGridViewState` | All five slices | The listed slices of a table state, the generated lanes left out. |
| `validateViewName` | Function | `(name, views, exceptId?) => TMDataGridViewNameError \| null` | – | The name check. |
| `VIEW_PAYLOAD_VERSION` | Constant | `number` | `1` | The version stamped into every saved view. |
| `TMDataGridViewsOptions` · `TMDataGridViewsApi` | Types | – | – | The option, and `grid.views`. |
| `TMDataGridView` · `TMDataGridViewPreset` · `TMDataGridViewEntry` · `TMDataGridViewState` | Types | – | – | A saved view, a preset, one list entry, and the slices a view holds. |
| `TMDataGridViewStore` · `TMDataGridLocalViewStoreOptions` · `TMDataGridStoredViews` | Types | – | – | A store, the options of the local one, and what it keeps under its key. |
| `TMDataGridViewNameError` · `TMDataGridSaveViewResult` | Types | – | – | Why a name is refused, and what `saveAs` resolves to. |
| `TMDataGridViewsMenuProps` | Type | – | – | The props of `TMDataGrid.ViewsMenu`. |
