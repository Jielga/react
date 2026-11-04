import { ActionIcon, TextInput } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef, useState } from "react";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getGridCapabilities } from "../core/capabilities";
import { CloseIcon, SearchIcon } from "./icons";

export type TMDataGridSearchProps = {
  /** Defaults to `labels.searchPlaceholder`. */
  placeholder?: string;
  /**
   * How long typing pauses before the filter is applied, in ms. Defaults to
   * 250. `0` writes on every keystroke - what the tests use, and fine for
   * small client-side data sets.
   */
  debounce?: number;
  /** Width of the input. Defaults to 220. */
  w?: number | string;
};

/**
 * Quick search over every column - a debounced input writing the table's
 * `globalFilter` state through the `"includesString"` filter the grid
 * configures by default.
 *
 * ```tsx
 * <TMDataGrid.Toolbar>
 *   <TMDataGrid.Search />
 *   <TMDataGrid.Spacer />
 *   <TMDataGrid.FilterButton />
 * </TMDataGrid.Toolbar>
 * ```
 *
 * Renders nothing under `enableGlobalFilter: false`. Columns opt out with
 * their own `enableGlobalFilter: false` - the generated lanes already do.
 *
 * The state is TanStack's `globalFilter`, so everything around it comes free:
 * `manualFiltering` grids forward it to the server, and it is one of the
 * persisted `data` slices. A grid that wants its own input entirely writes
 * `table.setGlobalFilter` itself - this component is only the built-in one.
 */
export function TMDataGridSearch({
  placeholder,
  debounce = 250,
  w = 220,
}: TMDataGridSearchProps) {
  const { table, features, labels, controlSize } = useTMDataGridContext();

  // A consumer can put anything in `globalFilter`; the input only mirrors the
  // string form and treats the rest as empty.
  const globalFilter = useSelector(table.store, (state) =>
    typeof state.globalFilter === "string" ? state.globalFilter : "",
  );

  const [draft, setDraft] = useState(globalFilter);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // What this input last wrote, so an echo of its own write is not mistaken
  // for an external change that should overwrite what is being typed.
  const lastWrittenRef = useRef(globalFilter);

  // External writes - a consumer's `setGlobalFilter`, a persistence restore -
  // win over the draft; the input is a mirror, not an owner.
  useEffect(() => {
    if (globalFilter === lastWrittenRef.current) return;
    lastWrittenRef.current = globalFilter;
    setDraft(globalFilter);
  }, [globalFilter]);

  // An unmount mid-debounce drops the pending write rather than filtering a
  // grid whose input no longer exists.
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  if (!getGridCapabilities(table, features).canSearch) return null;

  const commit = (value: string) => {
    lastWrittenRef.current = value;
    // `undefined` rather than `""`: an empty filter is no filter, and this is
    // what keeps the persisted slice and the funnel logic clean.
    table.setGlobalFilter(value === "" ? undefined : value);
  };

  const handleChange = (value: string) => {
    setDraft(value);
    clearTimeout(timeoutRef.current);
    if (debounce <= 0) {
      commit(value);
      return;
    }
    timeoutRef.current = setTimeout(() => commit(value), debounce);
  };

  return (
    <TextInput
      size={controlSize}
      w={w}
      value={draft}
      onChange={(event) => handleChange(event.currentTarget.value)}
      placeholder={placeholder ?? labels.searchPlaceholder}
      aria-label={labels.searchLabel}
      data-dg-part="search"
      leftSection={<SearchIcon size={16} stroke={1.6} />}
      rightSection={
        draft !== "" ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={labels.clearSearch}
            data-dg-part="search-clear"
            onClick={() => {
              clearTimeout(timeoutRef.current);
              setDraft("");
              commit("");
            }}
          >
            <CloseIcon size={14} stroke={1.6} />
          </ActionIcon>
        ) : undefined
      }
    />
  );
}
