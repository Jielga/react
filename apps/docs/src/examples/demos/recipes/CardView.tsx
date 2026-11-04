import {
  ActionIcon,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  Paper,
  Select,
  Text,
} from "@mantine/core";
import { useElementSize, useMergedRef } from "@mantine/hooks";
import {
  IconFilter,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react";
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import { flexRender, type Row } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import {
  activeColumnFilters,
  createTMDataGridColumnHelper,
  getColumnLabel,
  getDisplayedRows,
  isGeneratedColumn,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridFeatureFlags,
  type TMDataGridFeatures,
  type TMDataGridTable,
} from "@jielga/tmdatagrid";
import { salaryColumn, statusColumn } from "../../data/employeeColumns";
import { MANY_EMPLOYEES, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name" }),
  columnHelper.accessor("lastName", { header: "Last name" }),
  columnHelper.accessor("email", { header: "Email" }),
  columnHelper.accessor("department", {
    header: "Department",
    meta: { type: "select", options: "faceted" },
  }),
  columnHelper.accessor("location", {
    header: "Location",
    meta: { type: "select", options: "faceted" },
  }),
  columnHelper.accessor("hired", { header: "Hired", meta: { type: "date" } }),
  salaryColumn,
  statusColumn,
]);

// The card header shows these; every other visible column is a line in the
// card body, so hiding a column in the menu takes it off every card.
const TITLE_COLUMNS = new Set(["firstName", "lastName", "email"]);

const MIN_CARD_WIDTH = 240;
const CARD_HEIGHT = 196;
const GAP = 12;

type EmployeeRow = Row<TMDataGridFeatures, Employee>;

export function CardView() {
  const grid = useTMDataGrid({
    data: MANY_EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
    // No popup or sidebar: those belong to TMDataGrid.Table, which this page
    // does not render. The panel is placed by hand below.
    filters: { surface: "none" },
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = useSelector(
    grid.table.store,
    (state) => activeColumnFilters(state.columnFilters).length,
  );
  const selectedCount = useSelector(
    grid.table.store,
    (state) => Object.keys(state.rowSelection).length,
  );

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.Search />
        <TMDataGrid.Spacer />
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Menu>
          <TMDataGrid.Menu.Columns />
        </TMDataGrid.Menu>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Toolbar withBottomBorder style={{ flexWrap: "wrap" }}>
        <SortControl table={grid.table} />
        <Button
          size="xs"
          variant={filtersOpen ? "light" : "default"}
          leftSection={<IconFilter size={14} />}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
        <TMDataGrid.Spacer />
        {selectedCount > 0 && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {selectedCount} selected
          </Text>
        )}
      </TMDataGrid.Toolbar>

      <Collapse expanded={filtersOpen}>
        <Paper
          p="sm"
          radius={0}
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)",
          }}
        >
          <TMDataGrid.FilterPanel layout="stacked" />
        </Paper>
      </Collapse>
      {activeFilterCount > 0 && (
        <Box px="sm" pt="xs">
          <TMDataGrid.FilterPills api={grid} />
        </Box>
      )}

      <CardList table={grid.table} features={grid.features} />
    </TMDataGrid>
  );
}

function SortControl({ table }: { table: TMDataGridTable<Employee> }) {
  const sorting = useSelector(table.store, (state) => state.sorting);
  const current = sorting[0];

  const options = table
    .getAllLeafColumns()
    .filter((column) => !isGeneratedColumn(column.id) && column.getCanSort())
    .map((column) => ({ value: column.id, label: getColumnLabel(column) }));

  return (
    <Group gap={4} wrap="nowrap">
      <Select
        size="xs"
        w={150}
        placeholder="Sort by"
        aria-label="Sort by"
        data={options}
        value={current?.id ?? null}
        clearable
        onChange={(id) =>
          table.setSorting(id ? [{ id, desc: current?.desc ?? false }] : [])
        }
      />
      <ActionIcon
        variant="default"
        size="md"
        disabled={!current}
        aria-label={current?.desc ? "Sort ascending" : "Sort descending"}
        onClick={() =>
          current && table.setSorting([{ id: current.id, desc: !current.desc }])
        }
      >
        {current?.desc ? (
          <IconSortDescending size={16} />
        ) : (
          <IconSortAscending size={16} />
        )}
      </ActionIcon>
    </Group>
  );
}

function CardList({
  table,
  features,
}: {
  table: TMDataGridTable<Employee>;
  features: TMDataGridFeatureFlags;
}) {
  // The rows the Table would render: filtered, sorted, paged when paging is
  // on. Read inside a selector, not as a bare call: the table identity never
  // changes, so the React Compiler would cache a bare call and the list would
  // stop following filters and sorting.
  const rows = useSelector(
    table.store,
    () => getDisplayedRows(table, features),
    { compare: shallow },
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref: sizeRef, width } = useElementSize();
  const mergedRef = useMergedRef(scrollRef, sizeRef);

  // Cards per line follows the available width; the virtualizer works on
  // lines, so one virtual item is one line of cards.
  const perLine = Math.max(
    1,
    Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP)),
  );
  const lineCount = Math.ceil(rows.length / perLine);

  const virtualizer = useVirtualizer({
    count: lineCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT + GAP,
    overscan: 3,
    paddingStart: GAP,
    paddingEnd: GAP,
  });

  if (rows.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No employees match your filters
      </Text>
    );
  }

  return (
    <Box ref={mergedRef} style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <Box
        style={{ position: "relative", height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((line) => (
          <Box
            key={line.key}
            px={GAP}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${line.start}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${perLine}, minmax(0, 1fr))`,
              gap: GAP,
            }}
          >
            {rows
              .slice(line.index * perLine, (line.index + 1) * perLine)
              .map((row) => (
                <EmployeeCard key={row.id} row={row} table={table} />
              ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function EmployeeCard({
  row,
  table,
}: {
  row: EmployeeRow;
  table: TMDataGridTable<Employee>;
}) {
  // One subscription per card, so selecting a card re-renders that card only.
  const selected = useSelector(
    table.store,
    (state) => state.rowSelection[row.id] === true,
  );
  // The visible cells, memoized by TanStack on column visibility - the same
  // reason as the rows above for reading them inside a selector.
  const cells = useSelector(table.store, () => row.getVisibleCells());
  const { firstName, lastName, email } = row.original;

  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      h={CARD_HEIGHT}
      data-row-id={row.id}
      style={{
        borderColor: selected ? "var(--mantine-primary-color-filled)" : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Box miw={0}>
          <Text fw={600} truncate>
            {firstName} {lastName}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {email}
          </Text>
        </Box>
        <Checkbox
          aria-label={`Select ${firstName} ${lastName}`}
          checked={selected}
          onChange={() => row.toggleSelected()}
        />
      </Group>

      <Box mt="sm">
        {cells
          .filter(
            (cell) =>
              !isGeneratedColumn(cell.column.id) &&
              !TITLE_COLUMNS.has(cell.column.id),
          )
          .map((cell) => (
            <Group key={cell.id} justify="space-between" gap="xs" h={24}>
              <Text size="xs" c="dimmed">
                {getColumnLabel(cell.column)}
              </Text>
              <Text size="sm" span>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Text>
            </Group>
          ))}
      </Box>
    </Card>
  );
}
