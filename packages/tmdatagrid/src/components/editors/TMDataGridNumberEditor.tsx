import { NumberInput, type NumberInputProps } from "@mantine/core";
import { useState } from "react";
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

export type TMDataGridNumberEditorProps = TMDataGridEditorArgs & {
  /**
   * Props for the Mantine `NumberInput`. The grid keeps the value, `onChange`,
   * `error`, `size` and the accessible name; `onFocus` and `onBlur` run after
   * the grid's own, and `ref` receives the input beside the grid's ref.
   */
  inputProps?: Omit<
    NumberInputProps,
    "value" | "defaultValue" | "onChange" | "error" | "size" | "aria-label"
  > &
    EditorDataAttributes;
};

/** The built-in editor for `meta.type: "number"`. */
export function TMDataGridNumberEditor({
  field,
  column,
  size,
  inputProps,
}: TMDataGridNumberEditorProps) {
  const { labels } = useTMDataGridContext();
  const value = useFieldValue(field);
  const invalid = useFieldInvalid(field);
  const { inputRef, remember } = useCaretKeeper();
  /**
   * The last text Mantine reported instead of a number - "-" or "1e" on the
   * way to one. Held so a half-typed number stays on screen while the field
   * itself holds no value.
   */
  const [typed, setTyped] = useState<string | null>(null);
  // The field is the source of truth: the text survives only while it still
  // describes what the field holds, so a write from outside the editor -
  // `edit.setCellValue`, a revert - replaces it rather than being masked.
  const parsedTyped = typed === null || typed === "" ? null : Number(typed);
  const textDescribesField = Number.isFinite(parsedTyped)
    ? parsedTyped === value
    : value === null;
  return (
    <NumberInput
      w="100%"
      hideControls
      {...inputProps}
      ref={mergeRefs(inputRef, inputProps?.ref)}
      size={size}
      onFocus={(event) => {
        selectAllOnFocus(event);
        inputProps?.onFocus?.(event);
      }}
      aria-label={labels.editCell(getColumnLabel(column))}
      data-dg-part="editor-input"
      value={
        typed !== null && textDescribesField
          ? typed
          : typeof value === "number"
            ? value
            : ""
      }
      onChange={(next) => {
        if (inputRef.current !== null) remember(inputRef.current);
        if (typeof next === "number") {
          setTyped(null);
          field.handleChange(next);
          return;
        }
        // Mantine reports a number once one can be parsed and a string while
        // it cannot: "" for an empty cell, partial input on the way to a
        // number. Anything that does not parse leaves the field empty rather
        // than `NaN` - which is a number to every validator and would commit
        // as one, with no message a user could act on.
        setTyped(next);
        const parsed = Number(next);
        field.handleChange(
          next !== "" && Number.isFinite(parsed) ? parsed : null,
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
