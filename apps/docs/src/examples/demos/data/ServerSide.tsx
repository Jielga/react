import { Badge } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import {
  fetchOrders,
  sek,
  TOTAL_ORDERS,
  type Order,
  type OrderStatus,
} from "../../data/orders";

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
  columnHelper.accessor("placed", {
    header: "Placed",
    minSize: 120,
    meta: { type: "date" },
  }),
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

export function ServerSide() {
  // The three pieces of state the server needs are the three you now own.
  // Everything else stays the grid's.
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<Array<Order>>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const sort = sorting[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void fetchOrders({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search: search || undefined,
      sortBy: sort?.id as keyof Order | undefined,
      sortDesc: sort?.desc,
    }).then((page) => {
      // A page that arrived after the query moved on is not this page.
      if (cancelled) return;
      setRows(page.rows);
      setRowCount(page.totalRowCount);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [pagination.pageIndex, pagination.pageSize, search, sort?.id, sort?.desc]);

  // A narrower result set makes the current page index meaningless, and under
  // `manualPagination` the grid takes itself back to page 1 - so this is the
  // plain setter. See `resetPageOnQueryChange`.
  const onGlobalFilterChange: OnChangeFn<string> = (updater) =>
    setSearch((previous) =>
      typeof updater === "function" ? updater(previous) : updater,
    );

  const meta = useMemo(
    () => ({ loading, totalRowCount: TOTAL_ORDERS }),
    [loading],
  );

  const grid = useTMDataGrid({
    data: rows,
    columns,
    getRowId: (row) => String(row.id),

    // Each of the three says "I have already done this - do not do it again".
    // `manualPagination` also switches the pagination flag on, so the footer
    // gets its pager without `enablePagination`.
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    // What the footer counts. The number of rows the *query* matched, which
    // is not the number of rows on screen.
    rowCount,

    state: { pagination, sorting, globalFilter: search },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGlobalFilterChange,

    // `loading` drives the loader and the toolbar spinner; `totalRowCount` is
    // what SummaryCount compares the filtered count against.
    meta,

    // Column filters would have to be translated into query parameters one by
    // one; this demo sends only the search box, so it does not offer them.
    enableColumnFilters: false,
    enableGrouping: false,
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Search />
        <TMDataGrid.Spacer />
        {/* Rows stay on screen while the next page is fetched, so the spinner
            is the only sign anything is happening. */}
        <TMDataGrid.LoadingIndicator />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Order> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}
