import {
  createTMDataGridColumnHelper,
  DgAutocompleteFilter,
  DgDateRangeFilter,
  DgRangeSliderFilter,
  DgTriStateFilter,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),

  // A slider seeded from the data's own min and max. Pair it with `between`
  // so the filter opens on the operator the control is shaped for.
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: {
      type: "number",
      align: "right",
      filter: { defaultOperator: "between", control: DgRangeSliderFilter },
    },
    cell: (info) => sek(info.getValue()),
  }),

  // Two calendars for a date range, rather than two text inputs.
  columnHelper.accessor("hired", {
    header: "Hired",
    minSize: 130,
    meta: {
      type: "date",
      filter: { defaultOperator: "between", control: DgDateRangeFilter },
    },
  }),

  // Still free text (anything can be typed), but the values present in the
  // data are offered as suggestions.
  columnHelper.accessor("location", {
    header: "Location",
    minSize: 130,
    meta: { filter: { control: DgAutocompleteFilter } },
  }),

  // A boolean has three answers, not two: true, false, and "do not care".
  columnHelper.accessor("active", {
    header: "Active",
    minSize: 100,
    meta: {
      type: "boolean",
      align: "center",
      filter: { control: DgTriStateFilter },
    },
    cell: (info) => (info.getValue() ? "✓" : "-"),
  }),
]);

export function BuiltInFilterControls() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns,
    getRowId: (row) => String(row.id),
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
