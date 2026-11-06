import { UnstyledButton } from "@mantine/core";
import {
  useBodyControlTabIndex,
  useTMDataGridContext,
} from "../TMDataGridContext";
import type { Row, RowData } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import classes from "./TMDataGridDetailsColumn.module.css";
import { ChevronRightIcon } from "./icons";
import { areAllRowsExpanded, resolveExpandAll } from "../core/expanding";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";

export const DETAILS_COLUMN_ID = "__details__";

/**
 * The chevron that opens a row's detail panel.
 *
 * Expansion is read through a subscription rather than from
 * `row.getIsExpanded()` in the component body: the `row` identity survives an
 * expand, so the React Compiler would cache the call along with it and the
 * chevron would never turn. Same reason the select checkbox subscribes.
 */
export function DetailsCell<TData extends RowData>({
  row,
}: {
  row: Row<TMDataGridFeatures, TData>;
}) {
  const { labels } = useTMDataGridContext();
  const tabIndex = useBodyControlTabIndex();
  const expanded = useSelector(row.table.store, () => row.getIsExpanded());

  if (row.getIsGrouped()) return null;
  if (!row.getCanExpand()) return null;

  return (
    <UnstyledButton
      className={classes.detailsToggle}
      tabIndex={tabIndex}
      aria-expanded={expanded}
      aria-label={expanded ? labels.hideDetails : labels.showDetails}
      data-dg-part="details-toggle"
      data-row-id={row.id}
      onClick={(event) => {
        event.stopPropagation();
        row.toggleExpanded();
      }}
    >
      <span className={classes.chevron} data-expanded={expanded || undefined}>
        <ChevronRightIcon size={16} stroke={1.6} />
      </span>
    </UnstyledButton>
  );
}

/**
 * Expand-all / collapse-all for the lane, the way the checkbox column's header
 * selects and clears every row.
 *
 * Deliberately not `table.toggleAllRowsExpanded()`: that writes the `expanded`
 * state's whole-table form, and one state holds both the tree and the panels -
 * so it would unfold every group as well. Only the data rows are touched here;
 * whatever the tree was showing, it goes on showing. See resolveExpandAll.
 */
export function DetailsHeader<TData extends RowData>({
  table,
}: {
  table: TMDataGridTable<TData>;
}) {
  const { labels } = useTMDataGridContext();
  const detailRows = () => table.getPrePaginatedRowModel().flatRows;

  const allExpanded = useSelector(table.store, (state) =>
    areAllRowsExpanded({
      rows: detailRows(),
      expanded: state.expanded,
      target: "details",
    }),
  );

  return (
    <UnstyledButton
      className={classes.detailsToggle}
      aria-expanded={allExpanded}
      aria-label={
        allExpanded ? labels.collapseAllDetails : labels.expandAllDetails
      }
      data-dg-part="details-toggle-all"
      onClick={() =>
        table.setExpanded(
          resolveExpandAll({
            rows: detailRows(),
            expanded: table.store.state.expanded,
            target: "details",
            expand: !allExpanded,
          }),
        )
      }
    >
      <span
        className={classes.chevron}
        data-expanded={allExpanded || undefined}
      >
        <ChevronRightIcon size={16} stroke={1.6} />
      </span>
    </UnstyledButton>
  );
}
