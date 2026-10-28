import { useStore } from "@tanstack/react-form";
import {
  useLayoutEffect,
  useRef,
  type Ref,
  type RefCallback,
  type RefObject,
} from "react";
import { isInputElement } from "../../core/dom";
import { firstErrorText, type TMDataGridEditField } from "../../core/editEngine";

/**
 * `data-*` attributes for a built-in editor's `inputProps`. JSX accepts them
 * on any element, but a props object literal only takes declared keys.
 */
export type EditorDataAttributes = {
  [attribute: `data-${string}`]: string | number | boolean | undefined;
};

/** One ref callback feeding the grid's own ref and the consumer's. */
export function mergeRefs<T>(
  ...refs: Array<Ref<T> | undefined>
): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref !== null && ref !== undefined) ref.current = node;
    }
  };
}

/** The field's live value - one subscription, on the field's own store. */
export function useFieldValue(field: TMDataGridEditField): unknown {
  return useStore(field.store, (state) => state.value as unknown);
}

/** The field's first error - the message the editor's host puts in a tooltip. */
export function useFieldError(field: TMDataGridEditField): string | undefined {
  return useStore(field.store, (state) =>
    firstErrorText(state.meta.errors as ReadonlyArray<unknown>),
  );
}

/**
 * Whether the field has an error, for the Mantine input's `error` prop - the
 * invalid border and nothing else. The message itself would wrap inside a
 * narrow cell and be clipped, so the host shows it in a tooltip instead.
 */
export function useFieldInvalid(field: TMDataGridEditField): boolean {
  return useStore(
    field.store,
    (state) =>
      firstErrorText(state.meta.errors as ReadonlyArray<unknown>) !== undefined,
  );
}

/** Select-all on focus - F2/Enter open with the value ready to replace. */
export function selectAllOnFocus(event: { currentTarget: unknown }): void {
  const target = event.currentTarget;
  if (isInputElement(target)) target.select();
}

/**
 * Keeps the caret where it was typed when the value comes back changed.
 *
 * A column with `meta.edit.mapValue` writes something other than what the
 * input holds, so React reassigns `input.value` - and the browser collapses
 * the selection to the end of the field. Typing into the middle of a value
 * then jumped to the end on every keystroke.
 *
 * `remember` records the caret as the change is handed over; the effect puts
 * it back once the mapped value has rendered, shifted by however much the map
 * changed the length so a mask that inserts or strips characters keeps the
 * caret beside the same text. Without a map nothing is recorded twice and the
 * restore is a no-op, so an unmapped column is untouched.
 */
export function useCaretKeeper(): {
  inputRef: RefObject<HTMLInputElement | null>;
  remember: (input: HTMLInputElement) => void;
} {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caret = useRef<{ position: number; length: number } | null>(null);

  useLayoutEffect(() => {
    const pending = caret.current;
    const input = inputRef.current;
    caret.current = null;
    if (pending === null || input === null) return;
    const shift = input.value.length - pending.length;
    const next = Math.max(
      0,
      Math.min(pending.position + shift, input.value.length),
    );
    input.setSelectionRange(next, next);
  });

  return {
    inputRef,
    remember: (input) => {
      if (input.selectionStart === null) return;
      caret.current = {
        position: input.selectionStart,
        length: input.value.length,
      };
    },
  };
}
