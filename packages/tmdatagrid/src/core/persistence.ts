import type { TableState } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { sameStateValue } from "./controlledState";
import { filterNarrowsRows } from "./filterOperators";

type GridState = TableState<TMDataGridFeatures>;

/**
 * Persistence deliberately does not use Mantine's `useLocalStorage`.
 *
 * That hook holds a piece of state and returns `[value, setValue]`. Here the
 * table already holds the state and storage only mirrors it, so routing writes
 * through the hook would keep a second copy and trigger a React state update on
 * every change, including every pointer move during a column resize. Its
 * defaults also conflict with this use: `getInitialValueInEffect: true` delivers
 * the stored value after mount, while `initialState` is only read on the first
 * render, and `sync: true` would let two open tabs overwrite each other's
 * column layout.
 *
 * The option vocabulary follows Mantine's: `StorageType` is its type, and
 * `serialize` / `deserialize` behave as they do in `UseStorageOptions`.
 */

/**
 * State slices describing what the user is looking at. Derived from the data,
 * so they can go stale as it changes.
 */
export const DATA_STATE_SLICES = [
  "columnFilters",
  "globalFilter",
  "sorting",
  "pagination",
  // Which groups are open. Keyed by group ids built from the values themselves
  // (`department:Design`), so a restored entry for a group the data no longer
  // produces is simply never looked up.
  "expanded",
] as const satisfies ReadonlyArray<keyof GridState>;

/**
 * State slices describing how the user configured the grid. Independent of the
 * data, and the ones users notice losing.
 */
export const SETTINGS_STATE_SLICES = [
  "columnVisibility",
  "columnSizing",
  "columnOrder",
  "columnPinning",
  // Which columns the rows are grouped by. A settings slice rather than a data
  // one: it names columns, not values, so it survives the data changing under
  // it the way the column layout does.
  "grouping",
] as const satisfies ReadonlyArray<keyof GridState>;

export type TMDataGridDataSlice = (typeof DATA_STATE_SLICES)[number];
export type TMDataGridSettingsSlice = (typeof SETTINGS_STATE_SLICES)[number];

/**
 * A storage key, optionally narrowed to a subset of its group's slices.
 *
 * - `"employees.data"` - persists every slice in the group.
 * - `["employees.data", ["sorting"]]` - persists only the listed slices.
 */
export type TMDataGridPersistKey<TSlice extends string> =
  | string
  | readonly [key: string, slices: readonly TSlice[]];

/** Same values as Mantine's `StorageType`, which the package does not re-export. */
export type TMDataGridStorageMode = "localStorage" | "sessionStorage";

/**
 * Reads and writes the one URL search param that `urlKey` names. Replaces the
 * default, which reads `window.location.search` and writes with
 * `history.replaceState`, for a router that owns the URL.
 */
export type TMDataGridUrlStorage = {
  /** The param's current value, or `null` when the URL has none. */
  get(name: string): string | null;
  /** Sets the param to `value`, or removes it when `value` is `null`. */
  set(name: string, value: string | null): void;
};

export type TMDataGridPersistence = {
  /** Key for filters, global filter, sorting and pagination. */
  dataKey?: TMDataGridPersistKey<TMDataGridDataSlice>;
  /** Key for column visibility, sizing, order and pinning. */
  settingsKey?: TMDataGridPersistKey<TMDataGridSettingsSlice>;
  /**
   * Search param for data slices kept in the URL, so a link opens the grid on
   * the same state. Takes the slices it lists away from `dataKey`. The param
   * holds only the slices that differ from the initial state, and carries no
   * version stamp.
   */
  urlKey?: TMDataGridPersistKey<TMDataGridDataSlice>;
  /** Where `urlKey` reads and writes. Defaults to the browser's URL. */
  urlStorage?: TMDataGridUrlStorage;
  /** Which storage area to use. Defaults to `"localStorage"`. */
  storageMode?: TMDataGridStorageMode;
  /** Serializes a payload before it is stored. Defaults to `JSON.stringify`. */
  serialize?: (value: Partial<GridState>) => string;
  /** Parses a stored payload. Defaults to `JSON.parse`. */
  deserialize?: (value: string) => unknown;
};

/**
 * Version stamped into every stored payload, under a key no state slice can
 * collide with. A payload whose version does not match is dropped whole: a
 * migration would be guessing at a shape this code no longer knows, and the
 * cost of dropping is one lost layout. Payloads written before versioning
 * existed (≤0.4.0) have no stamp and are dropped the same way - the 1.0
 * wave's one-time break, named in its changeset.
 */
export const PERSIST_PAYLOAD_VERSION = 1;
const VERSION_FIELD = "__v";

type ResolvedKey = { key: string; slices: ReadonlyArray<keyof GridState> };

function resolveKey<TSlice extends string>(
  entry: TMDataGridPersistKey<TSlice> | undefined,
  defaultSlices: ReadonlyArray<keyof GridState>,
): ResolvedKey | null {
  if (!entry) return null;
  if (typeof entry === "string") return { key: entry, slices: defaultSlices };

  const [key, slices] = entry;
  if (!key) return null;
  // An empty list means nothing was selected, which is not the same as "all".
  return { key, slices: slices as ReadonlyArray<keyof GridState> };
}

/**
 * The browser's URL. Writes replace the current history entry and never push
 * one: a filter change is not a navigation, and Back should leave the page
 * rather than undo filters one at a time. Path, hash, every other param and
 * `history.state` are kept - a router keeps its own bookkeeping there.
 */
const defaultUrlStorage: TMDataGridUrlStorage = {
  get: (name) => new URLSearchParams(window.location.search).get(name),
  set: (name, value) => {
    // Spliced by hand rather than through `URLSearchParams`, whose serializer
    // re-encodes every param (`/a%20b` comes back as `%2Fa+b`). Only the
    // grid's own pair changes; every other entry is kept byte for byte.
    const { pathname, search, hash, href } = window.location;
    const entries = search
      .replace(/^\?/, "")
      .split("&")
      .filter((entry) => entry !== "");
    const kept = entries.filter((entry) => paramEntryKey(entry) !== name);
    if (value === null && kept.length === entries.length) return;
    if (value !== null) {
      kept.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
    }
    const next = `${pathname}${kept.length === 0 ? "" : `?${kept.join("&")}`}${hash}`;
    if (new URL(next, href).href === href) return;
    window.history.replaceState(window.history.state, "", next);
  },
};

/** The decoded key of one `key=value` query entry, `+` read as a space. */
function paramEntryKey(entry: string): string {
  const separator = entry.indexOf("=");
  const raw = (separator === -1 ? entry : entry.slice(0, separator)).replaceAll(
    "+",
    " ",
  );
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed escape cannot be the grid's own key, which it encoded.
    return raw;
  }
}

function resolveUrlStorage(
  persistence: TMDataGridPersistence | undefined,
): TMDataGridUrlStorage | null {
  if (!persistence) return null;
  if (persistence.urlStorage) return persistence.urlStorage;
  // Absent under SSR, like web storage. Access that throws is caught where the
  // param is read or written.
  return typeof window === "undefined" ? null : defaultUrlStorage;
}

function resolveStorage(
  persistence: TMDataGridPersistence | undefined,
): Storage | null {
  if (!persistence) return null;
  return resolveStorageArea(persistence.storageMode);
}

/**
 * The web storage area a mode names, or `null` where there is none.
 *
 * @internal Shared with the saved views' local store.
 */
export function resolveStorageArea(
  storageMode: TMDataGridStorageMode | undefined,
): Storage | null {
  // Absent under SSR, and access throws outright in some privacy modes.
  try {
    if (typeof window === "undefined") return null;
    return storageMode === "sessionStorage"
      ? window.sessionStorage
      : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Shape guards for restored state.
 *
 * A stored payload outlives the code that wrote it: a slice can change shape
 * between releases, and nothing stops anyone from editing storage by hand. The
 * value goes straight into `initialState`, where a wrong shape surfaces as a
 * crash inside TanStack rather than as a bad read here. A slice that fails its
 * guard is dropped; the rest still restore.
 */
function prop(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

const isString = (value: unknown): value is string => typeof value === "string";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function isArrayOf(
  value: unknown,
  isItem: (item: unknown) => boolean,
): boolean {
  return Array.isArray(value) && value.every(isItem);
}

function isRecordOf(
  value: unknown,
  isItem: (item: unknown) => boolean,
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(isItem);
}

const hasStringId = (entry: unknown): boolean => isString(prop(entry, "id"));

const SLICE_GUARDS: Record<
  TMDataGridDataSlice | TMDataGridSettingsSlice,
  (value: unknown) => boolean
> = {
  columnFilters: (value) => isArrayOf(value, hasStringId),
  // TanStack leaves the global filter value untyped - the grid's own default
  // filters on a string, but a consumer may store anything here.
  globalFilter: () => true,
  sorting: (value) =>
    isArrayOf(
      value,
      (entry) => hasStringId(entry) && typeof prop(entry, "desc") === "boolean",
    ),
  pagination: (value) => {
    const pageIndex = prop(value, "pageIndex");
    const pageSize = prop(value, "pageSize");
    return (
      isFiniteNumber(pageIndex) &&
      pageIndex >= 0 &&
      isFiniteNumber(pageSize) &&
      pageSize > 0
    );
  },
  // `true` is a legal ExpandedState of its own, meaning every row is open.
  expanded: (value) =>
    value === true || isRecordOf(value, (entry) => typeof entry === "boolean"),
  columnVisibility: (value) =>
    isRecordOf(value, (entry) => typeof entry === "boolean"),
  columnSizing: (value) => isRecordOf(value, isFiniteNumber),
  columnOrder: (value) => isArrayOf(value, isString),
  // Both the current logical shape and the physical one 1.x wrote.
  columnPinning: (value) =>
    (isArrayOf(prop(value, "start"), isString) &&
      isArrayOf(prop(value, "end"), isString)) ||
    (isArrayOf(prop(value, "left"), isString) &&
      isArrayOf(prop(value, "right"), isString)),
  grouping: (value) => isArrayOf(value, isString),
};

/**
 * Settings saved by 1.x used TanStack's old physical `columnPinning` keys.
 * Rewrite them once on read, so nothing downstream sees `left` / `right`.
 */
function normalizeColumnPinning(value: unknown): unknown {
  const left = prop(value, "left");
  const right = prop(value, "right");
  if (left === undefined || right === undefined) return value;
  return { start: left, end: right };
}

function isValidSlice(slice: keyof GridState, value: unknown): boolean {
  const guard = SLICE_GUARDS[slice as keyof typeof SLICE_GUARDS];
  return guard === undefined || guard(value);
}

/**
 * The settings slices of an untrusted record that pass their shape guards,
 * with the 1.x pinning keys rewritten. Every other key is ignored.
 *
 * @internal Reads the state of a saved view.
 */
export function readSettingsSlices(
  value: unknown,
): Partial<Pick<GridState, TMDataGridSettingsSlice>> {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const read: Record<string, unknown> = {};
  for (const slice of SETTINGS_STATE_SLICES) {
    const entry = record[slice];
    if (entry === undefined || !isValidSlice(slice, entry)) continue;
    read[slice] =
      slice === "columnPinning" ? normalizeColumnPinning(entry) : entry;
  }
  return read as Partial<Pick<GridState, TMDataGridSettingsSlice>>;
}

function readSlices({
  read,
  resolved,
  deserialize,
  versioned,
}: {
  /** Returns the raw payload stored under a key, or `null`. */
  read: ((key: string) => string | null) | null;
  resolved: ResolvedKey | null;
  deserialize: (value: string) => unknown;
  /** Whether the payload must carry the current version stamp. */
  versioned: boolean;
}): Partial<GridState> {
  if (!read || !resolved) return {};
  try {
    const raw = read(resolved.key);
    if (!raw) return {};
    const parsed = deserialize(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    const record = parsed as Record<string, unknown>;
    if (versioned && record[VERSION_FIELD] !== PERSIST_PAYLOAD_VERSION) {
      return {};
    }
    const restored: Record<string, unknown> = {};
    // Only copy the selected slices. A payload written before the selection was
    // narrowed cannot reintroduce slices the caller has since opted out of.
    for (const slice of resolved.slices) {
      if (!(slice in record)) continue;
      // A `null` slice stands for `undefined` - see the writers. An own key
      // holding `undefined` still overrides `initialState` in the merge, which
      // is the point: the user cleared the slice. The slice's guard then
      // judges `undefined`, so only a slice that may be `undefined` (the
      // untyped global filter) restores that way.
      const value = record[slice] === null ? undefined : record[slice];
      if (!isValidSlice(slice, value)) continue;
      restored[slice] =
        slice === "columnPinning" ? normalizeColumnPinning(value) : value;
    }
    return restored as Partial<GridState>;
  } catch {
    return {};
  }
}

function writeSlices(
  storage: Storage | null,
  resolved: ResolvedKey | null,
  state: GridState,
  serialize: (value: Partial<GridState>) => string,
): void {
  if (!storage || !resolved) return;
  const payload: Record<string, unknown> = { [VERSION_FIELD]: PERSIST_PAYLOAD_VERSION };
  for (const slice of resolved.slices) {
    // `null` for a slice the user cleared to `undefined` - the global filter
    // over an `initialState.globalFilter`. JSON drops an `undefined` key, and
    // a missing slice means the initial state, so a reload would come back on
    // the very value the user cleared. readSlices turns it back.
    payload[slice] = state[slice] === undefined ? null : state[slice];
  }
  try {
    storage.setItem(resolved.key, serialize(payload as Partial<GridState>));
  } catch {
    // Quota exceeded or storage disabled. Persistence is best effort.
  }
}

/**
 * Writes the URL payload: the selected slices that differ from `baseline`,
 * with no version stamp, or no param at all when none differs.
 *
 * Only the difference goes in, so a link names what the user changed and not
 * what the page starts with anyway: the address bar stays short, and an old
 * link does not pin a default the page has since changed. No stamp, because a
 * bookmarked link has to survive a release; the shape guards and the
 * realignment on read are what keep an old link safe.
 */
function writeUrlSlices({
  urlStorage,
  resolved,
  state,
  baseline,
  excludedFilterColumnIds,
  serialize,
}: {
  urlStorage: TMDataGridUrlStorage | null;
  resolved: ResolvedKey | null;
  state: GridState;
  baseline: Partial<GridState>;
  excludedFilterColumnIds: ReadonlySet<string>;
  serialize: (value: Partial<GridState>) => string;
}): void {
  if (!urlStorage || !resolved) return;
  const payload: Record<string, unknown> = {};
  for (const slice of resolved.slices) {
    // Both sides reduced the same way, so a change to an opted-out column or
    // to a filter that narrows nothing does not put the param in the URL.
    const value =
      slice === "columnFilters"
        ? linkableColumnFilters(state.columnFilters, excludedFilterColumnIds)
        : state[slice];
    const initial =
      slice === "columnFilters"
        ? linkableColumnFilters(baseline.columnFilters, excludedFilterColumnIds)
        : baseline[slice];
    if (sameStateValue(value, initial)) continue;
    // `null` for a slice the user cleared to `undefined` - the global filter
    // over an `initialState.globalFilter`. JSON drops an `undefined` key, and
    // a missing slice means the initial state, so the link would reopen on
    // the very value the user cleared. readSlices turns it back.
    payload[slice] = value === undefined ? null : value;
  }
  try {
    const next =
      Object.keys(payload).length === 0
        ? null
        : serialize(payload as Partial<GridState>);
    // Unchanged: no write. A router-backed storage may navigate on every
    // `set`, and the debounced write runs after a resize or a selection too.
    if (urlStorage.get(resolved.key) === next) return;
    urlStorage.set(resolved.key, next);
  } catch {
    // History access refused, or a router's own storage threw. Best effort,
    // like storage.
  }
}

function withoutColumnFilters(
  filters: GridState["columnFilters"] | undefined,
  excluded: ReadonlySet<string>,
): GridState["columnFilters"] | undefined {
  if (filters === undefined || excluded.size === 0) return filters;
  return filters.filter((filter) => !excluded.has(filter.id));
}

/**
 * The column filters a link carries: not on an opted-out column, and narrowing
 * the rows. A filter that narrows nothing is a row the filter panel seeded or
 * the user has not filled in yet; in a link it would only reopen an empty row.
 */
function linkableColumnFilters(
  filters: GridState["columnFilters"] | undefined,
  excluded: ReadonlySet<string>,
): GridState["columnFilters"] | undefined {
  return withoutColumnFilters(filters, excluded)?.filter(filterNarrowsRows);
}

function resolveKeys(persistence: TMDataGridPersistence | undefined) {
  const url = resolveKey(persistence?.urlKey, DATA_STATE_SLICES);
  const data = resolveKey(persistence?.dataKey, DATA_STATE_SLICES);
  return {
    url,
    // A slice lives in one group. The URL takes what both keys list, so a
    // stored copy can never override the link that was opened.
    data:
      data !== null && url !== null
        ? {
            key: data.key,
            slices: data.slices.filter((slice) => !url.slices.includes(slice)),
          }
        : data,
    settings: resolveKey(persistence?.settingsKey, SETTINGS_STATE_SLICES),
  };
}

/** True when at least one key is configured. */
export function hasPersistenceKeys(
  persistence: TMDataGridPersistence | undefined,
): boolean {
  const { url, data, settings } = resolveKeys(persistence);
  return url !== null || data !== null || settings !== null;
}

/**
 * The data slices that a `dataKey` tuple names and `urlKey` also lists;
 * `urlKey` takes them. A bare `dataKey` names no slice, so it reports nothing:
 * "every data slice" plus a `urlKey` is the ordinary setup, and resolveKeys
 * hands the URL its slices without a word. Only a slice named twice is a
 * contradiction worth reporting.
 */
export function findOverlappingSlices(
  persistence: TMDataGridPersistence | undefined,
): TMDataGridDataSlice[] {
  if (typeof persistence?.dataKey === "string") return [];
  const url = resolveKey(persistence?.urlKey, DATA_STATE_SLICES);
  const data = resolveKey(persistence?.dataKey, DATA_STATE_SLICES);
  if (url === null || data === null) return [];
  return DATA_STATE_SLICES.filter(
    (slice) => url.slices.includes(slice) && data.slices.includes(slice),
  );
}

const defaultDeserialize = (value: string): unknown => JSON.parse(value);
const defaultSerialize = (value: Partial<GridState>): string =>
  JSON.stringify(value);

/**
 * The leaf column ids a set of column defs will produce, by TanStack's own
 * derivation: `id`, else `accessorKey` with dots replaced by underscores,
 * else a string `header`. Mirrored here so restored state can be realigned
 * against the columns that will actually exist - deriving ids any other way
 * would realign against names the table never uses.
 */
export function collectLeafColumnIds(
  defs: ReadonlyArray<unknown>,
  into: string[] = [],
): string[] {
  forEachLeafColumnDef(defs, (id) => into.push(id));
  return into;
}

/**
 * The leaf column ids whose `meta.filter.url` is `false`, by the same id
 * derivation as {@link collectLeafColumnIds}. Their filters stay out of the
 * `urlKey` param, on read and on write.
 */
export function collectUrlExcludedColumnIds(
  defs: ReadonlyArray<unknown>,
  into: string[] = [],
): string[] {
  forEachLeafColumnDef(defs, (id, record) => {
    if (prop(prop(record.meta, "filter"), "url") === false) into.push(id);
  });
  return into;
}

/**
 * Visits every leaf column definition under `defs` with the id TanStack gives
 * it: `id`, else the `accessorKey` with dots replaced by underscores, else a
 * string `header`.
 *
 * @internal Shared by persistence and the typed links in urlState.ts; not
 * exported from the package.
 */
export function forEachLeafColumnDef(
  defs: ReadonlyArray<unknown>,
  visit: (id: string, record: Record<string, unknown>) => void,
): void {
  for (const def of defs) {
    if (typeof def !== "object" || def === null) continue;
    const record = def as Record<string, unknown>;
    if (Array.isArray(record.columns) && record.columns.length > 0) {
      forEachLeafColumnDef(record.columns, visit);
      continue;
    }
    const accessorKey =
      typeof record.accessorKey === "string" ? record.accessorKey : undefined;
    const id =
      (typeof record.id === "string" ? record.id : undefined) ??
      accessorKey?.replaceAll(".", "_") ??
      (typeof record.header === "string" ? record.header : undefined);
    if (id !== undefined) visit(id, record);
  }
}

/**
 * Drops restored entries that name columns the grid no longer has.
 *
 * A stored layout outlives the column set: a column removed between deploys
 * would otherwise linger forever - a ghost id in the order, a width for
 * nothing, and worse, a *filter or sort that is active but has no column to
 * show for itself*. New columns need no counterpart here: TanStack appends
 * columns missing from `columnOrder` on its own, in definition order.
 *
 * @internal Also applied to a saved view before it is applied.
 */
export function realignToColumns(
  restored: Partial<GridState>,
  known: ReadonlySet<string>,
): Partial<GridState> {
  const has = (id: unknown): boolean =>
    typeof id === "string" && known.has(id);
  const keepIds = (values: ReadonlyArray<string>) => values.filter(has);
  const keepKeys = <T,>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([id]) => has(id)));
  const keepEntries = <T extends { id: string }>(entries: ReadonlyArray<T>) =>
    entries.filter((entry) => has(entry.id));

  const realigned: Partial<GridState> = { ...restored };
  if (restored.columnOrder) realigned.columnOrder = keepIds(restored.columnOrder);
  if (restored.grouping) realigned.grouping = keepIds(restored.grouping);
  if (restored.columnVisibility) {
    realigned.columnVisibility = keepKeys(restored.columnVisibility);
  }
  if (restored.columnSizing) {
    realigned.columnSizing = keepKeys(restored.columnSizing);
  }
  if (restored.columnPinning) {
    realigned.columnPinning = {
      start: keepIds(restored.columnPinning.start ?? []),
      end: keepIds(restored.columnPinning.end ?? []),
    };
  }
  if (restored.sorting) realigned.sorting = keepEntries(restored.sorting);
  if (restored.columnFilters) {
    realigned.columnFilters = keepEntries(restored.columnFilters);
  }
  return realigned;
}

/** What the `urlKey` group needs beyond the persistence config itself. */
export type TMDataGridUrlPersistInputs = {
  /**
   * The state the table starts with when nothing is restored: the grid's
   * defaults merged with `initialState`. The URL carries only the slices that
   * differ from it. Without it, every slice that has a value is written. On
   * read, a column opted out of the URL keeps its filter from it.
   */
  baseline?: Partial<GridState>;
  /** See {@link collectUrlExcludedColumnIds}. */
  excludedFilterColumnIds?: ReadonlyArray<string>;
  /** Whether a write touches the URL. Defaults to `true`; ignored on read. */
  writeUrl?: boolean;
};

/**
 * State to merge into `initialState`, read once on mount: settings, then data,
 * then the URL. The groups are disjoint, since the URL takes the slices it
 * shares with `dataKey`.
 *
 * With `knownColumnIds` - every id the grid is about to construct, generated
 * lanes included - the column-shaped slices are realigned first; see
 * {@link realignToColumns}. Without it the payload is returned as stored.
 */
export function readPersistedState(
  persistence?: TMDataGridPersistence,
  knownColumnIds?: ReadonlyArray<string>,
  {
    baseline = {},
    excludedFilterColumnIds = [],
  }: TMDataGridUrlPersistInputs = {},
): Partial<GridState> {
  const storage = resolveStorage(persistence);
  const readStorage = storage ? (key: string) => storage.getItem(key) : null;
  const urlStorage = resolveUrlStorage(persistence);
  const readUrl = urlStorage ? (key: string) => urlStorage.get(key) : null;
  const { url, data, settings } = resolveKeys(persistence);
  const deserialize = persistence?.deserialize ?? defaultDeserialize;
  const fromUrl = readSlices({
    read: readUrl,
    resolved: url,
    deserialize,
    versioned: false,
  });
  if (fromUrl.columnFilters) {
    // The link never speaks for an opted-out column - the write leaves those
    // out of both sides - so such a column keeps its initial filter, which
    // the restored slice would otherwise replace along with the rest.
    const excluded = new Set(excludedFilterColumnIds);
    fromUrl.columnFilters = [
      ...(baseline.columnFilters ?? []).filter((filter) =>
        excluded.has(filter.id),
      ),
      ...(withoutColumnFilters(fromUrl.columnFilters, excluded) ?? []),
    ];
  }
  const restored = {
    ...readSlices({
      read: readStorage,
      resolved: settings,
      deserialize,
      versioned: true,
    }),
    ...readSlices({
      read: readStorage,
      resolved: data,
      deserialize,
      versioned: true,
    }),
    ...fromUrl,
  };
  return knownColumnIds === undefined
    ? restored
    : realignToColumns(restored, new Set(knownColumnIds));
}

/** Writes every configured payload. Called on every table state change. */
export function writePersistedState(
  state: GridState,
  persistence?: TMDataGridPersistence,
  {
    baseline = {},
    excludedFilterColumnIds = [],
    writeUrl = true,
  }: TMDataGridUrlPersistInputs = {},
): void {
  const { url, data, settings } = resolveKeys(persistence);
  const serialize = persistence?.serialize ?? defaultSerialize;
  if (writeUrl) {
    writeUrlSlices({
      urlStorage: resolveUrlStorage(persistence),
      resolved: url,
      state,
      baseline,
      excludedFilterColumnIds: new Set(excludedFilterColumnIds),
      serialize,
    });
  }
  const storage = resolveStorage(persistence);
  if (!storage) return;
  writeSlices(storage, data, state, serialize);
  writeSlices(storage, settings, state, serialize);
}
