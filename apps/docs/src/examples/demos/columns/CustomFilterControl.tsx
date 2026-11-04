import { Chip, Group } from "@mantine/core";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridFilterControlComponent,
} from "@jielga/tmdatagrid";
import { EMPLOYEES, sek, type Employee } from "../../data/employees";

/**
 * A filter control fills the *value* slot of one filter-panel row. The
 * contract is value-only: read `operator` to shape yourself, call `onChange`
 * with the bare value, and let the grid pair it with the operator.
 *
 * `options` arrives pre-resolved for any column that declares `meta.options`,
 * so a control like this one never has to know where the choices came from.
 *
 * Module scope, and a component rather than a render function - so hooks are
 * legal inside and its identity is stable across renders.
 */
const StatusChips: TMDataGridFilterControlComponent = ({
  value,
  onChange,
  options,
  size,
}) => {
  // `isAnyOf` hands an array; the single-value operators hand a string.
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <Chip.Group
      multiple
      value={[...selected]}
      onChange={(next) => onChange(next)}
    >
      <Group gap={4}>
        {options.map((option) => (
          <Chip key={option.value} value={option.value} size={size}>
            {option.label}
          </Chip>
        ))}
      </Group>
    </Chip.Group>
  );
};

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("firstName", { header: "First name", minSize: 120 }),
  columnHelper.accessor("lastName", { header: "Last name", minSize: 120 }),
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => sek(info.getValue()),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    minSize: 140,
    meta: {
      type: "select",
      options: "faceted",
      // `isAnyOf` is the operator the chips are shaped for, so the filter
      // opens on it rather than on the type's default.
      filter: { defaultOperator: "isAnyOf", control: StatusChips },
    },
  }),
]);

export function CustomFilterControl() {
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
