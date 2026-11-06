import { UnstyledButton } from "@mantine/core";
import {
  useBodyControlTabIndex,
  useTMDataGridContext,
} from "../TMDataGridContext";
import type { Row, RowData } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import classes from "./TMDataGridGroupColumn.module.css";
import { ChevronRightIcon } from "./icons";
import { resolveColumnOptions } from "../core/columnOptions";
import { getColumnLabel, getColumnType } from "../core/columnUtils";
import { formatGroupValue, getGroupDataRows } from "../core/grouping";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

export const GROUP_COLUMN_ID = "__group__";

/** Indent added per level of nesting, in px. */
const INDENT_STEP = 16;

/**
 * The tree cell: chevron, group value and leaf count, indented by depth.
 *
 * Expansion is read through a subscription rather than from `row.getIsExpanded()`
 * in the component body for the same reason the select checkbox does it - the
 * `row` identity survives an expand, so the React Compiler would cache the call
 * along with it and the chevron would never turn. See TMDataGridSelectColumn.
 */
export function GroupCell<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  const { table, labels } = useTMDataGridContext();
  const tabIndex = useBodyControlTabIndex();
  const expanded = useSelector(row.table.store, () => row.getIsExpanded());

  if (!row.getIsGrouped()) return null;

  // `groupingValue` is TanStack's map key, the value already turned into a
  // string: `true` arrives as "true", a Date as its English timestamp, `null`
  // as "null". The first record's grouping value is the value itself.
  const columnId = row.groupingColumnId;
  const column = columnId === undefined ? undefined : table.getColumn(columnId);
  const dataRows = getGroupDataRows(row);
  const value =
    columnId === undefined || dataRows[0] === undefined
      ? row.groupingValue
      : dataRows[0].getGroupingValue(columnId);
  const label = formatGroupValue(value, labels.blankGroupValue, {
    type: column ? getColumnType(column) : undefined,
    options: column ? resolveColumnOptions({ table, column }) : undefined,
    labels,
  });

  return (
    <UnstyledButton
      className={classes.groupToggle}
      style={{ paddingInlineStart: row.depth * INDENT_STEP }}
      tabIndex={tabIndex}
      aria-expanded={expanded}
      aria-label={
        expanded ? labels.collapseGroup(label) : labels.expandGroup(label)
      }
      data-dg-part="group-toggle"
      data-row-id={row.id}
      onClick={(event) => {
        event.stopPropagation();
        row.toggleExpanded();
      }}
    >
      <span className={classes.chevron} data-expanded={expanded || undefined}>
        <ChevronRightIcon size={16} stroke={1.6} />
      </span>
      <span className={classes.groupLabel}>{label}</span>
      {/* Data rows, not direct children and not `getLeafRows()`: a nested group
          counts the records under it, never the sub-groups in between. */}
      <span className={classes.groupCount}>({dataRows.length})</span>
    </UnstyledButton>
  );
}

/**
 * Names the columns currently grouped on, so the lane says what it is showing
 * rather than a static "Group".
 */
export function GroupHeader<TData extends RowData>({
  table,
}: {
  table: TMDataGridTable<TData>;
}) {
  const { labels } = useTMDataGridContext();
  const grouping = useSelector(table.store, (state) => state.grouping, {
    compare: shallow,
  });

  if (grouping.length === 0) return labels.groupColumnLabel;
  return grouping
    .map((columnId) => {
      const column = table.getColumn(columnId);
      return column ? getColumnLabel(column) : columnId;
    })
    .join(" / ");
}
