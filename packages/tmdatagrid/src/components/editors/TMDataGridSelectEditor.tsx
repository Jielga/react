import { Select, type SelectProps } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import {
  optionsToComboboxData,
  resolveColumnOptions,
} from "../../core/columnOptions";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import {
  useFieldInvalid,
  useFieldValue,
  type EditorDataAttributes,
} from "./editorShared";

export type TMDataGridSelectEditorProps = TMDataGridEditorArgs & {
  /**
   * Props for the Mantine `Select`. The grid keeps `data`, the value,
   * `onChange`, `error`, `size` and the accessible name; `onBlur` runs after
   * the grid's own.
   */
  inputProps?: Omit<
    SelectProps,
    | "data"
    | "value"
    | "defaultValue"
    | "onChange"
    | "error"
    | "size"
    | "aria-label"
  > &
    EditorDataAttributes;
};

/**
 * The built-in editor for `meta.type: "select"`. Options come from the same
 * `meta.options` the filter panel reads - with the row in hand, so a
 * function source can depend on the record being edited.
 */
export function TMDataGridSelectEditor({
  field,
  column,
  row,
  table,
  size,
  commit,
  inputProps,
}: TMDataGridSelectEditorProps) {
  const { labels, features } = useTMDataGridContext();
  const value = useFieldValue(field);
  const invalid = useFieldInvalid(field);
  return (
    <Select
      w="100%"
      searchable
      {...inputProps}
      // The dropdown is Mantine's default, portalled: drawn inside the cell,
      // the grid's scroll area clips it in a short grid or a low row. A pick
      // is still not a click-away, because Mantine's options keep the focus
      // in the input, and the host's handlers see the dropdown's events
      // through the React tree.
      size={size}
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      data={optionsToComboboxData(
        resolveColumnOptions({ table, column, row, fallback: "faceted" }),
      )}
      value={typeof value === "string" ? value : null}
      onChange={(next) => {
        field.handleChange(next);
        // Sheets semantics under `"cell"`: a pick is the edit, so it commits.
        // The confirming modes leave the draft for their explicit commit.
        if (next !== null && features.editMode === "cell") void commit();
      }}
      onBlur={(event) => {
        field.handleBlur();
        inputProps?.onBlur?.(event);
      }}
      error={invalid}
    />
  );
}
