import { SegmentedControl, Stack } from "@mantine/core";
import { useState } from "react";
import {
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridSize,
} from "@jielga/tmdatagrid";
import { employeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const SIZES: Array<TMDataGridSize> = ["xs", "sm", "md", "lg", "xl"];

/**
 * `size` is row density: it drives row height, font size and the size of every
 * control in the chrome at once, so a compact grid stays internally consistent
 * rather than becoming a small table with full-size buttons.
 */
export function DensityAndLayout() {
  const [size, setSize] = useState<TMDataGridSize>("md");

  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: employeeColumns,
    getRowId: (row) => String(row.id),
    enablePagination: true,
  });

  return (
    <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
      <SegmentedControl
        size="xs"
        w={260}
        value={size}
        onChange={(value) => setSize(value as TMDataGridSize)}
        data={SIZES}
      />

      {/* The grid fills whatever box it is given. In a flex column that means
          `flex: 1` to take the leftover space and `minHeight: 0` to be allowed
          to shrink below its content - without the second, the virtualizer's
          scroller never gets a bounded height and the page scrolls instead. */}
      <TMDataGrid {...grid} size={size} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
          <TMDataGrid.Menu>
            <TMDataGrid.Menu.Columns />
          </TMDataGrid.Menu>
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
        <TMDataGrid.Footer />
      </TMDataGrid>
    </Stack>
  );
}
