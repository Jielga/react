import type { RowData } from "@tanstack/react-table";
import {
  isTMDataGridFilterValue,
  type TMDataGridFilterOperator,
} from "./filterOperators";
import type { TMDataGridTable } from "../useTMDataGrid";

/** A matched slice of a cell's text, `start` inclusive to `end` exclusive. */
export type TMDataGridMatchRange = { start: number; end: number };

/**
 * The operators whose match is a contiguous substring - the ones highlighting
 * can point at. Equality highlights nothing: marking the whole cell says
 * nothing the filter did not already say.
 */
const HIGHLIGHTABLE_OPERATORS: ReadonlyArray<TMDataGridFilterOperator> = [
  "contains",
  "startsWith",
  "endsWith",
];

/**
 * Every needle that could highlight in a given column, keyed by column id -
 * the quick search for the columns it searches, plus any contains-family
 * column filter. `null` while nothing highlightable is active, which is the
 * common case and the cheap one.
 *
 * The fuzzy quick search still contributes its raw text: when the needle occurs
 * contiguously it is highlighted, and a typo-match with no contiguous
 * occurrence is not highlighted at all.
 */
export function buildMatchNeedles<TData extends RowData>(
  table: TMDataGridTable<TData>,
): Map<string, ReadonlyArray<string>> | null {
  const state = table.store.state;
  const global =
    typeof state.globalFilter === "string" ? state.globalFilter.trim() : "";

  const byColumn = new Map<string, Array<string>>();
  for (const filter of state.columnFilters) {
    if (!isTMDataGridFilterValue(filter.value)) continue;
    const { operator, value } = filter.value;
    if (!HIGHLIGHTABLE_OPERATORS.includes(operator)) continue;
    if (typeof value !== "string" || value === "") continue;
    const needles = byColumn.get(filter.id) ?? [];
    needles.push(value);
    byColumn.set(filter.id, needles);
  }

  if (global === "" && byColumn.size === 0) return null;

  const map = new Map<string, ReadonlyArray<string>>();
  for (const column of table.getAllLeafColumns()) {
    const needles: Array<string> = [];
    if (global !== "" && column.getCanGlobalFilter()) needles.push(global);
    const own = byColumn.get(column.id);
    if (own !== undefined) needles.push(...own);
    if (needles.length > 0) map.set(column.id, needles);
  }
  return map.size > 0 ? map : null;
}

/**
 * Where the needles occur in the text, case-insensitively, merged where they
 * overlap or touch - so two needles covering "St" and "tock" come back as one
 * range rather than nested marks. `null` when nothing matches.
 */
export function findMatchRanges(
  text: string,
  needles: ReadonlyArray<string>,
): Array<TMDataGridMatchRange> | null {
  const haystack = text.toLowerCase();
  const found: Array<TMDataGridMatchRange> = [];
  for (const needle of needles) {
    const lowered = needle.toLowerCase();
    if (lowered === "") continue;
    let index = haystack.indexOf(lowered);
    while (index !== -1) {
      found.push({ start: index, end: index + lowered.length });
      index = haystack.indexOf(lowered, index + 1);
    }
  }
  if (found.length === 0) return null;

  found.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<TMDataGridMatchRange> = [];
  for (const range of found) {
    const last = merged.at(-1);
    if (last !== undefined && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}
