import { TextInput, type TextInputProps } from "@mantine/core";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import {
  mergeRefs,
  selectAllOnFocus,
  useCaretKeeper,
  useFieldInvalid,
  useFieldValue,
  type EditorDataAttributes,
} from "./editorShared";

export type TMDataGridStringEditorProps = TMDataGridEditorArgs & {
  /**
   * Props for the Mantine `TextInput`. The grid keeps the value, `onChange`,
   * `error`, `size` and the accessible name; `onFocus` and `onBlur` run after
   * the grid's own, and `ref` receives the input beside the grid's ref.
   */
  inputProps?: Omit<
    TextInputProps,
    "value" | "defaultValue" | "onChange" | "error" | "size" | "aria-label"
  > &
    EditorDataAttributes;
};

/** The built-in editor for `meta.type: "string"` (and the default). */
export function TMDataGridStringEditor({
  field,
  column,
  size,
  inputProps,
}: TMDataGridStringEditorProps) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const invalid = useFieldInvalid(field);
  const { inputRef, remember } = useCaretKeeper();
  return (
    <TextInput
      w="100%"
      {...inputProps}
      ref={mergeRefs(inputRef, inputProps?.ref)}
      size={size}
      onFocus={(event) => {
        selectAllOnFocus(event);
        inputProps?.onFocus?.(event);
      }}
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => {
        remember(event.currentTarget);
        field.handleChange(event.currentTarget.value);
      }}
      onBlur={(event) => {
        field.handleBlur();
        inputProps?.onBlur?.(event);
      }}
      error={invalid}
    />
  );
}
