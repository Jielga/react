/**
 * A fake search API, written the way a backend would be rather than the way a
 * grid would like it: its own field names, its own operator set, its own
 * status enum, and pages numbered from 1.
 *
 * The site has no server, so the "network" is a `setTimeout` over an array
 * held in this module. Everything above that line - the request shape, the
 * response envelope, the paging arithmetic - is what a real endpoint offers,
 * which is what the recipe has to map onto.
 */

/** One record as the API returns it. Nothing here is named like a column. */
export type OrderRecord = {
  orderRef: number;
  customerName: string;
  shipCity: string;
  totalAmount: number;
  /** ISO date. */
  placedAt: string;
  status: OrderStatusCode;
};

/** The API speaks codes; the grid shows labels. Translating is the client's. */
export type OrderStatusCode = "PAID" | "PENDING" | "OVERDUE";

/** Every comparison the endpoint understands, and no more. */
export type PredicateOp =
  | "eq"
  | "neq"
  | "like"
  | "startsWith"
  | "endsWith"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "notIn"
  | "range"
  | "isNull"
  | "isNotNull";

export type Predicate =
  | { field: string; op: "in" | "notIn"; values: Array<string | number> }
  | { field: string; op: "range"; from?: string | number; to?: string | number }
  | { field: string; op: "isNull" | "isNotNull" }
  | {
      field: string;
      op: Exclude<PredicateOp, "in" | "notIn" | "range" | "isNull" | "isNotNull">;
      value: string | number;
    };

export type OrderSearchRequest = {
  /** Every predicate must hold. A real API would also offer `or`. */
  filter: { and: Array<Predicate> };
  orderBy: Array<{ field: string; direction: "ASC" | "DESC" }>;
  /** `number` is 1-based, as REST pagers usually are. */
  page: { number: number; size: number };
};

export type OrderSearchResponse = {
  items: Array<OrderRecord>;
  page: {
    number: number;
    size: number;
    totalPages: number;
    /** Records the filter matched, not records returned. */
    totalItems: number;
  };
};

/** Everything the "database" holds. 200 pages of 25. */
export const TOTAL_RECORDS = 5_000;

/** What a network costs, near enough that a spinner has time to be seen. */
const LATENCY_MS = 450;

const CUSTOMERS = [
  "Nordkraft AB",
  "Fjällström & Söner",
  "Baltic Trade",
  "Havsvik Logistik",
  "Polarfrakt",
  "Stadsbygg Syd",
  "Lindgren Konsult",
  "Öresund Marin",
] as const;

const CITIES = [
  "Stockholm",
  "Göteborg",
  "Malmö",
  "Uppsala",
  "Umeå",
] as const;

function makeRecord(ref: number): OrderRecord {
  const month = String(1 + (ref % 12)).padStart(2, "0");
  const day = String(1 + ((ref * 5) % 28)).padStart(2, "0");

  return {
    orderRef: ref,
    customerName: CUSTOMERS[(ref * 7) % CUSTOMERS.length],
    shipCity: CITIES[(ref * 3 + 1) % CITIES.length],
    totalAmount: 500 + ((ref * 631) % 950) * 10,
    placedAt: `202${4 + (ref % 2)}-${month}-${day}`,
    status: ref % 11 < 7 ? "PAID" : ref % 11 < 10 ? "PENDING" : "OVERDUE",
  };
}

/** Materialised once, because the endpoint filters and sorts the whole set. */
const RECORDS: Array<OrderRecord> = Array.from(
  { length: TOTAL_RECORDS },
  (_, index) => makeRecord(index + 1),
);

const field = (record: OrderRecord, name: string): unknown =>
  (record as unknown as Record<string, unknown>)[name];

const text = (value: unknown) => String(value ?? "").toLowerCase();

/** Undefined bounds leave that end of a range open. */
const withinBound = (
  value: unknown,
  bound: string | number | undefined,
  compare: (left: string | number, right: string | number) => boolean,
) => bound === undefined || bound === "" || compare(value as string | number, bound);

function matches(record: OrderRecord, predicate: Predicate): boolean {
  const value = field(record, predicate.field);

  switch (predicate.op) {
    case "in":
      return predicate.values.includes(value as string | number);
    case "notIn":
      return !predicate.values.includes(value as string | number);
    case "range":
      return (
        withinBound(value, predicate.from, (left, right) => left >= right) &&
        withinBound(value, predicate.to, (left, right) => left <= right)
      );
    case "isNull":
      return value === null || value === undefined || value === "";
    case "isNotNull":
      return !(value === null || value === undefined || value === "");
    case "eq":
      return text(value) === text(predicate.value);
    case "neq":
      return text(value) !== text(predicate.value);
    case "like":
      return text(value).includes(text(predicate.value));
    case "startsWith":
      return text(value).startsWith(text(predicate.value));
    case "endsWith":
      return text(value).endsWith(text(predicate.value));
    case "lt":
      return (value as string | number) < predicate.value;
    case "lte":
      return (value as string | number) <= predicate.value;
    case "gt":
      return (value as string | number) > predicate.value;
    case "gte":
      return (value as string | number) >= predicate.value;
  }
}

function compareBy(
  orderBy: OrderSearchRequest["orderBy"],
  left: OrderRecord,
  right: OrderRecord,
): number {
  for (const { field: name, direction } of orderBy) {
    const a = field(left, name) as string | number;
    const b = field(right, name) as string | number;
    if (a === b) continue;
    return (a < b ? -1 : 1) * (direction === "DESC" ? -1 : 1);
  }
  return 0;
}

/**
 * `POST /api/orders/search`, in as much as a page with no server has one.
 *
 * The request is round-tripped through JSON first, so anything the client
 * cannot serialise fails here rather than silently working in the demo.
 */
export function searchOrders(
  request: OrderSearchRequest,
): Promise<OrderSearchResponse> {
  const { filter, orderBy, page } = JSON.parse(
    JSON.stringify(request),
  ) as OrderSearchRequest;

  return new Promise((resolve) => {
    setTimeout(() => {
      const matched = RECORDS.filter((record) =>
        filter.and.every((predicate) => matches(record, predicate)),
      );

      const ordered =
        orderBy.length === 0
          ? matched
          : [...matched].sort((left, right) => compareBy(orderBy, left, right));

      const start = (page.number - 1) * page.size;

      resolve({
        items: ordered.slice(start, start + page.size),
        page: {
          number: page.number,
          size: page.size,
          totalPages: Math.max(1, Math.ceil(ordered.length / page.size)),
          totalItems: ordered.length,
        },
      });
    }, LATENCY_MS);
  });
}
