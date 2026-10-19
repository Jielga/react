# Columns API

Reference for the `columns` skill.

## meta.filter and meta.edit

`meta.filter` belongs to the `filtering` skill:

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `operators` | `readonly TMDataGridFilterOperator[]` | The type's list | The operators this column offers, a subset of its type's. For a backend that answers only some. |
| `defaultOperator` | `TMDataGridFilterOperator` | The type's default, else the first offered | The operator a fresh filter on this column starts with. |
| `control` | `TMDataGridFilterControlComponent` | By `meta.type` | Replaces the value control in this column's filter row. Module scope. |

`meta.edit` belongs to the `editing` skill, and only acts once `editing` is set:

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `enabled` | `boolean \| ((row) => boolean)` | editable where a field maps | Whether this column's cells edit. `row` is typed by the column helper. |
| `field` | `string` | The `accessorKey` | The data path an edit writes to. The only way an `accessorFn` column edits. |
| `editor` | `TMDataGridEditorComponent` | By `meta.type` | Replaces the cell editor. Module scope. |
| `validate` | `TMDataGridFieldValidate` | – | Field-level validation. A bare schema means `onChange`. |
| `mapValue` | `TMDataGridEditValueMap` | – | Maps each value an editor writes, on every keystroke. |

## Column-level feature options

Standard TanStack column options. Each also removes the corresponding interface.

| Option | Effect when `false` |
| --- | --- |
| `enableSorting` | No sort indicator, no sort menu items, no click-to-sort. |
| `enableMultiSort` | Shift+click on this header replaces the sort instead of adding to it. |
| `enableColumnFilter` | No filter menu item. Excluded from the filter panel's column list, and its header filter cell is empty. |
| `enableHiding` | No hide menu item. Checkbox disabled in the column manager. |
| `enablePinning` | No pin menu items. |
| `enableResizing` | The divider is displayed but cannot be dragged. |
| `enableGrouping` | No "Group by" menu item. |

## Exports and options

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `createTMDataGridColumnHelper` | Export | `<TData>() => TMDataGridColumnHelper<TData>` | – | The typed column helper. `meta` callbacks receive `Row<TMDataGridFeatures, TData>`. |
| `TMDataGridColumnHelper` | Type | – | – | The helper's type. |
| `TMDataGridColumnMeta` | Type | `TMDataGridColumnMeta<TData = TMDataGridRowData>` | – | The type of `meta`. Typed against the row when the column is declared with the helper. |
| `meta.options` | Column meta | `TMDataGridOptionsSource`: array \| `"faceted"` \| `(args: TMDataGridOptionsArgs) => …` | – | The choices of a `select` / `multiSelect` column. |
| `TMDataGridOption` | Type | `{ value, label?, color?, disabled?, group? }` | – | One choice. A bare string is shorthand for `{ value }`. |
| `TMDataGridOptionsArgs` | Type | `{ table, column, row? }` | – | What a `meta.options` function receives. `row` is absent when the filter panel asks. |
| `resolveColumnOptions` | Export | `({ table, column, row?, fallback? }) => Array<TMDataGridOption>` | – | Normalises all three `meta.options` forms. Empty when the column declares none. |
| `optionsToComboboxData` | Export | `(options) => ComboboxData` | – | Options as Mantine `Select` / `MultiSelect` data, groups folded in. |
| `minSize` / `maxSize` / `size` | Column options | `number` | `80` / – / `150` | Floor of the fluid track, a resize and a pinned width; ceiling of a resize and a pinned width; width of a column pinned at mount. |
| `enableSorting` · `enableColumnFilter` · `enableHiding` · `enablePinning` · `enableResizing` · `enableGrouping` | Column options | `boolean` | `true` | Per-column switches, each removing its interface. |
| `enableColumnOrdering` | Option | `boolean` | `true` | Header dragging and the move menu items. Grid-defined. |
| `enableMultiSort` · `maxMultiSortColCount` · `isMultiSortEvent` | Table options | – | Shift held | Multi-column sorting. |
| `sortFn` | Column option | name or `(rowA, rowB, columnId) => number` | `"auto"` | The comparator for one column. Not v8's `sortingFn`. |
| `initialState.columnOrder` · `.columnPinning` · `.columnVisibility` · `.columnSizing` | Table options | – | – | Layout at mount. Settings slices, persisted under `settingsKey`. |
| `initialState.sorting` | Table option | `Array<{ id, desc }>` | `[]` | Sort at mount. A data slice, persisted under `dataKey`. |
| `resetSettings` | Hook return | `() => void` | – | Clears visibility, order, pinning and widths. |
| `moveColumn` | Export | `({ table, columnId, targetId, side }) => void` | – | Moves a column beside another. |
| `moveColumnByStep` | Export | `({ table, columnId, direction }) => void` | – | Moves it one place. `direction` is `-1` or `1`. |
| `MoveColumnArgs` · `ColumnStepArgs` | Types | – | – | What `moveColumn` takes, and what `moveColumnByStep` and `getStepTargetColumn` take. |
| `TMDataGridDropSide` | Type | `"before" \| "after"` | – | The `side` of `MoveColumnArgs`: which edge of the target column the moved column lands on. |
| `getStepTargetColumn` | Export | `(args) => Column \| null` | – | What a step would swap with, or `null` at a region edge. |
| `getColumnRegion` | Export | `(columnPinning, columnId) => TMDataGridColumnRegion` | – | Which pinned region a column is in. |
| `TMDataGridColumnRegion` | Type | `"start" \| "center" \| "end"` | – | What `getColumnRegion` returns. |
| `keepGeneratedColumnsOutermost` | Export | `(columnPinning) => ColumnPinningState` | – | Puts the generated lanes back on the outside of both pinned lanes. The grid runs it after every pin; call it on a `columnPinning` you write yourself. |
| `getColumnCapabilities(column, features).canReorder` | Export | `boolean` | – | Whether this column may move at all. |
| `autosizeColumn` | Export | `({ table, columnId, container }) => void` | – | Fits a column to its mounted content. |
| `getColumnLabel` · `getColumnType` · `getColumnDefaultOperator` · `isControlColumn` | Exports | – | – | What the built-in controls read off a column. |
| `isGeneratedColumn` | Export | `(columnId) => boolean` | – | Whether the grid generated the column - the four control lanes plus the tree column. |
| `SELECT_COLUMN_ID` · `GROUP_COLUMN_ID` · `DETAILS_COLUMN_ID` · `EDIT_COLUMN_ID` · `ROW_NUMBER_COLUMN_ID` | Exports | ids | – | The generated lanes. |
| `TMDataGrid.Menu.Columns` · `TMDataGrid.ColumnsPanel` | Components | `searchable` · Mantine `BoxProps` | – | The column chooser, as menu items and as plain controls. Style props set on the panel. |
| `TMDataGridColumnSearchable` | Type | `boolean \| "auto"` | `"auto"` | The `searchable` prop of both: a search box from six hideable columns under `"auto"`, `true` always, `false` never. |
