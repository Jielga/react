import { getColumnLabel } from "../../core/columnUtils";
import type { TMDataGridFilterControlArgs } from "../../core/filterControls";

type LayoutArgs = Pick<
  TMDataGridFilterControlArgs,
  "column" | "layout" | "labels"
>;

/**
 * The label and width props a filter control's field takes, by layout.
 *
 * Side by side in a panel row a field is a labelled control of a fixed
 * comfortable width. Stacked in a narrow host it keeps the label and fills the
 * host instead. In a header cell there is no room for a label above it at all,
 * so the field names itself to assistive tech and fills the column.
 *
 * `qualifier` distinguishes the two ends of a pair, which would otherwise both
 * read as the column's name.
 */
export function filterFieldProps(
  args: LayoutArgs,
  panel: { label: string; width?: number | string },
  qualifier?: string,
): { label?: string; "aria-label"?: string; w?: number | string } {
  if (args.layout === "row") return { label: panel.label, w: panel.width };
  if (args.layout === "stacked") return { label: panel.label, w: "100%" };
  const name = args.labels.filterOn(getColumnLabel(args.column));
  return {
    "aria-label": qualifier === undefined ? name : `${name} ${qualifier}`,
    w: "100%",
  };
}
