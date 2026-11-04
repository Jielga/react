/**
 * A second, much larger dataset behind a fake server. Only the demos that
 * genuinely need one use it: infinite scroll and server-side data, where the
 * point is that the client never holds the whole set.
 */

export type OrderStatus = "Paid" | "Pending" | "Overdue";

export type Order = {
  id: number;
  customer: string;
  city: string;
  amount: number;
  placed: string;
  status: OrderStatus;
};

export const CUSTOMERS = [
  "Nordkraft AB",
  "Fjällström & Söner",
  "Baltic Trade",
  "Havsvik Logistik",
  "Polarfrakt",
  "Stadsbygg Syd",
  "Lindgren Konsult",
  "Öresund Marin",
] as const;

export const CITIES = [
  "Stockholm",
  "Göteborg",
  "Malmö",
  "Uppsala",
  "Umeå",
] as const;

/** The whole "database" the fake server pages out of. */
export const TOTAL_ORDERS = 100_000;

export function makeOrder(id: number): Order {
  const month = String(1 + (id % 12)).padStart(2, "0");
  const day = String(1 + ((id * 5) % 28)).padStart(2, "0");

  return {
    id,
    customer: CUSTOMERS[(id * 7) % CUSTOMERS.length],
    city: CITIES[(id * 3 + 1) % CITIES.length],
    amount: 500 + ((id * 631) % 950) * 10,
    placed: `202${4 + (id % 2)}-${month}-${day}`,
    status: id % 11 < 7 ? "Paid" : id % 11 < 10 ? "Pending" : "Overdue",
  };
}

/** What a network costs, near enough that a spinner has time to be seen. */
const LATENCY_MS = 500;

export type OrdersQuery = {
  pageIndex: number;
  pageSize: number;
  /** Free-text match over customer and city, as a server would do it. */
  search?: string;
  sortBy?: keyof Order;
  sortDesc?: boolean;
};

export type OrdersResponse = {
  rows: Array<Order>;
  /** What the grid needs for `meta.totalRowCount` - the count *after* filtering. */
  totalRowCount: number;
};

/**
 * One page, filtered and sorted the way a backend would do it: over the whole
 * set, not over what the client happens to hold.
 */
export function fetchOrders(query: OrdersQuery): Promise<OrdersResponse> {
  const { pageIndex, pageSize, search, sortBy, sortDesc } = query;

  return new Promise((resolve) => {
    setTimeout(() => {
      // Materialised only when a query needs the whole set; the unfiltered,
      // unsorted case slices straight out of the sequence instead.
      if (!search && !sortBy) {
        const start = pageIndex * pageSize;
        const length = Math.max(0, Math.min(pageSize, TOTAL_ORDERS - start));
        resolve({
          rows: Array.from({ length }, (_, i) => makeOrder(start + i + 1)),
          totalRowCount: TOTAL_ORDERS,
        });
        return;
      }

      // A real server queries an index. This one is a demo, so it scans a
      // bounded slice - enough rows to be convincing, few enough to stay fast.
      const SCAN = 10_000;
      let rows = Array.from({ length: SCAN }, (_, i) => makeOrder(i + 1));

      if (search) {
        const needle = search.toLowerCase();
        rows = rows.filter(
          (order) =>
            order.customer.toLowerCase().includes(needle) ||
            order.city.toLowerCase().includes(needle),
        );
      }

      if (sortBy) {
        const direction = sortDesc ? -1 : 1;
        rows = [...rows].sort((a, b) => {
          const left = a[sortBy];
          const right = b[sortBy];
          if (left === right) return 0;
          return (left < right ? -1 : 1) * direction;
        });
      }

      const start = pageIndex * pageSize;
      resolve({
        rows: rows.slice(start, start + pageSize),
        totalRowCount: rows.length,
      });
    }, LATENCY_MS);
  });
}

/** The page-at-a-time reader infinite scroll uses - no filtering, no sorting. */
export function fetchOrderPage(
  pageIndex: number,
  pageSize: number,
): Promise<Array<Order>> {
  return fetchOrders({ pageIndex, pageSize }).then((page) => page.rows);
}

export const sek = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });
