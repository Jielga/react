import { TextInput, type TextInputProps } from "@mantine/core";
import { useRef } from "react";
import type { TMDataGridEditorArgs } from "../../core/editEngine";
import { getColumnLabel } from "../../core/columnUtils";
import { useTMDataGridContext } from "../../TMDataGridContext";
import {
  useFieldInvalid,
  useFieldValue,
  type EditorDataAttributes,
} from "./editorShared";

export type TMDataGridDateEditorProps = TMDataGridEditorArgs & {
  /**
   * Props for the Mantine `TextInput`. The grid keeps `type`, the value,
   * `onChange`, `error`, `size` and the accessible name; `onBlur` runs after
   * the grid's own.
   */
  inputProps?: Omit<
    TextInputProps,
    | "type"
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
 * The built-in editor for `meta.type: "date"` - the native
 * `<input type="date">` styled by Mantine, no `@mantine/dates` involved. A
 * consumer wanting a real picker plugs one in through `meta.edit.editor`.
 */
export function TMDataGridDateEditor({
  field,
  column,
  size,
  inputProps,
}: TMDataGridDateEditorProps) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const invalid = useFieldInvalid(field);
  // The cell's original shape decides what the editor writes back: a `Date`
  // cell keeps getting Dates, an ISO-string cell keeps getting strings -
  // decided once at open, so clearing and retyping cannot flip the type.
  const writesDates = useRef(value instanceof Date);

  const text =
    value instanceof Date
      ? value.toLocaleDateString("sv-SE")
      : typeof value === "string"
        ? value.slice(0, 10)
        : "";

  return (
    <TextInput
      w="100%"
      {...inputProps}
      size={size}
      type="date"
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      value={text}
      onChange={(event) => {
        const next = event.currentTarget.value;
        if (next === "") {
          field.handleChange(null);
          return;
        }
        field.handleChange(
          writesDates.current ? new Date(`${next}T00:00:00`) : next,
        );
      }}
      onBlur={(event) => {
        field.handleBlur();
        inputProps?.onBlur?.(event);
      }}
      error={invalid}
    />
  );
}
