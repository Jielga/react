# Components and hooks

Every hook and component the package exports.
A part whose props belong to one topic is documented on that topic's page, and listed here with a link; everything else - the root, the Table, and the parts whose props scatter across every topic - is written up in full below.
The options `useTMDataGrid` takes are on [useTMDataGrid](/docs/use-tm-data-grid).

```tsx
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
```

The parts of the grid are reached through the `TMDataGrid` object.
`TMDataGridSearch`, `TMDataGridFilterPills`, `TMDataGridDraftActions`, the editors and the filter controls are also exported by name; the remaining parts are available only as `TMDataGrid.Part`.

## useTMDataGrid

Creates the table instance, the UI store and the edit engine.
Spread its result onto `TMDataGrid`:

```tsx
const grid = useTMDataGrid({ data, columns });

<TMDataGrid {...grid}>
  <TMDataGrid.Table />
</TMDataGrid>;
```

`useTMDataGrid<TData>(options: UseTMDataGridOptions<TData>): TMDataGridApi<TData>`

| Field | Type | What it is |
| --- | --- | --- |
| `table` | `TMDataGridTable<TData>` | The TanStack table instance. State lives in `table.store`. |
| `ui` | `TMDataGridUiStore` | Panels, drag state, focused cell and cell range. |
| `edit` | `TMDataGridEditApi` | The [editing engine](/docs/editing). Inert until `editing` is set. |
| `features` | `TMDataGridFeatureFlags` | Feature switches, re-read from the options on every render. |
| `labels` | `TMDataGridLabels` | The [dictionary](/docs/localization), merged over the English defaults. |
| `renderDetails` | `TMDataGridDetailsRenderer<TData> \| undefined` | The [details renderer](/docs/row-details), passed through to the Table. |
| `renderDetailsEstHeight` | `number` | The option, or `160`. |
| `overscan` | `number` | The option, or `6`. |
| `resetSettings` | `() => void` | Puts visibility, order, widths, pinning and grouping back to a first visit. |
| `scrollToRow` | `({ rowId, align? }) => boolean` | Scrolls a row into view. Returns `false` when the row is not in the current view. |
| `sortStale` | `boolean` | Under `sortMode: "frozen"`, whether the held order differs from a fresh sort. See [Sorting](/docs/sorting#hold-the-order-while-editing). |
| `sortAgain` | `() => void` | Under `sortMode: "frozen"`, sorts again on the current values, with the same sort. |

## useTMDataGridContext

Returns the grid from inside a component rendered under `TMDataGrid`.
It throws when called outside one.

```tsx
const { table, labels, controlSize } = useTMDataGridContext();
```

The value carries every field `useTMDataGrid` returns, plus three resolved from `size`:

| Field | Type | What it is |
| --- | --- | --- |
| `size` | `TMDataGridSize` | The `size` prop set on `TMDataGrid`. |
| `rowHeight` | `number` | Row height in pixels, from `size` and `meta.rowHeight`. |
| `controlSize` | `TMDataGridSize` | The Mantine control size that pairs with `size`. |

## TMDataGrid

The root element.
Its props type is `TMDataGridProps`.
It provides the grid to every part through context, and takes every field `useTMDataGrid` returns alongside these props:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | The grid's parts, in render order. |
| `size` | `TMDataGridSize` | `"md"` | The [size scale](/docs/styling#the-size-scale). |
| `className` · `style` · `id` | `string` · `CSSProperties` · `string` | – | Set on the root element. Give the grid a bounded height - see [Layout](/docs/styling#layout). |
| `data-testid` | `string` | – | Names the grid for [tests](/docs/testing). Set it when a page holds more than one grid. |

## TMDataGrid.Table

The scrollable surface: the header, the virtualized body and the filter panel.
Pass the row type so the handlers are typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onRowClick` | `(row) => void` | – | Called when a body row is clicked. Rows show a pointer cursor when set. See [Clicks and context menus](/docs/row-interaction). |
| `onCellClick` · `onCellDoubleClick` · `onCellContextMenu` | `(args: TMDataGridCellEventArgs) => void` | – | Called on cell click, double-click and right-click. Receive `{ cell, row, column, event }`. See [Clicks and context menus](/docs/row-interaction). |
| `renderRowContextMenu` | `TMDataGridRowContextMenuRenderer` | – | Contents of a row's context menu. Receives `{ table, row, cell, close, internalItems }`. See [Context menus](/docs/row-interaction#context-menus). |
| `rowContextMenuProps` | `Omit<MenuProps, "opened" \| "onChange" \| "children">` | – | Props passed to the Mantine `Menu` behind the context menu. |
| `renderColumnMenuItems` | `TMDataGridColumnMenuItemsRenderer` | – | Contents of a column's menu. Returning an empty array leaves the column with no menu button. See [Column header menu](/docs/column-menu). |
| `rowClassName` | `string \| (row) => string` | – | Class for a body row. See [Row styling](/docs/row-styling). |
| `rowStyle` | `TMDataGridRowStyle \| (row) => TMDataGridRowStyle` | – | Inline style for a body row. Set `--row-bg` rather than `background`. See [Row styling](/docs/row-styling#set-the-row-background). |
| `striped` | `boolean` | `false` | If set, every second row takes `--dg-row-striped-bg`. See [Striping](/docs/row-styling#striping). |
| `highlightOnHover` | `boolean` | On for rows that answer a click or a right-click | Whether a body row takes the hover tint. See [Hover](/docs/row-styling#hover). |
| `onScrollToTop` · `onScrollToBottom` · `onScrollToLeft` · `onScrollToRight` | `() => void` | – | Called once on arriving at that edge, not on mount and not per scroll event. See [Edge callbacks](/docs/scrolling#edge-callbacks). |
| `onReachEnd` | `() => void` | – | Called as the scroll nears the last row, once per row count. Sorting and filtering must be server-side. See [Infinite scroll](/docs/server-side#infinite-scroll). |
| `reachEndThreshold` | `number` | `10` | Rows before the end at which `onReachEnd` fires. |
| `renderEmptyState` | `({ hasActiveFilters, table }) => ReactNode` | – | Replaces both built-in empty messages. See [Loading and empty states](/docs/loading-and-empty). |
| `aria-label` · `aria-labelledby` | `string` | – | The grid's accessible name, announced on entry and matched by `getByRole("grid", { name })`. |

Note that `onReachEnd` and `enablePagination` slice the same scroll: the pager caps the rows, so the end reached is the page's.
Setting both logs a warning.

## TMDataGrid.Toolbar

A flex row above the grid. See [Toolbar](/docs/toolbar).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | The toolbar's contents, in render order. |
| `withBottomBorder` | `boolean` | `false` | A 1px bottom border in the theme's default border colour, the line the header draws under itself. |
| Mantine `BoxProps` | | – | Style props (`mb`, `px`, `hiddenFrom`, …), `className`, `style` and `mod`, set on the row. |

## TMDataGrid.Spacer

Pushes the toolbar items after it to the right.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| Mantine `BoxProps` | | – | Style props, `className` and `style`, set on the spacer. |

## TMDataGrid.Search

A debounced quick-search input that writes the grid's global filter.
It renders nothing when no column is searchable. See [Quick search](/docs/quick-search).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `placeholder` | `string` | `labels.searchPlaceholder` | Placeholder text. |
| `debounce` | `number` | `250` | Milliseconds between the last keystroke and the filter being written. |
| `w` | `number \| string` | `220` | Width of the input. |

## The filter parts

Filtering owns these three, so their props are on that page rather than repeated here.

| Component | What it is | Props |
| --- | --- | --- |
| `TMDataGrid.FilterButton` | Toggles the filter surface, tinted with the count of active filters. Renders nothing when no column can be filtered, and nothing under `filters.surface: "none"`. | None. [Filtering](/docs/filtering#tmdatagridfilterbutton) |
| `TMDataGrid.FilterPanel` | The filter rows, as a plain block with no title, no close button and no open state - the popup and sidebar [surfaces](/docs/filtering#the-filters-option) wrap it. | `layout`, Mantine `BoxProps`. [Filtering](/docs/filtering#tmdatagridfilterpanel) |
| `TMDataGrid.FilterPills` · `TMDataGridFilterPills` | One pill per active filter. Takes the grid as an `api` prop rather than from context, so it renders anywhere on the page. | `api`, `size`, `showClearAll`, `onPillClick`, `className`. [Filtering](/docs/filtering#tmdatagridfilterpills) |

`openColumnFilter(api, columnId)` sends the user to a column's filter control; it is documented with them, on [Filtering](/docs/filtering#opencolumnfilter).

## TMDataGrid.Menu

The burger at the end of the toolbar and the Mantine `Menu` it opens.
Its children are the dropdown. See [Grid menu](/docs/menu).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | The dropdown: your own `Menu.Item`s and the `TMDataGrid.Menu.*` items. |
| `icon` | `ReactNode` | The burger | The trigger's icon. |
| `label` | `string` | `labels.menuButton` | The trigger's tooltip and `aria-label`. |
| Mantine `MenuProps` | | `position="bottom-end"`, `shadow="md"`, `width={260}`, `withinPortal` | Passed to the `Menu`. |

`TMDataGrid.Menu.Columns`, `.ColumnToggles`, `.ShowHideAll` and `.ResetLayout` are the column chooser as menu items, for this menu or any Mantine `Menu` inside the grid.
`Columns` takes `searchable` (default `"auto"`, a search box from six columns; a number sets the count), `ColumnToggles` takes `search`; the other two take no props.

## TMDataGrid.ColumnsPanel

The column chooser as plain controls: a checkbox list of the hideable columns, a search box once there are six of them, a show-all toggle and a reset button.
For a Popover, a Drawer or an inline layout; `TMDataGrid.Menu.Columns` is the same thing as menu items.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `searchable` | `boolean \| "auto" \| number` | `"auto"` | The search box over the list. `"auto"` shows it from six columns, a number from that many columns, `true` always, `false` never. |
| Mantine `BoxProps` | | – | Style props (`w`, `p`, …), `className` and `style`, set on the panel block. |

## TMDataGrid.LoadingIndicator

A spinner, shown while `meta.loading` is `true`. See [Loading and empty states](/docs/loading-and-empty).

No props.

## TMDataGrid.SummaryCount

The row count, as shown over total.
The total comes from `meta.totalRowCount` when set, and from the unfiltered row count otherwise.
While a column is grouped the shown count includes the group rows and the total keeps counting records, so `42 / 42` reads `48 / 42` under six groups; pass `children` to show a count of your own.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | Replaces the count with your own text. |

## TMDataGrid.DraftActions

Save and Discard for pending edits.
It renders nothing unless `editing` is set. See [Editing](/docs/editing).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `renderActions` | `(args: TMDataGridDraftActionsSlotArgs) => ReactNode` | – | Replaces both buttons. Receives `{ state, actions, Controls }`. |

The slot argument carries the state, the operations and the built-in pieces:

| Field | Type | What it is |
| --- | --- | --- |
| `state.draftCount` | `number` | Rows in the draft store: committed edits, committed entry rows and deletion marks. This is what Save sends. |
| `state.openCount` | `number` | Rows still open, so not part of the save. |
| `state.openRowIds` | `ReadonlyArray<string>` | The ids behind `openCount`, in the order the grid opened them. An entered row appears as its `tempId`. |
| `state.isSubmitting` | `boolean` | `true` while any open row is submitting. Not the save; see `state.isSaving`. |
| `state.isSaving` | `boolean` | `true` while `saveDrafts` is in flight, until the consumer's callbacks settle. The built-in Save shows it as its loading state. |
| `actions.save` | `() => Promise<TMDataGridSaveDraftsResult>` | Sends the draft store - `edit.saveDrafts()`. Open rows are left alone. Resolves `{ ok, saved, kept, reopened }`. |
| `actions.commitAll` | `() => Promise<TMDataGridCommitAllResult>` | Submits every open row, committing the ones that validate - `edit.commitAll()`. Resolves `{ ok, committed, open }`. |
| `actions.discard` | `() => void` | Drops open form state and the draft store alike. |
| `actions.scrollToRow` | `({ rowId, align? }) => boolean` | [`scrollToRow`](/docs/scrolling#scrolling-to-a-row), passed through. |
| `actions.scrollToFirstOpenRow` | `(align?) => boolean` | Scrolls to the first open row in display order. `false` when none could be reached. |
| `Controls.Save` · `Controls.Discard` · `Controls.OpenRowsNote` | `() => ReactNode` | The built-in pieces, to place in your own layout. |

The two orderings differ: `openRowIds` is the order the grid opened the rows,
while `scrollToFirstOpenRow` takes "first" in display order, so it follows the
current sort, filter and page. `openRowIds[0]` need not be the row it reaches.

## TMDataGrid.Footer

The pager bar: rows per page, the current range, and previous and next.
It renders nothing when pagination is off. See [Pagination](/docs/pagination).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `pageSizeOptions` | `ReadonlyArray<number>` | `[10, 25, 50, 100]` | The choices in the rows-per-page select. |
| `renderPagination` | `(args: TMDataGridPaginationSlotArgs) => ReactNode` | – | Replaces the pager. Receives `{ state, actions, Controls }`. |
| Mantine `BoxProps` | | – | Style props (`mt`, `px`, …), `className` and `style`, set on the footer bar. |

The slot argument holds the paging state, its operations and the built-in controls:

| Field | Type | What it is |
| --- | --- | --- |
| `state` | `TMDataGridPaginationState` | `pageIndex`, `pageSize`, `pageCount`, `rowCount`, `canPreviousPage`, `canNextPage`, `isPagingActive`, and the 1-based `from` and `to`. |
| `actions` | `TMDataGridPaginationActions` | `setPageIndex`, `setPageSize`, `previousPage`, `nextPage`, `firstPage`, `lastPage`. |
| `Controls.PageSize` · `Controls.Range` · `Controls.Pager` | `() => ReactNode` | The three built-in controls, to place in your own layout. |

`pageCount` is `-1` when a manual grid declares an unknown total, and `isPagingActive` is `false` while a grouping suspends paging.
`getTMDataGridPaginationApi(table, isPaging?)` returns the same `state` and `actions` for a pager built outside the grid.

## Editors

The control a cell opens for editing.
The grid picks one from the column's `meta.type`, and `meta.edit.editor` replaces it. See [Editors and validation](/docs/editors).

| Component | Renders | Used for `meta.type` |
| --- | --- | --- |
| `TMDataGridStringEditor` | Mantine `TextInput` | `"string"` |
| `TMDataGridNumberEditor` | `NumberInput`, writing `null` for an empty cell | `"number"` |
| `TMDataGridBooleanEditor` | `Checkbox` | `"boolean"` |
| `TMDataGridDateEditor` | `TextInput` with `type="date"` | `"date"` |
| `TMDataGridSelectEditor` | `Select`, committing on pick in `"cell"` mode | `"select"` |
| `TMDataGridMultiSelectEditor` | `MultiSelect`, committing on Enter or blur | `"multiSelect"` |

Each built-in editor also takes `inputProps`, passed to its Mantine control. See [Extending a built-in editor](/docs/editors#extending-a-built-in-editor).

Every editor takes the same argument object, `TMDataGridEditorArgs`:

| Field | Type | What it is |
| --- | --- | --- |
| `field` | `TMDataGridEditField` | The TanStack Form field for this cell. |
| `form` | `TMDataGridRowEditForm` | The whole row form, for an editor that reads sibling fields. |
| `cell` · `row` · `column` · `table` | TanStack instances | The cell being edited and its surroundings. |
| `commit` | `() => Promise<boolean>` | Commits the edit, as Enter would. |
| `cancel` | `() => void` | Drops the draft, as Escape would. |
| `size` | `TMDataGridSize` | The grid's resolved control size. |
| `seedText` | `string \| undefined` | Set when typing opened the editor. |

## Filter controls

The value control in a filter row.
The grid picks one from the column's `meta.type` and the current operator, and `meta.filter.control` replaces it. See [Filtering](/docs/filtering).

| Component | Renders | Suits |
| --- | --- | --- |
| `TMDataGridFilterValueInput` | A text input, a multi-select, a boolean select or a from/to pair, by operator | Every column. This is the default. |
| `DgRangeSliderFilter` | `RangeSlider` bounded by the values in the data | `number` columns with `between` |
| `DgDateRangeFilter` | Two `type="date"` inputs | `date` columns with `between` |
| `DgAutocompleteFilter` | `Autocomplete` over the column's values | Text columns with a scalar operator |
| `DgTriStateFilter` | `SegmentedControl` of all, true and false | `boolean` columns |

Each of the four specialised controls falls back to `TMDataGridFilterValueInput` for the operators it does not handle.
Every control takes the same argument object, `TMDataGridFilterControlArgs`:

| Field | Type | What it is |
| --- | --- | --- |
| `column` · `table` | TanStack instances | The column being filtered, and the table. |
| `operator` | `TMDataGridFilterOperator` | The row's selected operator. A control reads it and never writes it. |
| `value` | `string \| ReadonlyArray<string>` | The bare filter value, never the `{ operator, value }` wrapper. |
| `onChange` | `(next: string \| ReadonlyArray<string>) => void` | Writes the bare value. The grid pairs it with the current operator. |
| `options` | `ReadonlyArray<TMDataGridOption>` | The column's options, resolved for a column declaring `meta.options` or a select type. Empty otherwise. |
| `size` | `TMDataGridSize` | The grid's resolved control size. |
| `labels` | `TMDataGridLabels` | The resolved dictionary. |

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `useTMDataGrid` | Hook | `(options) => TMDataGridApi` | – | Creates the table, UI store and edit engine. |
| `useTMDataGridContext` | Hook | `() => TMDataGridContextValue` | – | The grid, from inside any part. Throws outside `TMDataGrid`. |
| `TMDataGrid` | Component | – | – | The root element. Provides the grid through context. |
| `TMDataGridProps` | Type | – | – | The props of `TMDataGrid`: the fields of `TMDataGridApi`, plus `children`, `size`, `className`, `style`, `id` and `data-testid`. |
| `TMDataGrid.Table` | Component | – | – | Header, virtualized body and filter panel. |
| `TMDataGridTableProps` | Type | – | – | The props of `TMDataGrid.Table`. |
| `TMDataGrid.Toolbar` · `.Spacer` | Components | – | – | The toolbar row, and the gap that pushes items right. |
| `TMDataGridToolbarProps` | Type | – | – | The props of `TMDataGrid.Toolbar`. |
| `TMDataGrid.Search` | Component | – | – | Quick search input. Also `TMDataGridSearch`. |
| `TMDataGridSearchProps` | Type | – | – | The props of `TMDataGrid.Search`. |
| `TMDataGrid.FilterButton` · `.FilterPanel` | Components | – | – | The filter UI. Props on [Filtering](/docs/filtering). |
| `TMDataGrid.Menu` · `.ColumnsPanel` | Components | – | – | The burger menu, and the column chooser as plain controls. |
| `TMDataGridColumnsPanelProps` · `TMDataGridColumnSearchable` | Types | – | – | The props of `TMDataGrid.ColumnsPanel`, and the type of the `searchable` prop it shares with `TMDataGrid.Menu.Columns`. |
| `TMDataGrid.LoadingIndicator` · `.SummaryCount` | Components | – | – | Fetch spinner, and the row count. |
| `TMDataGrid.DraftActions` | Component | – | – | Save and Discard. Also `TMDataGridDraftActions`. |
| `TMDataGridDraftActionsProps` | Type | – | – | The props of `TMDataGrid.DraftActions`. |
| `TMDataGridDraftActionsState` · `TMDataGridDraftActionsActions` · `TMDataGridDraftActionsControls` | Types | – | – | The `state`, `actions` and `Controls` of `TMDataGridDraftActionsSlotArgs`. |
| `TMDataGrid.Footer` | Component | – | – | The pager bar. |
| `TMDataGridFooterProps` | Type | – | – | The props of `TMDataGrid.Footer`. |
| `TMDataGrid.FilterPills` | Component | – | – | Active filters as pills. Also `TMDataGridFilterPills`. Props on [Filtering](/docs/filtering). |
| `openColumnFilter` | Export | `(api, columnId) => void` | – | Sends the user to a column's filter control. See [Filtering](/docs/filtering#opencolumnfilter). |
| `getTMDataGridPaginationApi` | Function | `(table, isPaging?) => TMDataGridPaginationApi` | `isPaging`: `true` | Paging state and actions for a pager of your own. |
| `DEFAULT_EXPORT_OPTIONS` | Constant | `TMDataGridExportSettings` | – | The export defaults `exportOptions` merges over. See [Export](/docs/export). |
