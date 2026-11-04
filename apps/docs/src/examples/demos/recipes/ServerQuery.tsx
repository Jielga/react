import { Badge, Group, Paper, Text } from "@mantine/core";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import {
  activeColumnFilters,
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridFilterOperator,
  type TMDataGridFilterValue,
} from "@jielga/tmdatagrid";
import {
  searchOrders,
  TOTAL_RECORDS,
  type OrderRecord,
  type OrderSearchRequest,
  type OrderSearchResponse,
  type OrderStatusCode,
  type Predicate,
  type PredicateOp,
} from "../../data/orderSearchApi";

type StatusLabel = "Paid" | "Pending" | "Overdue";

/** What the grid renders. Column ids, not API field names. */
type OrderRow = {
  id: number;
  customer: string;
  city: string;
  amount: number;
  placed: string;
  status: StatusLabel;
};

const STATUS_LABELS: Record<OrderStatusCode, StatusLabel> = {
  PAID: "Paid",
  PENDING: "Pending",
  OVERDUE: "Overdue",
};

const STATUS_CODES: Record<string, OrderStatusCode> = {
  Paid: "PAID",
  Pending: "PENDING",
  Overdue: "OVERDUE",
};

const STATUS_COLORS: Record<StatusLabel, string> = {
  Paid: "green",
  Pending: "yellow",
  Overdue: "red",
};

const CITIES = ["Stockholm", "Göteborg", "Malmö", "Uppsala", "Umeå"];

const sek = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

// ---------------------------------------------------------------------------
// The mapping layer: three functions, and two tables it reads.
// ---------------------------------------------------------------------------

/**
 * One entry per filterable and sortable column: which API field it stands for,
 * and how the panel's string becomes the scalar that field holds. Every filter
 * control writes strings; `totalAmount` is a number and `status` an enum, so
 * the cast belongs here rather than at either end.
 *
 * A column missing from this table is one the API cannot query. The mapping
 * drops it instead of sending a field the endpoint would reject.
 */
const QUERY_FIELDS: Record<
  string,
  { field: string; cast: (raw: string) => string | number }
> = {
  id: { field: "orderRef", cast: Number },
  customer: { field: "customerName", cast: String },
  city: { field: "shipCity", cast: String },
  amount: { field: "totalAmount", cast: Number },
  placed: { field: "placedAt", cast: String },
  status: { field: "status", cast: (raw) => STATUS_CODES[raw] ?? raw },
};

/**
 * The grid's operators against the endpoint's. A `Record` rather than a
 * `Partial`, so an operator the library adds later fails the build here -
 * where it can be answered - rather than reaching the server unmapped.
 *
 * Several grid operators collapse onto one API op: a date `before` and a
 * number `lessThan` are both `lt` once the value is typed.
 */
const PREDICATE_OPS: Record<TMDataGridFilterOperator, PredicateOp> = {
  contains: "like",
  equals: "eq",
  notEquals: "neq",
  startsWith: "startsWith",
  endsWith: "endsWith",
  greaterThan: "gt",
  greaterThanOrEqual: "gte",
  lessThan: "lt",
  lessThanOrEqual: "lte",
  between: "range",
  before: "lt",
  after: "gt",
  onOrBefore: "lte",
  onOrAfter: "gte",
  isAnyOf: "in",
  isNoneOf: "notIn",
  isEmpty: "isNull",
  isNotEmpty: "isNotNull",
};

const asArray = (value: TMDataGridFilterValue["value"]) =>
  Array.isArray(value) ? value : [String(value)];

/** One filter row as one predicate, or nothing when the API cannot take it. */
function toPredicate(
  columnId: string,
  filter: TMDataGridFilterValue,
): Predicate | undefined {
  const column = QUERY_FIELDS[columnId];
  if (!column) return undefined;

  const { field, cast } = column;
  const op = PREDICATE_OPS[filter.operator];

  // The three value shapes the grid's filter model uses, in the order the
  // operator decides them: no value, a set, a pair, a scalar.
  if (op === "isNull" || op === "isNotNull") return { field, op };

  if (op === "in" || op === "notIn") {
    return {
      field,
      op,
      values: asArray(filter.value)
        .filter((entry) => entry.trim() !== "")
        .map(cast),
    };
  }

  if (op === "range") {
    // `between` is a [min, max] pair and either end may be left open, which
    // the API spells as an absent bound rather than an empty string.
    const [from = "", to = ""] = asArray(filter.value);
    return {
      field,
      op,
      from: from.trim() === "" ? undefined : cast(from),
      to: to.trim() === "" ? undefined : cast(to),
    };
  }

  return { field, op, value: cast(String(filter.value)) };
}

/** The whole grid query as the one request body the endpoint accepts. */
function toSearchRequest(state: {
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  pagination: PaginationState;
}): OrderSearchRequest {
  return {
    filter: {
      // `activeColumnFilters` hands back the filters that are actually
      // narrowing the grid, typed. A filter still being typed matches every
      // row, so it is not a predicate yet - sending it would narrow the
      // result set to nothing.
      and: activeColumnFilters(state.columnFilters)
        .map((filter) => toPredicate(filter.id, filter.value))
        .filter((predicate): predicate is Predicate => predicate !== undefined),
    },
    orderBy: state.sorting.flatMap((sort) => {
      const column = QUERY_FIELDS[sort.id];
      return column
        ? [{ field: column.field, direction: sort.desc ? "DESC" : "ASC" } as const]
        : [];
    }),
    // The grid counts pages from 0 and this API from 1. One `+ 1` here is the
    // whole of that disagreement.
    page: { number: state.pagination.pageIndex + 1, size: state.pagination.pageSize },
  };
}

/** And the way back: one record as one row. */
const toRow = (record: OrderRecord): OrderRow => ({
  id: record.orderRef,
  customer: record.customerName,
  city: record.shipCity,
  amount: record.totalAmount,
  placed: record.placedAt,
  status: STATUS_LABELS[record.status],
});

// ---------------------------------------------------------------------------

const columnHelper = createTMDataGridColumnHelper<OrderRow>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    header: "Order",
    minSize: 100,
    meta: { type: "number", flex: 0.4 },
  }),
  columnHelper.accessor("customer", { header: "Customer", minSize: 150 }),
  // `options: "faceted"` reads the distinct values in `data`, which server-side
  // is one page of them. A select column therefore declares its own set.
  columnHelper.accessor("city", {
    header: "City",
    minSize: 120,
    meta: { type: "select", options: CITIES },
  }),
  columnHelper.accessor("placed", {
    header: "Placed",
    minSize: 120,
    meta: { type: "date", filter: { defaultOperator: "between" } },
  }),
  columnHelper.accessor("amount", {
    header: "Amount",
    minSize: 120,
    meta: {
      type: "number",
      align: "right",
      filter: { defaultOperator: "between" },
    },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 110,
    meta: { type: "select", options: Object.keys(STATUS_CODES) },
    cell: (info) => (
      // The record said PAID; what the cell shows is the mapped label, so
      // `tt="none"` keeps Mantine from shouting it back.
      <Badge
        color={STATUS_COLORS[info.getValue()]}
        variant="light"
        size="sm"
        tt="none"
      >
        {info.getValue()}
      </Badge>
    ),
  }),
]);

/** Long enough that a filter being typed is one request, not eight. */
const DEBOUNCE_MS = 300;

export function ServerQuery() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const [rows, setRows] = useState<Array<OrderRow>>([]);
  const [page, setPage] = useState<OrderSearchResponse["page"] | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * The request as text, and the request as an object parsed back out of it.
   *
   * Keying the effect on the JSON rather than on the state means the fetch
   * follows the *query*: adding an empty filter row, or reordering one, moves
   * the grid's state and leaves this string alone, so nothing is sent.
   */
  const requestJson = useMemo(
    () =>
      JSON.stringify(
        toSearchRequest({ columnFilters, sorting, pagination }),
        null,
        2,
      ),
    [columnFilters, sorting, pagination],
  );

  const request = useMemo(
    () => JSON.parse(requestJson) as OrderSearchRequest,
    [requestJson],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      void searchOrders(request).then((response) => {
        // A response that arrived after the query moved on is not this query's.
        if (cancelled) return;
        setRows(response.items.map(toRow));
        setPage(response.page);
        setLoading(false);
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request]);

  const meta = useMemo(
    () => ({ loading, totalRowCount: TOTAL_RECORDS }),
    [loading],
  );

  const grid = useTMDataGrid({
    data: rows,
    columns,
    getRowId: (row) => String(row.id),

    // The server has already filtered, sorted and paged. Each flag stops the
    // grid doing it a second time over the one page it holds.
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    // What the pager divides into pages. The response's `totalItems`, which is
    // the matched count, not the count on screen.
    rowCount: page?.totalItems ?? 0,

    // A narrower result set makes the page the user is on meaningless, so a
    // filter or a sort takes the grid back to page 1 - which under
    // `manualPagination` the grid does itself. See `resetPageOnQueryChange`.
    state: { columnFilters, sorting, pagination },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,

    meta,
    enableGrouping: false,
  });

  return (
    <>
      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          {/* The rows stay on screen while the next page is fetched, so the
              spinner is the only sign anything is happening. */}
          <TMDataGrid.LoadingIndicator />
          <TMDataGrid.FilterButton />
        </TMDataGrid.Toolbar>

        <TMDataGrid.Table<OrderRow> />

        {/* The API counts pages; so does the pager. Showing its own number
            keeps the two visibly in step. */}
        <TMDataGrid.Footer
          renderPagination={({ Controls }) => (
            <>
              <Controls.PageSize />
              <Controls.PageNumber />
              <Controls.Pager />
            </>
          )}
        />
      </TMDataGrid>

      <Paper withBorder mt="xs" p="xs" style={{ flex: "0 0 auto" }}>
        <Group justify="space-between" mb={6} wrap="nowrap">
          <Text size="xs" fw={600} ff="monospace">
            POST /api/orders/search
          </Text>
          <Text size="xs" c="dimmed">
            {page
              ? `${page.totalItems.toLocaleString("sv-SE")} matched · page ${page.number} of ${page.totalPages}`
              : "…"}
          </Text>
        </Group>
        <pre
          style={{
            margin: 0,
            maxHeight: 190,
            overflow: "auto",
            fontFamily: "var(--mantine-font-family-monospace)",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {requestJson}
        </pre>
      </Paper>
    </>
  );
}
