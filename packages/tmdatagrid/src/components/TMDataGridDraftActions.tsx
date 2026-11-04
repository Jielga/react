import { Button, Group, Text } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { shallow } from "@tanstack/store";
import type { ReactNode } from "react";
import { useTMDataGridContext } from "../TMDataGridContext";
import {
  getOpenRowIds,
  type TMDataGridCommitAllResult,
  type TMDataGridSaveDraftsResult,
} from "../core/editEngine";
import { getDisplayedRows } from "../core/rowSelection";
import type {
  TMDataGridScrollAlign,
  TMDataGridScrollToRowArgs,
} from "../useTMDataGrid";

/**
 * How many rows the draft store holds - parked edits, parked entry rows and
 * deletion marks. This is what Save sends, so it is what Save counts: a row
 * the user is still typing into is not in here.
 */
function useDraftCount(): number {
  const { edit } = useTMDataGridContext();
  return useSelector(edit.store, (state) => {
    const deleted = new Set(state.deletedRowIds);
    // An edited row that was then marked counts once: Save sends the
    // deletion and leaves the edit behind.
    const edited =
      deleted.size === 0
        ? state.committedRowIds.length
        : state.committedRowIds.filter((rowId) => !deleted.has(rowId)).length;
    return (
      edited +
      state.newRows.filter((newRow) => newRow.committed).length +
      deleted.size
    );
  });
}

/**
 * How many rows are still open - edited or entered but not parked, so not
 * part of the save. Surfaced beside Save so an undecided row is visible
 * rather than silently left behind.
 */
function useOpenCount(): number {
  const { edit } = useTMDataGridContext();
  return useSelector(edit.store, (state) => getOpenRowIds(state).length);
}

/**
 * The ids behind {@link useOpenCount}. Shallow-compared: the array would
 * otherwise be a new one on every edit-store publish, and it is handed to
 * `renderActions`, where it may well end up in a dependency array.
 */
function useOpenRowIds(): ReadonlyArray<string> {
  const { edit } = useTMDataGridContext();
  return useSelector(edit.store, getOpenRowIds, { compare: shallow });
}

/*
 * Module scope, like the pagination controls and for the same reason: a
 * component defined inside the render body is a new type every render, so
 * React would remount the buttons underneath an interaction.
 */

function EditSaveButton() {
  const { edit, labels } = useTMDataGridContext();
  const draftCount = useDraftCount();
  // Save sends the draft store, so its loading state is the save in flight,
  // not an open row's submit.
  const isSaving = useSelector(edit.store, (state) => state.isSaving);

  return (
    <Button
      size="compact-sm"
      disabled={draftCount === 0}
      loading={isSaving}
      data-dg-part="save-all"
      data-draft-count={draftCount}
      onClick={() => void edit.saveDrafts()}
    >
      {labels.saveAllEdits(draftCount)}
    </Button>
  );
}

/** The count of rows left open, or nothing while every row is decided. */
function EditOpenRowsNote() {
  const { labels } = useTMDataGridContext();
  const openCount = useOpenCount();
  if (openCount === 0) return null;
  return (
    <Text
      size="xs"
      c="dimmed"
      data-dg-part="open-rows-note"
      data-open-count={openCount}
    >
      {labels.editRowsStillOpen(openCount)}
    </Text>
  );
}

function EditDiscardButton() {
  const { edit, labels } = useTMDataGridContext();
  // Discard drops everything the grid is holding, open rows included, so it
  // stays live while anything is uncommitted.
  const uncommittedCount = useDraftCount() + useOpenCount();

  return (
    <Button
      variant="subtle"
      color="gray"
      size="compact-sm"
      disabled={uncommittedCount === 0}
      data-dg-part="discard-all"
      onClick={() => edit.cancelAll()}
    >
      {labels.discardAllEdits}
    </Button>
  );
}

const EDIT_ACTIONS_CONTROLS: TMDataGridDraftActionsControls = {
  Save: EditSaveButton,
  Discard: EditDiscardButton,
  OpenRowsNote: EditOpenRowsNote,
};

/** What the edit chrome is showing. */
export type TMDataGridDraftActionsState = {
  /**
   * Rows in the draft store, which is what Save sends: committed edits,
   * committed entry rows and deletion marks.
   */
  draftCount: number;
  /**
   * Rows still open - edited or entered but not committed, so not part of
   * the save. They stay open across a save.
   */
  openCount: number;
  /**
   * The ids behind {@link openCount}, in the order the grid opened them - a
   * sort, a filter or a page never moves this list. An entered row appears as
   * its `tempId`.
   *
   * Narrower than `edit.state.openRowIds`, which is every row holding a form,
   * the parked ones included. And note the ordering:
   * {@link TMDataGridDraftActionsActions.scrollToFirstOpenRow} takes "first"
   * in display order, so it need not be `openRowIds[0]`.
   */
  openRowIds: ReadonlyArray<string>;
  /** Whether a submit is in flight - any open row is submitting. */
  isSubmitting: boolean;
  /** `true` while `saveDrafts` is in flight. */
  isSaving: boolean;
};

/** What the edit chrome can do. */
export type TMDataGridDraftActionsActions = {
  /**
   * Saves the draft store - `edit.saveDrafts()`. Open rows are left alone.
   * Resolves which ids were saved, kept in the draft store for the next
   * save, or reopened with an error; see {@link TMDataGridSaveDraftsResult}.
   */
  save: () => Promise<TMDataGridSaveDraftsResult>;
  /**
   * Submits every open row, committing the ones that validate -
   * `edit.commitAll()`. Resolves which rows committed and which are still
   * open; see {@link TMDataGridCommitAllResult}.
   */
  commitAll: () => Promise<TMDataGridCommitAllResult>;
  /** Drops everything - open form state and the draft store alike. */
  discard: () => void;
  /**
   * `grid.scrollToRow`, so a control in here can take the user to a row
   * without the grid being threaded down to it.
   */
  scrollToRow: (args: TMDataGridScrollToRowArgs) => boolean;
  /**
   * Scrolls to the first row still open, taking "first" in display order: the
   * topmost open row under the current sort, filter and page. That need not
   * be {@link TMDataGridDraftActionsState.openRowIds}`[0]`, which is the
   * order the grid opened them in.
   *
   * Answers whether an open row could be reached. `false` when nothing is
   * open, and when every open row is filtered out, on another page or
   * collapsed inside a group. An open entry row answers `true` without
   * scrolling - it is sticky under the header, so it is on screen already -
   * and so does an open row pinned to an edge. The scroll goes through
   * `scrollToRow`, so before `TMDataGrid.Table` has mounted there is nothing
   * to scroll and the answer is `false`.
   */
  scrollToFirstOpenRow: (align?: TMDataGridScrollAlign) => boolean;
};

/** The pre-bound pieces of the built-in edit chrome. */
export type TMDataGridDraftActionsControls = {
  /** Save, with the draft count, disabled while the draft store is empty. */
  Save: () => ReactNode;
  /** Discard, disabled while nothing is pending. */
  Discard: () => ReactNode;
  /** The "N rows still being edited" note, or nothing while there are none. */
  OpenRowsNote: () => ReactNode;
};

/** What {@link TMDataGridDraftActionsProps.renderActions} is handed. */
export type TMDataGridDraftActionsSlotArgs = {
  state: TMDataGridDraftActionsState;
  actions: TMDataGridDraftActionsActions;
  Controls: TMDataGridDraftActionsControls;
};

export type TMDataGridDraftActionsProps = {
  /**
   * Replaces the built-in Save/Discard pair, and is handed the pieces of it.
   *
   * ```tsx
   * <TMDataGrid.DraftActions
   *   renderActions={({ state, Controls }) => (
   *     <Group>
   *       {state.draftCount > 0 && <Badge>{state.draftCount}</Badge>}
   *       <Controls.OpenRowsNote />
   *       <Controls.Save />
   *       <Controls.Discard />
   *     </Group>
   *   )}
   * />
   * ```
   */
  renderActions?: (args: TMDataGridDraftActionsSlotArgs) => ReactNode;
};

/**
 * The draft store's toolbar chrome: Save with the store's count, Discard, and
 * a note counting the rows still open. Save sends the store and leaves open
 * rows alone, so it greys out while nothing is parked however much is being
 * typed - the note is what makes those rows visible.
 *
 * Works under any `editing.mode`. The toolbar is declarative: the grid does
 * not decide for you, so include this only when the grid runs a draft store -
 * without `editing.draft` there is nothing to save and Save stays disabled.
 *
 * ```tsx
 * <TMDataGrid.Toolbar>
 *   <TMDataGrid.SummaryCount />
 *   <TMDataGrid.Spacer />
 *   <TMDataGrid.DraftActions />
 * </TMDataGrid.Toolbar>
 * ```
 */
export function TMDataGridDraftActions({
  renderActions,
}: TMDataGridDraftActionsProps = {}) {
  const { edit, features, table, scrollToRow } = useTMDataGridContext();
  const draftCount = useDraftCount();
  const openRowIds = useOpenRowIds();
  const isSubmitting = useSelector(edit.store, (state) =>
    state.openRowIds.some((rowId) => state.rows[rowId]?.isSubmitting === true),
  );
  const isSaving = useSelector(edit.store, (state) => state.isSaving);

  if (!features.editing) return null;

  if (renderActions) {
    return renderActions({
      state: {
        draftCount,
        openCount: openRowIds.length,
        openRowIds,
        isSubmitting,
        isSaving,
      },
      actions: {
        save: () => edit.saveDrafts(),
        commitAll: () => edit.commitAll(),
        discard: () => edit.cancelAll(),
        scrollToRow,
        scrollToFirstOpenRow: (align) => {
          // Read through the store rather than closing over this render's
          // arrays: display order is only decided here, at the click.
          const state = edit.state;
          const openIds = getOpenRowIds(state);
          if (openIds.length === 0) return false;
          const open = new Set(openIds);
          const first = getDisplayedRows(table, features).find((row) =>
            open.has(row.id),
          );
          if (first !== undefined) {
            return scrollToRow({ rowId: first.id, align });
          }
          // Nothing left in the scrolling order, which does not mean nothing
          // is visible: an entry row is sticky under the header, and a pinned
          // row is parked at an edge - `scrollToRow` answers for that one.
          return openIds.some(
            (rowId) =>
              state.newRows.some((newRow) => newRow.tempId === rowId) ||
              scrollToRow({ rowId, align }),
          );
        },
      },
      Controls: EDIT_ACTIONS_CONTROLS,
    });
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <EditOpenRowsNote />
      <EditSaveButton />
      <EditDiscardButton />
    </Group>
  );
}
