import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  TMDataGridFilterPills,
  useTMDataGrid,
  type TMDataGridDraftActionsProps,
  type TMDataGridFooterProps,
  type TMDataGridTableProps,
  type UseTMDataGridOptions,
} from "../src";

// No `@testing-library/*` here: the Playwright gallery renders these same
// fixtures in a real browser, where RTL has no place.

/**
 * Shared fixtures for the grid's tests. Lives outside `src/` so it stays out
 * of the published package and out of the declaration build.
 */
export type TestRow = {
  id: number;
  name: string;
  age: number;
  city: string;
};

const helper = createTMDataGridColumnHelper<TestRow>();

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
export const testColumns = helper.columns([
  helper.accessor("id", {
    header: "ID",
    meta: { type: "number" },
    minSize: 80,
  }),
  helper.accessor("name", { header: "Name", minSize: 120 }),
  helper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right" },
    minSize: 80,
  }),
  helper.accessor("city", { header: "City", minSize: 120 }),
]);

const CITIES = ["Stockholm", "Göteborg", "Malmö"];
const NAMES = ["Anna", "Erik", "Maria", "Lars", "Sofia"];

export function makeRows(count: number): Array<TestRow> {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: NAMES[index % NAMES.length],
    age: 20 + ((index * 7) % 40),
    city: CITIES[index % CITIES.length],
  }));
}

export const testRows = makeRows(12);

/**
 * `env="test"` disables Mantine's transitions. Without it a Popover's dropdown
 * never finishes mounting under jsdom, so panels opened in a test stay empty.
 */
export function MantineWrapper({ children }: { children: ReactNode }) {
  return <MantineProvider env="test">{children}</MantineProvider>;
}

export type GridProps = Partial<UseTMDataGridOptions<TestRow>> & {
  /** Everything under this key goes to `TMDataGrid.Table`, not to the hook. */
  tableProps?: TMDataGridTableProps<TestRow>;
  /** Everything under this key goes to `TMDataGrid.Footer`. */
  footerProps?: TMDataGridFooterProps;
  /** Renders `TMDataGrid.DraftActions` in the toolbar, with these props. */
  draftActionsProps?: TMDataGridDraftActionsProps;
  /** Passed to `<TMDataGrid>` itself, the way a consumer names a grid. */
  "data-testid"?: string;
};

/**
 * The full compound grid the component tests render - chrome, table and
 * footer - over the harness rows. Smoke tests for the wiring between the
 * chrome and the table live on this; TanStack's own behaviour is not
 * re-tested through it.
 */
export function Grid({
  tableProps,
  footerProps,
  draftActionsProps,
  "data-testid": testId,
  ...options
}: GridProps = {}) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row) => String(row.id),
    ...options,
  } as UseTMDataGridOptions<TestRow>);

  return (
    <>
      {/* Rendered outside the provider on purpose: the pills take the api as a
          prop, and nothing else in the grid may. */}
      <TMDataGridFilterPills api={grid} />
      <TMDataGrid {...grid} data-testid={testId}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          {draftActionsProps ? (
            <TMDataGrid.DraftActions {...draftActionsProps} />
          ) : null}
          <TMDataGrid.FilterButton />
          <TMDataGrid.Menu>
            <TMDataGrid.Menu.Columns />
          </TMDataGrid.Menu>
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<TestRow> {...tableProps} />
        <TMDataGrid.Footer {...footerProps} />
      </TMDataGrid>
    </>
  );
}
