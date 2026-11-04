import { Checkbox, type CheckboxProps } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import {
  useFieldInvalid,
  useFieldValue,
  type EditorDataAttributes,
} from "./editorShared";

export type TMDataGridBooleanEditorProps = TMDataGridEditorArgs & {
  /**
   * Props for the Mantine `Checkbox`. The grid keeps `checked`, `onChange`,
   * `error`, `size` and the accessible name; `onBlur` runs after the grid's
   * own.
   */
  inputProps?: Omit<
    CheckboxProps,
    "checked" | "defaultChecked" | "onChange" | "error" | "size" | "aria-label"
  > &
    EditorDataAttributes;
};

/** The built-in editor for `meta.type: "boolean"` - a focused checkbox. */
export function TMDataGridBooleanEditor({
  field,
  column,
  size,
  inputProps,
}: TMDataGridBooleanEditorProps) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const invalid = useFieldInvalid(field);
  return (
    <Checkbox
      {...inputProps}
      size={size}
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      checked={value === true}
      onChange={(event) => field.handleChange(event.currentTarget.checked)}
      onBlur={(event) => {
        field.handleBlur();
        inputProps?.onBlur?.(event);
      }}
      error={invalid}
    />
  );
}
