# Loading and empty states

A grid can have nothing to show for five different reasons, and the body says
which one it is: still fetching, emptied by a filter, or holding no data.

```demo
file: data/LoadingAndEmpty.tsx
hint: Switch to loaded, then search for something that cannot match, to see the other branch.
extraSources: data/employeeColumns.tsx
```

## Precedence

An empty body shows exactly one thing, decided in this order:

1. **Loading** - `meta.loading` is true: a centred loader. A grid that is
   fetching never reports itself as empty.
2. **Entry rows** - an open entry row from `edit.addRow()`: the entry block
   only, with no message beside the form.
3. **`renderEmptyState`** - your node, centred where the message would be.
4. **Filtered-empty** - a column filter is active (`isFilterActive`) or the
   quick search is not blank: a search icon and `labels.noResults` ("No rows
   match your filters").
5. **Truly-empty** - no column filter is active and the quick search is blank:
   `labels.noRows` ("No rows to show").

"Empty" means no displayed row and no pinned row: the current page under
pagination, otherwise every filtered row. States 4 and 5 are decided by the
filter state alone, so an empty `data` array shows `noResults` while a filter is
active. A half-typed filter, such as `{ operator: "contains", value: "" }`, is
not active, so it does not count.

## While data loads

The loader shows only while `meta.loading` is `true` and the view is empty. It
is the only "no data yet" signal the grid has, so set `meta.loading` during the
first fetch as well; without it the empty message shows until the rows arrive.

`renderEmptyState` is called only once `meta.loading` is not `true`. During a
refetch that returns no rows, the loader mounts when `loading` turns `true`,
`renderEmptyState` mounts when it turns `false`, and it unmounts again on the
next refetch; the two branches never render together. Rows on screen stay on
screen until `data` changes, whatever `loading` says.

## Replacing the message

`renderEmptyState` replaces states 4 and 5 with one render prop.
`hasActiveFilters` says which of the two it is replacing, so one prop can render
two different messages:

```tsx
<TMDataGrid.Table<Employee>
  renderEmptyState={({ hasActiveFilters, table }) =>
    hasActiveFilters ? (
      <Stack align="center" gap="xs">
        <Text c="dimmed">Nothing matches your filters</Text>
        <Button variant="light" onClick={() => table.resetColumnFilters()}>
          Clear filters
        </Button>
      </Stack>
    ) : (
      <Stack align="center" gap="xs">
        <Text c="dimmed">No employees yet</Text>
        <Button onClick={openCreateModal}>Add the first one</Button>
      </Stack>
    )
  }
/>
```

## Loading with rows on screen

The body's loading state only appears while the grid is **empty**. A
server-driven grid refetching with rows still on screen keeps showing them
rather than blanking the body on every page change.

`TMDataGrid.LoadingIndicator` covers that case: a small spinner while
`meta.loading` is true, and nothing otherwise. Place it where you want it,
typically after `Spacer`.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer />
  <TMDataGrid.LoadingIndicator />
</TMDataGrid.Toolbar>
```

## Counting what is there

`TMDataGrid.SummaryCount` shows visible rows out of the total. The total is
`meta.totalRowCount` when you provide it, and the pre-filtered row count
otherwise. A [server-side](/docs/server-side) grid holds one page, so without
`meta.totalRowCount` it shows the shown count alone, with no total.

```tsx
<TMDataGrid.SummaryCount>
  {visible} of {total} employees
</TMDataGrid.SummaryCount>
```

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `meta.loading` | Option | `boolean` | `false` | A fetch is in flight. While `true` and the view is empty, the loader replaces every empty message and `renderEmptyState` is not called. |
| `meta.noResultsLabel` | Option | `string` | `labels.noResults` | The filtered-empty message, without a render prop. |
| `meta.totalRowCount` | Option | `number` | Pre-filtered count; none on a server-driven grid | The total `SummaryCount` reports. |
| `renderEmptyState` | Table prop | `({ hasActiveFilters, table }) => ReactNode` | – | Replaces both built-in empty messages. `hasActiveFilters` is `true` when a column filter is active (`isFilterActive`) or the quick search is not blank. |
| `TMDataGrid.LoadingIndicator` | Component | – | – | Spinner while `meta.loading`, for when the body has rows. |
| `TMDataGrid.SummaryCount` | Component | `children` replaces the text | – | Visible rows out of total. |
| `labels.noRows` · `labels.noResults` | Labels | `string` | English defaults | The two built-in messages. See [Localization](/docs/localization). |
