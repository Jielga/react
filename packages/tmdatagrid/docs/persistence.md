# Persistence

Restores table state on mount and writes it back on every change, so users
return to the grid as they left it.

State is split across **two keys**: `settingsKey` for the column layout, which
stays valid indefinitely, and `dataKey` for filters, sorting and pagination,
which go stale as the data underneath them changes. Either can be cleared
without touching the other. A third key, `urlKey`, keeps data slices in the
page URL instead, as a [deep link](#deep-links).

```tsx
// Module scope: the object is a dependency of the write subscription.
const persist = {
  dataKey: "employees.data",
  settingsKey: "employees.settings",
} satisfies TMDataGridPersistence;

const grid = useTMDataGrid({ data, columns, persist });
```

Both keys are optional - pass only `settingsKey` to remember the layout but
never the filters.

```demo
file: data/Persistence.tsx
hint: Sort, filter and hide a column, then reload the page. It all comes back; the page index does not.
extraSources: data/employeeColumns.tsx
```

## The two groups

| Group | Slices | Lifetime |
| --- | --- | --- |
| `dataKey` | `columnFilters`, `globalFilter`, `sorting`, `pagination`, `expanded` | As long as the data means the same thing |
| `urlKey` | The data slices. A slice listed here is taken out of `dataKey` | As long as the link is opened. See [Deep links](#deep-links) |
| `settingsKey` | `columnVisibility`, `columnSizing`, `columnOrder`, `columnPinning`, `grouping` | Indefinite. This is the user's layout |

`DATA_STATE_SLICES` and `SETTINGS_STATE_SLICES` are exported with the same
values. Slice names are typed per group, so only valid names compile.

Settings saved by 1.x with the old `columnPinning` keys `left` and `right` are
read and migrated to `start` and `end`.

## Persisting only some of it

A key on its own persists every slice in its group. Pass a tuple to narrow it:

```tsx
const persist = {
  // Restore filters and sorting, but always start on the first page.
  dataKey: ["employees.data", ["columnFilters", "sorting"]],
  // Restore column layout but not widths.
  settingsKey: ["employees.settings", ["columnVisibility", "columnOrder"]],
  storageMode: "sessionStorage",
} satisfies TMDataGridPersistence;
```

Only the selected slices are read back, so a payload written before you narrowed
the selection cannot reintroduce slices you have since opted out of.

## Deep links

`urlKey` keeps data slices in one URL search param, so a link to the page opens
the grid on the same filters. The string is the param name, and the slices
follow the same rules as `dataKey`: a bare key takes every data slice, a tuple a
subset. A slice lives in one group, so a slice listed under `urlKey` is taken
out of `dataKey`:

```tsx
const persist = {
  settingsKey: "employees.settings",
  // Sorting is remembered per browser; the filters travel in the link.
  dataKey: ["employees.data", ["sorting"]],
  urlKey: ["employees", ["columnFilters", "globalFilter"]],
} satisfies TMDataGridPersistence;
```

```demo
file: data/DeepLinks.tsx
hint: Filter a column, then copy the address bar into a new tab. The Location filter stays out of the link.
extraSources: data/employeeColumns.tsx
```

The param carries only the slices whose value differs from the initial state,
`initialState` merged over the grid defaults, and only the column filters that
are active. When nothing differs, the param is removed. A link without the
param, or without a slice, opens on the initial state; a URL slice never falls
back to storage.

Writes use `history.replaceState`, so a filter change never adds a history
entry. Only the grid's own param changes; the path, the hash, other params and
`history.state` are kept. Two grids on one page use two keys.

The URL payload carries no version stamp, because a bookmarked link has to
survive a release. The shape guards and the realignment against existing
columns apply as they do to storage, and so do `serialize` and `deserialize`.

Note that a bare `dataKey` hands the URL slices over silently, while a
`dataKey` tuple that names a slice `urlKey` also lists is reported with
`console.error` on mount; `urlKey` handles the slice either way.

### Keeping a column out of the link

Set `meta.filter.url` to `false` on a column whose filter should not travel
with the link:

```tsx
columnHelper.accessor("owner", {
  header: "Owner",
  meta: { filter: { url: false } },
});
```

The column's filter is then not persisted anywhere. A filter on it in
`initialState` still applies when a link is opened. The flag has no effect
unless `urlKey` carries `columnFilters`.

### Routers that own the URL

`urlStorage` replaces the default read and write of the param, for a router
that validates its search params and would not see a `replaceState` call.
`get` returns the param's string or `null`; `set` receives the string, or
`null` to remove the param. Keep `persist` referentially stable here too:
react-router rebuilds `setSearchParams` on every URL change, so read it
through a ref rather than listing it as a dependency:

```tsx
// react-router: let the router do the replace.
const [, setSearchParams] = useSearchParams();
const setSearchParamsRef = useRef(setSearchParams);
setSearchParamsRef.current = setSearchParams;

const persist = useMemo(
  () =>
    ({
      urlKey: ["employees", ["columnFilters"]],
      urlStorage: {
        get: (name) => new URLSearchParams(window.location.search).get(name),
        set: (name, value) =>
          setSearchParamsRef.current(
            (prev) => {
              if (value === null) prev.delete(name);
              else prev.set(name, value);
              return prev;
            },
            { replace: true },
          ),
      },
    }) satisfies TMDataGridPersistence,
  [],
);
```

## Behaviour

**Restoring happens once**, on mount, through `initialState`. Writing is a
subscription to the table store, so state changed directly through the table
API is persisted too.

**A payload from another version is dropped whole**, not migrated. Payloads
carry the exported `PERSIST_PAYLOAD_VERSION`, and anything else, including
everything written by a 0.x build, which had no stamp, is discarded.

**Restored state is realigned against the columns that exist.** Entries naming a
column removed between deploys are dropped: a stale id in the order, a width for
a column that no longer exists, or a sort or filter that would be active with no
column to show it. New columns need no handling, since TanStack appends columns
missing from `columnOrder` in definition order.

**Storage access is guarded.** If storage is unavailable, disabled or full,
persistence is skipped rather than throwing.

**Keys are not namespaced.** Include a tenant or user identifier if several
people can share a browser profile.

## Resetting

`resetSettings()` puts the settings state back to what a first visit with clean
storage would have shown (your `initialState` plus the structural lanes), and,
with persistence configured, writes through to storage like any other change.
The columns panel's **Reset layout** button calls it.

TanStack's own `resetColumnX()` family cannot do it on a persisted grid: those
reset to `initialState`, which the mount built *from* the restored payload.

## Relation to Mantine

Persistence does not use Mantine's `useLocalStorage`; the table owns the state
and storage only mirrors it. The option names follow Mantine's
`UseStorageOptions` where they apply, and `storageMode` takes the same values as
its `StorageType`.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `persist` | Option | `TMDataGridPersistence` | – | The whole configuration. Keep it referentially stable. |
| `dataKey` | persist field | `string \| [string, DataSlice[]]` | – | Storage key for the data group. |
| `settingsKey` | persist field | `string \| [string, SettingsSlice[]]` | – | Storage key for the settings group. |
| `urlKey` | persist field | `string \| [string, DataSlice[]]` | – | Search param for data slices kept in the URL. See [Deep links](#deep-links). |
| `urlStorage` | persist field | `TMDataGridUrlStorage` | `location.search` and `history.replaceState` | Reads and writes the URL param. |
| `TMDataGridUrlStorage` | Type | `{ get(name): string \| null; set(name, value: string \| null): void }` | – | The type of `urlStorage`. |
| `meta.filter.url` | Column meta | `boolean` | `true` | Determines whether the column's filter is written to the URL under `urlKey`. |
| `TMDataGridPersistKey` | Type | `string \| [string, slices]` | – | The type of `dataKey`, `settingsKey` and `urlKey`. |
| `storageMode` | persist field | `"localStorage" \| "sessionStorage"` | `"localStorage"` | Storage area. `"sessionStorage"` is per tab. |
| `TMDataGridStorageMode` | Type | `"localStorage" \| "sessionStorage"` | – | The type of `storageMode`. |
| `serialize` | persist field | `(value) => string` | `JSON.stringify` | Serializes a payload before storing. |
| `deserialize` | persist field | `(value: string) => unknown` | `JSON.parse` | Parses a stored payload. |
| `resetSettings` | Hook return | `() => void` | – | Back to a clean first visit, written through to storage. |
| `DATA_STATE_SLICES` · `SETTINGS_STATE_SLICES` | Exports | `string[]` | – | The slice names of each group. |
| `TMDataGridDataSlice` · `TMDataGridSettingsSlice` | Types | – | – | One slice name of each group. |
| `PERSIST_PAYLOAD_VERSION` | Export | `number` | – | The stamp. A payload from another version is dropped. |
