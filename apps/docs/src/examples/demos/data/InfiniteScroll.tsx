import { Badge } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import {
  fetchOrderPage,
  sek,
  TOTAL_ORDERS,
  type Order,
  type OrderStatus,
} from "../../data/orders";

const PAGE_SIZE = 100;

const STATUS_COLORS: Record<OrderStatus, string> = {
  Paid: "green",
  Pending: "yellow",
  Overdue: "red",
};

const columnHelper = createTMDataGridColumnHelper<Order>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    header: "Order",
    minSize: 100,
    meta: { type: "number", flex: 0.4 },
  }),
  columnHelper.accessor("customer", { header: "Customer", minSize: 180 }),
  columnHelper.accessor("city", { header: "City", minSize: 120 }),
  columnHelper.accessor("amount", {
    header: "Amount",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 120,
    cell: (info) => (
      <Badge color={STATUS_COLORS[info.getValue()]} variant="light" size="sm">
        {info.getValue()}
      </Badge>
    ),
  }),
]);

/**
 * The grid holds the pages fetched so far and `onReachEnd` asks for the next
 * one as the scroll nears the bottom. The virtualizer keeps its position
 * across the append, so nothing jumps.
 *
 * Sorting and filtering are off on purpose: the client only ever holds a
 * prefix of the data, so both would run over a fraction of it and lie. A real
 * backend does them server-side and resets the accumulated pages when they
 * change.
 */
export function InfiniteScroll() {
  const [orders, setOrders] = useState<Array<Order>>([]);
  const [loading, setLoading] = useState(false);
  const nextPageRef = useRef(0);

  const loadNextPage = useCallback(async () => {
    if (nextPageRef.current * PAGE_SIZE >= TOTAL_ORDERS) return;
    const pageIndex = nextPageRef.current;
    // Claimed before the await, so a second call cannot claim the same page.
    nextPageRef.current += 1;
    setLoading(true);
    const page = await fetchOrderPage(pageIndex, PAGE_SIZE);
    setOrders((previous) => [...previous, ...page]);
    setLoading(false);
  }, []);

  // Page zero is asked for here, not by the grid: `onReachEnd` stays quiet on
  // an empty grid, since "the end" of nothing is not a scroll position.
  useEffect(() => {
    if (nextPageRef.current === 0) void loadNextPage();
  }, [loadNextPage]);

  const meta = useMemo(
    () => ({ loading, totalRowCount: TOTAL_ORDERS }),
    [loading],
  );

  const grid = useTMDataGrid({
    data: orders,
    columns,
    getRowId: (row) => String(row.id),
    meta,
    enableSorting: false,
    enableColumnFilters: false,
    enableGrouping: false,
    selectionMode: "highlight",
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount>
          {orders.length.toLocaleString("sv-SE")} of{" "}
          {TOTAL_ORDERS.toLocaleString("sv-SE")} loaded
        </TMDataGrid.SummaryCount>
        <TMDataGrid.Spacer />
        <TMDataGrid.LoadingIndicator />
      </TMDataGrid.Toolbar>

      {/* Fires rows early, and latches per row count - a fetch in flight is
          not asked for again until it lands. */}
      <TMDataGrid.Table<Order> onReachEnd={() => void loadNextPage()} />
    </TMDataGrid>
  );
}
