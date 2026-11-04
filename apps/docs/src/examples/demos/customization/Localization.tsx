import { SegmentedControl } from "@mantine/core";
import { useState } from "react";
import {
  TMDataGrid,
  TMDATAGRID_LABELS_SV,
  useTMDataGrid,
  type TMDataGridLabelsOverride,
} from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

type Locale = "en" | "sv" | "partial";

/**
 * A partial override merges over the English base, so only the keys you name
 * change and a future release adding a key does not leave a gap. The Swedish
 * preset is complete and typed so that a missing key is a compile error.
 */
const PLAIN_ENGLISH: TMDataGridLabelsOverride = {
  filters: "Narrow down",
  manageColumns: "Choose columns",
  searchPlaceholder: "Find anyone…",
  noResults: "Nothing matched",
};

export function Localization() {
  const [locale, setLocale] = useState<Locale>("en");

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    // Every string and every aria-label the chrome renders comes from here.
    labels:
      locale === "sv"
        ? TMDATAGRID_LABELS_SV
        : locale === "partial"
          ? PLAIN_ENGLISH
          : undefined,
    enablePagination: true,
  });

  return (
    <>
      <SegmentedControl
        size="xs"
        mb="xs"
        value={locale}
        onChange={(value) => setLocale(value as Locale)}
        data={[
          { value: "en", label: "English (default)" },
          { value: "sv", label: "Svenska (preset)" },
          { value: "partial", label: "Four keys overridden" },
        ]}
      />

      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Search />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
          <TMDataGrid.Menu>
            <TMDataGrid.Menu.Columns />
          </TMDataGrid.Menu>
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
        <TMDataGrid.Footer />
      </TMDataGrid>
    </>
  );
}
