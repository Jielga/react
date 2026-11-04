import type {
  TMDataGridCellSelectionMode,
  TMDataGridSelectionMode,
  TMDataGridSize,
} from "@jielga/tmdatagrid";

/**
 * Builds the smallest file that reproduces what the example page is currently
 * showing.
 *
 * Only what differs from a default is emitted. A grid with every switch left
 * alone comes out as `data`, `columns` and `getRowId`, which is what the common
 * case actually requires.
 */

/** Options whose default is known, so they can be left out when they match. */
const OPTION_DEFAULTS = {
  enableRowSelection: true,
  enableMultiRowSelection: true,
  enableSorting: true,
  enableColumnFilters: true,
  enableHiding: true,
  enableColumnPinning: true,
  enableColumnResizing: true,
  enableColumnOrdering: true,
  enablePagination: false,
} as const;

export type StarterSnippetOption = keyof typeof OPTION_DEFAULTS;

/** Short note for the options whose effect is not obvious from the name. */
const OPTION_NOTES: Partial<Record<StarterSnippetOption, string>> = {
  enableMultiRowSelection: "one row at a time; drops the select-all box",
  enableRowSelection: "no row can be selected",
  enablePagination: "off by default - all rows render, virtualized",
};

const SELECTION_MODE_NOTES: Record<TMDataGridSelectionMode, string> = {
  checkbox: "checkbox column, multi-select",
  row: "no checkbox column; click a row, Ctrl/Shift to extend",
  checkboxAndHighlight:
    "checkboxes multi-select, and a click highlights one row",
  highlight: "no selection - a click only highlights, for a detail panel",
};

export type StarterSnippetConfig = {
  options: Record<StarterSnippetOption, boolean>;
  selectionMode: TMDataGridSelectionMode;
  size: TMDataGridSize;
  customPager: boolean;
  /** `undefined` follows the mode, which needs no line in the snippet. */
  showSelectedBackground: boolean | undefined;
  rowContextMenu: boolean;
  rowDetails: boolean;
  cellSelection: TMDataGridCellSelectionMode;
};

const DEFAULT_SIZE: TMDataGridSize = "md";
const DEFAULT_SELECTION_MODE: TMDataGridSelectionMode = "checkbox";

/** What `showSelectedBackground` would be if it were left out entirely. */
function defaultShowSelectedBackground(mode: TMDataGridSelectionMode): boolean {
  return mode === "row";
}

function hasHighlight(mode: TMDataGridSelectionMode): boolean {
  return mode === "checkboxAndHighlight" || mode === "highlight";
}

export function buildStarterSnippet({
  options,
  selectionMode,
  size,
  customPager,
  showSelectedBackground,
  rowContextMenu,
  rowDetails,
  cellSelection,
}: StarterSnippetConfig): string {
  const highlight = hasHighlight(selectionMode);
  const paginated = options.enablePagination;

  // Only the lines that differ from a default. Anything omitted is a default,
  // which keeps the snippet short.
  const gridOptions: Array<string> = [];

  if (selectionMode !== DEFAULT_SELECTION_MODE) {
    gridOptions.push(
      `    // ${SELECTION_MODE_NOTES[selectionMode]}`,
      `    selectionMode: "${selectionMode}",`,
    );
  }

  // Nothing can be selected, so every other selection option is inert - and an
  // inert line in a starter file is worse than a missing one.
  const selectionOff =
    selectionMode === "highlight" || !options.enableRowSelection;

  for (const key of Object.keys(OPTION_DEFAULTS) as Array<StarterSnippetOption>) {
    const value = options[key];
    if (value === OPTION_DEFAULTS[key]) continue;
    // `"highlight"` already means no selection; saying it twice reads as though
    // the two were separate decisions.
    if (key === "enableRowSelection" && selectionMode === "highlight") continue;
    if (key === "enableMultiRowSelection" && selectionOff) continue;
    const note = OPTION_NOTES[key];
    if (note !== undefined) gridOptions.push(`    // ${note}`);
    gridOptions.push(`    ${key}: ${String(value)},`);
  }

  if (
    !selectionOff &&
    showSelectedBackground !== undefined &&
    showSelectedBackground !== defaultShowSelectedBackground(selectionMode)
  ) {
    gridOptions.push(
      `    showSelectedBackground: ${String(showSelectedBackground)},`,
    );
  }

  if (cellSelection !== "none") {
    gridOptions.push(
      cellSelection === "range"
        ? "    // Arrow keys move a cell cursor; drag or Shift+arrows select a block,\n    //     Ctrl+C copies it, right-click exports it."
        : "    // Arrow keys move a cell cursor through the body.",
      `    cellSelection: "${cellSelection}",`,
    );
  }

  if (rowDetails) {
    gridOptions.push(
      "    // Setting this adds the pinned chevron lane and renders what it opens.",
      "    //     The panel is measured, so it can be any height.",
      "    renderDetails: ({ row }) => (",
      "      <pre>{JSON.stringify(row.original, null, 2)}</pre>",
      "    ),",
    );
  }

  const imports = [
    "import {",
    "  createTMDataGridColumnHelper,",
    "  TMDataGrid,",
    "  useTMDataGrid,",
    '} from "@jielga/tmdatagrid";',
    'import "@jielga/tmdatagrid/styles.css";',
  ];
  if (highlight) {
    imports.push('import { useSelector } from "@tanstack/react-store";');
  }
  if (rowContextMenu) {
    imports.push('import { Menu } from "@mantine/core";');
  }

  const toolbar = [
    "        <TMDataGrid.Toolbar>",
    "          <TMDataGrid.SummaryCount />",
    "          <TMDataGrid.Spacer />",
  ];
  // Both buttons render nothing when their feature is off, so leaving them out
  // here changes nothing on screen.
  if (options.enableColumnFilters) {
    toolbar.push("          <TMDataGrid.FilterButton />");
  }
  if (options.enableHiding) {
    toolbar.push("          <TMDataGrid.Menu>");
    toolbar.push("            <TMDataGrid.Menu.Columns />");
    toolbar.push("          </TMDataGrid.Menu>");
  }
  toolbar.push("        </TMDataGrid.Toolbar>");

  const footer: Array<string> = [];
  if (paginated && customPager) {
    footer.push(
      "",
      "        {/* Any pager you like, beside the built-in page-size select. */}",
      "        <TMDataGrid.Footer",
      "          renderPagination={({ state, actions, Controls }) => (",
      "            <>",
      "              <Controls.PageSize />",
      "              <button",
      "                disabled={!state.canNextPage}",
      "                onClick={actions.nextPage}",
      "              >",
      "                Next ({state.pageIndex + 1} / {state.pageCount})",
      "              </button>",
      "            </>",
      "          )}",
      "        />",
    );
  } else if (paginated) {
    footer.push("", "        <TMDataGrid.Footer />");
  }

  const sizeProp = size === DEFAULT_SIZE ? "" : ` size="${size}"`;

  // The grid opens the Menu at the pointer and closes it again; the render prop
  // only says what goes in the dropdown.
  const tableElement = rowContextMenu
    ? [
        "        <TMDataGrid.Table<MyRow>",
        "          renderRowContextMenu={({ row, cell }) => (",
        "            <>",
        "              <Menu.Label>{row.original.name}</Menu.Label>",
        "              <Menu.Item onClick={() => console.log(row.original)}>",
        "                Open",
        "              </Menu.Item>",
        "              <Menu.Item",
        "                onClick={() =>",
        "                  navigator.clipboard.writeText(String(cell?.getValue() ?? ''))",
        "                }",
        "              >",
        "                Copy cell value",
        "              </Menu.Item>",
        "            </>",
        "          )}",
        "        />",
      ]
    : ["        <TMDataGrid.Table<MyRow> />"];

  const highlightBlock = highlight
    ? [
        "",
        "  // 4 · The highlighted row is chrome state, so it comes off `grid.ui`",
        "  //     rather than the table. This is what a detail panel follows.",
        "  //     Clear it when the panel closes:",
        "  //     grid.ui.actions.setHighlightedRow(null)",
        "  const highlightedId = useSelector(grid.ui, (ui) => ui.highlightedRowId);",
        "  const highlighted = data.find((row) => String(row.id) === highlightedId);",
      ]
    : [];

  const gridElement = [
    // A grid with no height collapses to nothing - the one layout gotcha.
    `      <TMDataGrid {...grid}${sizeProp} style={{ height: 480 }}>`,
    ...toolbar,
    "",
    ...tableElement,
    ...footer,
    "      </TMDataGrid>",
  ];

  // `gridElement` is authored at the indent a fragment child needs, so the
  // fragment takes it as-is and the bare case dedents by one level.
  const body = highlight
    ? [
        "    <>",
        ...gridElement,
        "",
        "      {highlighted && (",
        "        // Your detail panel goes here.",
        "        <pre>{JSON.stringify(highlighted, null, 2)}</pre>",
        "      )}",
        "    </>",
      ]
    : gridElement.map((line) => (line === "" ? "" : line.slice(2)));

  return [
    "// Everything not listed below is a default - this is the whole setup.",
    "",
    ...imports,
    "",
    "// 1 · Your row type. Swap these two fields for your own.",
    "type MyRow = {",
    "  id: number;",
    "  name: string;",
    "};",
    "",
    "// 2 · Columns at module scope - a new array every render rebuilds the",
    "//     column model. `meta.type` decides which filter operators appear.",
    "const columnHelper = createTMDataGridColumnHelper<MyRow>();",
    "",
    "const columns = columnHelper.columns([",
    '  columnHelper.accessor("id", {',
    '    header: "ID",',
    '    meta: { type: "number", align: "right" },',
    "    minSize: 80,",
    "  }),",
    '  columnHelper.accessor("name", { header: "Name", minSize: 160 }),',
    "]);",
    "",
    "export function MyGrid({ data }: { data: MyRow[] }) {",
    "  const grid = useTMDataGrid({",
    "    data,",
    "    columns,",
    "    // 3 · Stable ids. Selection and the highlight are keyed by these.",
    "    getRowId: (row) => String(row.id),",
    ...gridOptions,
    "  });",
    ...highlightBlock,
    "",
    "  return (",
    ...body,
    "  );",
    "}",
    "",
  ].join("\n");
}
