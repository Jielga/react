import { Box, type BoxProps, Button, Pill, UnstyledButton } from "@mantine/core";
import type { RowData } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import classes from "./TMDataGridFilterPills.module.css";
import { resolveColumnOptions } from "../core/columnOptions";
import { getColumnLabel, getColumnType } from "../core/columnUtils";
import {
  formatFilterLabel,
  isFilterActive,
  isTMDataGridFilterValue,
} from "../core/filterOperators";
import type { TMDataGridSize } from "../core/sizes";
import type { TMDataGridRowData } from "../TMDataGridContext";
import {
  openColumnFilter,
  type TMDataGridApi,
  type TMDataGridTable,
} from "../useTMDataGrid";

/** Mantine's style props (`mb="sm"`, `hiddenFrom="sm"`) are set on the wrapper. */
export type TMDataGridFilterPillsProps<TData extends RowData> = BoxProps & {
  /** The object returned by `useTMDataGrid`. */
  api: TMDataGridApi<TData>;
  /** Mantine size of the pills. Defaults to `"sm"`. */
  size?: TMDataGridSize;
  /** "Clear all" button, shown once two filters are active. Defaults to `true`. */
  showClearAll?: boolean;
  /**
   * Replaces what a click on a pill's label does. The default opens the grid's
   * filter panel on that column.
   */
  onPillClick?: (columnId: string) => void;
};

/**
 * One pill per active filter (`First name: Sofia ✕`), with the ✕ clearing that
 * filter and a click on the label opening the filter panel on its column.
 *
 * The one grid component that takes the api as a prop instead of reading
 * context, so it can live anywhere: a page header, a card title, a breadcrumb
 * row. Renders nothing while no filter is active.
 *
 * ```tsx
 * const grid = useTMDataGrid({ data, columns });
 *
 * <Group>
 *   <Title order={3}>Employees</Title>
 *   <TMDataGridFilterPills api={grid} />
 * </Group>
 * ```
 *
 * Half-typed filters are left out: a filter that is not narrowing the rows yet
 * has nothing to report, which is the same rule the funnel indicator uses.
 */
export function TMDataGridFilterPills<TData extends RowData>({
  api,
  size = "sm",
  showClearAll = true,
  onPillClick,
  className,
  ...others
}: TMDataGridFilterPillsProps<TData>) {
  const { table, labels } = api;
  // The options readers take the row-type-erased table, like the rest of the
  // chrome does through context.
  const erased = table as unknown as TMDataGridTable<TMDataGridRowData>;
  const columnFilters = useSelector(
    table.store,
    (state) => state.columnFilters,
  );

  const activeFilters = columnFilters.filter((filter) =>
    isFilterActive(filter.value),
  );
  if (activeFilters.length === 0) return null;

  return (
    <Box
      role="group"
      aria-label={labels.activeFilters}
      data-dg-part="filter-pills"
      className={[classes.filterPills, className].filter(Boolean).join(" ")}
      {...others}
    >
      <Pill.Group size={size}>
        {activeFilters.map((filter) => {
          const column = table.getColumn(filter.id);
          const erasedColumn = erased.getColumn(filter.id);
          const label = column ? getColumnLabel(column) : filter.id;
          const value = filter.value;
          // isFilterActive already vouched for the shape; this narrows it.
          if (!isTMDataGridFilterValue(value)) return null;
          // Mantine types `removeButtonProps` as `CloseButtonProps`, which
          // has no room for `data-*` in an object literal. Spread in from a
          // typed value, they reach the button all the same.
          const removeButtonParts: Record<`data-${string}`, string> = {
            "data-dg-part": "filter-pill-remove",
            "data-column-id": filter.id,
          };

          return (
            <Pill
              key={filter.id}
              size={size}
              className={classes.pill}
              data-dg-part="filter-pill"
              data-column-id={filter.id}
              withRemoveButton
              onRemove={() =>
                table.setColumnFilters(
                  columnFilters.filter((other) => other.id !== filter.id),
                )
              }
              // Mantine hides its remove button from assistive tech and from
              // the tab order, because inside a `PillsInput` Backspace is the
              // way out. These pills stand on their own, so the ✕ has to be a
              // real button.
              removeButtonProps={{
                "aria-label": labels.clearFilter(label),
                "aria-hidden": false,
                tabIndex: 0,
                ...removeButtonParts,
              }}
            >
              <UnstyledButton
                className={classes.pillLabel}
                onClick={() =>
                  onPillClick
                    ? onPillClick(filter.id)
                    : openColumnFilter(api, filter.id)
                }
              >
                {formatFilterLabel({
                  label,
                  type: column ? getColumnType(column) : "string",
                  filter: value,
                  operatorLabels: labels.operators,
                  options: erasedColumn
                    ? resolveColumnOptions({ table: erased, column: erasedColumn })
                    : undefined,
                  labels,
                })}
              </UnstyledButton>
            </Pill>
          );
        })}
      </Pill.Group>

      {showClearAll && activeFilters.length > 1 && (
        // Below two pills their own ✕ is the shorter path, so the button would
        // only be a second way to do the same thing.
        <Button
          variant="subtle"
          color="gray"
          size="compact-xs"
          onClick={() => table.setColumnFilters([])}
        >
          {labels.clearAllFilters}
        </Button>
      )}
    </Box>
  );
}
