import type { TMDataGridColumnType } from "./filterOperators";
import type {
  OperatorsByColumnType,
  TMDataGridColumnFilter,
  TMDataGridFilterOperator,
  TMDataGridFilterValue,
} from "./filterOperators";
import {
  DATA_STATE_SLICES,
  forEachLeafColumnDef,
  type TMDataGridDataSlice,
  type TMDataGridPersistence,
  type TMDataGridPersistKey,
  type TMDataGridUrlStorage,
} from "./persistence";

/**
 * Typed deep links.
 *
 * `createTMDataGridColumnHelper` returns columns that carry, in their type
 * only, what a link needs to know about them: the id, the `meta.type`, the
 * value type, the offered operators, and whether the column can be filtered,
 * sorted and put in the URL. `createTMDataGridUrlState` reads that from the
 * grid's own columns, so a link can name only what the grid can show: a
 * filter on a column the grid lacks, an operator its type does not offer or a
 * value of the wrong type is a compile error, not a link that silently opens
 * unfiltered.
 *
 * Nothing here is visible at runtime except the definition object. The
 * column brand is a type, never a property.
 */

// ---------------------------------------------------------------------------
// The column brand
// ---------------------------------------------------------------------------

/**
 * What a column built with `createTMDataGridColumnHelper` tells a typed link
 * about itself. Read from literal values in the column definition: a value
 * that is not a literal (`enableSorting: isAdmin`) reads as "not allowed".
 */
export type TMDataGridColumnInfo = {
  /** The column id, by TanStack's rule: `id`, else the accessor key with `.` replaced by `_`. */
  id: string;
  /** `meta.type`, `"string"` when unset. */
  type: TMDataGridColumnType;
  /** The value type the accessor returns. */
  value: unknown;
  /** `meta.filter.operators`, every operator when unset. */
  operators: TMDataGridFilterOperator;
  /** `enableColumnFilter` is not `false`. */
  filterable: boolean;
  /** `enableSorting` is not `false`. */
  sortable: boolean;
  /** `meta.filter.url` is not `false`. */
  url: boolean;
};

declare const columnInfo: unique symbol;

/**
 * The type-only brand a column helper column carries. Never present at
 * runtime, so spreading, cloning or serializing a column is unaffected.
 */
export type TMDataGridTypedColumn<TInfo extends TMDataGridColumnInfo> = {
  readonly [columnInfo]: TInfo;
};

/** The info of every leaf column in `TColumn`, a group's children included. */
export type TMDataGridColumnInfoOf<TColumn> =
  TColumn extends TMDataGridTypedColumn<infer TInfo> ? TInfo : never;

/** `"address.city"` becomes `"address_city"`, as TanStack derives the id. */
type DotsToUnderscores<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? `${Head}_${DotsToUnderscores<Tail>}`
  : S;

/**
 * The column id the helper's `accessor` call produces: the explicit `id`,
 * else the accessor key. An accessor function without an `id` gets `never`,
 * which no link can name.
 */
export type TMDataGridAccessorColumnId<TAccessor, TId extends string> = [TId] extends [never]
  ? TAccessor extends string
    ? DotsToUnderscores<TAccessor>
    : never
  : TId;

/**
 * The column options whose literal values a typed link reads. Intersected into
 * the column helper's parameter so each one is inferred as a literal.
 *
 * @internal
 */
export type TMDataGridColumnInfoHints<
  TId extends string,
  TType extends TMDataGridColumnType,
  TOperator extends TMDataGridFilterOperator,
  TFilterable extends boolean,
  TSortable extends boolean,
  TUrl extends boolean,
> = {
  id?: TId;
  enableColumnFilter?: TFilterable;
  enableSorting?: TSortable;
  meta?: {
    type?: TType;
    filter?: { operators?: ReadonlyArray<TOperator>; url?: TUrl };
  };
};

// ---------------------------------------------------------------------------
// Link input
// ---------------------------------------------------------------------------

/** A `Date`, or an ISO `YYYY-MM-DD` string. */
export type TMDataGridDateInput = Date | string;

/** One choice of a select column: the value, or an element of an array value. */
type OptionOf<TValue> =
  NonNullable<TValue> extends ReadonlyArray<infer TElement> ? TElement : NonNullable<TValue>;

type ScalarInput = {
  string: string;
  number: number;
  date: TMDataGridDateInput;
  boolean: boolean;
  select: string;
  multiSelect: string;
};

type RangeEnd<TType extends TMDataGridColumnType> = TType extends "date"
  ? TMDataGridDateInput
  : TType extends "number"
    ? number
    : string;

/** One filter on one column: an operator, and the value that operator takes. */
type FilterInputFor<
  TType extends TMDataGridColumnType,
  TValue,
  TOperator extends TMDataGridFilterOperator,
> = TOperator extends "isEmpty" | "isNotEmpty"
  ? { operator: TOperator }
  : TOperator extends "isAnyOf" | "isNoneOf"
    ? { operator: TOperator; value: ReadonlyArray<OptionOf<TValue>> }
    : TOperator extends "between"
      ? {
          operator: TOperator;
          /** `null` leaves that end open. */
          value: readonly [from: RangeEnd<TType> | null, to: RangeEnd<TType> | null];
        }
      : { operator: TOperator; value: ScalarInput[TType] };

/** Columns a link may filter: filterable, and not kept out of the URL. */
type LinkFilterable<TInfo extends TMDataGridColumnInfo> = Extract<
  TInfo,
  { filterable: true; url: true }
>;

/**
 * The `filters` a link accepts: one optional entry per filterable column.
 * With no filterable column it accepts no entry at all - an empty object type
 * would let any key through, since TypeScript skips the unknown-key check
 * against `{}`.
 */
export type TMDataGridUrlFiltersInput<TInfo extends TMDataGridColumnInfo> = [
  LinkFilterable<TInfo>,
] extends [never]
  ? Record<string, never>
  : {
      [TColumn in LinkFilterable<TInfo> as TColumn["id"]]?: FilterInputFor<
        TColumn["type"],
        TColumn["value"],
        Extract<OperatorsByColumnType[TColumn["type"]], TColumn["operators"]>
      >;
    };

/** The ids a link may sort by. */
export type TMDataGridUrlSortableId<TInfo extends TMDataGridColumnInfo> = Extract<
  TInfo,
  { sortable: true }
>["id"];

type Carries<
  TSlices extends ReadonlyArray<TMDataGridDataSlice>,
  TSlice extends TMDataGridDataSlice,
> = TSlice extends TSlices[number] ? true : false;

/** What a link may set: only the slices the definition carries, only the grid's columns. */
export type TMDataGridUrlInput<
  TInfo extends TMDataGridColumnInfo,
  TSlices extends ReadonlyArray<TMDataGridDataSlice>,
> = (Carries<TSlices, "columnFilters"> extends true
  ? { filters?: TMDataGridUrlFiltersInput<TInfo> }
  : unknown) &
  (Carries<TSlices, "globalFilter"> extends true ? { globalFilter?: string } : unknown) &
  (Carries<TSlices, "sorting"> extends true
    ? {
        sorting?: ReadonlyArray<{
          id: TMDataGridUrlSortableId<TInfo>;
          /** Defaults to `false`. */
          desc?: boolean;
        }>;
      }
    : unknown) &
  (Carries<TSlices, "pagination"> extends true
    ? { pagination?: { pageIndex: number; pageSize: number } }
    : unknown);

// ---------------------------------------------------------------------------
// The payload and the definition
// ---------------------------------------------------------------------------

/** What the grid keeps in its URL param: the data slices, in the grid's own state shape. */
export type TMDataGridUrlPayload = {
  columnFilters?: Array<TMDataGridColumnFilter>;
  /** `null` is a search the user cleared, as opposed to one the link does not set. */
  globalFilter?: string | null;
  sorting?: Array<{ id: string; desc: boolean }>;
  pagination?: { pageIndex: number; pageSize: number };
  expanded?: true | Record<string, boolean>;
};

/**
 * A router's search, read and written as values rather than strings, for
 * routers that keep objects in their search params and encode them
 * themselves, such as TanStack Router.
 */
export type TMDataGridUrlSearchStorage = {
  /** The param's current value in the router's search, or `undefined`. */
  get(name: string): unknown;
  /** Sets the param to `value`, or removes it on `undefined`. */
  set(name: string, value: TMDataGridUrlPayload | undefined): void;
};

export type TMDataGridUrlState<
  TKey extends string,
  TSlices extends ReadonlyArray<TMDataGridDataSlice>,
  TInfo extends TMDataGridColumnInfo,
> = {
  /** The URL search param. */
  readonly key: TKey;
  /** The data slices the param carries. */
  readonly slices: TSlices;
  /** For `persist.urlKey`. */
  readonly urlKey: TMDataGridPersistKey<TMDataGridDataSlice>;
  /** The param's value for a link, or `undefined` when the input sets nothing. */
  payload(input: TMDataGridUrlInput<TInfo, TSlices>): TMDataGridUrlPayload | undefined;
  /** The search object for a router link, `{ [key]: payload }`. */
  search(input: TMDataGridUrlInput<TInfo, TSlices>): {
    [K in TKey]: TMDataGridUrlPayload | undefined;
  };
  /**
   * The search params for a plain link, encoded the way the grid's default
   * `serialize` encodes them. Pass the `serialize` you gave `persist`, if any.
   */
  searchParams(
    input: TMDataGridUrlInput<TInfo, TSlices>,
    options?: { serialize?: (payload: TMDataGridUrlPayload) => string },
  ): URLSearchParams;
  /**
   * A route search validator: keeps the param when it is an object and drops
   * anything else. The grid checks every slice itself when it reads the param.
   */
  validateSearch(search: Record<string, unknown>): {
    [K in TKey]?: TMDataGridUrlPayload;
  };
  /**
   * `urlKey`, plus a `urlStorage` over `storage` when one is given. Without
   * one, the grid reads and writes the browser's URL itself.
   */
  persist(
    storage?: TMDataGridUrlSearchStorage,
  ): Pick<TMDataGridPersistence, "urlKey" | "urlStorage">;
};

/**
 * Defines a grid's deep links from its columns. `columns` is the array the
 * grid renders, built with `createTMDataGridColumnHelper`; it decides which
 * filters, operators, values and sorts a link may name.
 */
export function createTMDataGridUrlState<
  const TKey extends string,
  TColumns extends ReadonlyArray<unknown>,
  const TSlices extends ReadonlyArray<TMDataGridDataSlice> = typeof DATA_STATE_SLICES,
>(options: {
  /** The URL search param. */
  key: TKey;
  /** The grid's columns. */
  columns: TColumns;
  /** The data slices the param carries. Defaults to every data slice. */
  slices?: TSlices;
}): TMDataGridUrlState<TKey, TSlices, TMDataGridColumnInfoOf<TColumns[number]>> {
  const { key, columns } = options;
  const slices = (options.slices ?? DATA_STATE_SLICES) as TSlices;
  const urlKey: TMDataGridPersistKey<TMDataGridDataSlice> = options.slices
    ? [key, options.slices]
    : key;

  const columnTypes = new Map<string, TMDataGridColumnType>();
  forEachLeafColumnDef(columns, (id, record) => {
    const type = (record.meta as { type?: TMDataGridColumnType } | undefined)?.type;
    columnTypes.set(id, type ?? "string");
  });

  const payload = (input: LooseUrlInput): TMDataGridUrlPayload | undefined =>
    toPayload(input, columnTypes, slices);

  return {
    key,
    slices,
    urlKey,
    payload: (input) => payload(input as LooseUrlInput),
    search: (input) =>
      ({ [key]: payload(input as LooseUrlInput) }) as {
        [K in TKey]: TMDataGridUrlPayload | undefined;
      },
    searchParams: (input, { serialize = JSON.stringify } = {}) => {
      const value = payload(input as LooseUrlInput);
      const params = new URLSearchParams();
      if (value !== undefined) params.set(key, serialize(value));
      return params;
    },
    validateSearch: (search) => {
      const value = search[key];
      return (isPlainObject(value) ? { [key]: value } : {}) as {
        [K in TKey]?: TMDataGridUrlPayload;
      };
    },
    persist: (storage) =>
      storage ? { urlKey, urlStorage: toUrlStorage(storage) } : { urlKey },
  };
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

type LooseFilterInput = { operator: TMDataGridFilterOperator; value?: unknown };

type LooseUrlInput = {
  filters?: Record<string, LooseFilterInput | undefined>;
  globalFilter?: string;
  sorting?: ReadonlyArray<{ id: string; desc?: boolean }>;
  pagination?: { pageIndex: number; pageSize: number };
};

/**
 * The input in the grid's own state shape. A slice the definition does not
 * carry is left out even when an untyped caller passes it, since the grid
 * would ignore it in the URL anyway.
 */
function toPayload(
  input: LooseUrlInput,
  columnTypes: ReadonlyMap<string, TMDataGridColumnType>,
  slices: ReadonlyArray<TMDataGridDataSlice>,
): TMDataGridUrlPayload | undefined {
  const payload: TMDataGridUrlPayload = {};

  if (input.filters && slices.includes("columnFilters")) {
    const columnFilters = Object.entries(input.filters).flatMap(([id, filter]) =>
      filter ? [{ id, value: toFilterValue(filter, columnTypes.get(id)) }] : [],
    );
    if (columnFilters.length > 0) payload.columnFilters = columnFilters;
  }
  if (input.globalFilter && slices.includes("globalFilter")) {
    payload.globalFilter = input.globalFilter;
  }
  if (input.sorting && input.sorting.length > 0 && slices.includes("sorting")) {
    payload.sorting = input.sorting.map(({ id, desc = false }) => ({ id, desc }));
  }
  if (input.pagination && slices.includes("pagination")) {
    payload.pagination = {
      pageIndex: input.pagination.pageIndex,
      pageSize: input.pagination.pageSize,
    };
  }

  return Object.keys(payload).length === 0 ? undefined : payload;
}

/** Native values in, the grid's filter envelope out: every value a string. */
function toFilterValue(
  filter: LooseFilterInput,
  type: TMDataGridColumnType | undefined,
): TMDataGridFilterValue {
  const { operator, value } = filter;
  if (operator === "isEmpty" || operator === "isNotEmpty") {
    return { operator, value: "" };
  }
  if (operator === "isAnyOf" || operator === "isNoneOf") {
    return { operator, value: (value as ReadonlyArray<unknown>).map(String) };
  }
  if (operator === "between") {
    const [from, to] = value as readonly [unknown, unknown];
    return { operator, value: [toFilterString(from, type), toFilterString(to, type)] };
  }
  return { operator, value: toFilterString(value, type) };
}

function toFilterString(value: unknown, type: TMDataGridColumnType | undefined): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return localIsoDay(value);
  // The date controls write `YYYY-MM-DD`; a full ISO timestamp is cut to it.
  if (type === "date" && typeof value === "string") return value.slice(0, 10);
  return String(value);
}

/** The calendar day in local time. `toISOString()` would give the UTC day. */
function localIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The grid reads and writes its param as the string `serialize` produced
 * (JSON by default); a router like TanStack Router keeps the parsed object and
 * encodes it itself. Both directions go through JSON, so the grid's "the param
 * is unchanged, skip the write" comparison keeps holding.
 */
function toUrlStorage(storage: TMDataGridUrlSearchStorage): TMDataGridUrlStorage {
  return {
    get: (name) => {
      const value = storage.get(name);
      if (value === undefined || value === null) return null;
      // A router that left the value as text hands back what the grid wrote.
      return typeof value === "string" ? value : JSON.stringify(value);
    },
    set: (name, value) => {
      storage.set(name, value === null ? undefined : (JSON.parse(value) as TMDataGridUrlPayload));
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
