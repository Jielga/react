import type {
  ColumnFiltersState,
  FilterMeta,
  Row,
  RowData,
  TableFeatures,
} from "@tanstack/react-table";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

/**
 * The value shape stored in `columnFilters` for every TMDataGrid column.
 *
 * TanStack resolves `filterFn` statically per column, so the operator travels
 * inside the filter *value* instead. That keeps the filter model plain,
 * serialisable JSON, so a server-side `manualFiltering` table can forward
 * `columnFilters` to the API unchanged.
 *
 * `value` is a string array under `isAnyOf` / `isNoneOf` (the set the cell is
 * tested against), a `[min, max]` pair under `between` (an empty string means
 * that end is open), and a single string everywhere else - dates travel as
 * ISO `YYYY-MM-DD` strings, booleans as `"true"` / `"false"`. Still plain
 * JSON.
 */
export type TMDataGridFilterValue = {
  operator: TMDataGridFilterOperator;
  value: string | ReadonlyArray<string>;
};

export type TMDataGridColumnType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "multiSelect";

export type TMDataGridFilterOperator =
  | "contains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "between"
  | "before"
  | "after"
  | "onOrBefore"
  | "onOrAfter"
  | "isAnyOf"
  | "isNoneOf"
  | "isEmpty"
  | "isNotEmpty";

export const FILTER_OPERATOR_LABELS: Record<TMDataGridFilterOperator, string> = {
  contains: "contains",
  equals: "equals",
  notEquals: "does not equal",
  startsWith: "starts with",
  endsWith: "ends with",
  greaterThan: "is greater than",
  greaterThanOrEqual: "is greater than or equal to",
  lessThan: "is less than",
  lessThanOrEqual: "is less than or equal to",
  between: "is between",
  before: "is before",
  after: "is after",
  onOrBefore: "is on or before",
  onOrAfter: "is on or after",
  isAnyOf: "is any of",
  isNoneOf: "is none of",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

const STRING_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "contains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
];

const NUMBER_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "between",
  "isEmpty",
  "isNotEmpty",
];

// `equals` doubles as a date's "is": it compares by calendar day whenever the
// cell holds a Date (see matchesFilter), so a separate `is` operator would be
// the same comparison under a second name.
const DATE_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "equals",
  "notEquals",
  "before",
  "after",
  "onOrBefore",
  "onOrAfter",
  "between",
  "isEmpty",
  "isNotEmpty",
];

const BOOLEAN_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "equals",
  "notEquals",
  "isEmpty",
  "isNotEmpty",
];

// One set for both select types: the operators are about membership in the
// filter's set, which reads the same whether the cell holds one value or many.
const SELECT_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "isAnyOf",
  "isNoneOf",
  "isEmpty",
  "isNotEmpty",
];

/** Operators that ignore the value input (the input is disabled for these). */
const VALUELESS_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "isEmpty",
  "isNotEmpty",
];

/** Operators whose value is a set of strings rather than one. */
const ARRAY_OPERATORS: readonly TMDataGridFilterOperator[] = [
  "isAnyOf",
  "isNoneOf",
];

/** Operators whose value is a `[min, max]` pair. */
const RANGE_OPERATORS: readonly TMDataGridFilterOperator[] = ["between"];

const OPERATORS_BY_TYPE: Record<
  TMDataGridColumnType,
  readonly TMDataGridFilterOperator[]
> = {
  string: STRING_OPERATORS,
  number: NUMBER_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  date: DATE_OPERATORS,
  select: SELECT_OPERATORS,
  multiSelect: SELECT_OPERATORS,
};

const DEFAULT_OPERATOR_BY_TYPE: Record<
  TMDataGridColumnType,
  TMDataGridFilterOperator
> = {
  string: "contains",
  number: "equals",
  boolean: "equals",
  date: "equals",
  select: "isAnyOf",
  multiSelect: "isAnyOf",
};

export function getOperatorsForType(
  type: TMDataGridColumnType,
): readonly TMDataGridFilterOperator[] {
  return OPERATORS_BY_TYPE[type];
}

export function getDefaultOperator(
  type: TMDataGridColumnType,
): TMDataGridFilterOperator {
  return DEFAULT_OPERATOR_BY_TYPE[type];
}

export function operatorNeedsValue(operator: TMDataGridFilterOperator): boolean {
  return !VALUELESS_OPERATORS.includes(operator);
}

/** Whether the operator's value is a string array - `isAnyOf` / `isNoneOf`. */
export function operatorTakesArrayValue(
  operator: TMDataGridFilterOperator,
): boolean {
  return ARRAY_OPERATORS.includes(operator);
}

/** Whether the operator's value is a `[min, max]` pair - `between`. */
export function operatorTakesRangeValue(
  operator: TMDataGridFilterOperator,
): boolean {
  return RANGE_OPERATORS.includes(operator);
}

/** The untouched value a fresh filter starts with - the operator's shape, empty. */
export function emptyValueForOperator(
  operator: TMDataGridFilterOperator,
): string | ReadonlyArray<string> {
  if (operatorTakesArrayValue(operator)) return [];
  if (operatorTakesRangeValue(operator)) return ["", ""];
  return "";
}

export function isTMDataGridFilterValue(
  value: unknown,
): value is TMDataGridFilterValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "operator" in value &&
    typeof (value as TMDataGridFilterValue).operator === "string"
  );
}

/**
 * The three value shapes an operator can take. A set is not a range, even
 * though both are arrays.
 */
export type TMDataGridFilterValueShape = "scalar" | "set" | "range";

/**
 * Which shape an operator's value takes. A typed value survives an operator or
 * column change only within its shape, which is the rule both the panel and
 * the header controls use when the operator changes.
 */
export function filterValueShape(
  operator: TMDataGridFilterOperator,
): TMDataGridFilterValueShape {
  if (operatorTakesArrayValue(operator)) return "set";
  if (operatorTakesRangeValue(operator)) return "range";
  return "scalar";
}

/**
 * A filter only narrows the row set once it has something to compare against.
 * Half-typed filters stay in state (so the panel keeps rendering their row) but
 * are treated as inactive for the funnel indicator and for row matching.
 */
export function isFilterActive(value: unknown): boolean {
  if (!isTMDataGridFilterValue(value)) return false;
  if (!operatorNeedsValue(value.operator)) return true;
  // A `between` pair is `["", ""]` while untouched, so an array is active
  // once some entry says something, not merely by existing.
  return Array.isArray(value.value)
    ? value.value.some((entry) => String(entry).trim() !== "")
    : typeof value.value === "string" && value.value.trim() !== "";
}

/** One column's filter, typed - what `columnFilters` holds per entry. */
export type TMDataGridColumnFilter = {
  id: string;
  value: TMDataGridFilterValue;
};

/**
 * The column filters that are actually narrowing the grid, typed.
 *
 * `ColumnFiltersState` types `value` as `unknown`, so the first line of a
 * server-side mapping layer is otherwise a cast back to the shape the grid
 * itself wrote, wrapped in the same "drop the half-typed ones" filter every
 * consumer writes:
 *
 * ```ts
 * const predicates = activeColumnFilters(table).map((filter) =>
 *   toPredicate(filter.id, filter.value),
 * );
 * ```
 *
 * Takes the table, or a `columnFilters` array where the consumer owns the
 * slice. Reading it from the table reads the current value and does not
 * subscribe; inside a component, subscribe to `columnFilters` the way the
 * grid's own chrome does.
 */
export function activeColumnFilters<TData extends RowData>(
  source: TMDataGridTable<TData> | ColumnFiltersState,
): Array<TMDataGridColumnFilter> {
  const columnFilters = Array.isArray(source)
    ? source
    : source.store.state.columnFilters;
  return columnFilters.flatMap((entry) =>
    isTMDataGridFilterValue(entry.value) && isFilterActive(entry.value)
      ? [{ id: entry.id, value: entry.value }]
      : [],
  );
}

/**
 * One-line description of a single filter, as shown on a filter pill.
 *
 * The type's default operator is left implicit - "First name: Sofia" reads the
 * way a person would say it - while any other operator is spelled out, since
 * that is the part a reader cannot guess.
 */
export function formatFilterLabel({
  label,
  type,
  filter,
  operatorLabels = FILTER_OPERATOR_LABELS,
}: {
  label: string;
  type: TMDataGridColumnType;
  filter: TMDataGridFilterValue;
  /** Localized operator names - `labels.operators`. Defaults to English. */
  operatorLabels?: Record<TMDataGridFilterOperator, string>;
}): string {
  const { operator, value } = filter;
  if (!operatorNeedsValue(operator)) {
    return `${label} ${operatorLabels[operator]}`;
  }
  const text =
    operator === "between" && Array.isArray(value)
      ? value.map((entry) => String(entry).trim()).join("–")
      : Array.isArray(value)
        ? value.join(", ")
        : String(value).trim();
  if (operator === getDefaultOperator(type)) return `${label}: ${text}`;
  return `${label} ${operatorLabels[operator]} ${text}`;
}

/**
 * A value's calendar day as `YYYY-MM-DD`, or `null` for anything that has no
 * day to speak of. A `Date` is read in local time - `sv-SE` formats as ISO,
 * which is the shape `<input type="date">` produced on the other side - and a
 * string contributes its leading ISO day, so both `2026-07-31` and a full
 * timestamp compare by day.
 */
function toIsoDay(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toLocaleDateString("sv-SE");
  }
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    return match ? match[1] : null;
  }
  return null;
}

/** One end of a `between` interval. An empty bound is an open end. */
function boundHolds(
  cellValue: unknown,
  bound: string,
  end: "min" | "max",
): boolean {
  const boundText = bound.trim();
  if (boundText === "") return true;

  const numericCell = typeof cellValue === "number" ? cellValue : Number.NaN;
  const numericBound = Number(boundText);
  if (!Number.isNaN(numericCell) && !Number.isNaN(numericBound)) {
    return end === "min"
      ? numericCell >= numericBound
      : numericCell <= numericBound;
  }

  const cellDay = toIsoDay(cellValue);
  const boundDay = toIsoDay(boundText);
  if (cellDay === null || boundDay === null) return false;
  return end === "min" ? cellDay >= boundDay : cellDay <= boundDay;
}

function isEmptyCell(cellValue: unknown): boolean {
  return (
    cellValue === null ||
    cellValue === undefined ||
    cellValue === "" ||
    (Array.isArray(cellValue) && cellValue.length === 0)
  );
}

export function matchesFilter(
  cellValue: unknown,
  { operator, value }: TMDataGridFilterValue,
): boolean {
  if (operator === "isEmpty") return isEmptyCell(cellValue);
  if (operator === "isNotEmpty") return !isEmptyCell(cellValue);

  // Set membership. The cell side is also a list - a multiSelect cell holds an
  // array - so "any of" is an intersection test and "none of" its complement.
  if (operator === "isAnyOf" || operator === "isNoneOf") {
    const set = (Array.isArray(value) ? value : [value])
      .map((entry) => String(entry).toLowerCase())
      .filter((entry) => entry !== "");
    if (set.length === 0) return true;
    const cellEntries = Array.isArray(cellValue) ? cellValue : [cellValue];
    const hit = cellEntries.some((entry) =>
      set.includes(String(entry ?? "").toLowerCase()),
    );
    return operator === "isAnyOf" ? hit : !hit;
  }

  // A closed or half-open interval. Each present end must hold; an empty end
  // is open - and a fully empty pair matches everything, the same way a blank
  // needle does. Ends compare the way the single-ended operators would:
  // numerically when both sides are numbers, by calendar day otherwise.
  if (operator === "between") {
    const [min, max] = Array.isArray(value)
      ? [String(value[0] ?? ""), String(value[1] ?? "")]
      : [String(value), ""];
    return (
      boundHolds(cellValue, min, "min") && boundHolds(cellValue, max, "max")
    );
  }

  const filterText =
    typeof value === "string" ? value.trim() : value.join(",").trim();
  if (filterText === "") return true;

  // Day ordering. ISO days compare correctly as strings, which keeps this
  // free of timezone arithmetic - the whole comparison lives in local days.
  switch (operator) {
    case "before":
    case "after":
    case "onOrBefore":
    case "onOrAfter": {
      const cellDay = toIsoDay(cellValue);
      const filterDay = toIsoDay(filterText);
      if (cellDay === null || filterDay === null) return false;
      if (operator === "before") return cellDay < filterDay;
      if (operator === "after") return cellDay > filterDay;
      if (operator === "onOrBefore") return cellDay <= filterDay;
      return cellDay >= filterDay;
    }
    default:
      break;
  }

  const numericCell = typeof cellValue === "number" ? cellValue : Number.NaN;
  const numericFilter = Number(filterText);
  const compareNumeric =
    !Number.isNaN(numericCell) && !Number.isNaN(numericFilter);

  switch (operator) {
    case "greaterThan":
      return compareNumeric && numericCell > numericFilter;
    case "greaterThanOrEqual":
      return compareNumeric && numericCell >= numericFilter;
    case "lessThan":
      return compareNumeric && numericCell < numericFilter;
    case "lessThanOrEqual":
      return compareNumeric && numericCell <= numericFilter;
    default:
      break;
  }

  // A Date compares by its calendar day, so `equals` on a date column means
  // "is this day" rather than a string comparison against the Date's default
  // stringification.
  const cellText = (
    cellValue instanceof Date
      ? (toIsoDay(cellValue) ?? "")
      : String(cellValue ?? "")
  ).toLowerCase();
  const needle = filterText.toLowerCase();

  switch (operator) {
    case "contains":
      return cellText.includes(needle);
    case "equals":
      return compareNumeric ? numericCell === numericFilter : cellText === needle;
    case "notEquals":
      return compareNumeric ? numericCell !== numericFilter : cellText !== needle;
    case "startsWith":
      return cellText.startsWith(needle);
    case "endsWith":
      return cellText.endsWith(needle);
    default:
      return true;
  }
}

/**
 * The signature of a column's own `filterFn`. The third argument is the
 * `{ operator, value }` envelope the grid writes into `columnFilters`; a
 * column `filterFn` replaces `tmDataGridFilterFn` outright, so it is handed
 * the envelope, not the unwrapped value. Delegate to `tmDataGridFilterFn`
 * for the operators the function does not handle itself.
 */
export type TMDataGridFilterFn<TData extends RowData> = (
  row: Row<TMDataGridFeatures, TData>,
  columnId: string,
  filterValue: TMDataGridFilterValue,
  addMeta?: (meta: FilterMeta) => void,
) => boolean;

/**
 * The single filter function every TMDataGrid column uses. It dispatches on the
 * operator carried by the filter value, which is what lets one column offer
 * "contains" / "does not equal" / "is empty" without redefining the column.
 */
export function tmDataGridFilterFn<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(row: Row<TFeatures, TData>, columnId: string, filterValue: unknown): boolean {
  if (!isTMDataGridFilterValue(filterValue)) return true;
  return matchesFilter(row.getValue(columnId), filterValue);
}
