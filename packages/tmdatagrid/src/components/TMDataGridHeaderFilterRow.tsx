import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useMemo, useRef, useState } from "react";
import classes from "./TMDataGridHeaderFilterRow.module.css";
import sticky from "./sticky.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import {
  getColumnDefaultOperator,
  getColumnLabel,
  getColumnOperators,
  isControlColumn,
} from "../core/columnUtils";
import {
  type TMDataGridFilterOperator,
  type TMDataGridFilterValue,
  emptyValueForOperator,
  filterValueShape,
  isTMDataGridFilterValue,
} from "../core/filterOperators";
import { FilterIcon } from "./icons";
import {
  filterControlFor,
  filterOptionsUseFacets,
} from "./filters/filterControlFor";
import type { TMDataGridColumnLayout } from "./TMDataGridTable";
import type { TMDataGridHeader } from "./TMDataGridHeaderCell";

/**
 * Whether a value says nothing at all - untrimmed, unlike `isFilterActive`,
 * which is about whether a filter *narrows* anything. A lone space narrows
 * nothing but is very much something the user typed.
 */
function isEmptyValue(value: string | ReadonlyArray<string>): boolean {
  return Array.isArray(value)
    ? value.every((entry) => entry === "")
    : value === "";
}

/**
 * One column's filter control, as it appears in the header row: the value
 * control the column would get in the panel, plus a button for the operator
 * when the column's type offers more than one.
 *
 * The column and operator dropdowns of a panel row have no place here - the
 * column is the one the cell sits over, and a header cell has room for a value
 * and not much else. Everything else is the same filter: the same operators,
 * the same `meta.filter.control`, the same `columnFilters` state.
 */
function HeaderFilterControl({ column }: { column: TMDataGridHeader["column"] }) {
  const { table, labels, controlSize } = useTMDataGridContext();
  const filterValue = useSelector(
    table.store,
    (state) => state.columnFilters.find((filter) => filter.id === column.id)?.value,
  );

  const defaultOperator = getColumnDefaultOperator(column);
  const current = isTMDataGridFilterValue(filterValue) ? filterValue : undefined;
  const operator = current?.operator ?? defaultOperator;
  const value = current?.value ?? emptyValueForOperator(operator);
  const label = getColumnLabel(column);

  /**
   * Writes the filter, or drops it entirely once nothing is left to say. A
   * header control is always on screen, so an empty one has no row to keep
   * alive the way a panel row does, and leaving the entry behind would put a
   * filter in `columnFilters` that says nothing.
   *
   * Emptiness here is the literal one, not `isFilterActive`'s: that one trims,
   * and dropping the filter on a value of `" "` would take the space back out
   * of the input the moment it was typed. An operator the user picked is worth
   * keeping even with an empty value; the type's own default is not.
   */
  function write(next: TMDataGridFilterValue) {
    const worthKeeping =
      !isEmptyValue(next.value) || next.operator !== defaultOperator;
    column.setFilterValue(worthKeeping ? next : undefined);
  }

  function changeOperator(next: TMDataGridFilterOperator) {
    // Same arity rule as the panel: keep the value across operators of the
    // same shape, reset it across any shape boundary.
    write({
      operator: next,
      value:
        filterValueShape(next) === filterValueShape(operator)
          ? value
          : emptyValueForOperator(next),
    });
  }

  // Memoized because this row re-renders with the table - on every scroll
  // frame, for every column - while resolving faceted options walks the
  // faceted map into a sorted set. TanStack swaps that map's identity whenever
  // the values behind it change, so it is exactly the right key.
  const facetKey = filterOptionsUseFacets(column)
    ? column.getFacetedUniqueValues()
    : undefined;
  const { options, ValueControl } = useMemo(
    () => filterControlFor(table, column),
    // `facetKey` is a cache key, not something the body reads: the resolution
    // reaches the faceted map through the column, so nothing here names it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, column, facetKey],
  );
  const operators = getColumnOperators(column);

  return (
    <>
      <div className={classes.headerFilterValue} data-dg-filter-value-slot>
        <ValueControl
          column={column}
          table={table}
          operator={operator}
          value={value}
          onChange={(next) => write({ operator, value: next })}
          options={options}
          size={controlSize}
          labels={labels}
          layout="header"
        />
      </div>

      <OperatorMenu
        columnId={column.id}
        columnLabel={label}
        operator={operator}
        isDefault={operator === defaultOperator}
        operators={operators}
        onChange={changeOperator}
      />
    </>
  );
}

/**
 * The operator picker beside a header filter's value: which comparison the
 * column is on, and the list to change it to.
 *
 * The tooltip is the only thing saying what the current operator is while the
 * menu is shut, and the only thing in the way once it is open - so it is held
 * back while the dropdown shows.
 */
function OperatorMenu({
  columnId,
  columnLabel,
  operator,
  isDefault,
  operators,
  onChange,
}: {
  columnId: string;
  columnLabel: string;
  operator: TMDataGridFilterOperator;
  isDefault: boolean;
  operators: ReadonlyArray<TMDataGridFilterOperator>;
  onChange: (next: TMDataGridFilterOperator) => void;
}) {
  const { labels } = useTMDataGridContext();
  const [opened, setOpened] = useState(false);

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      shadow="md"
      width={220}
      withinPortal
    >
      <Menu.Target>
        <Tooltip
          label={labels.operators[operator]}
          openDelay={400}
          disabled={opened}
        >
          <ActionIcon
            className={classes.headerFilterOperator}
            variant="subtle"
            // Tinted while the column is on anything but its default operator -
            // the one part of the filter the value cannot show.
            color={isDefault ? "gray" : undefined}
            size="sm"
            aria-label={labels.filterOperatorFor(columnLabel)}
            data-dg-part="header-filter-operator"
            data-column-id={columnId}
          >
            <FilterIcon size={14} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        {operators.map((candidate) => (
          <Menu.Item
            key={candidate}
            className={
              candidate === operator ? classes.operatorItemActive : undefined
            }
            onClick={() => onChange(candidate)}
          >
            {labels.operators[candidate]}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * `filters.inHeader` - a second header row holding one value control per
 * filterable column, always visible.
 *
 * A header row like the group rows above it, on the same column tracks and
 * with the same pinned lanes, so resizing, reordering and pinning move the
 * controls with their columns. It sticks below the group rows rather than at
 * the top, and carries `data-dg-header-row` so the body's scroll offset counts
 * it in.
 *
 * @internal Rendered by `TMDataGrid.Table`.
 */
export function TMDataGridHeaderFilterRow({
  leafHeaders,
  layoutFor,
  ariaRowIndex,
}: {
  leafHeaders: ReadonlyArray<TMDataGridHeader>;
  layoutFor: (columnId: string) => TMDataGridColumnLayout;
  ariaRowIndex: number;
}) {
  const { ui, labels } = useTMDataGridContext();
  const focusColumnId = useSelector(ui, (state) => state.headerFilterColumnId);
  const rowRef = useRef<HTMLDivElement>(null);

  // `openColumnFilter` under header filters means "put me in that column's
  // control" - there is no panel to open. The column may be scrolled out
  // sideways, so it is brought into view first.
  useEffect(() => {
    if (focusColumnId === null) return;
    const cell = rowRef.current?.querySelector<HTMLElement>(
      `[data-dg-part="header-filter-cell"][data-column-id="${CSS.escape(focusColumnId)}"]`,
    );
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
    cell
      ?.querySelector<HTMLElement>(
        "input:not([type='hidden']), textarea, select, [tabindex]:not([tabindex='-1'])",
      )
      ?.focus();
    ui.actions.focusHeaderFilter(null);
  }, [focusColumnId, ui]);

  return (
    <div
      ref={rowRef}
      role="row"
      aria-rowindex={ariaRowIndex}
      // Counted by the same measurement the group rows are: it is part of what
      // the body scrolls under.
      data-dg-header-row
      data-dg-header-filter-row
      data-dg-part="header-filter-row"
      // The header/body boundary is this row once it exists, so it wears the
      // scrolled-under shadow the last group row wears otherwise.
      className={`${classes.headerFilterRow} ${sticky.headerBoundary}`}
    >
      {leafHeaders.map((header) => {
        const column = header.column;
        const layout = layoutFor(column.id);
        return (
          <div
            key={header.id}
            role="columnheader"
            // Named only where there is a filter: a generated lane or a column
            // that does not filter holds no control to name.
            aria-label={
              column.getCanFilter()
                ? labels.filterOn(getColumnLabel(column))
                : undefined
            }
            data-dg-part="header-filter-cell"
            data-column-id={column.id}
            data-control-column={isControlColumn(column.id) || undefined}
            className={[
              classes.headerFilterCell,
              layout.isBoundary && layout.pinnedAt === "left"
                ? sticky.stickyLeft
                : "",
              layout.isBoundary && layout.pinnedAt === "right"
                ? sticky.stickyRight
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: layout.pinnedAt === "left" ? layout.offset : undefined,
              right: layout.pinnedAt === "right" ? layout.offset : undefined,
              position: layout.pinnedAt ? "sticky" : undefined,
              zIndex: layout.pinnedAt
                ? "var(--dg-z-header-pinned-cell, 7)"
                : undefined,
            }}
          >
            {column.getCanFilter() && <HeaderFilterControl column={column} />}
          </div>
        );
      })}
    </div>
  );
}
