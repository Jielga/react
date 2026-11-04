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

  // Group rows open into their children, not into a panel - see the body's
  // `showsDetails`. Their cells are aggregated, so this lane is already blank
  // on them; the guard is what makes that a decision rather than a side effect.
  if (row.getIsGrouped()) return null;
  // A record the consumer's `getRowCanExpand` turns down has no panel, and
  // TanStack refuses to expand it - a chevron here would do nothing.
  if (!row.getCanExpand()) return null;

  return (
    <UnstyledButton
      className={classes.detailsToggle}
      // See useBodyControlTabIndex: under cell selection, reached by stepping
      // into the cell or by the Tab walk within the row, not by the page.
      tabIndex={tabIndex}
      aria-expanded={expanded}
      aria-label={expanded ? labels.hideDetails : labels.showDetails}
      data-dg-part="details-toggle"
      data-row-id={row.id}
      // The row underneath may select or highlight on click; opening a panel is
      // its own gesture and must not also trigger those.
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
  // Pre-paginated: expand-all means every row the filters left, not the page
  // that happens to be on screen. Same model `getCanSomeRowsExpand` reads.
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
      // Partly expanded opens the rest rather than closing what is already
      // open - the same reading as an indeterminate select-all box.
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
      <span className={classes.chevron} data-expanded={allExpanded || undefined}>
        <ChevronRightIcon size={16} stroke={1.6} />
      </span>
    </UnstyledButton>
  );
}
