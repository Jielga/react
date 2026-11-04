import {
  Badge,
  Button,
  Card,
  Collapse,
  Fieldset,
  Flex,
  Group,
  Menu,
  Pagination,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import {
  aggregateColumn,
  createTMDataGridColumnHelper,
  DgAutocompleteFilter,
  DgRangeSliderFilter,
  exportGrid,
  TMDataGrid,
  TMDATAGRID_LABELS_SV,
  type TMDataGridFilterValue,
  type TMDataGridPersistence,
  type TMDataGridCellSelectionMode,
  type TMDataGridSelectionMode,
  type TMDataGridSize,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import { MANY_EMPLOYEES, sek, type Employee } from "../data/employees";
import { StarterSnippetModal } from "./StarterSnippetModal";

/** Keeps a menu item on one line whatever the cell holds. */
const truncate = (value: string, max = 20) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const columnHelper = createTMDataGridColumnHelper<Employee>();

/** Filler so the panels differ in height - the grid measures each one. */
const NOTES = [
  "Joined through the Stockholm office and has been with the team since.",
  "Currently on a rotation with Product; reviews land in the shared queue.",
  "Owns the on-call handover doc and the quarterly capacity forecast.",
];

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  );
}

/**
 * What `renderDetails` returns. Nothing here is the grid's: it renders whatever
 * comes back, at whatever height it comes back at.
 */
function EmployeeDetails({ employee }: { employee: Employee }) {
  return (
    <Stack gap="sm">
      <Group gap="xl" wrap="wrap">
        <DetailField
          label="Employee"
          value={`${employee.firstName} ${employee.lastName}`}
        />
        <DetailField label="Department" value={employee.department} />
        <DetailField label="Location" value={employee.location} />
        <DetailField label="Salary" value={sek(employee.salary)} />
        <DetailField label="Age" value={String(employee.age)} />
      </Group>
      <Text size="sm" c="dimmed" maw={640}>
        {NOTES.slice(0, 1 + (employee.id % NOTES.length)).join(" ")}
      </Text>
      <Group gap="xs">
        <Button size="xs" variant="light">
          Open profile
        </Button>
        <Button size="xs" variant="subtle">
          Message
        </Button>
      </Group>
    </Stack>
  );
}

const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    header: "ID",
    meta: { label: "ID", type: "number", flex: 0.4 },
    minSize: 100,
  }),
  columnHelper.accessor("firstName", {
    header: "First name",
    minSize: 120,
  }),
  columnHelper.accessor("lastName", {
    header: "Last name",
    minSize: 120,
  }),
  columnHelper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right", flex: 0.4 },
    minSize: 100,
  }),
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "fullName",
    header: "Full name",
    meta: { label: "Full name" },
    minSize: 160,
  }),
  columnHelper.accessor("department", {
    header: "Department",
    minSize: 140,
  }),
  columnHelper.accessor("location", {
    header: "Location",
    minSize: 120,
    // Free text, but the values in the data offered as suggestions.
    meta: { filter: { control: DgAutocompleteFilter } },
  }),
  columnHelper.accessor("salary", {
    header: "Salary",
    // Filtering opens on a range slider seeded from the data's min/max.
    meta: {
      type: "number",
      align: "right",
      filter: { defaultOperator: "between", control: DgRangeSliderFilter },
    },
    minSize: 130,
    cell: (info) => sek(info.getValue()),
    // The one column told how to summarise itself. Group by Department and this
    // fills in per group while the others stay blank - aggregation is opt-in.
    aggregationFn: "sum",
    aggregatedCell: (info) => sek(Number(info.getValue() ?? 0)),
    // A `footer` is what summons the sticky summary row along the bottom -
    // here the salary total over every filtered row, all pages.
    footer: ({ table }) =>
      sek(Number(aggregateColumn({ table, columnId: "salary" }))),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 120,
    cell: (info) => {
      const value = info.getValue();
      const color =
        value === "Active" ? "green" : value === "On leave" ? "yellow" : "red";
      return (
        <Badge color={color} variant="light" size="sm">
          {value}
        </Badge>
      );
    },
  }),
]);

// Module scope keeps the reference stable across renders.
// The settings key persists every slice in its group; the data key is narrowed
// to two, so page index is not restored on reload.
const persist = {
  dataKey: ["tmdatagrid.employees.data", ["columnFilters", "sorting"]],
  settingsKey: "tmdatagrid.employees.settings",
} satisfies TMDataGridPersistence;

/**
 * Grouped by what they affect, so the panel reads as sections rather than one
 * long row of switches. `key` is the real option name - each switch is passed
 * straight through to `useTMDataGrid`.
 */
const COLUMN_TOGGLES = [
  { key: "enableSorting", label: "Sorting" },
  { key: "enableColumnFilters", label: "Filtering" },
  { key: "enableHiding", label: "Hiding" },
  { key: "enableColumnPinning", label: "Pinning" },
  { key: "enableColumnResizing", label: "Resizing" },
  { key: "enableColumnOrdering", label: "Reordering" },
] as const;

const ROW_TOGGLES = [
  { key: "enablePagination", label: "Pagination" },
  {
    key: "enableGrouping",
    label: "Grouping",
    hint: "Group by … in any column menu. Salary sums per group; the rest stay blank",
  },
] as const;

const SELECTION_TOGGLES = [
  {
    key: "enableRowSelection",
    label: "Selectable",
    hint: "TanStack's gate - off, no row can be selected at all",
  },
  {
    key: "enableMultiRowSelection",
    label: "Multi-select",
    hint: "Off, rowSelection holds at most one id and the select-all box goes",
  },
] as const;

const FEATURE_TOGGLES = [
  ...SELECTION_TOGGLES,
  ...COLUMN_TOGGLES,
  ...ROW_TOGGLES,
] as const;

type FeatureKey = (typeof FEATURE_TOGGLES)[number]["key"];

const SELECTION_MODES = [
  { value: "checkbox", label: "Checkbox" },
  { value: "row", label: "Row" },
  { value: "checkboxAndHighlight", label: "Checkbox + highlight" },
  { value: "highlight", label: "Highlight" },
] as const satisfies ReadonlyArray<{
  value: TMDataGridSelectionMode;
  label: string;
}>;

/**
 * Enough room for three rows of switches *and* a usable grid. Below it the
 * switches take space from the grid they configure, so they fold away, which
 * keeps the page usable in a side-by-side editor pane.
 */
const ROOMY_VIEWPORT = "(min-width: 1100px) and (min-height: 820px)";

/** The smallest grid worth showing: header, a few rows, footer. */
const MIN_GRID_HEIGHT = 340;

function useRoomyViewport(): boolean {
  // `matchMedia` rather than a resize listener: the browser only calls back
  // when the answer changes, not on every pixel of a drag.
  const [roomy, setRoomy] = useState(
    () => window.matchMedia(ROOMY_VIEWPORT).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(ROOMY_VIEWPORT);
    const update = () => setRoomy(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return roomy;
}

const CELL_SELECTION_MODES = [
  { value: "none", label: "No cells" },
  { value: "single", label: "Cell" },
  { value: "range", label: "Cell range" },
] as const satisfies ReadonlyArray<{
  value: TMDataGridCellSelectionMode;
  label: string;
}>;

/** One switch per option, wired straight to the option name in `key`. */
function FeatureSwitches({
  toggles,
  features,
  setFeatures,
}: {
  toggles: ReadonlyArray<{
    key: FeatureKey;
    label: string;
    hint?: string;
  }>;
  features: Record<FeatureKey, boolean>;
  setFeatures: Dispatch<SetStateAction<Record<FeatureKey, boolean>>>;
}) {
  return toggles.map(({ key, label, hint }) => (
    <Tooltip
      key={key}
      label={hint}
      disabled={hint === undefined}
      withArrow
      multiline
      w={240}
    >
      <Switch
        size="xs"
        label={label}
        checked={features[key]}
        onChange={(event) => {
          // Read before the updater runs - React clears currentTarget once the
          // handler returns.
          const { checked } = event.currentTarget;
          setFeatures((prev) => ({ ...prev, [key]: checked }));
        }}
      />
    </Tooltip>
  ));
}

/**
 * The kitchen sink. Every feature at once behind switches, so the way they
 * compose can be seen - and so a configuration can be dialled in and taken as
 * code. It is deliberately not a starting point: for that, the examples under
 * `/examples` show one thing at a time.
 */
export function PlaygroundExample() {
  const data = MANY_EMPLOYEES;
  const [size, setSize] = useState<TMDataGridSize>("md");

  // Stock TanStack options, apart from `enableColumnOrdering` and
  // `enablePagination` which the grid defines itself. Turning one off removes
  // the matching chrome on its own.
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>({
    enableRowSelection: true,
    enableMultiRowSelection: true,
    enableSorting: true,
    enableColumnFilters: true,
    enableHiding: true,
    enableColumnPinning: true,
    enableColumnResizing: true,
    enableColumnOrdering: true,
    enablePagination: true,
    enableGrouping: true,
  });
  const [customPager, setCustomPager] = useState(false);
  const [rowContextMenu, setRowContextMenu] = useState(true);
  const [rowDetails, setRowDetails] = useState(true);
  const [striped, setStriped] = useState(false);
  const [rowNumbers, setRowNumbers] = useState(false);
  const [rowPinning, setRowPinning] = useState(false);
  const [customEmptyState, setCustomEmptyState] = useState(false);
  const [fuzzySearch, setFuzzySearch] = useState(true);
  const [matchHighlighting, setMatchHighlighting] = useState(false);
  const [selectionMode, setSelectionMode] =
    useState<TMDataGridSelectionMode>("checkbox");
  const [cellSelection, setCellSelection] =
    useState<TMDataGridCellSelectionMode>("range");
  // Undefined follows the mode: off with checkboxes, on when rows select.
  const [showSelectedBackground, setShowSelectedBackground] = useState<
    boolean | undefined
  >(undefined);
  const [snippetOpen, setSnippetOpen] = useState(false);
  // The whole i18n integration: one option, one dictionary.
  const [locale, setLocale] = useState<"en" | "sv">("en");
  // `null` until the user says otherwise, and then it is theirs: the viewport
  // picks the opening state, a click overrides it for good. Following the
  // viewport after a click would reopen a panel somebody just shut.
  const [optionsOpen, setOptionsOpen] = useState<boolean | null>(null);
  const roomy = useRoomyViewport();
  const showOptions = optionsOpen ?? roomy;

  const grid = useTMDataGrid({
    data,
    columns,
    getRowId: (row) => String(row.id),
    // No rowHeight - let the `size` prop drive it.
    meta: { loading: false },
    labels: locale === "sv" ? TMDATAGRID_LABELS_SV : undefined,
    persist,
    selectionMode,
    showSelectedBackground,
    cellSelection,
    enableRowNumbers: rowNumbers,
    enableRowPinning: rowPinning,
    quickSearchMode: fuzzySearch ? "fuzzy" : "contains",
    enableMatchHighlighting: matchHighlighting,
    // Setting the render prop is what turns row details on; the grid measures
    // whatever it returns, so the estimate only has to be in the right region.
    renderDetails: rowDetails
      ? ({ row }) => <EmployeeDetails employee={row.original} />
      : undefined,
    renderDetailsEstHeight: 120,
    ...features,
    initialState: {
      sorting: [{ id: "id", desc: false }],
      pagination: { pageIndex: 0, pageSize: 25 },
    },
  });

  // The chrome store and the table store are both subscribable - this is how a
  // consumer reacts to grid state without owning it.
  const selectedCount = useSelector(
    grid.table.store,
    (state) => Object.keys(state.rowSelection).length,
  );
  // The highlighted row is chrome state, so it comes off the ui store instead.
  // A detail panel is exactly what it exists for.
  const highlightedRowId = useSelector(
    grid.ui,
    (state) => state.highlightedRowId,
  );
  const highlightedEmployee = data.find(
    (row) => String(row.id) === highlightedRowId,
  );

  return (
    // The app shell hands out exactly one viewport and clips the rest, so the
    // page scrolls itself once its own minimum heights stop fitting - which is
    // what keeps the grid a grid in a narrow editor pane rather than a header
    // with a scrollbar under it.
    <Flex
      direction="column"
      gap="md"
      p={{ base: "sm", md: "lg" }}
      h="100%"
      style={{ overflowY: "auto" }}
    >
      <Group justify="space-between" gap="sm" wrap="wrap">
        <Group gap="sm" wrap="wrap">
          <Text fw={600} size="lg">
            Employees{" "}
            <Text component="span" size="sm" c="dimmed" fw={400}>
              - 5 000 rows · virtualized · state persisted to localStorage
            </Text>
          </Text>
          {/* Outside the grid, which is what the `api` prop is for: the pills
              read the same filter state the panel writes. */}
          <TMDataGrid.FilterPills api={grid} />
        </Group>
        <Group gap="xs" wrap="nowrap">
          {/* Swaps every string in the grid - labels: TMDATAGRID_LABELS_SV. */}
          <SegmentedControl
            size="xs"
            value={locale}
            onChange={(value) => setLocale(value as "en" | "sv")}
            data={[
              { value: "en", label: "EN" },
              { value: "sv", label: "SV" },
            ]}
          />
          <Button
            size="xs"
            variant="subtle"
            aria-expanded={showOptions}
            onClick={() => setOptionsOpen(!showOptions)}
          >
            {showOptions ? "Hide options" : "Options"}
          </Button>
          {/* Set the switches below to what you want, then take the code. */}
          <Button size="xs" variant="light" onClick={() => setSnippetOpen(true)}>
            Get the code
          </Button>
        </Group>
      </Group>

      <StarterSnippetModal
        opened={snippetOpen}
        onClose={() => setSnippetOpen(false)}
        config={{
          options: features,
          selectionMode,
          size,
          customPager,
          showSelectedBackground,
          rowContextMenu,
          rowDetails,
          cellSelection,
        }}
      />

      {/* `Collapse` animates the height, so the grid below grows back into the
          space rather than jumping into it. */}
      <Collapse expanded={showOptions}>
        <Flex gap="sm" wrap="wrap" align="stretch">
          <Fieldset legend="Selection" p="xs" pt={4}>
            <Stack gap={6}>
              <SegmentedControl
                size="xs"
                value={selectionMode}
                onChange={(value) =>
                  setSelectionMode(value as TMDataGridSelectionMode)
                }
                data={SELECTION_MODES as unknown as Array<{
                  value: string;
                  label: string;
                }>}
              />
              <Group gap="md">
                <FeatureSwitches
                  toggles={SELECTION_TOGGLES}
                  features={features}
                  setFeatures={setFeatures}
                />
                <Switch
                  size="xs"
                  label="Selected background"
                  checked={grid.features.showSelectedBackground}
                  onChange={(event) =>
                    setShowSelectedBackground(event.currentTarget.checked)
                  }
                />
              </Group>
              <Tooltip
                label="Cell cursor: arrows move it, drag or Shift+arrows select a block, Ctrl+C copies it for Excel"
                withArrow
                multiline
                w={260}
              >
                <SegmentedControl
                  size="xs"
                  value={cellSelection}
                  onChange={(value) =>
                    setCellSelection(value as TMDataGridCellSelectionMode)
                  }
                  data={CELL_SELECTION_MODES as unknown as Array<{
                    value: string;
                    label: string;
                  }>}
                />
              </Tooltip>
            </Stack>
          </Fieldset>

          <Fieldset legend="Columns" p="xs" pt={4}>
            {/* Capped so six switches wrap to 3 × 2 rather than one long line -
                which is what pushes the other groups off the row. */}
            <Group gap="md" maw={260}>
              <FeatureSwitches
                toggles={COLUMN_TOGGLES}
                features={features}
                setFeatures={setFeatures}
              />
            </Group>
          </Fieldset>

          {/* Size lives here because it drives row height and font size - it is
              row density, not a category of its own. */}
          <Fieldset legend="Rows" p="xs" pt={4}>
            <Stack gap={6}>
              <SegmentedControl
                size="xs"
                value={size}
                onChange={(value) => setSize(value as TMDataGridSize)}
                data={["xs", "sm", "md", "lg", "xl"]}
              />
              <Group gap="md">
                <FeatureSwitches
                  toggles={ROW_TOGGLES}
                  features={features}
                  setFeatures={setFeatures}
                />
                <Switch
                  size="xs"
                  label="Custom pager"
                  disabled={!features.enablePagination}
                  checked={customPager}
                  onChange={(event) => setCustomPager(event.currentTarget.checked)}
                />
                <Tooltip
                  label="Right-click any row - the grid owns the Menu, you fill the dropdown"
                  withArrow
                  multiline
                  w={240}
                >
                  <Switch
                    size="xs"
                    label="Context menu"
                    checked={rowContextMenu}
                    onChange={(event) =>
                      setRowContextMenu(event.currentTarget.checked)
                    }
                  />
                </Tooltip>
                <Tooltip
                  label="Chevron in the first column opens a panel under the row - panels vary in height and are measured"
                  withArrow
                  multiline
                  w={240}
                >
                  <Switch
                    size="xs"
                    label="Row details"
                    checked={rowDetails}
                    onChange={(event) => setRowDetails(event.currentTarget.checked)}
                  />
                </Tooltip>
                <Tooltip
                  label="Stripes follow the row's position in the view, so sorting and scrolling never shift them"
                  withArrow
                  multiline
                  w={240}
                >
                  <Switch
                    size="xs"
                    label="Striped"
                    checked={striped}
                    onChange={(event) => setStriped(event.currentTarget.checked)}
                  />
                </Tooltip>
                <Tooltip
                  label="A gutter outermost left numbering the current view - continues across pages, group rows unnumbered"
                  withArrow
                  multiline
                  w={240}
                >
                  <Switch
                    size="xs"
                    label="Row numbers"
                    checked={rowNumbers}
                    onChange={(event) => setRowNumbers(event.currentTarget.checked)}
                  />
                </Tooltip>
                <Tooltip
                  label="Pin rows to sticky edge blocks from the context menu - the body scrolls beneath them"
                  withArrow
                  multiline
                  w={240}
                >
                  <Switch
                    size="xs"
                    label="Row pinning"
                    checked={rowPinning}
                    onChange={(event) =>
                      setRowPinning(event.currentTarget.checked)
                    }
                  />
                </Tooltip>
                <Tooltip
                  label="renderEmptyState replaces the built-in empty messages - filter to no matches to see it"
                  withArrow
                  multiline
                  w={240}
                >
                  <Switch
                    size="xs"
                    label="Custom empty state"
                    checked={customEmptyState}
                    onChange={(event) =>
                      setCustomEmptyState(event.currentTarget.checked)
                    }
                  />
                </Tooltip>
                <Tooltip
                  label="Fuzzy quick search: typos forgiven, unsorted results ordered by match quality - try “Stckholm”"
                  withArrow
                  multiline
                  w={240}
                >
                  <Switch
                    size="xs"
                    label="Fuzzy search"
                    checked={fuzzySearch}
                    onChange={(event) =>
                      setFuzzySearch(event.currentTarget.checked)
                    }
                  />
                </Tooltip>
                <Tooltip
                  label="Cells mark the matched text while a filter or the search narrows - default-rendered columns only"
                  withArrow
                  multiline
                  w={240}
                >
                  <Switch
                    size="xs"
                    label="Match highlighting"
                    checked={matchHighlighting}
                    onChange={(event) =>
                      setMatchHighlighting(event.currentTarget.checked)
                    }
                  />
                </Tooltip>
              </Group>
            </Stack>
          </Fieldset>
        </Flex>
      </Collapse>

      <Flex gap="md" flex={1} mih={MIN_GRID_HEIGHT}>
        <TMDataGrid
          {...grid}
          size={size}
          style={{
            flex: 1,
            minHeight: 0,
            // Both backgrounds are CSS variables, changeable without touching
            // the flags that decide whether they apply.
            "--dg-row-selected-bg": "var(--mantine-primary-color-light)",
          }}
        >
          <TMDataGrid.Toolbar>
            <TMDataGrid.SummaryCount />
            {/* Gated on the flag, not just the count: under "highlight" there
                is no selection, and a stale count would still be in state. */}
            {grid.features.rowSelection && selectedCount > 0 && (
              <Badge variant="light" size="sm">
                {selectedCount} selected
              </Badge>
            )}
            {/* Quick search over every column - writes `globalFilter`. */}
            <TMDataGrid.Search />
            <TMDataGrid.Spacer />
            {/* The toolbar is plain composition, so an app's own actions sit
                beside the built-ins. Export takes every filtered row. */}
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() =>
                exportGrid({
                  table: grid.table,
                  options: { fileName: "employees" },
                })
              }
            >
              {locale === "sv" ? "Exportera" : "Export"}
            </Button>
            <TMDataGrid.FilterButton />
            <TMDataGrid.Menu>
              <TMDataGrid.Menu.Export columns="custom" />
              <TMDataGrid.Menu.Columns />
            </TMDataGrid.Menu>
          </TMDataGrid.Toolbar>

          <TMDataGrid.Table<Employee>
            striped={striped}
            // Replaces both built-in empty messages; `hasActiveFilters` says
            // whether clearing filters would help or the grid is truly empty.
            renderEmptyState={
              customEmptyState
                ? ({ hasActiveFilters, table }) =>
                    hasActiveFilters ? (
                      <Stack align="center" gap="xs">
                        <Text size="sm" c="dimmed">
                          Nothing matches your filters
                        </Text>
                        <Button
                          size="compact-sm"
                          variant="light"
                          onClick={() => {
                            table.resetColumnFilters();
                            table.resetGlobalFilter();
                          }}
                        >
                          Clear filters
                        </Button>
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No employees yet
                      </Text>
                    )
                : undefined
            }
            // The render prop fills a Mantine dropdown the grid opens at the
            // pointer. `cell` is the one that was right-clicked, which is what
            // makes a per-cell action like "copy" possible at all.
            renderRowContextMenu={
              rowContextMenu
                ? ({ row, cell }) => {
                    // The raw cell value, not the rendered one: Salary shows
                    // "42 000 kr" but filters and copies as 42000.
                    const value = cell ? String(cell.getValue() ?? "") : "";
                    const canFilter =
                      cell !== null && cell.column.getCanFilter() && value !== "";

                    return (
                      <>
                        <Menu.Label>
                          {row.original.firstName} {row.original.lastName}
                        </Menu.Label>
                        <Menu.Item
                          disabled={!grid.features.highlightRow}
                          onClick={() =>
                            grid.ui.actions.setHighlightedRow(row.id)
                          }
                        >
                          Show details
                        </Menu.Item>
                        <Menu.Item
                          disabled={!cell}
                          onClick={() =>
                            navigator.clipboard.writeText(value)
                          }
                        >
                          Copy cell value
                        </Menu.Item>
                        {grid.features.rowPinning && (
                          <>
                            {row.getIsPinned() !== "top" && (
                              <Menu.Item onClick={() => row.pin("top")}>
                                Pin to top
                              </Menu.Item>
                            )}
                            {row.getIsPinned() !== "bottom" && (
                              <Menu.Item onClick={() => row.pin("bottom")}>
                                Pin to bottom
                              </Menu.Item>
                            )}
                            {row.getIsPinned() !== false && (
                              <Menu.Item onClick={() => row.pin(false)}>
                                Unpin
                              </Menu.Item>
                            )}
                          </>
                        )}
                        <Menu.Item
                          disabled={!canFilter}
                          onClick={() => {
                            if (!cell) return;
                            // The operator travels inside the filter value, so
                            // adding a filter is one `setFilterValue` call -
                            // and opening the panel shows what just happened.
                            cell.column.setFilterValue({
                              operator: "equals",
                              value,
                            } satisfies TMDataGridFilterValue);
                            grid.ui.actions.openFilterPanel(cell.column.id);
                          }}
                        >
                          Filter by “{truncate(value)}”
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          disabled={row.original.status === "Terminated"}
                        >
                          Terminate
                        </Menu.Item>
                      </>
                    );
                  }
                : undefined
            }
          />

          {customPager ? (
            // The slot replaces the pager while keeping the built-in
            // page-size select beside it.
            <TMDataGrid.Footer
              renderPagination={({ state, actions, Controls }) => (
                <>
                  <Controls.PageSize />
                  <Pagination
                    size="sm"
                    total={state.pageCount}
                    value={state.pageIndex + 1}
                    onChange={(page) => actions.setPageIndex(page - 1)}
                  />
                </>
              )}
            />
          ) : (
            <TMDataGrid.Footer pageSizeOptions={[10, 25, 50, 100]} />
          )}
        </TMDataGrid>

        {grid.features.highlightRow && highlightedEmployee && (
          <Card withBorder w={260} p="md">
            <Stack gap="xs">
              <Text fw={600}>
                {highlightedEmployee.firstName} {highlightedEmployee.lastName}
              </Text>
              <Text size="sm" c="dimmed">
                #{highlightedEmployee.id} · {highlightedEmployee.department}
              </Text>
              <Text size="sm">{highlightedEmployee.location}</Text>
              <Text size="sm">{sek(highlightedEmployee.salary)}</Text>
              {/* Clearing the highlight is the consumer's job - the grid only
                  ever sets it, so a second click cannot close this panel. */}
              <Button
                size="xs"
                variant="light"
                onClick={() => grid.ui.actions.setHighlightedRow(null)}
              >
                Close
              </Button>
            </Stack>
          </Card>
        )}
      </Flex>
    </Flex>
  );
}
