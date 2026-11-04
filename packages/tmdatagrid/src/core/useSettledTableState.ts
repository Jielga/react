import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import type { ReadonlyStore, Store } from "@tanstack/store";

/** The one slice a settled subscription leaves out. */
const TRANSIENT_SLICE = "columnResizing";

/**
 * Subscribes to every table state slice except the transient resize state.
 *
 * `columnResizing` publishes a new delta on every pointer move of a resize
 * drag. Nothing renders from those deltas - the divider highlight reads
 * `isResizingColumn` through its own selector, and the drag itself is painted
 * straight onto the grid's track list (see `resizePreview`) - so a component
 * subscribed to the whole store would re-render the grid dozens of times a
 * second for state it does not show.
 *
 * The comparison is shallow over the remaining slices, which is the
 * granularity TanStack publishes at: a slice keeps its identity until it
 * changes.
 */
export function useSettledTableState<TState extends object>(
  store: Store<TState> | ReadonlyStore<TState>,
): void {
  useSelector(
    store,
    (state) => {
      const settled: Record<string, unknown> = {};
      for (const [slice, value] of Object.entries(state)) {
        if (slice !== TRANSIENT_SLICE) settled[slice] = value;
      }
      return settled;
    },
    { compare: shallow },
  );
}
