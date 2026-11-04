import { Group, SegmentedControl, Switch } from "@mantine/core";
import { useState } from "react";
import {
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridQuickSearchMode,
} from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

export function QuickSearch() {
  const [mode, setMode] = useState<TMDataGridQuickSearchMode>("fuzzy");
  const [highlight, setHighlight] = useState(true);

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    // "fuzzy" is the default: typos are forgiven, and an unsorted grid comes
    // back ordered by match quality. "contains" is the literal substring.
    quickSearchMode: mode,
    // Cells mark the matched text while a filter or the search narrows -
    // default-rendered columns only, since a custom `cell` returns React the
    // grid cannot safely reach into.
    enableMatchHighlighting: highlight,
  });

  return (
    <>
      <Group gap="md" mb="xs">
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(value) => setMode(value as TMDataGridQuickSearchMode)}
          data={["fuzzy", "contains"]}
        />
        <Switch
          size="xs"
          label="Match highlighting"
          checked={highlight}
          onChange={(event) => setHighlight(event.currentTarget.checked)}
        />
      </Group>

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          {/* Debounced into `globalFilter`. Hidden entirely under
              `enableGlobalFilter: false`. */}
          <TMDataGrid.Search />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    </>
  );
}
