import { useSyncExternalStore } from "react";

/**
 * A value that changes many times a second, such as the pointer position. The parts that show it read it with
 * `useStoreValue`, so a change renders them and not the page with the map.
 */
export type ValueStore<T> = {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createValueStore<T>(initial: T): ValueStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => {
      return value;
    },
    set: (next) => {
      if (next !== value) {
        value = next;
        for (const listener of listeners) {
          listener();
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStoreValue<T>(store: ValueStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
