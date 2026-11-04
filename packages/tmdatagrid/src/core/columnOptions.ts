import type { Column, Row, RowData } from "@tanstack/react-table";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

/**
 * One choice of a `select` / `multiSelect` column. A bare string in any options
 * list is shorthand for `{ value }`.
 */
export type TMDataGridOption = {
  value: string;
  /** Shown in dropdowns. Defaults to the value itself. */
  label?: string;
  /** Mantine colour for the value's badge, where a cell renders one. */
  color?: string;
  disabled?: boolean;
  /** Dropdown group heading. Ungrouped options render first. */
  group?: string;
};

/**
 * What an options function is called with. `TData` is the row type of the
 * column helper the column was declared with.
 */
export type TMDataGridOptionsArgs<TData extends RowData = TMDataGridRowData> = {
  table: TMDataGridTable<TData>;
  column: Column<TMDataGridFeatures, TData, unknown>;
  /** The row an editor is standing on. Absent when the filter panel asks. */
  row?: Row<TMDataGridFeatures, TData>;
  /**
   * Source to use when the column declares none. The filter panel passes
   * `"faceted"` so a select column with no `meta.options` still offers the
   * values that exist, rather than an empty dropdown.
   */
  fallback?: TMDataGridOptionsSource<TData>;
};

/**
 * Where a column's options come from - `meta.options`. One declaration feeds
 * both the filter panel's value control and the cell editor.
 *
 * | Form | For |
 * | --- | --- |
 * | array | a known, fixed set |
 * | `"faceted"` | low-cardinality data columns: the distinct values present, via `getFacetedUniqueValues` |
 * | function | large or contextual sets - `row` is set when an editor asks, so options can depend on the record (city given country) |
 */
export type TMDataGridOptionsSource<TData extends RowData = TMDataGridRowData> =
  | ReadonlyArray<TMDataGridOption | string>
  | "faceted"
  | ((
      args: TMDataGridOptionsArgs<TData>,
    ) => ReadonlyArray<TMDataGridOption | string>);

/**
 * Columns already warned about, per grid - so a warning fires once and a
 * test's grid is not silenced by another test's. Keyed on `table.store`, not
 * on the table: `useTable` returns a fresh table object every render, while
 * the store is created once and shared by every render's copy.
 */
const warnedFaceted = new WeakMap<object, Set<string>>();

/**
 * Faceted options read the distinct values in `data`, which under
 * `manualFiltering` or `manualPagination` is whatever the server sent for the
 * current page. The dropdown then offers the values that happen to be on the
 * page the user is looking at, and looks correct while being wrong - so it is
 * said out loud, once per column.
 *
 * Fires from render, unlike the library's other warnings: the fallback form
 * of `"faceted"` only exists at resolve time, which is render. The guard
 * makes it once per grid regardless - a StrictMode double render or a
 * discarded concurrent render marks the set the same way a committed one
 * does. H3 in the backlog folds it into the diagnostics mechanism with the
 * rest.
 */
function warnFacetedUnderManualMode(
  table: TMDataGridTable<TMDataGridRowData>,
  columnId: string,
): void {
  if (
    table.options.manualFiltering !== true &&
    table.options.manualPagination !== true
  ) {
    return;
  }
  const store = table.store as object;
  let warned = warnedFaceted.get(store);
  if (warned === undefined) {
    warned = new Set();
    warnedFaceted.set(store, warned);
  }
  if (warned.has(columnId)) return;
  warned.add(columnId);
  console.warn(
    `TMDataGrid: column "${columnId}" resolves faceted options while the server owns the rows - the distinct values of one page are not the distinct values of the result set. Pass meta.options as a list or a function instead.`,
  );
}

function addFacetValue(target: Set<string>, value: unknown): void {
  if (value === null || value === undefined || value === "") return;
  target.add(String(value));
}

/**
 * A column's options as a normalised list, whatever form `meta.options` took.
 * Empty for a column that declares none.
 *
 * `"faceted"` reads the distinct values actually present in the data. A
 * multiSelect cell holds an array, so array values contribute their elements
 * rather than the array itself.
 */
export function resolveColumnOptions({
  table,
  column,
  row,
  fallback,
}: TMDataGridOptionsArgs): Array<TMDataGridOption> {
  const source = column.columnDef.meta?.options ?? fallback;
  if (!source) return [];

  if (source === "faceted") {
    warnFacetedUnderManualMode(table, column.id);
    const values = new Set<string>();
    for (const key of column.getFacetedUniqueValues().keys()) {
      if (Array.isArray(key)) {
        for (const entry of key) addFacetValue(values, entry);
      } else {
        addFacetValue(values, key);
      }
    }
    return [...values]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((value) => ({ value }));
  }

  const list = typeof source === "function" ? source({ table, column, row }) : source;
  return list.map((option) =>
    typeof option === "string" ? { value: option } : option,
  );
}

type ComboboxItem = { value: string; label: string; disabled?: boolean };
type ComboboxData = Array<ComboboxItem | { group: string; items: ComboboxItem[] }>;

/**
 * The same list in the shape Mantine's `Select` / `MultiSelect` take, with
 * `group` fields folded into Mantine's group entries. Ungrouped options come
 * first, then the groups in first-appearance order.
 */
export function optionsToComboboxData(
  options: ReadonlyArray<TMDataGridOption>,
): ComboboxData {
  const ungrouped: ComboboxItem[] = [];
  const groups = new Map<string, ComboboxItem[]>();

  for (const option of options) {
    const item: ComboboxItem = {
      value: option.value,
      label: option.label ?? option.value,
      ...(option.disabled ? { disabled: true } : {}),
    };
    if (option.group === undefined) {
      ungrouped.push(item);
    } else {
      const bucket = groups.get(option.group);
      if (bucket) bucket.push(item);
      else groups.set(option.group, [item]);
    }
  }

  return [
    ...ungrouped,
    ...[...groups].map(([group, items]) => ({ group, items })),
  ];
}
