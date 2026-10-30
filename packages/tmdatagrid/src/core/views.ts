import type { TableState } from "@tanstack/react-table";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { isGeneratedColumn } from "./columnUtils";
import {
  readSettingsSlices,
  realignToColumns,
  resolveStorageArea,
  SETTINGS_STATE_SLICES,
  type TMDataGridSettingsSlice,
  type TMDataGridStorageMode,
} from "./persistence";

type GridState = TableState<TMDataGridFeatures>;

/**
 * The layout a view holds: any of the settings slices - visibility, widths,
 * order, pinning, grouping. A slice the view does not hold is left as it is
 * when the view is applied.
 */
export type TMDataGridViewState = Partial<
  Pick<GridState, TMDataGridSettingsSlice>
>;

/**
 * Version stamped into every view the grid saves.
 *
 * Unlike a `persist` payload, a view from another version is migrated rather
 * than dropped: the user named it and saved it on purpose, and losing it on
 * an upgrade is not the same cost as losing a remembered layout. Version 1 is
 * the only shape so far, so the migration is the shape guard alone.
 */
export const VIEW_PAYLOAD_VERSION = 1;

/** A view the user saved. */
export type TMDataGridView = {
  id: string;
  name: string;
  version: number;
  state: TMDataGridViewState;
};

/** A view the developer defines in code. Read-only: never saved, renamed or deleted. */
export type TMDataGridViewPreset = {
  id: string;
  name: string;
  state: TMDataGridViewState;
};

/** One entry of the views list, presets first. */
export type TMDataGridViewEntry = {
  id: string;
  name: string;
  /** `"preset"` for a developer preset, `"user"` for a view the user saved. */
  source: "preset" | "user";
  state: TMDataGridViewState;
};

/**
 * Where user views are kept. Every method is async, so an adapter backed by a
 * server fits the same shape as the local one.
 */
export type TMDataGridViewStore = {
  /** Every saved view, in the order they were saved. */
  list(): Promise<TMDataGridView[]>;
  /** Adds the view, or replaces the one with the same `id`. */
  save(view: TMDataGridView): Promise<void>;
  remove(id: string): Promise<void>;
  /** The id of the view last selected, preset or user view, or `null`. */
  getActiveId(): Promise<string | null>;
  setActiveId(id: string | null): Promise<void>;
  /**
   * Calls `onChange` when the views change somewhere else - another tab, or a
   * server push. Returns the unsubscribe.
   */
  subscribe?(onChange: () => void): () => void;
};

/** Why a view name cannot be saved. */
export type TMDataGridViewNameError = "empty" | "duplicate";

/** What `saveAs` resolves to. `"store"` means the store rejected the write. */
export type TMDataGridSaveViewResult =
  | { ok: true; view: TMDataGridView }
  | { ok: false; error: TMDataGridViewNameError | "notAllowed" | "store" };

/** The `views` option of `useTMDataGrid`. */
export type TMDataGridViewsOptions = {
  /**
   * Where user views and the selected view are kept. Without one they last
   * as long as the grid is mounted.
   */
  store?: TMDataGridViewStore;
  /** Read-only views defined in code, listed first. */
  presets?: ReadonlyArray<TMDataGridViewPreset>;
  /**
   * The slices a view saves and restores. Defaults to all five settings
   * slices. A slice left out is never written by a view.
   */
  slices?: ReadonlyArray<TMDataGridSettingsSlice>;
  /**
   * A preset id. Applied on a first visit: when no view was selected before
   * and `persist.settingsKey` restored nothing.
   */
  defaultView?: string;
  /**
   * Whether the user can save, overwrite and delete views of their own.
   * `false` leaves only picking between presets. Defaults to `true`.
   */
  allowUserViews?: boolean;
};

/** `grid.views` - the saved views, and the verbs that act on them. */
export type TMDataGridViewsApi = {
  /** Whether the `views` option is set. Every views component renders nothing otherwise. */
  enabled: boolean;
  /** `"loading"` until the store has answered, `"error"` if it rejected. */
  status: "loading" | "ready" | "error";
  /** Presets first, then the user's views. */
  list: ReadonlyArray<TMDataGridViewEntry>;
  /** The selected view, or `null`. */
  activeId: string | null;
  active: TMDataGridViewEntry | null;
  /**
   * Whether the layout has changed since the selected view was applied: one
   * of the slices the view holds no longer matches it. `false` with no view
   * selected. Selecting the view again discards the changes.
   */
  modified: boolean;
  /** The `allowUserViews` option. */
  allowUserViews: boolean;
  /**
   * Applies a view and makes it the selected one. Selecting the view that is
   * already selected applies it again, which discards the changes made since.
   */
  select(id: string): void;
  /** Checks a name against the other views: trimmed, case-insensitive. */
  validateName(name: string): TMDataGridViewNameError | null;
  /** Saves the current layout as a new user view and selects it. */
  saveAs(name: string): Promise<TMDataGridSaveViewResult>;
  /** Saves the current layout into the selected user view. `false` if there is none, or the store rejected. */
  overwrite(): Promise<boolean>;
  /** Deletes a user view. `false` for a preset, an unknown id, or a rejected write. */
  remove(id: string): Promise<boolean>;
};

const ownIds = (ids: ReadonlyArray<string> | undefined): string[] =>
  (ids ?? []).filter((id) => !isGeneratedColumn(id));

const ownKeys = <T>(
  record: Record<string, T> | undefined,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(record ?? {}).filter(([id]) => !isGeneratedColumn(id)),
  );

/**
 * The listed slices of a table state, as a view holds them.
 *
 * The generated lanes are left out of every slice: their visibility follows
 * their features and they are pinned by the grid, so a view saved before the
 * checkbox lane was switched off must not bring an entry for it back.
 */
export function captureViewState(
  state: Partial<GridState>,
  slices: ReadonlyArray<TMDataGridSettingsSlice> = SETTINGS_STATE_SLICES,
): TMDataGridViewState {
  const captured: TMDataGridViewState = {};
  for (const slice of slices) {
    switch (slice) {
      case "columnVisibility":
        captured.columnVisibility = ownKeys(state.columnVisibility);
        break;
      case "columnSizing":
        captured.columnSizing = ownKeys(state.columnSizing);
        break;
      case "columnOrder":
        captured.columnOrder = ownIds(state.columnOrder);
        break;
      case "columnPinning":
        captured.columnPinning = {
          start: ownIds(state.columnPinning?.start),
          end: ownIds(state.columnPinning?.end),
        };
        break;
      case "grouping":
        captured.grouping = [...(state.grouping ?? [])];
        break;
    }
  }
  return captured;
}

/** The slices of a view that `slices` lets through. */
export function pickViewSlices(
  state: TMDataGridViewState,
  slices: ReadonlyArray<TMDataGridSettingsSlice> = SETTINGS_STATE_SLICES,
): TMDataGridViewState {
  const picked: Record<string, unknown> = {};
  for (const slice of slices) {
    if (state[slice] !== undefined) picked[slice] = state[slice];
  }
  return picked as TMDataGridViewState;
}

const sameIds = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * Whether `state` has moved away from `view`, on the slices the view holds
 * that `slices` lets through - what `grid.views.modified` reports.
 *
 * Compared by effect rather than by shape, against the view as applying it
 * would lay it on (realigned against `columnIds`, the leaf ids in definition
 * order): a column with no visibility entry is shown, and an order that
 * leaves columns out puts them after the listed ones in definition order.
 * So hiding a column and showing it again, or dragging one away and back,
 * leaves the view unmodified. The generated lanes never count.
 */
export function isViewModified(
  view: TMDataGridViewState,
  state: Partial<GridState>,
  columnIds: ReadonlyArray<string>,
  slices: ReadonlyArray<TMDataGridSettingsSlice> = SETTINGS_STATE_SLICES,
): boolean {
  const expected = realignToColumns(
    pickViewSlices(view, slices),
    new Set(columnIds),
  ) as TMDataGridViewState;
  const own = columnIds.filter((id) => !isGeneratedColumn(id));
  const effectiveOrder = (order: ReadonlyArray<string> | undefined) => {
    const listed = ownIds(order).filter((id) => own.includes(id));
    return [...listed, ...own.filter((id) => !listed.includes(id))];
  };

  if (
    expected.columnVisibility &&
    own.some(
      (id) =>
        (expected.columnVisibility?.[id] !== false) !==
        (state.columnVisibility?.[id] !== false),
    )
  ) {
    return true;
  }
  if (
    expected.columnSizing &&
    own.some(
      (id) => expected.columnSizing?.[id] !== state.columnSizing?.[id],
    )
  ) {
    return true;
  }
  if (
    expected.columnOrder &&
    !sameIds(
      effectiveOrder(expected.columnOrder),
      effectiveOrder(state.columnOrder),
    )
  ) {
    return true;
  }
  if (
    expected.columnPinning &&
    (!sameIds(
      ownIds(expected.columnPinning.start),
      ownIds(state.columnPinning?.start),
    ) ||
      !sameIds(
        ownIds(expected.columnPinning.end),
        ownIds(state.columnPinning?.end),
      ))
  ) {
    return true;
  }
  return (
    expected.grouping !== undefined &&
    !sameIds(expected.grouping, state.grouping ?? [])
  );
}

/**
 * A view read from a store, checked and brought to the current version, or
 * `null` when it is not a view at all. Slices that fail their shape guard are
 * dropped; the rest of the view survives.
 */
export function normalizeView(value: unknown): TMDataGridView | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { id, name } = record;
  if (typeof id !== "string" || id === "") return null;
  if (typeof name !== "string" || name.trim() === "") return null;
  return {
    id,
    name,
    version: VIEW_PAYLOAD_VERSION,
    state: readSettingsSlices(record.state),
  };
}

/**
 * Why `name` cannot be used for a new view, or `null` when it can. Compared
 * trimmed and case-insensitively against every view, presets included, so two
 * entries in the menu never read the same.
 */
export function validateViewName(
  name: string,
  views: ReadonlyArray<{ id: string; name: string }>,
  exceptId?: string,
): TMDataGridViewNameError | null {
  const wanted = name.trim().toLocaleLowerCase();
  if (wanted === "") return "empty";
  const taken = views.some(
    (view) =>
      view.id !== exceptId && view.name.trim().toLocaleLowerCase() === wanted,
  );
  return taken ? "duplicate" : null;
}

/** A fresh view id. */
export function createViewId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** What the local store keeps under its key. */
export type TMDataGridStoredViews = {
  version: number;
  activeId: string | null;
  views: TMDataGridView[];
};

export type TMDataGridLocalViewStoreOptions = {
  /** Which storage area to use. Defaults to `"localStorage"`. */
  storageMode?: TMDataGridStorageMode;
  /** Serializes the payload. Defaults to `JSON.stringify`. */
  serialize?: (value: TMDataGridStoredViews) => string;
  /** Parses the payload. Defaults to `JSON.parse`. */
  deserialize?: (value: string) => unknown;
};

const EMPTY_STORED_VIEWS: TMDataGridStoredViews = {
  version: VIEW_PAYLOAD_VERSION,
  activeId: null,
  views: [],
};

/**
 * A {@link TMDataGridViewStore} over `localStorage` or `sessionStorage`: every
 * view and the selected id under one key. Other tabs see a change through
 * the `storage` event.
 *
 * Reads never throw - missing storage, a payload that does not parse, or a
 * view that fails its guard read as nothing. A write that cannot reach storage
 * rejects, so the grid can tell the user the view was not saved.
 *
 * ```ts
 * const store = createLocalStorageViewStore(`employees.views.${userId}`);
 * ```
 */
export function createLocalStorageViewStore(
  key: string,
  {
    storageMode,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  }: TMDataGridLocalViewStoreOptions = {},
): TMDataGridViewStore {
  const read = (): TMDataGridStoredViews => {
    const storage = resolveStorageArea(storageMode);
    if (storage === null) return EMPTY_STORED_VIEWS;
    try {
      const raw = storage.getItem(key);
      if (!raw) return EMPTY_STORED_VIEWS;
      const parsed = deserialize(raw);
      if (typeof parsed !== "object" || parsed === null) {
        return EMPTY_STORED_VIEWS;
      }
      const record = parsed as Record<string, unknown>;
      const views = Array.isArray(record.views)
        ? record.views.flatMap((view) => normalizeView(view) ?? [])
        : [];
      const activeId =
        typeof record.activeId === "string" ? record.activeId : null;
      return { version: VIEW_PAYLOAD_VERSION, activeId, views };
    } catch {
      return EMPTY_STORED_VIEWS;
    }
  };

  const write = (stored: TMDataGridStoredViews): void => {
    const storage = resolveStorageArea(storageMode);
    if (storage === null) throw new Error("TMDataGrid: no storage to save views in");
    storage.setItem(key, serialize(stored));
  };

  return {
    list: async () => read().views,
    save: async (view) => {
      const stored = read();
      const index = stored.views.findIndex((entry) => entry.id === view.id);
      const views = [...stored.views];
      if (index === -1) views.push(view);
      else views[index] = view;
      write({ ...stored, views });
    },
    remove: async (id) => {
      const stored = read();
      write({
        ...stored,
        views: stored.views.filter((view) => view.id !== id),
        activeId: stored.activeId === id ? null : stored.activeId,
      });
    },
    getActiveId: async () => read().activeId,
    setActiveId: async (id) => {
      const stored = read();
      if (stored.activeId === id) return;
      write({ ...stored, activeId: id });
    },
    subscribe: (onChange) => {
      if (typeof window === "undefined") return () => {};
      const storage = resolveStorageArea(storageMode);
      const listener = (event: StorageEvent) => {
        // A `null` key is a `clear()` of the whole area.
        if (event.storageArea !== null && event.storageArea !== storage) return;
        if (event.key === key || event.key === null) onChange();
      };
      window.addEventListener("storage", listener);
      return () => window.removeEventListener("storage", listener);
    },
  };
}
