import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { cellAt, part, queryPart, renderWithMantine } from "../../test/gridHarness";
import { TMDataGrid } from "./TMDataGrid";
import type { TMDataGridEditMode } from "../core/editEngine";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";

type UserEvent = ReturnType<typeof userEvent.setup>;

/**
 * The two axes of `editing`, one gesture at a time.
 *
 * `mode` says what counts as a commit and `draft` says where that commit
 * goes, so the same four gestures are driven under every mode and asserted
 * twice: once with commits going out to `onCommit`, once with them parking in
 * the draft store. Every claim the mode table makes is a case in here - if a
 * gesture changes meaning, exactly one row of this matrix moves.
 */
describe("edit modes", () => {
  type Employee = { id: number; name: string; age: number };

  const editRows: Employee[] = [
    { id: 1, name: "Anna", age: 34 },
    { id: 2, name: "Erik", age: 41 },
  ];

  const columns = (() => {
    const helper = createTMDataGridColumnHelper<Employee>();
    return helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { edit: { validate: z.string().min(2, "Too short") } },
      }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]);
  })();

  function ModeGrid({
    mode,
    draft,
    onCommit,
  }: {
    mode: TMDataGridEditMode;
    draft: boolean;
    onCommit: (args: unknown) => void;
  }) {
    const grid = useTMDataGrid<Employee>({
      data: editRows,
      columns,
      getRowId: (row) => String(row.id),
      editing: { mode, draft, onCommit },
      selectionMode: "highlight",
    } as UseTMDataGridOptions<Employee>);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.DraftActions />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    );
  }

  const nameInput = () => screen.getByRole("textbox", { name: "Edit Name" });
  const noEditor = () =>
    screen.queryByRole("textbox", { name: "Edit Name" }) === null;
  const rowOne = () => part("row", { rowId: "1" });

  /** Opens row 1's Name cell and types a valid new value into it. */
  async function startEditing(user: UserEvent, value = "Annika") {
    await user.dblClick(cellAt(0, 0));
    await user.clear(nameInput());
    await user.type(nameInput(), value);
  }

  /** Focus out of the edit entirely - a click on another row's cell. */
  async function clickAway(user: UserEvent) {
    await user.click(cellAt(1, 1));
  }

  type Gesture = "enter" | "tab" | "blur" | "escape";

  const perform = async (user: UserEvent, gesture: Gesture, mode: TMDataGridEditMode) => {
    if (gesture === "blur") return clickAway(user);
    if (gesture === "tab") {
      // The confirming editor's ✓ and ✕ are its own form: Tab reaches them
      // first, and the gesture the table is about is the one past the ✕.
      const presses = mode === "cellConfirm" ? 3 : 1;
      for (let index = 0; index < presses; index += 1) await user.tab();
      return;
    }
    await user.keyboard(gesture === "enter" ? "{Enter}" : "{Escape}");
  };

  /** What a gesture did to the row, in the vocabulary of the mode table. */
  type Outcome =
    /** The row's form submitted: out to `onCommit`, or into the store. */
    | "commits"
    /** The editor closed, the row kept its draft, undecided. */
    | "keeps the draft"
    /** Nothing happened to the row; its editors are still up. */
    | "stays open"
    /** The draft is gone and the row is clean again. */
    | "cancels";

  const MATRIX: Array<{ mode: TMDataGridEditMode; expected: Record<Gesture, Outcome> }> = [
    {
      mode: "cell",
      expected: {
        enter: "commits",
        tab: "commits",
        blur: "commits",
        escape: "cancels",
      },
    },
    {
      mode: "cellConfirm",
      expected: {
        enter: "commits",
        // The confirming mode is the one place leaving a cell decides
        // nothing: the caret moves on and the draft waits for its check.
        tab: "keeps the draft",
        blur: "keeps the draft",
        escape: "cancels",
      },
    },
    {
      mode: "row",
      expected: {
        enter: "commits",
        // Row mode mounts every editable cell of the row, so Tab is the
        // browser's and blur is focus moving inside the same edit.
        tab: "stays open",
        blur: "stays open",
        escape: "cancels",
      },
    },
  ];

  for (const { mode, expected } of MATRIX) {
    for (const draft of [false, true]) {
      const where = draft ? "into the draft store" : "out to onCommit";

      for (const gesture of Object.keys(expected) as Array<Gesture>) {
        const outcome = expected[gesture];
        it(`${mode}, ${where}: ${gesture} ${outcome}`, async () => {
          const user = userEvent.setup();
          const onCommit = vi.fn();
          renderWithMantine(
            <ModeGrid mode={mode} draft={draft} onCommit={onCommit} />,
          );

          await startEditing(user);
          await perform(user, gesture, mode);

          if (outcome === "commits") {
            if (draft) {
              // Parked: nothing has left the grid, and Save counts the row.
              await waitFor(() =>
                expect(rowOne()).toHaveAttribute("data-draft", "true"),
              );
              expect(onCommit).not.toHaveBeenCalled();
              expect(
                screen.getByRole("button", { name: "Save 1 row" }),
              ).toBeEnabled();
              expect(queryPart("open-rows-note")).not.toBeInTheDocument();
            } else {
              await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
              expect(onCommit.mock.calls[0]?.[0]).toMatchObject({
                rowId: "1",
                changes: [
                  {
                    columnId: "name",
                    field: "name",
                    previous: "Anna",
                    next: "Annika",
                  },
                ],
              });
              // The form is gone: the grid never mutates `data`, so the cell
              // goes back to what `data` still says.
              expect(rowOne()).not.toHaveAttribute("data-dirty");
            }
            return;
          }

          expect(onCommit).not.toHaveBeenCalled();

          if (outcome === "cancels") {
            expect(rowOne()).not.toHaveAttribute("data-dirty");
            expect(rowOne()).not.toHaveAttribute("data-draft");
            expect(noEditor()).toBe(true);
            return;
          }

          // Undecided either way: the draft is held, and nothing is parked.
          expect(rowOne()).toHaveAttribute("data-dirty", "true");
          expect(rowOne()).not.toHaveAttribute("data-draft");
          if (draft) {
            expect(part("open-rows-note")).toHaveTextContent(
              "1 row still being edited",
            );
            expect(
              screen.getByRole("button", { name: "Save 0 rows" }),
            ).toBeDisabled();
          }
          // "stays open" keeps its editors; "keeps the draft" closed them.
          expect(noEditor()).toBe(outcome === "keeps the draft");
        });
      }
    }
  }

  it("parks a row mode row from the lane, and closes its editors", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    renderWithMantine(<ModeGrid mode="row" draft onCommit={onCommit} />);

    // Row mode opens every editable cell, so the lane's ✓ is the commit.
    await user.dblClick(cellAt(0, 0));
    expect(part("save-row", { rowId: "1" })).toBeInTheDocument();
    await user.clear(nameInput());
    await user.type(nameInput(), "Annika");
    await user.click(part("save-row", { rowId: "1" }));

    await waitFor(() =>
      expect(rowOne()).toHaveAttribute("data-draft", "true"),
    );
    // A committed row is decided, so it goes back to rendering values: its
    // form is gone and the row is the draft store's values.
    expect(noEditor()).toBe(true);
    expect(cellAt(0, 0)).toHaveTextContent("Annika");
    expect(part("row-state", { rowId: "1" })).toHaveAttribute(
      "data-state",
      "edited",
    );
    expect(queryPart("save-row", { rowId: "1" })).not.toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits an entry row from its check, never from leaving it", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const adds: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          onCommit,
          onRowAdd: (args) => void adds.push(args),
          // The lane is where the entry row's check lives, and outside row
          // mode the trash is what generates it.
          onRowDelete: () => {},
          newRowDefaults: () => ({ id: 0, name: "", age: 20 }),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button type="button" onClick={() => grid.edit.addRow()}>
              add
            </button>
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<EntryGrid />);

    // An entry row is row-shaped in every mode, so leaving it decides
    // nothing - clicking away used to add the half-typed row.
    await user.click(screen.getByRole("button", { name: "add" }));
    const entry = part("entry-row", { rowId: "__new__1" });
    await user.type(
      within(entry).getByRole("textbox", { name: "Edit Name" }),
      "Ny Person",
    );
    await user.click(cellAt(1, 1));

    expect(adds).toEqual([]);
    expect(part("entry-row", { rowId: "__new__1" })).toBeInTheDocument();

    // The Sheets sweep must skip it too: double-clicking a body cell opens
    // that cell's editor without deciding the entry row on the way.
    await user.dblClick(cellAt(1, 1));
    expect(part("editor", { rowId: "2", columnId: "age" })).toBeInTheDocument();
    expect(adds).toEqual([]);
    expect(part("entry-row", { rowId: "__new__1" })).toBeInTheDocument();

    // The check is the decision.
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));
    await waitFor(() => expect(adds.length).toBe(1));
  });

  it("keeps a row the edit left invalid open, still saying why", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    renderWithMantine(
      <ModeGrid mode="cell" draft onCommit={onCommit} />,
    );

    // "A" fails the column's `min(2)`, so the row cannot park.
    await startEditing(user, "A");
    expect(await screen.findByText("Too short")).toBeInTheDocument();
    await clickAway(user);

    expect(onCommit).not.toHaveBeenCalled();
    expect(rowOne()).not.toHaveAttribute("data-draft");
    expect(part("open-rows-note")).toHaveTextContent("1 row still being edited");
    // The editor stays - a refused commit is not a decision - and the message
    // with it: the cell is marked, and the lane's ✓ carries the text as well.
    expect(noEditor()).toBe(false);
    expect(cellAt(0, 0)).toHaveAttribute("data-invalid", "true");
    expect(part("save-row", { rowId: "1" })).toBeInTheDocument();
    await user.hover(part("save-row", { rowId: "1" }));
    expect(await screen.findByText("Too short")).toBeInTheDocument();

    // Fixing the value clears the mark - the fix is the answer to it.
    await startEditing(user, "Annika");
    await waitFor(() =>
      expect(cellAt(0, 0)).not.toHaveAttribute("data-invalid"),
    );
  });
});
