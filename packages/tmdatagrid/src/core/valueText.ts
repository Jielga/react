import type { TMDataGridOption } from "./columnOptions";
import type { TMDataGridColumnType } from "./filterOperators";
import type { TMDataGridLabels } from "./labels";

/** The English boolean labels - the defaults `TMDATAGRID_LABELS_EN` takes. */
export const BOOLEAN_LABELS_EN = {
  booleanTrue: "Yes",
  booleanFalse: "No",
} as const satisfies Pick<TMDataGridLabels, "booleanTrue" | "booleanFalse">;

export type TMDataGridValueTextOptions = {
  /** The column's `meta.type`. A `boolean` column's `"true"` / `"false"` filter strings read as booleans. */
  type?: TMDataGridColumnType;
  /** The column's resolved options: a value with an option reads as its label. */
  options?: ReadonlyArray<TMDataGridOption>;
  /** What `true` and `false` read as. Defaults to English. */
  labels?: Pick<TMDataGridLabels, "booleanTrue" | "booleanFalse">;
};

/**
 * A value as the grid's chrome writes it in words - on a filter pill, in a
 * group row - rather than `String(value)`, which writes `true`, an option's
 * key instead of its label, and a `Date` as an English timestamp.
 */
export function formatValueText(
  value: unknown,
  { type, options, labels = BOOLEAN_LABELS_EN }: TMDataGridValueTextOptions = {},
): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatValueText(entry, { type, options, labels }))
      .join(", ");
  }
  if (value === true || (type === "boolean" && value === "true")) {
    return labels.booleanTrue;
  }
  if (value === false || (type === "boolean" && value === "false")) {
    return labels.booleanFalse;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toLocaleDateString();
  }
  const text = String(value);
  const option = options?.find((candidate) => candidate.value === text);
  return option?.label ?? text;
}
