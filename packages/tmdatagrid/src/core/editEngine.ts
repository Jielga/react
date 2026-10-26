import {
  FormApi,
  getBy,
  type AnyFieldApi,
  type AnyFormApi,
  type StandardSchemaV1,
} from "@tanstack/react-form";
import { Store } from "@tanstack/store";
import type { Cell, Column, Row, RowData } from "@tanstack/react-table";
import type { ComponentType } from "react";
import type { TMDataGridRowData } from "../TMDataGridContext";
import type { TMDataGridFeatures, TMDataGridTable } from "../useTMDataGrid";
import {
  isColumnEditableForRow,
  isColumnEditSwitchedOff,
  isControlColumn,
} from "./columnUtils";
import type { TMDataGridColumnType } from "./filterOperators";
import type { TMDataGridSize } from "./sizes";

/**
 * What counts as a commit - one axis, each mode a thin policy over the same
 * engine. Where a commit *goes* is the other axis, `editing.draft`: out to
 * the consumer, or into the draft store. See `editing` on
 * `UseTMDataGridOptions`.
 *
 * | Mode | Enter | Tab | Focus leaves | Escape |
 * | ---- | ----- | --- | ------------ | ------ |
 * | `"cell"` | commits | commits, caret moves on | commits | cancels |
 * | `"cellConfirm"` | commits | keeps the draft, caret moves on | keeps the draft | cancels |
 * | `"row"` | commits the row | the browser's, along the row | nothing | cancels the row |
 *
 * An entry row is row-shaped in every mode - every editable cell open at
 * once, the browser's Tab between them, and an explicit ✓.
 */
export type TMDataGridEditMode = "cell" | "cellConfirm" | "row";

/**
 * One editing row's live form. TanStack Form's `FormApi`, not a wrapper: the
 * engine is a form library, and everything mid-edit - values, dirty state,
 * errors, async validation, submit lifecycle - is form state, read off
 * `form.store` with the same selector idiom as the rest of the grid.
 *
 * The alias erases Form's validator generics the way `TMDataGridRowData`
 * erases the row type: the concrete types lived at the `useTMDataGrid` call.
 */
export type TMDataGridRowEditForm = AnyFormApi;

/** The live field a cell editor binds to - TanStack Form's own `FieldApi`. */
export type TMDataGridEditField = AnyFieldApi;

/**
 * A validator as TanStack Form takes it: a Standard Schema (Zod, Valibot,
 * ArkType…) or a plain function returning an error or nothing. Forwarded
 * untouched - the vocabulary is Form's, not a grid re-implementation.
 */
export type TMDataGridValidator =
  | StandardSchemaV1<unknown, unknown>
  | ((args: { value: never; fieldApi: never }) => unknown);

/**
 * `meta.edit.validate` - per-column field validators. A bare schema or function is
 * shorthand for `{ onChange: it }`; the object form takes every trigger
 * TanStack Form defines, `Async` variants and debounce included.
 */
export type TMDataGridFieldValidate =
  | TMDataGridValidator
  | {
      onMount?: TMDataGridValidator;
      onChange?: TMDataGridValidator;
      onChangeAsync?: TMDataGridValidator;
      onChangeAsyncDebounceMs?: number;
      onBlur?: TMDataGridValidator;
      onBlurAsync?: TMDataGridValidator;
      onSubmit?: TMDataGridValidator;
      onSubmitAsync?: TMDataGridValidator;
    };

/**
 * `rowValidators` - form-level validators for the whole row, where
 * cross-field rules live. Passed into each row form's `validators` untouched;
 * pathed issues land on the matching fields, pathless ones on the row.
 */
export type TMDataGridRowValidators = {
  onMount?: TMDataGridValidator;
  onChange?: TMDataGridValidator;
  onChangeAsync?: TMDataGridValidator;
  onChangeAsyncDebounceMs?: number;
  onBlur?: TMDataGridValidator;
  onBlurAsync?: TMDataGridValidator;
  onSubmit?: TMDataGridValidator;
  onSubmitAsync?: TMDataGridValidator;
  onSubmitAsyncDebounceMs?: number;
};

/** What `editing.tableValidators` is handed for one commit. */
export type TMDataGridTableValidateArgs<
  TData extends RowData = TMDataGridRowData,
> = {
  /** The committing row, as drafted. */
  value: TData;
  /** Its id - `addRow`'s temp id for an entry row. */
  rowId: string;
  /** Whether the row is an entry row, not yet in `data`. */
  isNew: boolean;
  /**
   * The collection as it would stand if this commit landed: every data row
   * overlaid with its draft where one is held (this row's `value` included),
   * entry rows appended, deletion-marked rows removed. Unfiltered - a rule
   * sees the whole collection whatever the view shows.
   */
  rows: ReadonlyArray<{ rowId: string; value: TData }>;
};

/**
 * `editing.tableValidators` - rules that need the other rows: no duplicate
 * keys, no overlapping ranges, allocations summing to a total. Run at every
 * commit, after the row's own validators, and again per committed row during
 * `saveDrafts`, the only rules that run there - a committed row a later edit
 * invalidated is reopened with the error, and the save reports it in
 * `reopened`.
 *
 * Return nothing to pass, a message, or Form's `{ form, fields }` shape;
 * pathed issues land on the committing row's cells, pathless ones on the row.
 * `onSubmit` runs first, and its failure stands without `onSubmitAsync`
 * running.
 */
export type TMDataGridTableValidators<
  TData extends RowData = TMDataGridRowData,
> = {
  onSubmit?: (args: TMDataGridTableValidateArgs<TData>) => unknown;
  onSubmitAsync?: (
    args: TMDataGridTableValidateArgs<TData>,
  ) => unknown | Promise<unknown>;
};

/** One field's before/after across a commit. */
export type TMDataGridEditChange = {
  /** Column the field maps back to, for consumers thinking in columns. */
  columnId: string;
  /** The data path - `getEditFieldName` of the column. */
  field: string;
  previous: unknown;
  next: unknown;
};

export type TMDataGridEditCommitArgs<TData extends RowData> = {
  rowId: string;
  /** The whole row as edited - for the consumer who saves records. */
  value: TData;
  /** The row as it was when editing began. */
  original: TData;
  /** Per-field diff - for the consumer who PATCHes. One entry in cell mode. */
  changes: Array<TMDataGridEditChange>;
  /** Which policy committed. */
  source: TMDataGridEditMode;
};

/** What one open row's form looks like from outside - the cell markers. */
export type TMDataGridEditRowProjection = {
  /** Field names whose value differs from the original. */
  dirtyFields: ReadonlyArray<string>;
  /** Field names carrying a validation error, live or from a failed commit. */
  errorFields: ReadonlyArray<string>;
  /**
   * Those errors as text: what each cell editor is showing, plus what the
   * row's last failed commit found. The second half is the reason this
   * exists - Form clears a field's errors when its editor unmounts, so a row
   * left invalid would go back to looking like an ordinary edited row. Such
   * a message is dropped as soon as its field's value moves: the fix is what
   * clears the mark.
   */
  errorMessages: ReadonlyArray<{ field: string; message: string }>;
  /** A row-level error - a pathless `.refine()`, or a rejected commit. */
  hasRowError: boolean;
  isSubmitting: boolean;
  /**
   * The row as drafted - the form's `state.values`. Reference-stable while no
   * value changes, so a cell may subscribe to it and repaint only when its
   * row's draft actually moves.
   */
  values: TMDataGridRowData;
};

/**
 * The grid-facing index of everything mid-edit. A projection synced from the
 * open forms' stores, so body cells subscribe to this one store for their
 * dirty/error markers instead of one store per form. Only the editor host
 * reads a form's store directly - it is mounted for one cell at a time.
 */
export type TMDataGridEditState = {
  /**
   * The cell the last open gesture named - where the caret goes. In row mode
   * the whole row is editing whatever this says, so there it is only the
   * caret's cell, and `null` for the lane's pencil, which names no column.
   */
  active: { rowId: string; columnId: string | null } | null;
  /**
   * Every row the grid is holding work for: open rows, whose form is still
   * undecided, and committed rows, whose values wait in the draft store. In
   * the order the rows first entered; a reopen keeps a row's place. A row is
   * *open* when it is in here and not in {@link committedRowIds}, or, for an
   * entry row, not flagged `committed` in {@link newRows}.
   */
  openRowIds: ReadonlyArray<string>;
  rows: Record<string, TMDataGridEditRowProjection>;
  /**
   * The draft store's edit slice: existing rows that passed their commit and
   * wait for `saveDrafts`. A committed row is data, not a form: its values
   * are in {@link committedValues}, and `begin` on one of these builds a
   * fresh form from them and takes the row back out.
   *
   * Only `editing.draft` commits into the store. Without it a commit goes
   * straight to the consumer, so this stays empty.
   */
  committedRowIds: ReadonlyArray<string>;
  /**
   * The draft store's values, per row - what a committed row *is* to the
   * table. Snapshotted when a row commits (existing and entry rows alike)
   * and kept across a reopen until the row commits again or is dropped, so
   * a row keeps its place in the sort while a second cell is being typed
   * into. The hook feeds these into the table's `data` in place of the
   * consumer's records, which is how sorting, filtering, grouping and
   * aggregates see a draft.
   */
  committedValues: Readonly<Record<string, TMDataGridRowData>>;
  /**
   * Rows being created, not yet in `data`. `committed` is the draft store's
   * add slice: the entry row passed its submit and renders as a value row
   * from {@link committedValues} until `begin` re-opens it. Without
   * `editing.draft` a commit adds through `onRowAdd` and the entry is
   * dropped, so it never turns `true`.
   */
  newRows: ReadonlyArray<{ tempId: string; committed: boolean }>;
  /** The draft store's delete slice: rows marked deleted, awaiting the save. */
  deletedRowIds: ReadonlyArray<string>;
  /**
   * `true` while `saveDrafts` is in flight - from the call until the
   * consumer's callbacks (`onSaveDrafts`, or the per-row `onCommit` /
   * `onRowAdd` / `onRowDelete` loop) have settled. Concurrent `saveDrafts`
   * calls join the same run, so it flips once per run. It stays `false` for
   * a save that finds nothing to send.
   */
  isSaving: boolean;
};

const EMPTY_EDIT_STATE: TMDataGridEditState = {
  active: null,
  openRowIds: [],
  rows: {},
  committedRowIds: [],
  committedValues: {},
  newRows: [],
  deletedRowIds: [],
  isSaving: false,
};

/**
 * The rows still *open*: holding a live form nobody has decided yet.
 *
 * Narrower than {@link TMDataGridEditState.openRowIds}, which is every row
 * the grid holds, the committed ones included. A row qualifies here when it
 * is not committed in the draft store and there is something to lose - an
 * entered row always counts, an existing one only once a value has moved.
 *
 * The order is the engine's: the order the forms were opened.
 */
export function getOpenRowIds(
  state: TMDataGridEditState,
): ReadonlyArray<string> {
  const committed = new Set(state.committedRowIds);
  const entered = new Map(
    state.newRows.map((newRow) => [newRow.tempId, newRow.committed]),
  );
  return state.openRowIds.filter((rowId) => {
    if (committed.has(rowId)) return false;
    const entryCommitted = entered.get(rowId);
    if (entryCommitted !== undefined) return !entryCommitted;
    return (state.rows[rowId]?.dirtyFields.length ?? 0) > 0;
  });
}

/**
 * Whether the grid holds anything a navigation would lose: an open row with
 * a moved value, an entry row, the draft store (edits, new rows, deletion
 * marks), or a save still in flight.
 *
 * A pure selector over the edit state, so `useSelector(edit.store,
 * hasPendingEdits)` re-renders only when the answer flips, and a navigation
 * blocker can read `hasPendingEdits(edit.state)` at the moment it is asked.
 * `isSaving` counts because the default per-row loop takes the deletion
 * marks out of the store before its `onRowDelete` calls settle.
 */
export function hasPendingEdits(state: TMDataGridEditState): boolean {
  return (
    state.isSaving ||
    state.committedRowIds.length > 0 ||
    state.deletedRowIds.length > 0 ||
    state.newRows.length > 0 ||
    state.openRowIds.some(
      (rowId) => (state.rows[rowId]?.dirtyFields.length ?? 0) > 0,
    )
  );
}

type ErasedRow = Row<TMDataGridFeatures, TMDataGridRowData>;
type ErasedColumn = Column<TMDataGridFeatures, TMDataGridRowData, unknown>;

/**
 * What a cell editor is handed - deliberately both vocabularies at once. The
 * form side is TanStack Form's real `field` API (`field.state.value`,
 * `field.state.meta.errors`, `field.handleChange`, `field.handleBlur`), so a
 * custom calendar, slider or async combobox binds to it exactly as it would
 * inside any TanStack Form. The table side is where the editor is standing.
 *
 * The built-ins are implemented against this same contract, so
 * `meta.edit.editor` is not a special case - it is the slot the defaults
 * fill, and the exported built-ins can be wrapped instead of replaced.
 */
export type TMDataGridEditorArgs = {
  /** The live TanStack Form field for this cell. */
  field: TMDataGridEditField;
  /** The whole row form, for the rare editor that reads sibling fields. */
  form: TMDataGridRowEditForm;
  cell: Cell<TMDataGridFeatures, TMDataGridRowData, unknown>;
  row: ErasedRow;
  column: ErasedColumn;
  table: TMDataGridTable<TMDataGridRowData>;
  /** What Enter would do - commit the edit. For the editor's own UI. */
  commit: () => Promise<boolean>;
  /** What Escape would do - drop the draft. */
  cancel: () => void;
  size: TMDataGridSize;
  /**
   * Set when typing opened the editor (the Sheets gesture) - the built-ins
   * replace the value with it and keep typing. A custom editor may ignore it.
   */
  seedText?: string;
};

/**
 * `meta.edit.editor` - replaces the built-in editor for this column. Rendered
 * as JSX, never invoked as a bare function, so hooks are legal inside. Define
 * it at module scope: a new identity per render remounts the editor mid-edit.
 */
export type TMDataGridEditorComponent = ComponentType<TMDataGridEditorArgs>;

/** What `meta.edit.mapValue` is handed for one write. */
export type TMDataGridEditValueMapArgs = {
  /** The value the editor just wrote. */
  value: unknown;
  /** What the field held before this write - for length-aware masks. */
  previous: unknown;
  row: ErasedRow;
  column: ErasedColumn;
  table: TMDataGridTable<TMDataGridRowData>;
};

/**
 * `meta.edit.mapValue` - the value on its way into the draft, mapped.
 *
 * Runs on every write an editor makes, which for a text input is every
 * keystroke and for a select is every pick, so the mapped value is what the
 * user sees, what validators judge and what commits.
 */
export type TMDataGridEditValueMap = (
  args: TMDataGridEditValueMapArgs,
) => unknown;

/** What `meta.edit.mapCommitValue` is handed for one field of a row being committed. */
export type TMDataGridEditCommitMapArgs = {
  /** The value the field holds as the row is committed. */
  value: unknown;
  /** What the field held when editing began. */
  previous: unknown;
  /** The row being committed. `undefined` for a row that is being added. */
  row: ErasedRow | undefined;
  column: ErasedColumn;
  table: TMDataGridTable<TMDataGridRowData>;
};

/**
 * `meta.edit.mapCommitValue` - the value as the row commits, mapped.
 *
 * Runs once per field, not per keystroke, so the user can type what the
 * mapped value would not allow, like a trailing space.
 */
export type TMDataGridEditCommitMap = (
  args: TMDataGridEditCommitMapArgs,
) => unknown;

/**
 * `meta.edit` - everything about how this column is edited, in one place,
 * mirroring the `edit.*` engine the grid exposes at runtime.
 *
 * ```tsx
 * meta: {
 *   type: "string",
 *   edit: {
 *     enabled: (row) => row.original.status !== "Locked",
 *     validate: z.string().min(2, "Too short"),
 *     mapValue: ({ value }) =>
 *       typeof value === "string" ? value.toUpperCase() : value,
 *   },
 * }
 * ```
 *
 * `meta.type` and `meta.options` stay outside this namespace on purpose: one
 * declaration of each feeds the cell editor and the filter panel alike.
 */
export type TMDataGridColumnEditOptions<
  TData extends RowData = TMDataGridRowData,
> = {
  /**
   * Whether this column's cells take edits, once `editMode` is on. `false`
   * switches the column off outright; a predicate decides per row. Defaults
   * to editable for any column that maps to a field - see {@link field}.
   * `row` is typed by the column helper the column was declared with.
   */
  enabled?: boolean | ((row: Row<TMDataGridFeatures, TData>) => boolean);
  /**
   * The data path this column edits, when it is not the `accessorKey` - the
   * only way a column built on `accessorFn` becomes editable. Dot paths reach
   * into nested records: `"address.city"`.
   */
  field?: string;
  /**
   * Replaces the built-in editor for this column. See
   * {@link TMDataGridEditorComponent}.
   */
  editor?: TMDataGridEditorComponent;
  /**
   * Field-level validators, in TanStack Form's own vocabulary. A bare Zod
   * schema (or any Standard Schema, or a plain function) means
   * `{ onChange: it }`; the object form takes every trigger Form defines.
   */
  validate?: TMDataGridFieldValidate;
  /**
   * Maps every value an editor writes before it reaches the draft - uppercase
   * a code, strip spaces from an IBAN, clamp a number into range. See
   * {@link TMDataGridEditValueMap}.
   */
  mapValue?: TMDataGridEditValueMap;
  /**
   * Maps the value of each field the user changed, once, as its row commits -
   * trim a string the user was free to type spaces into. It runs before the
   * validators of the submit, and its result is written back into the form,
   * so the draft, `changes` and `onCommit` hold the mapped value. See
   * {@link TMDataGridEditCommitMap}.
   */
  mapCommitValue?: TMDataGridEditCommitMap;
};

/** A new row being committed - `onRowAdd`, and `saveDrafts`'s `created`. */
export type TMDataGridRowAddArgs<TData extends RowData> = {
  /** The engine's placeholder id; the real id is the consumer's to mint. */
  tempId: string;
  value: TData;
};

/** A deletion - `onRowDelete`. */
export type TMDataGridRowDeleteArgs<TData extends RowData> = {
  rowId: string;
  row: Row<TMDataGridFeatures, TData>;
};

/**
 * The draft store, flushed - what `saveDrafts` hands `onSaveDrafts`. Every
 * committed change at once, so a server can apply it as one transaction.
 * Rows still open (undecided form state) are not in here and stay open.
 */
export type TMDataGridSaveDraftsArgs<TData extends RowData> = {
  /** Committed edits to existing rows; each entry carries its `rowId`. */
  updated: Array<TMDataGridEditCommitArgs<TData>>;
  /** Committed new rows from the entry block; each entry carries its `tempId`. */
  created: Array<TMDataGridRowAddArgs<TData>>;
  /** Ids marked deleted while the drafts accumulated. */
  deleted: Array<string>;
};

/**
 * Which entries of one bucket saved. `true`, or an id the map does not name,
 * saved and is dropped from the draft store; `false` failed and keeps its
 * draft. A bare boolean answers for the whole bucket.
 */
export type TMDataGridSaveOutcomes = boolean | Record<string, boolean>;

/**
 * What `onSaveDrafts` may return to save part of the store.
 *
 * Returning nothing saves everything, and throwing saves nothing. Between
 * those, name the ids that failed: they keep their drafts, committed and
 * ready for the next save, while the rest are dropped. The grid marks them
 * with nothing beyond the state itself - a failed edit keeps `data-draft`,
 * a failed deletion keeps `data-deleted` - so the display is the consumer's.
 */
export type TMDataGridSaveDraftsResponse = {
  /** Keyed by `rowId`. */
  updated?: TMDataGridSaveOutcomes;
  /** Keyed by `tempId`. */
  created?: TMDataGridSaveOutcomes;
  /** Keyed by `rowId`. */
  deleted?: TMDataGridSaveOutcomes;
};

/** Whether one id of a bucket saved. Unnamed ids saved. */
function isSaved(
  outcomes: TMDataGridSaveOutcomes | undefined,
  id: string,
): boolean {
  if (outcomes === undefined) return true;
  if (typeof outcomes === "boolean") return outcomes;
  return outcomes[id] !== false;
}

/** What the engine reads fresh on every call - see `createEditEngine`. */
export type TMDataGridEditEngineContext = {
  table: TMDataGridTable<TMDataGridRowData>;
  editMode: TMDataGridEditMode;
  /** `editing.draft` - whether a commit parks instead of reaching out. */
  draft: boolean;
  rowValidators?: TMDataGridRowValidators;
  tableValidators?: TMDataGridTableValidators;
  /**
   * `editing.columns` - the allowlist, or `undefined` for "every column that
   * maps to a field".
   */
  editableColumnIds?: ReadonlyArray<string>;
  isRowEditable?: (row: ErasedRow) => boolean;
  onEditCommit?: (
    args: TMDataGridEditCommitArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
  onSaveDrafts?: (
    args: TMDataGridSaveDraftsArgs<TMDataGridRowData>,
  ) =>
    | void
    | TMDataGridSaveDraftsResponse
    | Promise<void | TMDataGridSaveDraftsResponse>;
  /**
   * Seed values for `addRow`, under the values it is called with. A function
   * is called per added row.
   */
  newRowDefaults?: TMDataGridRowData | (() => TMDataGridRowData);
  onRowAdd?: (
    args: TMDataGridRowAddArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
  onRowDelete?: (
    args: TMDataGridRowDeleteArgs<TMDataGridRowData>,
  ) => void | Promise<void>;
};

/**
 * The data path a column edits, or `null` for a column that has none.
 *
 * `accessorKey` is the true path and Form addresses fields by dot-path, so
 * nested rows need no extra handling: `accessorKey: "address.city"` edits
 * `values.address.city`. A column built on `accessorFn` has no path and is not
 * editable unless `meta.edit.field` names one. TanStack's default column id
 * turns dots into underscores, which is why this starts from `accessorKey` and
 * never from `id`.
 */
export function getEditFieldName(column: {
  columnDef: { meta?: { edit?: { field?: string } } };
}): string | null {
  const fromMeta = column.columnDef.meta?.edit?.field;
  if (fromMeta) return fromMeta;
  const accessorKey = (column.columnDef as Record<string, unknown>)[
    "accessorKey"
  ];
  return typeof accessorKey === "string" ? accessorKey : null;
}

/** What Delete writes into a cell - the type's honest empty value. */
export function clearedValueForType(type: TMDataGridColumnType): unknown {
  switch (type) {
    case "string":
      return "";
    case "multiSelect":
      return [];
    case "boolean":
      return false;
    default:
      return null;
  }
}

/** `edit.addRows` options. */
export type TMDataGridAddRowsOptions = {
  /**
   * Submit each row as it is added instead of leaving it open. Defaults to
   * `false` - the rows open as editable entry rows, as `addRow` does.
   */
  commit?: boolean;
};

/** What `edit.addRows` reports back. Every added row is in exactly one list. */
export type TMDataGridAddRowsResult = {
  /** `true` when every added row committed - `open` is empty. */
  ok: boolean;
  /** Temp ids that committed - parked as drafts, or added outright. */
  committed: Array<string>;
  /**
   * Temp ids still open in the entry block: everything, when `commit` was
   * not asked for; the rows that failed validation, when it was.
   */
  open: Array<string>;
};

/**
 * What `edit.commitAll` reports back. Every row that was open at the call is
 * in exactly one list; ids are row ids, and temp ids for entry rows.
 */
export type TMDataGridCommitAllResult = {
  /** `true` when every open row committed - `open` is empty. */
  ok: boolean;
  /**
   * Rows whose `commit` resolved `true` - into the draft store under
   * `editing.draft`, out to the consumer without it, or closed with nothing
   * to save.
   */
  committed: Array<string>;
  /**
   * Rows still open, carrying their errors: validation failed, or without
   * `editing.draft` the consumer's `onCommit` / `onRowAdd` threw.
   */
  open: Array<string>;
};

/**
 * What `edit.saveDrafts` reports back. Ids are row ids, and temp ids for new
 * rows; edits, new rows and deletions are mixed in each list. Every id the
 * save took from the draft store is in exactly one list. Rows open at the
 * call are not part of the save and are in none.
 */
export type TMDataGridSaveDraftsResult = {
  /** `true` when nothing was kept or reopened. */
  ok: boolean;
  /** Left the draft store - the consumer accepted it. */
  saved: Array<string>;
  /**
   * Still in the draft store, still committed, and sent again by the next
   * save: an id `onSaveDrafts` reported as failed, every id it was sent
   * when it threw, or, without `onSaveDrafts`, a deletion whose
   * `onRowDelete` threw.
   */
  kept: Array<string>;
  /**
   * Out of the draft store and open again, carrying an error: a table rule
   * now rejects the row, or, without `onSaveDrafts`, the row's own
   * `onCommit` / `onRowAdd` threw.
   */
  reopened: Array<string>;
};

/**
 * Splits ids by the `commit` each one got - the shape `addRows` and
 * `commitAll` share. `results[index]` answers for `ids[index]`; order is kept.
 */
function splitCommitted(
  ids: ReadonlyArray<string>,
  results: ReadonlyArray<boolean>,
): { ok: boolean; committed: Array<string>; open: Array<string> } {
  const committed: Array<string> = [];
  const open: Array<string> = [];
  ids.forEach((id, index) => {
    (results[index] ? committed : open).push(id);
  });
  return { ok: open.length === 0, committed, open };
}

/** One row of {@link TMDataGridEditApi.getRows}. */
export type TMDataGridEditRowSnapshot<
  TData extends RowData = TMDataGridRowData,
> = {
  /** The row's id - `addRow`'s temp id for an entry row. */
  rowId: string;
  /** The row as shown: its draft where a form holds one, else `data`'s value. */
  value: TData;
  /** An entry row, not yet in `data`. */
  isNew: boolean;
  /** Marked deleted, awaiting `saveDrafts`. */
  deleted: boolean;
};

/**
 * The engine plus its store - `api.edit`.
 *
 * "One row, one form" while a row is open: `getForm` hands out the same
 * `FormApi` the inline editors write through, so a consumer can render it in
 * a drawer or a detail panel and share values, dirty state and errors with
 * the cells. A committed row has no form - it is data in the draft store -
 * so `getForm` returns `undefined` for it until `begin` reopens it.
 */
export type TMDataGridEditApi<
  TData extends RowData = TMDataGridRowData,
> = {
  /** The projection store - subscribe with `useSelector(edit.store, …)`. */
  store: Store<TMDataGridEditState>;
  /** Current snapshot, for reads outside React. */
  readonly state: TMDataGridEditState;
  /**
   * rowId → the open row's live form, the source of truth for everything
   * mid-edit. `undefined` for a row that is not open, a committed row
   * included; `begin` reopens one.
   */
  getForm: (rowId: string) => TMDataGridRowEditForm | undefined;
  /**
   * The row as shown: its draft values where the grid holds any - an open
   * form's, or the committed values in the draft store - else what `data`
   * says. `undefined` when no such row exists. A deletion mark does not
   * change the answer; check `state.deletedRowIds` for that.
   */
  getRowValues: (rowId: string) => TData | undefined;
  /**
   * Every row as shown, nothing filtered out: data rows overlaid with their
   * drafts, entry rows appended, deletion-marked rows included and flagged.
   * Built from the core row model, so it is unfiltered, unsorted and never
   * contains group rows. Filter on `deleted` / `isNew` for the set you want.
   */
  getRows: () => ReadonlyArray<TMDataGridEditRowSnapshot<TData>>;
  /**
   * Whether this cell may open an editor: the column maps to a field, nothing
   * switched it off, and the row takes edits at all.
   */
  canEditCell: (row: ErasedRow, column: ErasedColumn) => boolean;
  /** Whether the row takes edits at all - the edit lane's pencil gate. */
  canEditRow: (row: ErasedRow) => boolean;
  /**
   * Whether the column takes edits at all, with no row in hand: it maps to a
   * field, `editing.columns` lists it if that option is set, and
   * `meta.edit.enabled` is not `false`. A per-row `enabled` predicate is the
   * row's half of the question - `canEditCell` asks both.
   */
  isColumnEditable: (column: ErasedColumn) => boolean;
  /**
   * Opens an editor. In row mode the whole row opens either way and `columnId`
   * only says which cell takes the caret; `null` (the lane's pencil) leaves it
   * to the row's first editable cell.
   */
  begin: (target: { rowId: string; columnId: string | null }) => void;
  /**
   * Commits one row - `form.handleSubmit` under the hood. Resolves `true`
   * when the form is gone: validation passed and `onEditCommit` resolved, or
   * there was nothing to save. `false` keeps the form open with its errors.
   */
  commit: (rowId: string) => Promise<boolean>;
  /** Drops one row's draft. */
  cancel: (rowId: string) => void;
  /**
   * Closes the editor without touching the draft - what blur does under
   * `"cellConfirm"`, where the dirty cell keeps waiting for its ✓.
   */
  deactivate: () => void;
  /** Drops every draft - open form state and the draft store alike. */
  cancelAll: () => void;
  /**
   * Submits every open row, as if each had been OK'd: a row that validates
   * commits (into the draft store with `editing.draft` on, straight to the
   * consumer without it), a row that fails stays open with its errors.
   * Under `editing.draft` it sends nothing to the consumer by itself - that
   * is `saveDrafts`.
   *
   * Resolves which rows went which way: `committed` and `open` hold every
   * row that was open at the call, each in exactly one list, and `ok` is
   * `true` when `open` is empty. See {@link TMDataGridCommitAllResult}.
   */
  commitAll: () => Promise<TMDataGridCommitAllResult>;
  /**
   * Flushes the draft store: every committed edit, added row and deletion
   * mark reaches the consumer, through `onSaveDrafts` in one call when it is
   * set, or row by row through `onCommit` / `onRowAdd` / `onRowDelete`.
   *
   * Rows still open are left alone - they keep their form state and stay
   * open, and are in no list of the result.
   *
   * Resolves what happened to each id it sent: `saved` left the draft store,
   * `kept` is still in it, committed, for the next save - an id
   * `onSaveDrafts` reported as failed, every id when it threw, or a
   * deletion whose per-row `onRowDelete` threw - and
   * `reopened` is open again with an error, because a table rule now
   * rejects it or its per-row `onCommit` / `onRowAdd` threw. `ok` is `true`
   * when nothing was kept or reopened, and an empty store resolves `ok` with
   * empty lists. A call while a save is in flight joins it and resolves the
   * same result. See {@link TMDataGridSaveDraftsResult}.
   */
  saveDrafts: () => Promise<TMDataGridSaveDraftsResult>;
  /** Writes the type's empty value into a cell and commits it - Delete. */
  clearCell: (rowId: string, columnId: string) => Promise<boolean>;
  /**
   * Writes one cell and commits the row - a typed edit without the typing,
   * for toolbar actions and bulk fills. Under `editing.draft` the row parks
   * in the draft store exactly as a hand-made edit does, so it carries the
   * same change markers and the same per-row revert.
   *
   * The row need not be mounted; a row inside a collapsed group takes the
   * write. Resolves `false` when the cell takes no edit - no such row or
   * column, `editing.columns` excludes it, `meta.edit.enabled` is off, or the
   * row is not editable - and when validation refuses the value, which leaves
   * the row open carrying its errors.
   *
   * `value` is the stored value: no editor runs, so `meta.edit.mapValue`
   * does not either. `meta.edit.validate` does.
   */
  setCellValue: (
    rowId: string,
    columnId: string,
    value: unknown,
  ) => Promise<boolean>;
  /**
   * {@link setCellValue} for several cells of one row, in a single commit -
   * one consumer call and one draft entry rather than one per column. Keys
   * are column ids.
   *
   * All or nothing: if any named cell takes no edit, nothing is written and
   * this resolves `false`.
   */
  setRowValues: (
    rowId: string,
    values: Record<string, unknown>,
  ) => Promise<boolean>;
  /**
   * Opens a new entry row (the sticky block under the header) seeded from
   * `newRowDefaults`. `values` overrides that seed key by key, so
   * `addRow()` opens a blank row and `addRow({ status: "draft" })` opens one
   * that starts filled in. Returns its temporary id - a form with no backing
   * row yet. Committing it calls `onRowAdd`, or parks it for `saveDrafts`
   * under `editing.draft`.
   */
  addRow: (values?: Partial<TData>) => string;
  /**
   * Opens entry rows for a list of records at once - one publish for the
   * batch, where a loop over `addRow` is one per row. Each row is seeded over
   * `newRowDefaults` exactly as `addRow` does.
   *
   * `commit: true` submits the rows too, which is what an import wants: rows
   * that validate commit, and rows that fail stay open in the entry block
   * carrying their errors, for the user to fix. The result says which went
   * which way - `committed` and `open` hold every added row, each in exactly
   * one list, and `ok` is `true` when `open` is empty. Under
   * `editing.draft` the rows validate together and land in the draft store
   * in the same publish as the add - the grid renders once,
   * whatever the count. Without it each valid row goes out through
   * `onRowAdd`, one at a time and in order.
   */
  addRows: (
    rows: ReadonlyArray<Partial<TData>>,
    options?: TMDataGridAddRowsOptions,
  ) => Promise<TMDataGridAddRowsResult>;
  /**
   * Deletes a row: `onRowDelete` straight away, or under `editing.draft` a
   * mark in `deletedRowIds` - the row renders struck through until
   * `saveDrafts` reports it. Idempotent: deleting a marked row again leaves
   * it marked, and {@link restoreRow} is the undo. On an entry row,
   * committed or not, it just discards the entry; an id the grid does not
   * know is a no-op.
   */
  deleteRow: (rowId: string) => void;
  /**
   * {@link deleteRow} for several rows in one call - one notification for
   * the batch, for a bulk action over a selection. Because `deleteRow` is
   * idempotent and ignores unknown ids, the list may be passed exactly as
   * the selection stands - already-marked rows stay marked, duplicates and
   * stale ids do nothing.
   */
  deleteRows: (rowIds: ReadonlyArray<string>) => void;
  /**
   * Removes a row's deletion mark - the lane's Restore. A no-op on a row
   * that is not marked, and outside `editing.draft`, where no marks exist.
   */
  restoreRow: (rowId: string) => void;
  /** Whether delete chrome makes sense - the lane's trash gate. */
  canDeleteRows: () => boolean;
};

function clearFormSourcedFieldErrors(form: TMDataGridRowEditForm): void {
  const fieldMeta = form.state.fieldMeta as Record<
    string,
    { errorSourceMap?: Record<string, unknown> }
  >;
  for (const [name, meta] of Object.entries(fieldMeta)) {
    const staleKeys = Object.entries(meta.errorSourceMap ?? {})
      .filter(([, source]) => source === "form")
      .map(([key]) => key);
    if (staleKeys.length === 0) continue;
    form.setFieldMeta(name as never, (previous) => ({
      ...previous,
      errorMap: {
        ...previous.errorMap,
        ...Object.fromEntries(staleKeys.map((key) => [key, undefined])),
      },
    }));
  }
}

/** Arrays compare by element so a multiSelect edit-back-to-same is clean. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, i) => Object.is(entry, b[i]));
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  return false;
}

function hasAnyError(errors: ReadonlyArray<unknown>): boolean {
  return errors.some((error) => error !== undefined && error !== null);
}

/**
 * The first error as text, whatever shape the validator produced - TanStack
 * Form keeps errors verbatim, so a Zod issue arrives as `{ message }`, a
 * plain function's return arrives as it was, and a form-level schema's
 * pathless issues arrive keyed under an empty path (`{ "": [issues] }`).
 * This digs until it finds a message.
 */
export function firstErrorText(error: unknown): string | undefined {
  if (error === null || error === undefined) return undefined;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    for (const entry of error) {
      const text = firstErrorText(entry);
      if (text !== undefined) return text;
    }
    return undefined;
  }
  if (typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
    for (const value of Object.values(error)) {
      const text = firstErrorText(value);
      if (text !== undefined) return text;
    }
  }
  return undefined;
}

/**
 * The triggers a submit runs, in the order Form would: a value that fails its
 * column's `onChange` rule fails the submit too.
 */
const SUBMIT_VALIDATE_TRIGGERS = [
  "onChange",
  "onChangeAsync",
  "onSubmit",
  "onSubmitAsync",
] as const;

/** Whether a validator's return counts as an error. */
function isValidationError(result: unknown): boolean {
  return result !== undefined && result !== null && result !== false;
}

/**
 * Runs one field validator the way TanStack Form would - a Standard Schema
 * (Zod, Valibot…) or a plain function - and returns its error, or undefined.
 */
async function runFieldValidator(
  validator: unknown,
  value: unknown,
): Promise<unknown> {
  if (typeof validator === "function") {
    return await (
      validator as (args: { value: unknown; fieldApi: unknown }) => unknown
    )({ value, fieldApi: undefined });
  }
  if (
    typeof validator === "object" &&
    validator !== null &&
    "~standard" in validator
  ) {
    const schema = validator as StandardSchemaV1<unknown, unknown>;
    const result = await schema["~standard"].validate(value);
    const { issues } = result as {
      issues?: ReadonlyArray<{ message: string }>;
    };
    if (issues === undefined || issues.length === 0) return undefined;
    return issues[0]?.message ?? "Invalid";
  }
  return undefined;
}

/**
 * Builds the edit engine. A factory over React so it is headless-testable;
 * `getContext` is read fresh on every call, which is how the engine always
 * sees the latest table, mode and consumer callbacks without being rebuilt.
 *
 * Virtualization, per the plan: nothing here is DOM. A form is a plain object
 * in a map keyed by rowId - scroll its row away and the editor unmounts, the
 * form keeps its values, meta and errors; scroll back and the editor
 * re-mounts over the same form.
 */
/**
 * The engine as the hook holds it: the public `edit` API plus the verbs the
 * grid calls on its own behalf and does not document.
 */
export type TMDataGridEditEngine = TMDataGridEditApi & {
  /** See the implementation. `rowsById` is the core row model's. */
  forgetMissingRows: (rowsById: Record<string, unknown>) => void;
  /**
   * Whether the row carries a deletion mark - the set behind
   * `state.deletedRowIds`, for a check per row from a predicate the table
   * calls per row.
   */
  isRowDeleted: (rowId: string) => boolean;
};

export function createEditEngine(
  getContext: () => TMDataGridEditEngineContext,
): TMDataGridEditEngine {
  const store = new Store<TMDataGridEditState>(EMPTY_EDIT_STATE);

  /**
   * One open row's editor state. Only an open row has one: a row that
   * commits into the draft store hands its values to `committed` and its
   * form is dropped, so nothing in here describes a committed row.
   */
  type FormEntry = {
    form: TMDataGridRowEditForm;
    original: TMDataGridRowData;
    /** An entry-block row - a form with no backing row yet. */
    isNew: boolean;
    /** Set by the wrapped onSubmit when the consumer's commit resolved. */
    lastSubmitOk: boolean;
    /**
     * What the last failed commit found, field by field, with the value it
     * found it on. Form clears a field's errors when its editor unmounts, so
     * without this a row that failed on the way out would keep its draft and
     * lose the reason. `project` drops an entry once its value has moved.
     */
    submitErrors: Array<{ field: string; value: unknown; message: string }>;
    /**
     * The park: this submit validates and puts the row in the draft store
     * instead of calling the consumer. Set by `commit` per attempt, from
     * `editing.draft`.
     */
    parkOnly: boolean;
    /** A commit already running - Enter and blur race on the same edit. */
    pendingCommit: Promise<boolean> | null;
    unsubscribe: () => void;
  };
  const forms = new Map<string, FormEntry>();

  /**
   * One committed row in the draft store. A committed row is plain data:
   * it passed its validators, the user left it, and nothing can change its
   * values until a reopen builds a form back from this. Which is what keeps
   * an import of ten thousand rows to a few megabytes - a live `FormApi` per
   * row is some eight kilobytes each - and what makes the store serializable.
   */
  type Committed = {
    /** The data row, or the entry row's seed - what `changes` diffs against. */
    original: TMDataGridRowData;
    /** The committed values; `committedValues[rowId]` holds this same object. */
    values: TMDataGridRowData;
    /** `diff(original, values)` as it stood at commit time. */
    dirtyFields: Array<string>;
    isNew: boolean;
  };
  const committed = new Map<string, Committed>();
  let newRowCounter = 0;
  const NEW_ROW_ID_PREFIX = "__new__";

  /**
   * The column's half of the rule, with no row in hand: it is a consumer
   * column mapping to a field, `editing.columns` lists it if that is set, and
   * `meta.edit.enabled` has not switched it off outright. A per-row predicate
   * on `enabled` is the row's half and is not asked here.
   */
  const isColumnEditable = (column: ErasedColumn): boolean => {
    if (isControlColumn(column.id)) return false;
    if (getEditFieldName(column) === null) return false;
    const allowed = getContext().editableColumnIds;
    if (allowed !== undefined && !allowed.includes(column.id)) return false;
    return !isColumnEditSwitchedOff(column);
  };

  const editableColumns = (): Array<ErasedColumn> =>
    getContext().table.getAllLeafColumns().filter(isColumnEditable);

  /**
   * Every column's `meta.edit.validate`, run against a row's values.
   *
   * Field validators belong to the mounted editor, so a row committed with
   * no editors on screen - an import, a programmatic commit, a row whose
   * cells are scrolled out - would otherwise submit without them ever
   * running. This is the engine running the same rules itself, so a commit
   * validates the same wherever it comes from. The result is Form's
   * `{ fields }` shape, which plants each error on its own field.
   */
  const validateColumnFields = async (
    values: TMDataGridRowData,
    rowId: string,
    isNew: boolean,
  ): Promise<Record<string, unknown> | undefined> => {
    const row = isNew ? undefined : getRow(rowId);
    const fields: Record<string, unknown> = {};
    for (const column of editableColumns()) {
      // A column switched off for this row has no editor and takes no edit,
      // so its rule is not this row's to satisfy.
      if (row !== undefined && !isColumnEditableForRow(column, row)) continue;
      const field = getEditFieldName(column);
      if (field === null) continue;
      const normalized = normalizeFieldValidate(
        column.columnDef.meta?.edit?.validate,
      );
      if (normalized === undefined) continue;
      const value = getBy(values, field);
      for (const trigger of SUBMIT_VALIDATE_TRIGGERS) {
        const validator = normalized[trigger];
        if (validator === undefined) continue;
        const error = await runFieldValidator(validator, value);
        if (isValidationError(error)) {
          fields[field] = error;
          break;
        }
      }
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
  };

  /**
   * The draft the grid is holding for a row: an open form's live values, or
   * a committed row's snapshot. `undefined` for a row it holds nothing for.
   */
  const draftValues = (rowId: string): TMDataGridRowData | undefined => {
    const entry = forms.get(rowId);
    if (entry !== undefined) {
      return entry.form.state.values as TMDataGridRowData;
    }
    return committed.get(rowId)?.values;
  };

  /**
   * The collection as a table validator sees it: every data row overlaid
   * with its draft where the grid holds one, entry rows appended, and rows
   * marked deleted removed. The committing row, when there is one,
   * contributes the values being submitted rather than what `data` or the
   * draft store still says. Built from the core row model, so it is
   * unfiltered and never contains group rows.
   */
  const mergedRows = (committing?: {
    rowId: string;
    value: TMDataGridRowData;
    isNew: boolean;
  }): Array<{ rowId: string; value: TMDataGridRowData }> => {
    const deleted = working.deletedRowIds;
    const rows: Array<{ rowId: string; value: TMDataGridRowData }> = [];
    const model = getContext().table.getCoreRowModel();
    for (const row of model.flatRows) {
      if (deleted.has(row.id)) continue;
      if (row.id === committing?.rowId) {
        rows.push({ rowId: row.id, value: committing.value });
        continue;
      }
      rows.push({
        rowId: row.id,
        value: draftValues(row.id) ?? (row.original as TMDataGridRowData),
      });
    }
    // Entry rows the table does not hold: the open ones, and the committed
    // ones under `newRowsSticky`. A committed row in flow is in `data`
    // already, so it was listed above.
    for (const tempId of working.newRows.keys()) {
      if (tempId === committing?.rowId || tempId in model.rowsById) continue;
      if (deleted.has(tempId)) continue;
      const values = draftValues(tempId);
      if (values === undefined) continue;
      rows.push({ rowId: tempId, value: values });
    }
    if (
      committing !== undefined &&
      committing.isNew &&
      !(committing.rowId in model.rowsById)
    ) {
      rows.push({ rowId: committing.rowId, value: committing.value });
    }
    return rows;
  };

  /**
   * Runs `editing.tableValidators` for one commit. `onSubmit` first; its
   * failure stands and `onSubmitAsync` is not consulted, mirroring how the
   * column triggers short-circuit.
   *
   * `rows` is the collection to judge against, for the caller that has one
   * already: a Save pass runs the rules over rows whose values are frozen,
   * so building the collection once there turns an O(N²) pass into an O(N)
   * one. Left out, this builds the view for the committing row itself.
   */
  const runTableValidators = async (
    value: TMDataGridRowData,
    rowId: string,
    isNew: boolean,
    rows?: ReadonlyArray<{ rowId: string; value: TMDataGridRowData }>,
  ): Promise<unknown> => {
    const validators = getContext().tableValidators;
    if (
      validators?.onSubmit === undefined &&
      validators?.onSubmitAsync === undefined
    ) {
      return undefined;
    }
    const args: TMDataGridTableValidateArgs = {
      value,
      rowId,
      isNew,
      rows: rows ?? mergedRows({ rowId, value, isNew }),
    };
    const sync = validators.onSubmit?.(args);
    if (isValidationError(sync)) return sync;
    return await validators.onSubmitAsync?.(args);
  };

  /**
   * One submit pass's results folded into Form's error shape. A single
   * source passes through untouched (its own shape preserved); several merge
   * into `{ form, fields }`, the later source winning a field collision and
   * the form slot alike.
   */
  const mergeSubmitResults = (
    results: ReadonlyArray<unknown>,
    fields: Record<string, unknown> | undefined,
  ): unknown => {
    const errors = results.filter(isValidationError);
    if (errors.length === 0) {
      return fields === undefined ? undefined : { fields };
    }
    if (errors.length === 1) {
      const only = errors[0];
      if (fields === undefined) return only;
      if (typeof only === "object" && only !== null) {
        const shape = only as { fields?: Record<string, unknown> };
        return { ...shape, fields: { ...fields, ...(shape.fields ?? {}) } };
      }
      return { form: only, fields };
    }
    let form: unknown;
    let mergedFields: Record<string, unknown> = { ...(fields ?? {}) };
    for (const error of errors) {
      if (typeof error === "object" && error !== null) {
        const shape = error as {
          form?: unknown;
          fields?: Record<string, unknown>;
        };
        if (isValidationError(shape.form)) form = shape.form;
        mergedFields = { ...mergedFields, ...(shape.fields ?? {}) };
      } else {
        form = error;
      }
    }
    const merged: { form?: unknown; fields?: Record<string, unknown> } = {};
    if (form !== undefined) merged.form = form;
    if (Object.keys(mergedFields).length > 0) merged.fields = mergedFields;
    return merged;
  };

  /**
   * The row's `validators`, with column validation and the table rules folded
   * into the submit pass. The consumer's own `rowValidators` are passed
   * through untouched except for `onSubmitAsync`, which now also carries the
   * column rules and `editing.tableValidators` - later sources win a merge,
   * so the order is columns, then the table rules, then the row's own.
   */
  const composeValidators = (
    rowId: string,
    isNew: boolean,
  ): Record<string, unknown> => {
    const rowValidators = (getContext().rowValidators ?? {}) as Record<
      string,
      unknown
    >;
    const consumerAsync = rowValidators["onSubmitAsync"];
    return {
      ...rowValidators,
      onSubmitAsync: async (args: { value: unknown }) => {
        const value = args.value as TMDataGridRowData;
        const fromConsumer =
          consumerAsync === undefined
            ? undefined
            : await (consumerAsync as (a: unknown) => unknown)(args);
        const fromTable = await runTableValidators(value, rowId, isNew);
        const fields = await validateColumnFields(value, rowId, isNew);
        return mergeSubmitResults([fromTable, fromConsumer], fields);
      },
    };
  };

  /** What moved between a row as it was and a row as drafted. */
  const diff = (
    original: TMDataGridRowData,
    values: TMDataGridRowData,
  ): Array<TMDataGridEditChange> => {
    const changes: Array<TMDataGridEditChange> = [];
    for (const column of editableColumns()) {
      const field = getEditFieldName(column);
      if (field === null) continue;
      const previous: unknown = getBy(original, field);
      const next: unknown = getBy(values, field);
      if (!sameValue(previous, next)) {
        changes.push({ columnId: column.id, field, previous, next });
      }
    }
    return changes;
  };

  const project = (entry: FormEntry): TMDataGridEditRowProjection => {
    const state = entry.form.state;
    const values = state.values as TMDataGridRowData;
    const live = Object.entries(state.fieldMeta).flatMap(([name, meta]) => {
      // The empty path is a pathless (row-level) issue's landing spot - it
      // belongs to `hasRowError`, not to any cell's marker.
      if (name === "") return [];
      const errors = (meta as { errors: ReadonlyArray<unknown> }).errors;
      if (!hasAnyError(errors)) return [];
      return [{ field: name, message: firstErrorText(errors) ?? "" }];
    });
    // What a closed editor left behind, minus everything the user has since
    // changed - editing the field is the answer to its message.
    const kept = entry.submitErrors.filter(
      (error) =>
        !live.some((current) => current.field === error.field) &&
        sameValue(getBy(values, error.field), error.value),
    );
    const errorMessages = [
      ...live,
      ...kept.map(({ field, message }) => ({ field, message })),
    ];
    return {
      dirtyFields: diff(entry.original, values).map((change) => change.field),
      errorFields: errorMessages.map((error) => error.field),
      errorMessages,
      hasRowError: hasAnyError(state.errors),
      isSubmitting: state.isSubmitting,
      values,
    };
  };

  /**
   * The same projection for a committed row, built from its snapshot. There
   * is no form to read and nothing left to decide: the values passed every
   * rule on the way in, so the error slots are empty and stay empty until a
   * reopen puts the row back into form state.
   */
  const projectCommitted = (
    snapshot: Committed,
  ): TMDataGridEditRowProjection => ({
    dirtyFields: snapshot.dirtyFields,
    errorFields: [],
    errorMessages: [],
    hasRowError: false,
    isSubmitting: false,
    values: snapshot.values,
  });

  /**
   * The engine's own copy of the state, in maps and sets, so a write is O(1)
   * where the published shape would copy an array or a record. Every write
   * lands here; `publish` materializes it into `store`, rebuilding only the
   * slices that changed - a keystroke in an open editor leaves
   * `committedValues` and `newRows` identity-stable, which is what keeps the
   * table from rebuilding its row model under a caret.
   *
   * Holding the publish is what makes a batch verb scale. `addRows`,
   * `commitAll`, `saveDrafts` and `cancelAll` each touch every row they
   * hold, and an immutable write per row was quadratic: each one copied
   * `rows` and `committedValues`, rebuilt `openRowIds` and woke every
   * subscriber, so an import of ten thousand rows spent minutes copying and
   * re-rendering. Held, a run's writes stay O(1) each and the grid renders
   * once when it ends.
   */
  const working = {
    active: null as TMDataGridEditState["active"],
    /**
     * Every row the grid holds work for, open or committed, in the order the
     * rows first entered. Its own registry rather than `forms.keys()` plus
     * the committed ids: rows commit in whatever order their async
     * validators resolve, and the published order is the order the user
     * opened them in. A re-add is a no-op on a Set, so a reopen keeps a
     * row's place.
     */
    openRowIds: new Set<string>(),
    rows: new Map<string, TMDataGridEditRowProjection>(),
    committedRowIds: new Set<string>(),
    committedValues: new Map<string, TMDataGridRowData>(),
    /** `tempId` to its committed flag, in the order the rows were opened. */
    newRows: new Map<string, boolean>(),
    deletedRowIds: new Set<string>(),
    isSaving: false,
  };
  /** The slices the next publish has to rebuild. */
  const dirty = new Set<keyof TMDataGridEditState>();
  /** Forms whose projection is stale - projected once each, at publish. */
  const staleRows = new Set<string>();
  /** Above zero, `publish` waits for the run holding it to end. */
  let holdDepth = 0;

  // Rows the engine took out of the table, and rows that only lost their
  // selection - see flushRowState.
  const pendingLeft = new Set<string>();
  const pendingUnselect = new Set<string>();

  /**
   * Drops rows the engine took out of the table from the table state keyed
   * by row id: `rowSelection`, `expanded` and `rowPinning`. A row that was
   * only marked for deletion loses its selection alone - it is still there,
   * pinned or open as it was.
   *
   * TanStack never prunes those maps itself: `toggleAllRowsSelected(false)`
   * unticks only rows still in the model, `getIsSomeRowsSelected` counts
   * every key, and `expanded` is persisted with whatever ids it holds. An id
   * left behind keeps the header box indeterminate, flips "select all" back
   * to selecting, and shows a consumer reading the keys a row that is gone.
   * Two kinds of row leave through the engine: an entry row, discarded or
   * saved - its temp id never comes back - and a marked row whose deletion
   * the consumer has acted on. Run from `publish`, so a bulk delete or a
   * save prunes in one update per slice.
   */
  const flushRowState = () => {
    if (pendingLeft.size === 0 && pendingUnselect.size === 0) return;
    const left = [...pendingLeft];
    const unselect = [...left, ...pendingUnselect];
    pendingLeft.clear();
    pendingUnselect.clear();
    const table = getContext().table;
    const { rowSelection, expanded, rowPinning } = table.store.state;
    const has = (map: object, rowId: string) =>
      Object.prototype.hasOwnProperty.call(map, rowId);
    if (unselect.some((rowId) => has(rowSelection, rowId))) {
      table.setRowSelection((old) => {
        const next = { ...old };
        for (const rowId of unselect) delete next[rowId];
        return next;
      });
    }
    if (left.length === 0) return;
    if (expanded !== true && left.some((rowId) => has(expanded, rowId))) {
      table.setExpanded((old) => {
        if (old === true) return old;
        const next = { ...old };
        for (const rowId of left) delete next[rowId];
        return next;
      });
    }
    const gone = new Set(left);
    if (
      rowPinning.top.some((rowId) => gone.has(rowId)) ||
      rowPinning.bottom.some((rowId) => gone.has(rowId))
    ) {
      table.setRowPinning((old) => ({
        top: old.top.filter((rowId) => !gone.has(rowId)),
        bottom: old.bottom.filter((rowId) => !gone.has(rowId)),
      }));
    }
  };

  const publish = () => {
    if (holdDepth > 0) return;
    flushRowState();
    if (staleRows.size > 0) {
      for (const rowId of staleRows) {
        const entry = forms.get(rowId);
        if (entry !== undefined) working.rows.set(rowId, project(entry));
        // A row whose form is gone because it committed keeps the projection
        // `releaseForm` wrote from its snapshot; only a row that left the
        // grid loses it.
        else if (!committed.has(rowId)) working.rows.delete(rowId);
      }
      staleRows.clear();
      dirty.add("rows");
    }
    if (dirty.size === 0) return;
    const next = { ...store.state };
    if (dirty.has("active")) next.active = working.active;
    if (dirty.has("openRowIds")) next.openRowIds = [...working.openRowIds];
    if (dirty.has("rows")) next.rows = Object.fromEntries(working.rows);
    if (dirty.has("committedRowIds")) {
      next.committedRowIds = [...working.committedRowIds];
    }
    if (dirty.has("committedValues")) {
      next.committedValues = Object.fromEntries(working.committedValues);
    }
    if (dirty.has("newRows")) {
      next.newRows = [...working.newRows].map(([tempId, committed]) => ({
        tempId,
        committed,
      }));
    }
    if (dirty.has("deletedRowIds")) {
      next.deletedRowIds = [...working.deletedRowIds];
    }
    if (dirty.has("isSaving")) next.isSaving = working.isSaving;
    dirty.clear();
    store.setState(() => next);
  };

  /** Marks slices changed and publishes - the ordinary single write. */
  const touch = (...slices: Array<keyof TMDataGridEditState>) => {
    for (const slice of slices) dirty.add(slice);
    publish();
  };

  /** Runs `body` with the publish held: one render for the whole run. */
  const held = async <T,>(body: () => Promise<T>): Promise<T> => {
    holdDepth += 1;
    try {
      return await body();
    } finally {
      holdDepth -= 1;
      publish();
    }
  };

  /** {@link held} for a synchronous run. */
  const heldSync = <T,>(body: () => T): T => {
    holdDepth += 1;
    try {
      return body();
    } finally {
      holdDepth -= 1;
      publish();
    }
  };

  const publishRow = (rowId: string) => {
    staleRows.add(rowId);
    publish();
  };

  const setActive = (active: TMDataGridEditState["active"]) => {
    if (working.active === active) return;
    working.active = active;
    touch("active");
  };

  /**
   * Publishes a committed row's values from its snapshot. Refreshed on every
   * commit, not only the first - `setCellValue` on a committed row reopens
   * it, writes and commits it again, and the table has to see the second
   * value as well as the first. A reopen leaves the published values alone:
   * the table keeps showing the last decided ones until the next decision.
   * Marks the slice; the caller publishes.
   */
  const snapshotCommitted = (rowId: string) => {
    const values = committed.get(rowId)?.values;
    if (values === undefined || working.committedValues.get(rowId) === values) {
      return;
    }
    working.committedValues.set(rowId, values);
    dirty.add("committedValues");
  };

  const setNewRowCommitted = (tempId: string, isCommitted: boolean) => {
    const current = working.newRows.get(tempId);
    if (current === undefined) return;
    if (isCommitted) snapshotCommitted(tempId);
    if (current !== isCommitted) {
      working.newRows.set(tempId, isCommitted);
      dirty.add("newRows");
    }
    publish();
  };

  /**
   * Moves an existing row across the line between form state and the draft
   * store. The values are the snapshot's; this records which side the row is
   * on and publishes them for the table on the way in. On the way out it
   * leaves `committedValues` standing, so the row keeps the place the last
   * decision gave it while the next one is being typed.
   */
  const setCommitted = (rowId: string, isCommitted: boolean) => {
    if (isCommitted) snapshotCommitted(rowId);
    if (working.committedRowIds.has(rowId) !== isCommitted) {
      if (isCommitted) working.committedRowIds.add(rowId);
      else working.committedRowIds.delete(rowId);
      dirty.add("committedRowIds");
    }
    publish();
  };

  /**
   * Drops the form of a row that has just committed, leaving every trace of
   * the row itself: it is in the draft store now, and its projection is the
   * snapshot's. The form is what goes - eight kilobytes a row that nothing
   * can write to any more.
   */
  const releaseForm = (rowId: string) => {
    const entry = forms.get(rowId);
    if (entry === undefined) return;
    entry.unsubscribe();
    forms.delete(rowId);
    staleRows.delete(rowId);
    const snapshot = committed.get(rowId);
    if (snapshot !== undefined) {
      working.rows.set(rowId, projectCommitted(snapshot));
      dirty.add("rows");
    }
    publish();
  };

  /** The row leaves the grid: its form, its snapshot and every flag go. */
  const forget = (rowId: string) => {
    heldSync(() => {
      const isNew =
        forms.get(rowId)?.isNew ?? committed.get(rowId)?.isNew ?? false;
      releaseForm(rowId);
      committed.delete(rowId);
      if (working.openRowIds.delete(rowId)) dirty.add("openRowIds");
      if (working.rows.delete(rowId)) dirty.add("rows");
      if (working.committedRowIds.delete(rowId)) dirty.add("committedRowIds");
      if (working.committedValues.delete(rowId)) dirty.add("committedValues");
      if (isNew && working.newRows.delete(rowId)) dirty.add("newRows");
      // An entry row leaves the table for good: discarded, or saved and
      // coming back under the consumer's own id. Its selection, expansion
      // and pin go with it - see flushRowState.
      if (isNew) pendingLeft.add(rowId);
      if (working.active?.rowId === rowId) {
        working.active = null;
        dirty.add("active");
      }
    });
  };

  /**
   * Opens a row: a form over `original`, which is the row as it was when the
   * editing began and what a commit's `changes` are diffed against.
   *
   * `values` is what the form starts out holding when that is not `original`
   * - a reopen or a demotion, where the row already has committed values.
   * They are written before the mount validation runs, so a rule judging the
   * row on the way in sees what the user last decided, not the seed.
   */
  const createForm = (
    rowId: string,
    original: TMDataGridRowData,
    isNew: boolean,
    values?: TMDataGridRowData,
  ): FormEntry => {
    const entry: FormEntry = {
      original,
      isNew,
      lastSubmitOk: false,
      submitErrors: [],
      parkOnly: false,
      pendingCommit: null,
      unsubscribe: () => {},
      form: new FormApi({
        defaultValues: original,
        // The consumer's vocabulary is Form's own; the cast erases the
        // validator generics the same way the row type is erased. The column
        // rules ride along in the submit pass - see `composeValidators`.
        validators: composeValidators(rowId, isNew) as never,
        onSubmit: async ({ value }) => {
          // A new row commits whole: it is an add, not a diff against
          // anything that exists.
          if (entry.isNew) {
            const addArgs: TMDataGridRowAddArgs<TMDataGridRowData> = {
              tempId: rowId,
              value: value as TMDataGridRowData,
            };
            // Into the draft store: validated and held for Save - no
            // consumer call, and `commit` takes it from here.
            if (entry.parkOnly) {
              entry.lastSubmitOk = true;
              return;
            }
            try {
              await getContext().onRowAdd?.(addArgs);
              entry.lastSubmitOk = true;
            } catch (error) {
              entry.form.setErrorMap({
                onSubmit:
                  error instanceof Error ? error.message : String(error),
              } as never);
            }
            return;
          }
          const changes = diff(entry.original, value as TMDataGridRowData);
          const args: TMDataGridEditCommitArgs<TMDataGridRowData> = {
            rowId,
            value: value as TMDataGridRowData,
            original,
            changes,
            source: getContext().editMode,
          };
          // Into the draft store: validated and held for Save - no consumer
          // call, and `commit` takes it from here.
          if (entry.parkOnly) {
            entry.lastSubmitOk = true;
            return;
          }
          try {
            await getContext().onEditCommit?.(args);
            entry.lastSubmitOk = true;
          } catch (error) {
            // A rejected save keeps the form open, the message on the row.
            entry.form.setErrorMap({
              onSubmit:
                error instanceof Error ? error.message : String(error),
            } as never);
          }
        },
      }) as TMDataGridRowEditForm,
    };
    // One write for the lot rather than a `setFieldValue` per field, which
    // would churn the field meta and run the change rules on the way past.
    // `keepDefaultValues` is what keeps `original` the thing the row is
    // dirty against.
    if (values !== undefined) {
      entry.form.reset(values as never, { keepDefaultValues: true });
    }
    // Not `form.mount()`. What mount does is devtools wiring - three `window`
    // listeners per form and a state broadcast on every change - and a grid
    // holding ten thousand row forms cannot afford it: every form's every
    // change would fan out to every other form's listeners. The one thing
    // the engine wants from it is the `onMount` pass.
    if (getContext().rowValidators?.onMount !== undefined) {
      entry.form.validateSync("mount");
    }
    const subscription = entry.form.store.subscribe(() => publishRow(rowId));
    entry.unsubscribe = () => subscription.unsubscribe();
    forms.set(rowId, entry);
    staleRows.add(rowId);
    // A Set add is idempotent, so a reopened row keeps the place it had.
    if (!working.openRowIds.has(rowId)) {
      working.openRowIds.add(rowId);
      dirty.add("openRowIds");
    }
    publish();
    return entry;
  };

  /**
   * Takes a committed row back out of the draft store and into form state: a
   * fresh form over the row as it was, holding the values the user last
   * decided. `undefined` when the row is not committed.
   *
   * `committedValues` is left standing on purpose - the table keeps showing
   * the last decided values, so the row holds its place in the sort while
   * the next cell is typed into.
   */
  const reopen = (rowId: string): FormEntry | undefined => {
    const snapshot = committed.get(rowId);
    if (snapshot === undefined) return undefined;
    committed.delete(rowId);
    const entry = createForm(
      rowId,
      snapshot.original,
      snapshot.isNew,
      snapshot.values,
    );
    if (snapshot.isNew) setNewRowCommitted(rowId, false);
    else setCommitted(rowId, false);
    return entry;
  };

  /**
   * A committed row that failed at Save: reopened, with the error on it.
   * That is what the user has to act on, and "committed" means validated, so
   * a row carrying an error cannot stay in the store.
   *
   * The error is read the way TanStack Form's own `normalizeError` reads a
   * validator's return: an object naming `form` or `fields` splits into a
   * row-level message and pathed ones, anything else is a row-level message.
   */
  const demote = (rowId: string, error: unknown) => {
    const snapshot = committed.get(rowId);
    // No snapshot: `begin` took the row back out while a per-row save was
    // still waiting on the consumer. The row is open already, and the
    // answer lands on the form it has rather than being lost.
    const entry = snapshot === undefined ? forms.get(rowId) : reopen(rowId);
    if (entry === undefined) return;
    const values =
      snapshot?.values ?? (entry.form.state.values as TMDataGridRowData);
    const shape =
      typeof error === "object" && error !== null
        ? (error as { form?: unknown; fields?: Record<string, unknown> })
        : undefined;
    const split = shape !== undefined && ("fields" in shape || "form" in shape);
    const fields = split ? shape.fields : undefined;
    const formError = split ? shape.form : error;
    if (fields !== undefined) {
      // The shape `takeFieldErrors` produces, which `project` keeps on the
      // row for as long as the value the rule tripped over stands.
      entry.submitErrors = Object.entries(fields).flatMap(([field, issue]) =>
        isValidationError(issue)
          ? [
              {
                field,
                value: getBy(values, field),
                message: firstErrorText(issue) ?? "",
              },
            ]
          : [],
      );
    }
    if (isValidationError(formError)) {
      entry.form.setErrorMap({ onSubmit: formError } as never);
    }
    publishRow(rowId);
  };

  const canEditRow = (row: ErasedRow): boolean => {
    if (row.getIsGrouped()) return false;
    // A deletion-marked row is read-only until it is restored: an edit on a
    // row the save is about to delete has nowhere to go. The mark is checked
    // here, in the engine, so the keyboard and the verbs agree with the
    // pointer, which the table's CSS blocks.
    if (working.deletedRowIds.has(row.id)) return false;
    return getContext().isRowEditable?.(row) !== false;
  };

  const canEditCell = (row: ErasedRow, column: ErasedColumn): boolean => {
    const context = getContext();
    if (row.getIsGrouped()) return false;
    if (working.deletedRowIds.has(row.id)) return false;
    if (!isColumnEditable(column)) return false;
    if (!isColumnEditableForRow(column, row)) return false;
    if (context.isRowEditable !== undefined && !context.isRowEditable(row)) {
      return false;
    }
    return true;
  };

  const getRow = (rowId: string): ErasedRow | undefined => {
    try {
      return getContext().table.getRow(rowId);
    } catch {
      // TanStack throws for an id that is not in the current row model.
      return undefined;
    }
  };

  /**
   * The row's field errors as they stand, with the value each was found on.
   * Read straight after a failed submit, while every editor is still mounted
   * and Form still holds what its validators said.
   */
  const takeFieldErrors = (
    entry: FormEntry,
  ): Array<{ field: string; value: unknown; message: string }> => {
    const values = entry.form.state.values as TMDataGridRowData;
    return Object.entries(entry.form.state.fieldMeta).flatMap(
      ([field, meta]) => {
        if (field === "") return [];
        const errors = (meta as { errors: ReadonlyArray<unknown> }).errors;
        const message = hasAnyError(errors) ? firstErrorText(errors) : undefined;
        if (message === undefined) return [];
        return [{ field, value: getBy(values, field), message }];
      },
    );
  };

  /**
   * Runs every `meta.edit.mapCommitValue` over the row's form and writes the
   * results back. An open row maps the fields the user changed - a value that
   * was already stored is not the user's to have rewritten; a row being added
   * has no stored value, so every editable field of it is mapped. A field in
   * `callerFields` holds a value the caller wrote, not the user, and is left
   * as written. Written without validation: the submit that follows judges
   * the mapped values.
   */
  const applyCommitMaps = (
    entry: FormEntry,
    rowId: string,
    callerFields: ReadonlySet<string>,
  ) => {
    const { table } = getContext();
    const values = entry.form.state.values as TMDataGridRowData;
    const changed = entry.isNew
      ? null
      : new Set(diff(entry.original, values).map((change) => change.columnId));
    const row = entry.isNew ? undefined : getRow(rowId);
    for (const column of editableColumns()) {
      const map = column.columnDef.meta?.edit?.mapCommitValue;
      if (map === undefined) continue;
      if (changed !== null && !changed.has(column.id)) continue;
      const field = getEditFieldName(column);
      if (field === null || callerFields.has(field)) continue;
      const value: unknown = getBy(
        entry.form.state.values as TMDataGridRowData,
        field,
      );
      const mapped = map({
        value,
        previous: getBy(entry.original, field),
        row,
        column,
        table,
      });
      if (sameValue(value, mapped)) continue;
      entry.form.setFieldValue(field as never, mapped as never, {
        dontValidate: true,
      });
    }
  };

  const commit = (rowId: string): Promise<boolean> =>
    commitRow(rowId, new Set());

  /**
   * `callerFields` names the fields a caller wrote itself, which no editor
   * touched - `writeFields` passes the ones it writes, the rows of
   * `addRows({ commit: true })` pass `"all"`. They hold stored values already,
   * as `meta.edit.mapValue` has always assumed, so `mapCommitValue` leaves
   * them alone; every other field the user changed is still mapped.
   */
  const commitRow = async (
    rowId: string,
    callerFields: ReadonlySet<string> | "all",
  ): Promise<boolean> => {
    const entry = forms.get(rowId);
    // No form: the row is committed already, or the grid never held it.
    // Either way there is nothing left to decide.
    if (entry === undefined) return true;
    // Enter and blur race on the same edit; the second caller joins the
    // first's commit instead of submitting the row twice.
    if (entry.pendingCommit !== null) return entry.pendingCommit;
    // Before the pristine check: a value mapped back to the original leaves
    // nothing to commit.
    if (callerFields !== "all") applyCommitMaps(entry, rowId, callerFields);
    // A pristine form has nothing to say - drop it without a consumer call.
    // Not for a new row: adding an untouched entry is still an add.
    if (
      !entry.isNew &&
      diff(entry.original, entry.form.state.values as TMDataGridRowData)
        .length === 0
    ) {
      forget(rowId);
      return true;
    }
    // Field errors the *form's* validator planted are cleared before the
    // submit re-runs it: a field with no mounted editor is never revalidated
    // by Form itself, so a pathed issue would otherwise outlive its fix and
    // block `canSubmit` forever. The validator puts back whatever still holds.
    clearFormSourcedFieldErrors(entry.form);
    entry.lastSubmitOk = false;
    entry.submitErrors = [];
    entry.parkOnly = getContext().draft;
    entry.pendingCommit = (async () => {
      try {
        await entry.form.handleSubmit();
      } finally {
        entry.pendingCommit = null;
      }
      // Dropped while the submit was in flight - cancel or deleteRow won the
      // race. The form is gone, so there is nothing to park or drop; marking
      // the row committed now would plant an id in `committedRowIds` that no
      // save or discard could ever clear.
      if (forms.get(rowId) !== entry) return true;
      if (!entry.lastSubmitOk) {
        // Snapshot before the caller closes the editor: the field errors go
        // with it, and the row is about to be left carrying them.
        entry.submitErrors = takeFieldErrors(entry);
        publishRow(rowId);
        return false;
      }
      if (entry.parkOnly) {
        // Into the draft store, as data: the values are decided, so they are
        // snapshotted and the form goes. An entry row renders as a value
        // row, an edited row as its draft - both until `begin` builds a form
        // back from the snapshot, or `saveDrafts` flushes it.
        heldSync(() => {
          const values = entry.form.state.values as TMDataGridRowData;
          committed.set(rowId, {
            original: entry.original,
            values,
            dirtyFields: diff(entry.original, values).map(
              (change) => change.field,
            ),
            isNew: entry.isNew,
          });
          if (entry.isNew) setNewRowCommitted(rowId, true);
          else setCommitted(rowId, true);
          if (working.active?.rowId === rowId) setActive(null);
          releaseForm(rowId);
        });
        return true;
      }
      forget(rowId);
      return true;
    })();
    return entry.pendingCommit;
  };

  const beginOn = (rowId: string, columnId: string | null) => {
    // Held: a reopen builds a form, takes the row out of the draft store and
    // names the caret's cell, and the grid should see all of it at once.
    heldSync(() => {
      // An entry row has no backing row in the table. An open one is already
      // in its editors; a committed one is re-armed from its snapshot, which
      // with `editing.draft` on is how an entered row is edited again.
      if (forms.get(rowId)?.isNew === true) {
        setActive({ rowId, columnId });
        return;
      }
      if (committed.get(rowId)?.isNew === true) {
        reopen(rowId);
        setActive({ rowId, columnId });
        return;
      }
      const row = getRow(rowId);
      if (row === undefined) return;
      if (columnId !== null) {
        const column = getContext().table.getColumn(columnId);
        if (column === undefined || !canEditCell(row, column)) return;
      } else if (!canEditRow(row)) {
        return;
      }
      // Reopening a committed row takes it back out of the draft store: what
      // the user is now editing is undecided again, and `saveDrafts` must not
      // send it until it is committed afresh. It reopens from the snapshot,
      // never from `row.original` - the table is showing the draft, and the
      // row as it was is what a commit's `changes` are diffed against.
      if (!forms.has(rowId) && reopen(rowId) === undefined) {
        createForm(rowId, row.original, false);
      }
      setActive({ rowId, columnId });
    });
  };

  const begin: TMDataGridEditApi["begin"] = ({ rowId, columnId }) => {
    const { editMode } = getContext();
    // Each mode's policy about a row already open elsewhere:
    //
    // | Mode | Another row open |
    // | ---- | ---------------- |
    // | cell | committed - Sheets; a failed commit keeps holding the edit |
    // | row, cellConfirm | accumulates. Every draft waits for its own save,
    //   so a second row opening can neither discard the first nor be refused
    //   by it - nothing about one row's form bears on another's |
    //
    // A committed row is not "open": it has had its submit and is waiting
    // for the save, so it holds no form and the sweep never sees it. An
    // entry row is skipped too - it is row-shaped in every mode, and its ✓
    // is the decision, so the sweep must not add a half-typed row.
    if (editMode === "cell") {
      const openElsewhere = [...forms.keys()].find(
        (id) => id !== rowId && forms.get(id)?.isNew !== true,
      );
      if (openElsewhere !== undefined) {
        void commit(openElsewhere).then((ok) => {
          if (ok) beginOn(rowId, columnId);
        });
        return;
      }
    }
    beginOn(rowId, columnId);
  };

  const cancel = (rowId: string) => {
    forget(rowId);
  };

  const deactivate = () => {
    setActive(null);
  };

  const cancelAll = () => {
    heldSync(() => {
      // Open rows and committed ones alike - `openRowIds` is both.
      for (const rowId of [...working.openRowIds]) forget(rowId);
      committed.clear();
      working.active = null;
      working.committedRowIds.clear();
      working.committedValues.clear();
      working.deletedRowIds.clear();
      dirty.add("active");
      dirty.add("committedRowIds");
      dirty.add("committedValues");
      dirty.add("deletedRowIds");
    });
  };

  /** Opens one entry row - the form and its `newRows` entry, in one write. */
  const openEntryRow = (values?: TMDataGridRowData): string => {
    newRowCounter += 1;
    const tempId = `${NEW_ROW_ID_PREFIX}${newRowCounter}`;
    createForm(tempId, seedNewRow(values), true);
    working.newRows.set(tempId, false);
    dirty.add("newRows");
    return tempId;
  };

  const addRow = (values?: TMDataGridRowData): string =>
    heldSync(() => openEntryRow(values));

  /** Seeds one entry row's values - `newRowDefaults` under `values`. */
  const seedNewRow = (values?: TMDataGridRowData): TMDataGridRowData => {
    const { newRowDefaults } = getContext();
    const defaults =
      typeof newRowDefaults === "function"
        ? newRowDefaults()
        : (newRowDefaults ?? {});
    // The argument wins over the defaults key by key, so a caller can seed
    // one field and leave the rest of `newRowDefaults` standing.
    return { ...defaults, ...values };
  };

  const addRows = async (
    rows: ReadonlyArray<TMDataGridRowData>,
    options?: TMDataGridAddRowsOptions,
  ): Promise<TMDataGridAddRowsResult> =>
    // One publish for the whole import - the entry block and the table learn
    // of the rows once, committed, rather than once per row on the way in
    // and once more per commit.
    held(async () => {
      const tempIds = rows.map((values) => openEntryRow(values));
      if (options?.commit !== true) {
        return { ok: tempIds.length === 0, committed: [], open: tempIds };
      }

      // A row that fails validation stays open carrying its errors.
      //
      // Parked, the rows are submitted together: Form runs a submit's async
      // validators off a timer, so one row after another is a timer per row
      // - minutes for an import, once the browser clamps nested timers.
      // Nothing but the engine hears a parked commit, so the rows may
      // validate side by side. Out to `onRowAdd`, one at a time and in
      // order, so the consumer sees the rows as the file had them.
      const results = getContext().draft
        ? await Promise.all(
            tempIds.map((tempId) => commitRow(tempId, "all")),
          )
        : [];
      if (!getContext().draft) {
        for (const tempId of tempIds) {
          results.push(await commitRow(tempId, "all"));
        }
      }
      return splitCommitted(tempIds, results);
    });

  const deleteRow = (rowId: string) => {
    // Deleting an unsaved entry row is just discarding the entry, whether it
    // is still open or already committed into the draft store.
    if (
      forms.get(rowId)?.isNew === true ||
      committed.get(rowId)?.isNew === true
    ) {
      forget(rowId);
      return;
    }
    const context = getContext();
    if (context.draft) {
      // Idempotent: a marked row stays marked - `restoreRow` is the undo.
      if (working.deletedRowIds.has(rowId)) return;
      // Only a consumer row can be marked. A deletion mark is what
      // `saveDrafts` reports to the server, so an id it cannot act on - an
      // engine temp id, a record gone from `data`, an id the grid never
      // knew - must not live on as a mark inflating the draft count. Entry
      // rows are dropped above, never marked; the prefix check also catches
      // one already dropped that a stale selection or a double-fired
      // handler names again, while the table's data still shows it for one
      // render. The core model, so a filtered-out row still takes its mark.
      if (
        rowId.startsWith(NEW_ROW_ID_PREFIX) ||
        !(rowId in context.table.getCoreRowModel().rowsById)
      ) {
        return;
      }
      heldSync(() => {
        // An editor open on the row loses: what was being typed into a row
        // the user then deleted is not worth keeping, and a marked row has
        // no editor. A committed edit stays under the mark, so Restore
        // brings the row back as it was edited.
        if (forms.has(rowId)) forget(rowId);
        working.deletedRowIds.add(rowId);
        dirty.add("deletedRowIds");
        // Not selectable while marked - see `enableRowSelection` in the
        // hook - so the selection lets it go now, the way a row leaving the
        // table would. See flushRowState.
        pendingUnselect.add(rowId);
      });
      return;
    }
    const row = getRow(rowId);
    if (row === undefined) return;
    // Confirmation is the consumer's business, in their onRowDelete.
    void context.onRowDelete?.({ rowId, row });
  };

  const deleteRows = (rowIds: ReadonlyArray<string>) => {
    // One publish for the batch - each id still goes through `deleteRow`,
    // so entry rows drop and everything else marks or no-ops by the same
    // rules.
    heldSync(() => {
      for (const rowId of rowIds) deleteRow(rowId);
    });
  };

  const restoreRow = (rowId: string) => {
    if (working.deletedRowIds.delete(rowId)) touch("deletedRowIds");
  };

  const canDeleteRows = (): boolean => {
    const context = getContext();
    if (context.draft) {
      return (
        context.onRowDelete !== undefined ||
        context.onSaveDrafts !== undefined
      );
    }
    return context.onRowDelete !== undefined;
  };

  /** The draft store's rows, in the order the rows entered the grid. */
  const committedIds = (): Array<string> =>
    [...working.openRowIds].filter((rowId) => committed.has(rowId));

  const commitAll = async (): Promise<TMDataGridCommitAllResult> => {
    // Every form there is - a row in the draft store holds none, so this is
    // the open rows and nothing else.
    const openIds = [...forms.keys()];
    const results = await held(() =>
      Promise.all(openIds.map((rowId) => commit(rowId))),
    );
    return splitCommitted(openIds, results);
  };

  /**
   * The in-flight save. A second call while `onSaveDrafts` awaits would
   * re-collect the same payload and send it again - a double-clicked Save
   * would create every pending entry row twice - so concurrent calls join
   * this promise, and its result, instead of starting a save of their own.
   */
  let saveInFlight: Promise<TMDataGridSaveDraftsResult> | null = null;

  const saveDrafts = (): Promise<TMDataGridSaveDraftsResult> => {
    if (saveInFlight !== null) return saveInFlight;
    saveInFlight = saveDraftsInner().finally(() => {
      saveInFlight = null;
      // Guarded: a save that found nothing to send never raised the flag,
      // so it publishes nothing either.
      if (working.isSaving) {
        working.isSaving = false;
        touch("isSaving");
      }
    });
    return saveInFlight;
  };

  /** What one committed row hands `onEditCommit` and the payload's `updated`. */
  const commitArgsFor = (
    rowId: string,
    snapshot: Committed,
  ): TMDataGridEditCommitArgs<TMDataGridRowData> => ({
    rowId,
    value: snapshot.values,
    original: snapshot.original,
    changes: diff(snapshot.original, snapshot.values),
    source: getContext().editMode,
  });

  const saveDraftsInner = async (): Promise<TMDataGridSaveDraftsResult> => {
    const deletedIds = [...working.deletedRowIds];
    // A marked row's edit is not sent - the save deletes the row. The edit
    // stays under the mark for Restore and leaves with the row once the
    // deletion is saved; a rejected deletion keeps both.
    const ids = committedIds().filter(
      (rowId) => !working.deletedRowIds.has(rowId),
    );
    // Every id the save takes out of the store lands in exactly one list,
    // edits, new rows and deletions mixed, in the store's order.
    const saved: Array<string> = [];
    const kept: Array<string> = [];
    const reopened: Array<string> = [];
    const report = (): TMDataGridSaveDraftsResult => ({
      ok: kept.length === 0 && reopened.length === 0,
      saved,
      kept,
      reopened,
    });
    // Nothing decided: open rows are not this verb's business, so a grid
    // mid-edit with an empty draft store saves cleanly and stays as it is.
    if (ids.length === 0 && deletedIds.length === 0) return report();

    working.isSaving = true;
    touch("isSaving");

    // Only the table rules run here, and only once per row. A committed
    // row's values passed its column and row validators on the way in and
    // cannot have moved since, so re-running those could only say the same
    // thing. Table rules see the *other* rows, which later commits do move,
    // so a draft another edit has invalidated is caught here - and nowhere
    // else, because checking every committed row at every commit would be a
    // pass over the store per keystroke.
    //
    // The collection is built once for the pass: every value in it is frozen
    // while the pass runs, so N rows share one view instead of building one
    // each.
    const rows = mergedRows();

    if (getContext().onSaveDrafts === undefined) {
      // The default: the per-row loop - edits through `onEditCommit`, entry
      // rows through `onRowAdd`, marked deletions through `onRowDelete`. The
      // rows go out side by side, as one `onSaveDrafts` call would.
      const results = await held(() =>
        Promise.all(
          ids.map(async (rowId): Promise<"saved" | "reopened" | null> => {
            const snapshot = committed.get(rowId);
            if (snapshot === undefined) return null;
            const invalid = await runTableValidators(
              snapshot.values,
              rowId,
              snapshot.isNew,
              rows,
            );
            if (isValidationError(invalid)) {
              demote(rowId, invalid);
              return "reopened";
            }
            try {
              if (snapshot.isNew) {
                await getContext().onRowAdd?.({
                  tempId: rowId,
                  value: snapshot.values,
                });
              } else {
                await getContext().onEditCommit?.(
                  commitArgsFor(rowId, snapshot),
                );
              }
            } catch (error) {
              // The same answer a rejected commit gets outside the draft
              // store: the row is open again, carrying the message.
              demote(
                rowId,
                error instanceof Error ? error.message : String(error),
              );
              return "reopened";
            }
            forget(rowId);
            return "saved";
          }),
        ),
      );
      ids.forEach((rowId, index) => {
        const outcome = results[index];
        if (outcome === "saved") saved.push(rowId);
        else if (outcome === "reopened") reopened.push(rowId);
      });
      // A mark leaves once its `onRowDelete` resolved, and the row's
      // selection and the edit held under the mark go with it in one publish -
      // see flushRowState and saveDraftsInner's `ids`. A throw keeps the mark
      // for the next save, as a deletion `onSaveDrafts` refuses is kept.
      const deletedOk: Array<string> = [];
      for (const rowId of deletedIds) {
        const row = getRow(rowId);
        try {
          if (row !== undefined) {
            await getContext().onRowDelete?.({ rowId, row });
          }
          deletedOk.push(rowId);
        } catch {
          kept.push(rowId);
        }
      }
      heldSync(() => {
        let deletionsChanged = false;
        for (const rowId of deletedOk) {
          if (working.deletedRowIds.delete(rowId)) deletionsChanged = true;
          pendingLeft.add(rowId);
          if (committed.has(rowId)) forget(rowId);
        }
        if (deletionsChanged) dirty.add("deletedRowIds");
      });
      saved.push(...deletedOk);
      return report();
    }

    // One consumer call for the lot. The valid rows travel together, and
    // only a resolved save drops them - a rejected save keeps every draft,
    // deletions included. A row the table rules now reject is reopened with
    // the error and left behind for the user to fix.
    type CommitArgs = TMDataGridEditCommitArgs<TMDataGridRowData>;
    type AddArgs = TMDataGridRowAddArgs<TMDataGridRowData>;
    const collected: Array<CommitArgs> = [];
    const added: Array<AddArgs> = [];
    // The rows sent, edits and new rows mixed in the store's order - the
    // order the result reports them in.
    const sent: Array<{ id: string; isNew: boolean }> = [];
    await held(async () => {
      const results = await Promise.all(
        ids.map((rowId) => {
          const snapshot = committed.get(rowId);
          if (snapshot === undefined) return undefined;
          return runTableValidators(
            snapshot.values,
            rowId,
            snapshot.isNew,
            rows,
          );
        }),
      );
      // In the store's order, which is the order the rows entered the grid.
      ids.forEach((rowId, index) => {
        const snapshot = committed.get(rowId);
        if (snapshot === undefined) return;
        if (isValidationError(results[index])) {
          demote(rowId, results[index]);
          reopened.push(rowId);
          return;
        }
        sent.push({ id: rowId, isNew: snapshot.isNew });
        if (snapshot.isNew) {
          added.push({ tempId: rowId, value: snapshot.values });
        } else {
          collected.push(commitArgsFor(rowId, snapshot));
        }
      });
    });
    const deleted = deletedIds;
    if (collected.length > 0 || added.length > 0 || deleted.length > 0) {
      let response: void | TMDataGridSaveDraftsResponse;
      try {
        response = await getContext().onSaveDrafts?.({
          updated: collected,
          created: added,
          deleted,
        });
      } catch {
        // A thrown save keeps everything it was sent, for the next save.
        kept.push(...sent.map((row) => row.id), ...deleted);
        return report();
      }

      // Nothing returned saves the lot. A response names what failed; those
      // keep their drafts, committed, so the next save retries them.
      const outcomes = response ?? {};

      // The saved rows leave the store in one publish.
      heldSync(() => {
        for (const { id, isNew } of sent) {
          if (isSaved(isNew ? outcomes.created : outcomes.updated, id)) {
            forget(id);
            saved.push(id);
          } else {
            kept.push(id);
          }
        }
        let deletionsChanged = false;
        for (const id of deleted) {
          if (!isSaved(outcomes.deleted, id)) {
            kept.push(id);
            continue;
          }
          saved.push(id);
          if (working.deletedRowIds.delete(id)) deletionsChanged = true;
          // The consumer has deleted the record; the row is on its way out
          // of `data`, and its selection goes now - see flushRowState. So
          // does the edit held under the mark.
          pendingLeft.add(id);
          if (committed.has(id)) forget(id);
        }
        if (deletionsChanged) dirty.add("deletedRowIds");
      });
    }
    return report();
  };

  /**
   * The write path behind `clearCell`, `setCellValue` and `setRowValues`:
   * fill the row's own form and commit it, exactly as a ✓ on an open editor
   * would. Uses the form already open on the row when there is one, so a
   * programmatic write joins an edit in progress rather than discarding it;
   * a committed row is reopened from its snapshot and commits afresh.
   *
   * Only that last case runs under a hold. Reopened, the row is out of the
   * draft store until it commits again, and its markers must not flicker
   * off for the length of the validators. The hold is safe there because a
   * committed row exists only under `editing.draft`, where the commit parks
   * and never waits on the consumer. An open row's commit without `draft`
   * awaits `onEditCommit`, and holding the engine's publish for a server
   * round trip would stall every other row's markers and the caret.
   *
   * No editor is involved, so `meta.edit.mapValue` does not run - the caller
   * writes the stored value itself - and `meta.edit.mapCommitValue` skips the
   * fields written here, while still mapping what the user typed elsewhere in
   * an open row. Validation is untouched: this is the same
   * `commit`, so `meta.edit.validate` and `editing.rowValidators` still decide
   * whether the row lands, and a failure leaves the row open carrying its
   * errors.
   */
  const writeFields = async (
    rowId: string,
    writes: ReadonlyArray<{ field: string; value: unknown }>,
  ): Promise<boolean> => {
    const row = getRow(rowId);
    if (row === undefined) return false;
    // Read-only while marked - see canEditRow.
    if (working.deletedRowIds.has(rowId)) return false;
    if (writes.length === 0) return true;
    const write = (entry: FormEntry): Promise<boolean> => {
      for (const { field, value } of writes) {
        entry.form.setFieldValue(field as never, value as never);
      }
      return commitRow(rowId, new Set(writes.map(({ field }) => field)));
    };
    const open = forms.get(rowId);
    if (open !== undefined) return write(open);
    if (!committed.has(rowId)) {
      return write(createForm(rowId, row.original, false));
    }
    return held(async () => {
      const entry = reopen(rowId);
      return entry === undefined ? false : write(entry);
    });
  };

  /** The field a cell writes to, or `null` when that cell takes no edit. */
  const writableField = (rowId: string, columnId: string): string | null => {
    const row = getRow(rowId);
    const column = getContext().table.getColumn(columnId);
    if (row === undefined || column === undefined) return null;
    if (!canEditCell(row, column)) return null;
    return getEditFieldName(column);
  };

  const clearCell = async (
    rowId: string,
    columnId: string,
  ): Promise<boolean> => {
    const column = getContext().table.getColumn(columnId);
    const field = writableField(rowId, columnId);
    if (field === null || column === undefined) return false;
    return writeFields(rowId, [
      {
        field,
        value: clearedValueForType(column.columnDef.meta?.type ?? "string"),
      },
    ]);
  };

  const setCellValue = async (
    rowId: string,
    columnId: string,
    value: unknown,
  ): Promise<boolean> => {
    const field = writableField(rowId, columnId);
    if (field === null) return false;
    return writeFields(rowId, [{ field, value }]);
  };

  const setRowValues = async (
    rowId: string,
    values: Record<string, unknown>,
  ): Promise<boolean> => {
    const writes: Array<{ field: string; value: unknown }> = [];
    for (const [columnId, value] of Object.entries(values)) {
      const field = writableField(rowId, columnId);
      // All or nothing: one cell that takes no edit fails the call before
      // anything is written, so a bulk action cannot half-apply unnoticed.
      if (field === null) return false;
      writes.push({ field, value });
    }
    return writeFields(rowId, writes);
  };

  const getRowValues = (rowId: string): TMDataGridRowData | undefined =>
    // An entry row exists only as a draft, open or committed, so this covers
    // it too.
    draftValues(rowId) ??
    (getRow(rowId)?.original as TMDataGridRowData | undefined);

  const getRows = (): ReadonlyArray<TMDataGridEditRowSnapshot> => {
    const deleted = working.deletedRowIds;
    const rows: Array<TMDataGridEditRowSnapshot> = [];
    const model = getContext().table.getCoreRowModel();
    for (const row of model.flatRows) {
      rows.push({
        rowId: row.id,
        value: draftValues(row.id) ?? (row.original as TMDataGridRowData),
        isNew:
          forms.get(row.id)?.isNew ?? committed.get(row.id)?.isNew ?? false,
        deleted: deleted.has(row.id),
      });
    }
    // Entry rows the table does not hold - see mergedRows.
    for (const tempId of working.newRows.keys()) {
      if (tempId in model.rowsById) continue;
      const values = draftValues(tempId);
      if (values === undefined) continue;
      rows.push({
        rowId: tempId,
        value: values,
        isNew: true,
        deleted: deleted.has(tempId),
      });
    }
    return rows;
  };

  /**
   * Drops what the store holds for records that left `data`: a refetch that
   * no longer returns a row takes its open form, its committed edit and its
   * deletion mark with it. The server has nothing for the save to update or
   * delete, and a row nobody can see must not sit in the Save count. Entry
   * rows are the engine's own and stay. Called by the hook whenever the rows
   * as shown change, with the core row model's `rowsById`; not called where
   * the grid does not own the result set, since there a row missing from
   * `data` is on another page, not gone.
   */
  const forgetMissingRows = (rowsById: Record<string, unknown>) => {
    heldSync(() => {
      // Open rows and committed ones alike - `openRowIds` is both.
      for (const rowId of [...working.openRowIds]) {
        const isNew =
          forms.get(rowId)?.isNew ?? committed.get(rowId)?.isNew ?? false;
        if (!isNew && !(rowId in rowsById)) forget(rowId);
      }
      for (const rowId of [...working.deletedRowIds]) {
        if (rowId in rowsById) continue;
        working.deletedRowIds.delete(rowId);
        dirty.add("deletedRowIds");
      }
    });
  };

  return {
    store,
    get state() {
      return store.state;
    },
    forgetMissingRows,
    isRowDeleted: (rowId) => working.deletedRowIds.has(rowId),
    getForm: (rowId) => forms.get(rowId)?.form,
    getRowValues,
    getRows,
    canEditCell,
    canEditRow,
    isColumnEditable,
    begin,
    commit,
    cancel,
    deactivate,
    cancelAll,
    commitAll,
    saveDrafts,
    clearCell,
    setCellValue,
    setRowValues,
    addRow,
    addRows,
    deleteRow,
    deleteRows,
    restoreRow,
    canDeleteRows,
  };
}

/**
 * `meta.edit.validate` normalised to the object TanStack Form's `validators`
 * option takes - a bare schema or function is shorthand for `{ onChange }`.
 */
export function normalizeFieldValidate(
  validate: TMDataGridFieldValidate | undefined,
): Record<string, unknown> | undefined {
  if (validate === undefined) return undefined;
  if (typeof validate === "function" || "~standard" in validate) {
    return { onChange: validate };
  }
  return validate as Record<string, unknown>;
}
