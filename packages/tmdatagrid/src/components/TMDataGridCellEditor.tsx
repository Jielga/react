import { ActionIcon, Tooltip } from "@mantine/core";
import { FieldApi } from "@tanstack/react-form";
import type { Cell, Row } from "@tanstack/react-table";
import {
  type ComponentType,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import classes from "./TMDataGridTable.module.css";
import {
  type TMDataGridRowData,
  useTMDataGridContext,
} from "../TMDataGridContext";
import { isButtonElement, isInputElement, isNode } from "../core/dom";
import {
  getEditFieldName,
  normalizeFieldValidate,
  type TMDataGridEditField,
  type TMDataGridEditorArgs,
  type TMDataGridEditValueMap,
} from "../core/editEngine";
import type { TMDataGridFeatures } from "../useTMDataGrid";
import { FOCUSABLE_IN_CELL } from "../core/editorFocus";
import { CheckIcon, CloseIcon } from "./icons";
import { TMDataGridBooleanEditor } from "./editors/TMDataGridBooleanEditor";
import { TMDataGridDateEditor } from "./editors/TMDataGridDateEditor";
import { TMDataGridMultiSelectEditor } from "./editors/TMDataGridMultiSelectEditor";
import { TMDataGridNumberEditor } from "./editors/TMDataGridNumberEditor";
import { TMDataGridSelectEditor } from "./editors/TMDataGridSelectEditor";
import { TMDataGridStringEditor } from "./editors/TMDataGridStringEditor";
import { useFieldError } from "./editors/editorShared";

const BUILT_IN_EDITORS: Record<string, ComponentType<TMDataGridEditorArgs>> = {
  string: TMDataGridStringEditor,
  number: TMDataGridNumberEditor,
  boolean: TMDataGridBooleanEditor,
  date: TMDataGridDateEditor,
  select: TMDataGridSelectEditor,
  multiSelect: TMDataGridMultiSelectEditor,
};

/** How an editor closed, for the table to decide where the focus goes. */
export type TMDataGridCellEditorClose =
  | { committed: true; via: "enter" | "tab" | "shift-tab" | "pick" }
  | { committed: false; via: "escape" }
  /** `cellConfirm`: the editor closed, the draft stays, waiting for its ✓. */
  | { committed: false; via: "defer-tab" | "defer-shift-tab" };

/**
 * The host an editing cell mounts - it owns the field, the keys and the blur
 * policy; the editor inside it (a built-in picked by `meta.type`, or the
 * column's `meta.edit.editor`) owns the input.
 *
 * The form outlives this component by design: scrolling the row away
 * unmounts the host, and the form in the engine's map keeps the draft.
 */
export function TMDataGridCellEditor({
  cell,
  row,
  takeSeedText,
  onClose,
  inEntryBlock = false,
}: {
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  row: Row<TMDataGridFeatures, TMDataGridRowData>;
  /** Consumes the pending type-to-edit seed, when typing opened this editor. */
  takeSeedText: () => string | undefined;
  /** After the editor closed itself - the table moves the focus. */
  onClose: (args: TMDataGridCellEditorClose) => void;
  /**
   * Hosted by the entry block rather than a body cell. An entry row is
   * row-shaped in every mode: Enter enters the whole row, Tab stays the
   * browser's - walking the row's own inputs the way row mode's do - and
   * focus leaving decides nothing, because the ✓ is the decision.
   */
  inEntryBlock?: boolean;
}) {
  const { table, edit, features, labels, controlSize } = useTMDataGridContext();
  const isRowShaped = features.editMode === "row" || inEntryBlock;
  const column = cell.column;
  const form = edit.getForm(row.id);
  const fieldName = getEditFieldName(column);
  const [seedText] = useState(() => takeSeedText());

  /**
   * The column's current `mapValue`, for the field below to read at write
   * time. No dependency array, so it re-registers every render: the field is
   * created once and kept, and a map redeclared per render would otherwise be
   * frozen at the one this editor opened with. Declared above the seed effect,
   * which writes through the same field.
   */
  const mapValueRef = useRef<TMDataGridEditValueMap | undefined>(undefined);
  useEffect(() => {
    mapValueRef.current = column.columnDef.meta?.edit?.mapValue;
  });

  const [field] = useState<TMDataGridEditField>(() => {
    const created = new FieldApi({
      form: form as never,
      name: fieldName as never,
      validators: normalizeFieldValidate(
        column.columnDef.meta?.edit?.validate,
      ) as never,
    }) as unknown as TMDataGridEditField;

    // `meta.edit.mapValue` lives here so one implementation covers the
    // built-ins, any `meta.edit.editor` and the type-to-edit seed. Form's own
    // paths (validation, reset, `form.setFieldValue`) bypass this field, so a
    // cleared cell and a rolled-back draft stay what the engine wrote.
    const write = created.handleChange.bind(created);
    created.handleChange = ((updater: unknown) => {
      const map = mapValueRef.current;
      const previous = created.state.value as unknown;
      const value =
        typeof updater === "function"
          ? (updater as (prev: unknown) => unknown)(previous)
          : updater;
      write(
        (map === undefined
          ? value
          : map({ value, previous, row, column, table })) as never,
      );
    }) as typeof created.handleChange;

    return created;
  });
  useEffect(() => field.mount(), [field]);

  const error = useFieldError(field);
  // Not Tooltip's own `events`: they bring floating-ui's dismiss interaction,
  // which puts an `onKeyDown` on the anchor and stops Escape before the host's
  // handler can cancel on it. A controlled `opened` turns that off, so hover
  // and focus are tracked here.
  const [messageHovered, setMessageHovered] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);

  useEffect(() => {
    if (seedText === undefined) return;
    const type = column.columnDef.meta?.type ?? "string";
    if (type === "string") {
      field.handleChange(seedText as never);
    } else if (type === "number") {
      const seeded = Number(seedText);
      if (Number.isFinite(seeded)) field.handleChange(seeded as never);
    }
    // Once, at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closingRef = useRef(false);

  const commitAndClose = async (
    via: "enter" | "tab" | "shift-tab" | "pick",
  ): Promise<boolean> => {
    if (closingRef.current) return false;
    const ok = await edit.commit(row.id);
    if (ok && !closingRef.current) {
      closingRef.current = true;
      onClose({ committed: true, via });
    }
    return ok;
  };

  const cancelAndClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    edit.cancel(row.id);
    onClose({ committed: false, via: "escape" });
  };

  /**
   * `cellConfirm`: the key closes the editor and leaves the draft where it
   * is, waiting for the ✓. Moving along the row is not a decision about it;
   * Enter is, and commits instead.
   */
  const deferAndClose = (via: "defer-tab" | "defer-shift-tab") => {
    if (closingRef.current) return;
    closingRef.current = true;
    edit.deactivate();
    onClose({ committed: false, via });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && isButtonElement(event.target)) {
      event.stopPropagation();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void commitAndClose("enter");
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelAndClose();
    } else if (event.key === "Tab" && !isRowShaped) {
      event.preventDefault();
      event.stopPropagation();
      if (features.editMode === "cellConfirm") {
        const tabbables = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_IN_CELL),
        ).filter((element) => element.tabIndex >= 0);
        const index = tabbables.indexOf(event.target as HTMLElement);
        const next = tabbables[index + (event.shiftKey ? -1 : 1)];
        if (index >= 0 && next !== undefined) {
          next.focus();
          if (isInputElement(next)) next.select();
          return;
        }
        deferAndClose(event.shiftKey ? "defer-shift-tab" : "defer-tab");
      } else {
        void commitAndClose(event.shiftKey ? "shift-tab" : "tab");
      }
    }
  };

  /**
   * Focus left the editor entirely - a click somewhere else. Under `"cell"`
   * that commits (Sheets): a row the user has walked away from is a row they
   * are done typing into, and where the commit lands is `editing.draft`'s
   * business. A refused commit - validation, or `onCommit` rejecting - leaves
   * the editor where it is, invalid, with the value still in it: closed, the
   * cell would render the refused value as if it had landed, and the message
   * would go with the editor. The engine holds the same line when another
   * row is opened over a refused one (see `begin`). The user fixes the value,
   * or Escapes.
   */
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (closingRef.current) return;
    // Row mode and the entry block: focus moving between the row's editors is
    // not leaving the edit.
    if (isRowShaped) return;
    const next = event.relatedTarget;
    if (isNode(next) && event.currentTarget.contains(next)) return;
    closingRef.current = true;
    if (features.editMode === "cellConfirm") {
      edit.deactivate();
      return;
    }
    void edit.commit(row.id).then((ok) => {
      if (!ok) closingRef.current = false;
    });
  };

  if (form === undefined || fieldName === null) return null;

  const args: TMDataGridEditorArgs = {
    field,
    form,
    cell,
    row,
    column,
    table,
    commit: () => commitAndClose("pick"),
    cancel: cancelAndClose,
    size: controlSize,
    seedText,
  };

  const Editor =
    column.columnDef.meta?.edit?.editor ??
    BUILT_IN_EDITORS[column.columnDef.meta?.type ?? "string"] ??
    TMDataGridStringEditor;

  return (
    <div
      className={classes.cellEditor}
      data-dg-part="editor"
      data-row-id={row.id}
      data-column-id={column.id}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {/* A box of its own because Tooltip needs a child that takes a ref, which
          a `meta.edit.editor` need not forward. Not Mantine's inline error: in
          a narrow column it wraps, grows the row and is clipped. */}
      <Tooltip
        label={error}
        opened={error !== undefined && (messageHovered || messageFocused)}
        withArrow
        position="bottom-start"
      >
        <div
          className={classes.cellEditorField}
          onMouseEnter={() => setMessageHovered(true)}
          onMouseLeave={() => setMessageHovered(false)}
          onFocus={() => setMessageFocused(true)}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (isNode(next) && event.currentTarget.contains(next)) {
              return;
            }
            setMessageFocused(false);
          }}
        >
          <Editor {...args} />
        </div>
      </Tooltip>
      {features.editMode === "cellConfirm" && (
        <div className={classes.cellEditorActions}>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="green"
            aria-label={labels.confirmEdit}
            data-dg-part="editor-confirm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void commitAndClose("pick")}
          >
            <CheckIcon size={14} stroke={2} />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            aria-label={labels.cancelEdit}
            data-dg-part="editor-cancel"
            onMouseDown={(event) => event.preventDefault()}
            onClick={cancelAndClose}
          >
            <CloseIcon size={14} stroke={2} />
          </ActionIcon>
        </div>
      )}
    </div>
  );
}
