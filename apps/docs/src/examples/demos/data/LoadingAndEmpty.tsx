import { Button, SegmentedControl, Stack, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

type State = "loaded" | "loading" | "empty";

export function LoadingAndEmpty() {
  const [state, setState] = useState<State>("empty");

  const data = useMemo(
    () => (state === "loaded" ? EMPLOYEES : []),
    [state],
  );

  const meta = useMemo(
    // The first load, when there is nothing on screen yet: the grid shows its
    // loader instead of an empty state. A refetch that keeps rows on screen
    // wants `TMDataGrid.LoadingIndicator` in the toolbar instead.
    () => ({ loading: state === "loading" }),
    [state],
  );

  const grid = useTMDataGrid({
    data,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    meta,
  });

  return (
    <>
      <SegmentedControl
        size="xs"
        mb="xs"
        value={state}
        onChange={(value) => setState(value as State)}
        data={[
          { value: "empty", label: "no data" },
          { value: "loading", label: "loading" },
          { value: "loaded", label: "loaded - now filter to nothing" },
        ]}
      />

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Search />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
        </TMDataGrid.Toolbar>

        <TMDataGrid.Table<Employee>
          // Replaces both built-in empty messages. `hasActiveFilters` says
          // which emptiness this is - a filter that matched nothing wants a
          // way out, a grid with no data at all wants a way in.
          renderEmptyState={({ hasActiveFilters, table }) => (
            <Stack align="center" gap="xs">
              <Text size="sm" c="dimmed">
                {hasActiveFilters
                  ? "Nothing matches your filters"
                  : "No employees yet"}
              </Text>
              {hasActiveFilters ? (
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
              ) : (
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={() => setState("loaded")}
                >
                  Add the first one
                </Button>
              )}
            </Stack>
          )}
        />
      </TMDataGrid>
    </>
  );
}
