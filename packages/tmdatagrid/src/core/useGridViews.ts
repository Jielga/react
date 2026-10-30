import { useEffect, useMemo, useRef, useState } from "react";
import { sameStateValue } from "./controlledState";
import { SETTINGS_STATE_SLICES, type TMDataGridSettingsSlice } from "./persistence";
import {
  captureViewState,
  createViewId,
  normalizeView,
  pickViewSlices,
  validateViewName,
  VIEW_PAYLOAD_VERSION,
  type TMDataGridView,
  type TMDataGridViewEntry,
  type TMDataGridViewPreset,
  type TMDataGridViewState,
  type TMDataGridViewsApi,
  type TMDataGridViewsOptions,
} from "./views";

const NO_PRESETS: ReadonlyArray<TMDataGridViewPreset> = [];

/** The value as of the last render it structurally changed in. */
function useStructurallyStable<T>(value: T): T {
  const ref = useRef(value);
  if (!sameStateValue(ref.current, value)) ref.current = value;
  return ref.current;
}

/**
 * The preset a first visit starts on: `defaultView`, unless the settings were
 * restored from storage - then the user has been here before.
 *
 * @internal Read once by `useTMDataGrid`, which seeds the table's
 * `initialState` with it so the first paint already shows the view.
 */
export function resolveStartingView(
  options: TMDataGridViewsOptions | undefined,
  restoredSettings: boolean,
): TMDataGridViewPreset | null {
  if (options?.defaultView === undefined || restoredSettings) return null;
  return (
    options.presets?.find((preset) => preset.id === options.defaultView) ?? null
  );
}

/**
 * The views state behind `grid.views`.
 *
 * @internal `applyState` and `readState` come from `useTMDataGrid`, which owns
 * the table and knows how the generated lanes have to be laid back on.
 */
export function useGridViews({
  options,
  startingViewId,
  restoredSettings,
  applyState,
  readState,
}: {
  options: TMDataGridViewsOptions | undefined;
  startingViewId: string | null;
  restoredSettings: boolean;
  applyState: (state: TMDataGridViewState) => void;
  readState: () => TMDataGridViewState;
}): TMDataGridViewsApi {
  const enabled = options !== undefined;
  const store = options?.store;
  const presets = useStructurallyStable(options?.presets ?? NO_PRESETS);
  const slices = useStructurallyStable<ReadonlyArray<TMDataGridSettingsSlice>>(
    options?.slices ?? SETTINGS_STATE_SLICES,
  );
  const allowUserViews = enabled && options?.allowUserViews !== false;

  const [userViews, setUserViews] = useState<TMDataGridView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(startingViewId);
  const [status, setStatus] = useState<TMDataGridViewsApi["status"]>(
    store === undefined ? "ready" : "loading",
  );

  const list = useMemo<TMDataGridViewEntry[]>(() => {
    const presetIds = new Set(presets.map((preset) => preset.id));
    return [
      ...presets.map((preset) => ({ ...preset, source: "preset" as const })),
      // A user view cannot shadow a preset that took its id.
      ...userViews
        .filter((view) => !presetIds.has(view.id))
        .map(({ id, name, state }) => ({
          id,
          name,
          state,
          source: "user" as const,
        })),
    ];
  }, [presets, userViews]);

  // The verbs read the latest render through refs, so their identities never
  // change and an awaited store call never acts on a stale list.
  const latest = useRef({ list, activeId, slices, store, allowUserViews });
  latest.current = { list, activeId, slices, store, allowUserViews };
  const applyRef = useRef(applyState);
  applyRef.current = applyState;
  const readRef = useRef(readState);
  readRef.current = readState;

  // Read once: whether the first load may apply the stored view, or only
  // mark it. With the settings restored, the table already shows the layout
  // the user left, which may be the view with changes on top.
  const [mayApplyStored] = useState(!restoredSettings);

  useEffect(() => {
    if (store === undefined) return;
    let cancelled = false;

    const load = async (initial: boolean) => {
      try {
        const [stored, storedActive] = await Promise.all([
          store.list(),
          store.getActiveId(),
        ]);
        if (cancelled) return;
        const views = stored.flatMap((view) => normalizeView(view) ?? []);
        setUserViews(views);
        const known = (id: string | null) =>
          id !== null &&
          (views.some((view) => view.id === id) ||
            latest.current.list.some(
              (entry) => entry.source === "preset" && entry.id === id,
            ));
        if (initial) {
          if (known(storedActive)) {
            setActiveId(storedActive);
            if (mayApplyStored && storedActive !== startingViewId) {
              const entry =
                views.find((view) => view.id === storedActive) ??
                latest.current.list.find((item) => item.id === storedActive);
              if (entry) {
                applyRef.current(
                  pickViewSlices(entry.state, latest.current.slices),
                );
              }
            }
          } else if (startingViewId !== null) {
            void store.setActiveId(startingViewId).catch(() => {});
          } else {
            setActiveId(null);
          }
        } else {
          // Another tab changed the list. The selection is this tab's own,
          // unless the view it points at is gone.
          setActiveId((current) => (known(current) ? current : null));
        }
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    void load(true);
    const unsubscribe = store.subscribe?.(() => void load(false));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // `startingViewId` and `mayApplyStored` are fixed at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const verbs = useMemo(() => {
    const find = (id: string | null) =>
      id === null
        ? undefined
        : latest.current.list.find((entry) => entry.id === id);

    const remember = (id: string | null) => {
      setActiveId(id);
      void latest.current.store?.setActiveId(id).catch(() => {});
    };

    const capture = () =>
      captureViewState(readRef.current(), latest.current.slices);

    return {
      select: (id: string) => {
        const entry = find(id);
        if (entry === undefined) return;
        applyRef.current(pickViewSlices(entry.state, latest.current.slices));
        remember(id);
      },
      restore: () => {
        const entry = find(latest.current.activeId);
        if (entry === undefined) return;
        applyRef.current(pickViewSlices(entry.state, latest.current.slices));
      },
      validateName: (name: string) =>
        validateViewName(name, latest.current.list),
      saveAs: async (name: string) => {
        if (!latest.current.allowUserViews) {
          return { ok: false as const, error: "notAllowed" as const };
        }
        const error = validateViewName(name, latest.current.list);
        if (error !== null) return { ok: false as const, error };
        const view: TMDataGridView = {
          id: createViewId(),
          name: name.trim(),
          version: VIEW_PAYLOAD_VERSION,
          state: capture(),
        };
        try {
          await latest.current.store?.save(view);
        } catch {
          return { ok: false as const, error: "store" as const };
        }
        setUserViews((views) => [...views, view]);
        remember(view.id);
        return { ok: true as const, view };
      },
      overwrite: async () => {
        const entry = find(latest.current.activeId);
        if (!latest.current.allowUserViews || entry?.source !== "user") {
          return false;
        }
        const view: TMDataGridView = {
          id: entry.id,
          name: entry.name,
          version: VIEW_PAYLOAD_VERSION,
          state: capture(),
        };
        try {
          await latest.current.store?.save(view);
        } catch {
          return false;
        }
        setUserViews((views) =>
          views.map((item) => (item.id === view.id ? view : item)),
        );
        return true;
      },
      remove: async (id: string) => {
        const entry = find(id);
        if (!latest.current.allowUserViews || entry?.source !== "user") {
          return false;
        }
        try {
          await latest.current.store?.remove(id);
        } catch {
          return false;
        }
        setUserViews((views) => views.filter((view) => view.id !== id));
        if (latest.current.activeId === id) remember(null);
        return true;
      },
    };
  }, []);

  return useMemo<TMDataGridViewsApi>(() => {
    const active = list.find((entry) => entry.id === activeId) ?? null;
    return {
      enabled,
      status,
      list,
      activeId: active === null ? null : activeId,
      active,
      allowUserViews,
      ...verbs,
    };
  }, [enabled, status, list, activeId, allowUserViews, verbs]);
}
