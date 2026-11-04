import type { ReadonlyStore, Store } from "@tanstack/store";

/**
 * Timing repair for TanStack's controlled-state sync.
 *
 * `useTable` calls `table.setOptions` from its render body, and that syncs
 * `options.state` into the table's atoms. An atom write publishes the store
 * synchronously, so every component subscribed to `table.store` schedules a
 * setState while the consumer's component is still rendering - which React
 * reports as "Cannot update a component (X) while rendering a different
 * component (Y)", pointing at the consumer's component rather than at the
 * grid.
 *
 * The write has to stay where it is: the atoms must hold the controlled value
 * before the table builds its row models for that render. Only the
 * notification is early, so it moves to a microtask. `getSnapshot` already
 * returns the new value, so a component reads the same state either way; the
 * subscription is only what schedules a re-render for the components the
 * consumer's own render does not reach.
 *
 * Scope and assumptions. Only `table.store` is patched: a subscription made
 * on `table.atoms.*` or `table.baseAtoms.*` keeps the synchronous timing.
 * The patch leans on three table-core 9.0.0-beta.21 internals - the store is
 * created once in `constructTable`, `useTable` returns a shallow copy that
 * shares it, and the sync runs inside `setOptions` during render. The
 * publish test in controlledState.test.tsx fails loudly if any of them
 * moves; it is the guard for this module, not a redundant check. The
 * intended end state - owning the controlled slices through `options.atoms`,
 * which removes the render-time sync entirely - is in the backlog.
 */

type Observer = ((value: unknown) => void) | { next?: (value: unknown) => void };

type Subscribe = (observer: Observer) => { unsubscribe: () => void };

/**
 * True while `useTable` is syncing controlled state inside a render pass.
 * Process-global, so while one grid is inside its `useTable` call a publish
 * on any patched store is deferred too - harmless, since nothing else runs
 * during a synchronous render pass.
 */
let syncing = false;

/**
 * Called immediately before the `useTable` call that performs the sync.
 *
 * The microtask is the backstop that bounds the flag to the current task: if
 * `useTable` throws and an error boundary unmounts the grid, nothing after
 * the call runs, and without it every patched store would keep deferring its
 * notifications for the life of the page.
 */
export function beginControlledStateSync(): void {
  syncing = true;
  queueMicrotask(() => {
    syncing = false;
  });
}

/**
 * Called immediately after it - the prompt clear; correctness rests on the
 * backstop above. Not a `finally` around the call, because hooks inside
 * `try` opt the whole hook out of the React Compiler.
 */
export function endControlledStateSync(): void {
  syncing = false;
}

const patched = new WeakSet<object>();

/**
 * Wraps a table store's `subscribe` so notifications raised during the sync
 * are delivered in a microtask. Idempotent, and installed on the store object
 * itself rather than on a copy of the table - rows hold the original, so
 * `row.table.store` has to be the patched one.
 */
export function deferControlledStateSyncPublishes<TState>(
  store: Store<TState> | ReadonlyStore<TState>,
): void {
  if (patched.has(store)) return;
  patched.add(store);

  const subscribe = store.subscribe.bind(store) as Subscribe;

  (store as unknown as { subscribe: Subscribe }).subscribe = (observer) => {
    const next =
      typeof observer === "function" ? observer : observer.next?.bind(observer);
    if (next === undefined) return subscribe(observer);

    let live = true;
    const subscription = subscribe((value) => {
      if (!syncing) {
        next(value);
        return;
      }
      queueMicrotask(() => {
        // The subscriber may have unmounted between the write and the flush.
        if (live) next(value);
      });
    });

    return {
      unsubscribe: () => {
        live = false;
        subscription.unsubscribe();
      },
    };
  };
}
