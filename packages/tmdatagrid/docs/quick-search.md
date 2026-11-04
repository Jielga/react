# Quick search

One box over every column. `TMDataGrid.Search` is a debounced input writing
TanStack's `globalFilter` state. There is no option to turn it on: render the
component, or do not.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.Search />
</TMDataGrid.Toolbar>
```

```demo
file: data/QuickSearch.tsx
hint: Try “Stckholm”. Fuzzy finds it; contains does not.
extraSources: data/employeeColumns.tsx
```

## Fuzzy by default

Typos and skipped characters still match, and while the search is the only thing
narrowing the grid (no sort, no grouping) the rows are ordered by **match
quality**, best first.

That ordering is derived and never written into `sorting`: no column takes
`aria-sort`, nothing is written to the persisted slices, and the next sort click
replaces it.

```tsx
const grid = useTMDataGrid({ data, columns, quickSearchMode: "contains" });
```

`"contains"` restores plain substring matching. An explicit `globalFilterFn`
overrides both, and switches the rank ordering off with it.

`fuzzyGlobalFilterFn` is exported for building your own input over the same
matching.

## Match highlighting

Opt in with `enableMatchHighlighting: true` and cells mark the matched part of
their text, while the quick search is active or a `contains` / `starts with` /
`ends with` column filter is.

```tsx
const grid = useTMDataGrid({ data, columns, enableMatchHighlighting: true });
```

What is marked is the **contiguous, case-insensitive** occurrence of the search
term, so a fuzzy typo-match with no contiguous occurrence is not highlighted.
Equality operators highlight nothing.

**Default-rendered cells only.** A column with its own `cell` renderer is
excluded: the grid reproduces the default value-to-string render with the marks
added, and does not modify a custom renderer's output.

The mark colour is `--dg-match-highlight-bg`, a yellow that follows the Mantine
colour scheme.

## Opting columns out

`enableGlobalFilter: false` on a column takes it out of the search; on the table
it removes the input entirely. The generated lanes are already excluded.

A search input of your own can skip the component and call
`table.setGlobalFilter` directly. The state is TanStack's own, so a
[`manualFiltering`](/docs/server-side) grid forwards it to the server, and it is
one of the persisted `data` slices.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `TMDataGrid.Search` | Component | – | – | The debounced quick-search input. |
| `placeholder` | Search prop | `string` | `labels.searchPlaceholder` | Input placeholder. |
| `debounce` | Search prop | `number` | `250` | Pause before the filter applies, in ms. `0` filters per keystroke. |
| `w` | Search prop | `number \| string` | `220` | Input width. |
| `quickSearchMode` | Option | `"fuzzy" \| "contains"` | `"fuzzy"` | How the search matches. |
| `TMDataGridQuickSearchMode` | Type | `"fuzzy" \| "contains"` | – | The type of `quickSearchMode`. |
| `enableMatchHighlighting` | Option | `boolean` | `false` | Mark the matched text in default-rendered cells. |
| `enableGlobalFilter` | Table option | `boolean` | `true` | Also a column option. `false` removes the input, or one column's participation. |
| `globalFilterFn` | Table option | filter fn | `fuzzy` | Overrides the matching, and the rank ordering with it. |
| `fuzzyGlobalFilterFn` | Export | filter fn | – | The default matcher, for a custom input. |
| `--dg-match-highlight-bg` | CSS variable | colour | Themed yellow | The mark colour. |
