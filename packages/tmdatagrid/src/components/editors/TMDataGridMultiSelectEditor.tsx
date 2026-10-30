import { MultiSelect, type MultiSelectProps } from "@mantine/core";
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

export type TMDataGridMultiSelectEditorProps = TMDataGridEditorArgs & {
  /**
   * Props for the Mantine `MultiSelect`. The grid keeps `data`, the value,
   * `onChange`, `error`, `size` and the accessible name; `onBlur` runs after
   * the grid's own.
   */
  inputProps?: Omit<
    MultiSelectProps,
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
 * The built-in editor for `meta.type: "multiSelect"` - cells holding string
 * arrays. Never commits on pick: building a set takes several, so the commit
 * stays on Enter/blur like a text edit.
 */
export function TMDataGridMultiSelectEditor({
  field,
  column,
  row,
  table,
  size,
  inputProps,
}: TMDataGridMultiSelectEditorProps) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const invalid = useFieldInvalid(field);
  return (
    <MultiSelect
      w="100%"
      searchable
      {...inputProps}
      // Portalled, as in the select editor: inside the cell it is clipped.
      size={size}
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      data={optionsToComboboxData(
        resolveColumnOptions({ table, column, row, fallback: "faceted" }),
      )}
      value={Array.isArray(value) ? value.map(String) : []}
      onChange={(next) => field.handleChange(next)}
      onBlur={(event) => {
        field.handleBlur();
        inputProps?.onBlur?.(event);
      }}
      error={invalid}
    />
  );
}
