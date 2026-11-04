import type { ReactNode } from "react";
import { useState } from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  bodyRows,
  cellAt,
  countScrolls,
  gridRowCount,
  part,
  parts,
  queryPart,
  renderedRowIds,
  renderWithMantine,
} from "../../test/gridHarness";
import type { TMDataGridDraftActionsSlotArgs } from "./TMDataGridDraftActions";
import type {
  TMDataGridEditorComponent,
  TMDataGridTableValidateArgs,
  TMDataGridTableValidators,
} from "../core/editEngine";
import { TMDataGrid } from "./TMDataGrid";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridEditingOptions,
  type UseTMDataGridOptions,
} from "../useTMDataGrid";

type UserEvent = ReturnType<typeof userEvent.setup>;

/**
 * Cell, row and draft editing through the real grid. Split from
 * TMDataGrid.test.tsx for worker parallelism; the shared scaffolding lives
 * in the harness. The typed editors' own behaviour is in
 * TMDataGridCellEditor.test.tsx.
 */
describe("cell editing", () => {
  type Employee = { id: number; name: string; age: number; note: string };

  const editRows: Employee[] = [
    { id: 1, name: "Anna", age: 34, note: "a" },
    { id: 2, name: "Erik", age: 41, note: "b" },
  ];

  /** The same rows with row two out - a stable identity, for the remount. */

  const editColumns = (() => {
    const helper = createTMDataGridColumnHelper<Employee>();
    return helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { edit: { validate: z.string().min(2, "Too short") } },
      }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
      helper.accessor("note", {
        header: "Note",
        meta: { edit: { enabled: false } },
      }),
    ]);
  })();

  /** `editing` is partial here: the tests override members of the default. */
  type EditGridProps = Omit<
    Partial<UseTMDataGridOptions<Employee>>,
    "editing"
  > & { editing?: Partial<TMDataGridEditingOptions<Employee>> };

  function EditGrid({ editing, ...options }: EditGridProps = {}) {
    const grid = useTMDataGrid<Employee>({
      data: editRows,
      columns: editColumns,
      getRowId: (row) => String(row.id),
      editing: { mode: "cell", ...editing },
      selectionMode: "highlight",
      ...options,
    } as UseTMDataGridOptions<Employee>);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    );
  }

  // This grid has no checkbox lane, so its columns start at cell 0:
  // [Name, Age, Note].
  const editorInput = () =>
    screen.getByRole("textbox", { name: "Edit Name" });

  it("opens on double-click, commits on Enter with the diff", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Annika");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { rowId: string; changes: unknown[] };
    expect(commit.rowId).toBe("1");
    expect(commit.changes).toEqual([
      { columnId: "name", field: "name", previous: "Anna", next: "Annika" },
    ]);
    // The editor is gone; the cell shows content again (still the old data -
    // the grid never mutates `data`).
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
  });

  it("opens on F2 from the focused cell and reverts on Escape", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    await user.click(cellAt(0, 0));
    await user.keyboard("{F2}");
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Wrong");
    await user.keyboard("{Escape}");

    expect(commits.length).toBe(0);
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
    // Focus is back on the cell, ready for the next key.
    expect(document.activeElement).toBe(cellAt(0, 0));
  });

  it("opens seeded when a character is typed on the cell", async () => {
    const user = userEvent.setup();
    renderWithMantine(<EditGrid />);

    await user.click(cellAt(0, 0));
    await user.keyboard("Z");

    // The seed replaced the value - the Sheets gesture.
    expect(editorInput()).toHaveValue("Z");
  });

  it("renders meta.edit.editor as a component, hooks included", async () => {
    // A stateful custom editor - legal exactly because the grid renders it
    // as JSX instead of calling it.
    const StampEditor: TMDataGridEditorComponent = ({ field }) => {
      const [touches, setTouches] = useState(0);
      return (
        <div>
          <span data-testid="touch-count">{touches}</span>
          <input
            aria-label="Stamp name"
            value={String(field.state.value ?? "")}
            onChange={(event) => {
              setTouches((count) => count + 1);
              field.handleChange(event.currentTarget.value);
            }}
          />
        </div>
      );
    };
    const helper = createTMDataGridColumnHelper<Employee>();
    const customColumns = helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { edit: { editor: StampEditor } },
      }),
    ]);

    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        columns={customColumns}
        editing={{ onCommit: (args) => void commits.push(args) }}
      />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = screen.getByRole("textbox", { name: "Stamp name" });
    await user.clear(input);
    await user.type(input, "Ann");
    // The editor's own state survived every keystroke - it is a component.
    expect(screen.getByTestId("touch-count").textContent).not.toBe("0");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { changes: Array<{ next: unknown }> };
    expect(commit.changes[0]?.next).toBe("Ann");
  });

  it("blocks the commit on a field error and shows the message", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "A");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Too short")).toBeInTheDocument();
    // In the editor's tooltip, not as text under the input: an inline message
    // wraps inside a narrow column, grows the row and is clipped. The input
    // keeps the invalid state and nothing else.
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Too short");
    expect(editorInput()).toHaveAttribute("aria-invalid", "true");
    expect(cellAt(0, 0).querySelector(".mantine-InputWrapper-error")).toBeNull();
    expect(commits.length).toBe(0);
    // Still editing - the invalid cell holds the edit.
    expect(editorInput()).toBeInTheDocument();
  });

  it("keeps an invalid editor open when focus leaves the cell", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    await user.dblClick(cellAt(0, 0));
    await user.clear(editorInput());
    await user.type(editorInput(), "A");
    // Leaving the cell commits under `"cell"` - but a refused commit is not a
    // decision, so the editor stays, invalid, rather than closing on a value
    // the cell would then show as if it had landed.
    await user.click(cellAt(1, 1));

    expect(commits.length).toBe(0);
    expect(editorInput()).toBeInTheDocument();
    expect(editorInput()).toHaveAttribute("aria-invalid", "true");

    // Fixed and left again: this time the commit lands and the editor closes.
    await user.clear(editorInput());
    await user.type(editorInput(), "Annika");
    await user.click(cellAt(1, 1));

    await waitFor(() => expect(commits.length).toBe(1));
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
  });

  it("blocks the commit on an editing.tableValidators rule and shows the message", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editing={{
          onCommit: (args) => void commits.push(args),
          tableValidators: {
            onSubmit: ({ value, rowId, rows }) =>
              rows.some(
                (row) => row.rowId !== rowId && row.value.name === value.name,
              )
                ? { fields: { name: "Duplicate name" } }
                : undefined,
          },
        }}
      />,
    );

    // Row two, typed into the name row one already carries: a clash only a
    // rule reading the other rows can see.
    await user.dblClick(cellAt(1, 0));
    const input = within(bodyRows()[1]!).getByRole("textbox", {
      name: "Edit Name",
    });
    await user.clear(input);
    await user.type(input, "Anna");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Duplicate name")).toBeInTheDocument();
    expect(commits).toEqual([]);
    // Still editing - the refused cell holds the edit.
    expect(input).toBeInTheDocument();
    expect(cellAt(1, 0)).toHaveAttribute("data-invalid", "true");
  });

  it("commits on Tab and moves to the next editable cell", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    await user.dblClick(cellAt(0, 0));
    await user.clear(editorInput());
    await user.type(editorInput(), "Annika");
    await user.keyboard("{Tab}");

    await waitFor(() => expect(commits.length).toBe(1));
    // Age is next; Note is `edit.enabled: false` and is skipped from Age.
    await waitFor(() =>
      expect(document.activeElement).toBe(cellAt(0, 1)),
    );
  });

  it("never opens on a column that opted out", async () => {
    const user = userEvent.setup();
    renderWithMantine(<EditGrid />);

    await user.dblClick(cellAt(0, 2));

    expect(
      screen.queryByRole("textbox", { name: "Edit Note" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the draft on blur under cellConfirm, saving only through the check", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editing={{
          mode: "cellConfirm",
          onCommit: (args) => void commits.push(args),
        }}
      />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Annika");
    // Click away: the editor closes but the draft stays, dirty-marked.
    await user.click(cellAt(1, 1));
    expect(commits.length).toBe(0);
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
    expect(cellAt(0, 0)).toHaveAttribute("data-dirty", "true");
    // The kept draft is what the cell shows - `data` still says "Anna".
    expect(cellAt(0, 0)).toHaveTextContent("Annika");

    // Reopen and confirm through the ✓.
    await user.dblClick(cellAt(0, 0));
    expect(editorInput()).toHaveValue("Annika");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(commits.length).toBe(1));
  });

  it("walks the ✓ and ✕ before Tab leaves a cellConfirm editor", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editing={{
          mode: "cellConfirm",
          onCommit: (args) => void commits.push(args),
        }}
      />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.type(input, "x");

    // The ✓ and ✕ beside the input are the cell's own form: Tab reaches them
    // before it moves on, and Shift+Tab comes back the same way.
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Save" }),
    );
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Save" }),
    );
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(input);

    // Past the ✕ the editor closes with the draft kept, nothing committed.
    await user.tab();
    await user.tab();
    await user.tab();
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
    expect(commits.length).toBe(0);
    expect(cellAt(0, 0)).toHaveAttribute("data-dirty", "true");
  });

  it("row mode opens every editable cell from the pencil and saves them as one commit", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editing={{ mode: "row", onCommit: (args) => void commits.push(args) }}
      />,
    );

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }),
    );

    // Name and Age both open; Note (edit.enabled: false) does not.
    const name = screen.getByRole("textbox", { name: "Edit Name" });
    expect(screen.getByRole("textbox", { name: "Edit Age" })).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Edit Note" }),
    ).not.toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "Annika");
    const age = screen.getByRole("textbox", { name: "Edit Age" });
    await user.clear(age);
    await user.type(age, "35");

    await user.click(screen.getByRole("button", { name: "Save row" }));

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { changes: Array<{ field: string }> };
    expect(commit.changes.map((change) => change.field).sort()).toEqual([
      "age",
      "name",
    ]);
  });

  it("row mode edits a second row alongside a dirty first one", async () => {
    const user = userEvent.setup();
    const commits: Array<{ rowId: string }> = [];
    renderWithMantine(
      <EditGrid
        editing={{
          mode: "row",
          onCommit: (args) => void commits.push(args as { rowId: string }),
        }}
      />,
    );

    // Row one, opened from a cell and dirtied.
    await user.dblClick(cellAt(0, 0));
    const firstName = within(bodyRows()[0]!).getByRole("textbox", {
      name: "Edit Name",
    });
    await user.clear(firstName);
    await user.type(firstName, "Annika");

    // Row two, from a cell too. Nothing about row one refuses it, and row one
    // is neither saved nor discarded to make room.
    await user.dblClick(cellAt(1, 0));

    expect(parts("save-row")).toHaveLength(2);
    expect(commits.length).toBe(0);
    expect(firstName).toHaveValue("Annika");
    const secondName = within(bodyRows()[1]!).getByRole("textbox", {
      name: "Edit Name",
    });
    await user.clear(secondName);
    await user.type(secondName, "Erika");

    // Each row saves on its own: row two's ✓ commits row two and leaves row
    // one open with its draft.
    await user.click(
      within(bodyRows()[1]!).getByRole("button", { name: "Save row" }),
    );
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.rowId).toBe("2");
    expect(
      within(bodyRows()[1]!).queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
    expect(
      within(bodyRows()[0]!).getByRole("textbox", { name: "Edit Name" }),
    ).toHaveValue("Annika");

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Save row" }),
    );
    await waitFor(() => expect(commits.length).toBe(2));
    expect(commits[1]?.rowId).toBe("1");
  });

  it("row mode puts the caret in the cell the gesture named, not on the cell", async () => {
    const user = userEvent.setup();
    renderWithMantine(<EditGrid editing={{ mode: "row", onCommit: () => {} }} />);

    // The whole row opens, and Age - the cell double-clicked - holds the
    // caret. The focused-cell ring lands on the same cell, so it has nothing
    // to pull the caret back to.
    await user.dblClick(cellAt(0, 1));
    expect(screen.getByRole("textbox", { name: "Edit Name" })).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Edit Age" }),
    );

    // The pencil names no column, so the row's first editable cell takes it.
    await user.click(within(bodyRows()[1]!).getByRole("button", { name: "Edit row" }));
    expect(document.activeElement).toBe(
      within(bodyRows()[1]!).getByRole("textbox", { name: "Edit Name" }),
    );
    // And opening row two did not move row one's caret out of its editor.
    expect(parts("save-row")).toHaveLength(2);
  });

  it("places the caret from the keyboard's open gestures too", async () => {
    const user = userEvent.setup();
    renderWithMantine(<EditGrid editing={{ mode: "row", onCommit: () => {} }} />);

    // Enter on the cell cursor's cell, not the row's first.
    await user.click(cellAt(0, 1));
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Edit Age" }),
    );

    // F2 on a second row, same rule - and the first row stays open.
    await user.click(cellAt(1, 0));
    await user.keyboard("{F2}");
    expect(document.activeElement).toBe(
      within(bodyRows()[1]!).getByRole("textbox", { name: "Edit Name" }),
    );
    expect(parts("save-row")).toHaveLength(2);
  });

  it("row mode walks the open row with Tab, lane included", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <EditGrid editing={{ mode: "row", onCommit: () => {} }} />,
    );

    const rowOne = () => bodyRows()[0]!;
    await user.click(cellAt(0, 0));
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      within(rowOne()).getByRole("textbox", { name: "Edit Name" }),
    );

    // An open row is a form: its editors first, in column order, then the
    // lane's two buttons. Note is not editable, so it holds no stop.
    await user.tab();
    expect(document.activeElement).toBe(
      within(rowOne()).getByRole("textbox", { name: "Edit Age" }),
    );

    await user.tab();
    expect(document.activeElement).toBe(
      within(rowOne()).getByRole("button", { name: "Save row" }),
    );

    await user.tab();
    expect(document.activeElement).toBe(
      within(rowOne()).getByRole("button", { name: "Cancel edit" }),
    );

    // Past the last control the cursor moves on to the next row's first cell.
    // The row it left is still open - Tab walked out of it, it did not decide
    // anything - and the row it arrived at is not opened.
    await user.tab();
    expect(document.activeElement).toBe(cellAt(1, 0));
    expect(parts("save-row")).toHaveLength(1);
    expect(queryPart("save-row", { rowId: "1" })).toBeInTheDocument();
  });

  it("row mode leaves the body backwards from the first row's first editor", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <EditGrid editing={{ mode: "row", onCommit: () => {} }} />,
    );

    await user.click(cellAt(0, 0));
    await user.keyboard("{Enter}");
    await user.tab({ shift: true });

    // No row before this one, so the walk ends the way Tab from a cell does.
    expect(
      (document.activeElement as HTMLElement).closest('[data-dg-part="row"]'),
    ).toBeNull();
  });

  it("places the caret in a custom editor that never asks for focus", async () => {
    const user = userEvent.setup();

    /**
     * A `meta.edit.editor` has no focus prop to honour and no reason to focus
     * itself. The grid places the caret, so this one gets it anyway. No
     * `editor-input` either: the first focusable element inside is the target.
     */
    const BareEditor: TMDataGridEditorComponent = ({ field }) => (
      <input
        aria-label="Bare Age"
        value={typeof field.state.value === "number" ? field.state.value : 0}
        onChange={(event) => field.handleChange(Number(event.target.value))}
      />
    );
    const bareColumns = (() => {
      const helper = createTMDataGridColumnHelper<Employee>();
      return helper.columns([
        helper.accessor("name", { header: "Name" }),
        helper.accessor("age", {
          header: "Age",
          meta: { type: "number", edit: { editor: BareEditor } },
        }),
      ]);
    })();

    function BareGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: bareColumns,
        getRowId: (row) => String(row.id),
        editing: { mode: "row", onCommit: () => {} },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }

    renderWithMantine(<BareGrid />);
    await user.dblClick(cellAt(0, 1));

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Bare Age" }),
    );
  });

  it("row mode keeps the caret when another open row remounts", async () => {
    const user = userEvent.setup();

    /**
     * Row two leaves the row model and comes back - a filter, a page, or the
     * virtualizer scrolling it away, which is the same unmount. Its draft
     * lives outside the DOM, so its editors remount over the same form.
     */
    function RemountingGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: { mode: "row", onCommit: () => {} },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      // A column filter takes row two out of the row model and brings it
      // back without touching `data`. A record that leaves `data` is gone
      // for good and takes its draft with it - see forgetMissingRows.
      const toggle = () => {
        const column = grid.table.getColumn("name")!;
        column.setFilterValue(
          column.getFilterValue() === undefined
            ? { operator: "contains", value: editRows[0]!.name }
            : undefined,
        );
      };
      return (
        <>
          <button type="button" onClick={toggle}>
            Toggle row two
          </button>
          <TMDataGrid {...grid}>
            <TMDataGrid.Table<Employee> />
          </TMDataGrid>
        </>
      );
    }

    renderWithMantine(<RemountingGrid />);
    const toggle = screen.getByRole("button", { name: "Toggle row two" });

    // Two rows open, then the caret moved by hand into the first row's Age -
    // the second row is still the one `active` names.
    await user.click(within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }));
    await user.click(within(bodyRows()[1]!).getByRole("button", { name: "Edit row" }));
    const firstAge = within(bodyRows()[0]!).getByRole("textbox", {
      name: "Edit Age",
    });
    await user.click(firstAge);
    expect(document.activeElement).toBe(firstAge);

    // Row two out and back. Its editors remount, and the caret stays put -
    // the row was focused once, when it opened. `fireEvent` rather than
    // `user.click`, which would focus the button: the real trigger is the
    // virtualizer, and it does not touch the focus either.
    fireEvent.click(toggle);
    expect(parts("save-row")).toHaveLength(1);
    fireEvent.click(toggle);
    expect(parts("save-row")).toHaveLength(2);
    expect(document.activeElement).toBe(
      within(bodyRows()[0]!).getByRole("textbox", { name: "Edit Age" }),
    );
  });

  it("row mode cancels the whole row from the lane", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editing={{ mode: "row", onCommit: (args) => void commits.push(args) }}
      />,
    );

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }),
    );
    const name = screen.getByRole("textbox", { name: "Edit Name" });
    await user.clear(name);
    await user.type(name, "Thrown away");
    await user.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(commits.length).toBe(0);
    expect(
      screen.queryByRole("textbox", { name: "Edit Name" }),
    ).not.toBeInTheDocument();
  });

  it("blocks a row save on a cross-field refine, message on the Save", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid
        editing={{
          mode: "row",
          rowValidators: {
            onSubmit: z
              .object({ name: z.string(), age: z.number() })
              .refine((row) => row.age < 100, { message: "Nobody is that old" }),
          },
          onCommit: (args) => void commits.push(args),
        }}
      />,
    );

    await user.click(
      within(bodyRows()[0]!).getByRole("button", { name: "Edit row" }),
    );
    const age = screen.getByRole("textbox", { name: "Edit Age" });
    await user.clear(age);
    await user.type(age, "120");
    await user.click(screen.getByRole("button", { name: "Save row" }));

    expect(commits.length).toBe(0);
    // Still editing, and the pathless message rides the Save's tooltip.
    expect(screen.getByRole("textbox", { name: "Edit Age" })).toBeInTheDocument();
    await user.hover(screen.getByRole("button", { name: "Save row" }));
    expect(await screen.findByText("Nobody is that old")).toBeInTheDocument();
  });

  /** Columns with no rules of their own - the row rule is the only one. */
  const plainColumns = (() => {
    const helper = createTMDataGridColumnHelper<Employee>();
    return helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]);
  })();

  /**
   * Row mode with an add button and one row rule. `path` is where the rule's
   * issue lands: nowhere, so it is the row's, or on `age`, so it is the
   * cell's as well. The defaults already break the rule, so the ✓ is the
   * whole gesture.
   */
  function EntryRuleGrid({
    path,
    onRowAdd,
  }: {
    path?: ["age"];
    onRowAdd: (args: unknown) => void;
  }) {
    const grid = useTMDataGrid<Employee>({
      data: editRows,
      columns: plainColumns,
      getRowId: (row) => String(row.id),
      editing: {
        mode: "row",
        rowValidators: {
          onSubmit: z
            .object({ name: z.string(), age: z.number() })
            .refine((row) => row.age < 100, {
              message: "Nobody is that old",
              path,
            }),
        },
        newRowDefaults: () => ({ id: 0, name: "Ny", age: 120, note: "" }),
        onRowAdd,
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

  it("blocks an entry row on a row rule, message on the ✓", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    renderWithMantine(
      <EntryRuleGrid onRowAdd={(args) => void adds.push(args)} />,
    );

    await user.click(screen.getByRole("button", { name: "add" }));
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    expect(adds.length).toBe(0);
    // Still an entry row - a refused add is not a decision - and the
    // pathless message rides the ✓'s tooltip, as it rides the Save's.
    expect(part("entry-row", { rowId: "__new__1" })).not.toHaveAttribute("data-committed");
    await user.hover(part("confirm-new-row", { rowId: "__new__1" }));
    expect(await screen.findByText("Nobody is that old")).toBeInTheDocument();
  });

  it("marks the entry cell a pathed row rule names", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    renderWithMantine(
      <EntryRuleGrid path={["age"]} onRowAdd={(args) => void adds.push(args)} />,
    );

    await user.click(screen.getByRole("button", { name: "add" }));
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    expect(adds.length).toBe(0);
    // The cell is marked, as a body cell would be, and the ✓ says why.
    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(entryRow.querySelector('[data-column-id="age"]')).toHaveAttribute(
      "data-invalid",
      "true",
    );
    await user.hover(part("confirm-new-row", { rowId: "__new__1" }));
    expect(
      (await screen.findAllByText("Nobody is that old")).length,
    ).toBeGreaterThan(0);
  });

  /**
   * A grid with the draft store on: the toolbar's Save and Discard, plus an
   * add button for the entry block - `addRow` has no chrome of its own. The
   * gesture is the other axis, so it is a prop; `"cell"` is what these tests
   * mostly drive, and the mode matrix covers the rest.
   */
  function DraftGrid({
    mode = "cell",
    columns = editColumns,
    onCommit,
    onSaveDrafts,
    onRowAdd,
    onRowDelete,
    newRowDefaults,
    newRowsSticky,
    tableValidators,
    renderActions,
    onReady,
  }: {
    mode?: "cell" | "cellConfirm" | "row";
    columns?: UseTMDataGridOptions<Employee>["columns"];
    onCommit?: (args: unknown) => void;
    onSaveDrafts?: (args: unknown) => void;
    onRowAdd?: (args: unknown) => void;
    onRowDelete?: () => void;
    newRowDefaults?: () => Employee;
    newRowsSticky?: boolean;
    tableValidators?: TMDataGridTableValidators<Employee>;
    renderActions?: (args: TMDataGridDraftActionsSlotArgs) => ReactNode;
    /** The api, for the tests that sort or read the engine directly. */
    onReady?: (api: TMDataGridApi<Employee>) => void;
  }) {
    const grid = useTMDataGrid<Employee>({
      data: editRows,
      columns,
      getRowId: (row) => String(row.id),
      editing: {
        mode,
        draft: true,
        onCommit,
        onSaveDrafts,
        onRowAdd,
        onRowDelete,
        newRowDefaults,
        newRowsSticky,
        tableValidators,
      },
      selectionMode: "highlight",
    } as UseTMDataGridOptions<Employee>);
    onReady?.(grid);
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Toolbar>
          <button type="button" onClick={() => grid.edit.addRow()}>
            add
          </button>
          <TMDataGrid.DraftActions renderActions={renderActions} />
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Employee> />
      </TMDataGrid>
    );
  }

  /** Name through a renderer of its own - what a parked draft renders with. */
  const starColumns = (() => {
    const helper = createTMDataGridColumnHelper<Employee>();
    return helper.columns([
      helper.accessor("name", {
        header: "Name",
        cell: ({ getValue }) => `*${String(getValue())}*`,
      }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]);
  })();

  const entryDefaults = (): Employee => ({ id: 0, name: "", age: 20, note: "" });

  /** Opens an entry row and types a name into it, stopping short of the ✓. */
  async function typeIntoEntryRow(user: UserEvent, name: string) {
    await user.click(screen.getByRole("button", { name: "add" }));
    await user.type(
      within(part("entry-row", { rowId: "__new__1" })).getByRole("textbox", {
        name: "Edit Name",
      }),
      name,
    );
  }

  /**
   * Cells an entry row never opens: an age through a renderer of its own with
   * editing switched off, and a display column holding a button.
   */
  const plainCellColumns = (() => {
    const helper = createTMDataGridColumnHelper<Employee>();
    return helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", {
        header: "Age",
        meta: { type: "number", edit: { enabled: false } },
        cell: ({ getValue }) => "age " + String(getValue()),
      }),
      helper.display({
        id: "use",
        header: "Use",
        cell: ({ row }) => (
          <button type="button">{"Use " + row.original.name}</button>
        ),
      }),
    ]);
  })();

  it("renders the cells an entry row does not open through their own renderers", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <DraftGrid
        mode="row"
        columns={plainCellColumns}
        newRowDefaults={entryDefaults}
      />,
    );
    const entryRow = () => part("entry-row", { rowId: "__new__1" });

    // Open: the editable cell holds an editor, the other two their content
    // over the seed - as a body row in row mode shows them.
    await user.click(screen.getByRole("button", { name: "add" }));
    expect(
      within(entryRow()).getByRole("textbox", { name: "Edit Name" }),
    ).toBeInTheDocument();
    expect(
      within(entryRow()).queryByRole("textbox", { name: "Edit Age" }),
    ).toBeNull();
    expect(within(entryRow()).getByText("age 20")).toBeInTheDocument();
    expect(
      within(entryRow()).getByRole("button", { name: "Use" }),
    ).toBeInTheDocument();

    // The cells outside the editors follow the form as it is typed.
    await user.type(
      within(entryRow()).getByRole("textbox", { name: "Edit Name" }),
      "Ny Person",
    );
    expect(
      within(entryRow()).getByRole("button", { name: "Use Ny Person" }),
    ).toBeInTheDocument();
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    // Committed into the body, then reopened where it is double-clicked:
    // back in the entry block, over the committed values, and the cells that
    // take no editor still show and still follow the form.
    const bodyRow = part("row", { rowId: "__new__1" });
    await user.dblClick(bodyRow.querySelector('[data-column-id="name"]')!);
    expect(entryRow()).not.toHaveAttribute("data-committed");
    expect(
      within(entryRow()).getByRole("textbox", { name: "Edit Name" }),
    ).toHaveValue("Ny Person");
    expect(within(entryRow()).getByText("age 20")).toBeInTheDocument();
    expect(
      within(entryRow()).getByRole("button", { name: "Use Ny Person" }),
    ).toBeInTheDocument();
    await user.type(
      within(entryRow()).getByRole("textbox", { name: "Edit Name" }),
      " Berg",
    );
    expect(
      within(entryRow()).getByRole("button", { name: "Use Ny Person Berg" }),
    ).toBeInTheDocument();
  });

  it("marks a parked draft with data-draft and clears it on save", async () => {
    const user = userEvent.setup();
    renderWithMantine(<DraftGrid onCommit={() => {}} />);

    // Row attributes are present only while they apply.
    const row = () => part("row", { rowId: "1" });
    expect(row()).not.toHaveAttribute("data-draft");

    await user.dblClick(cellAt(0, 0));
    await user.clear(screen.getByRole("textbox", { name: "Edit Name" }));
    await user.type(screen.getByRole("textbox", { name: "Edit Name" }), "Annika");
    // Leaving the cell decides the row under `"cell"`: dirty, and parked.
    await user.click(cellAt(1, 1));
    expect(row()).toHaveAttribute("data-dirty", "true");
    expect(row()).toHaveAttribute("data-draft", "true");

    await user.click(screen.getByRole("button", { name: "Save 1 row" }));
    await waitFor(() =>
      expect(row()).not.toHaveAttribute("data-draft"),
    );
  });

  it("parks drafts on Enter and saves them through DraftActions", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <DraftGrid onCommit={(args) => void commits.push(args)} />,
    );

    // Two rows edited; Enter parks each draft instead of committing.
    await user.dblClick(cellAt(0, 1));
    const nameInput = () => screen.getByRole("textbox", { name: "Edit Name" });
    const ageInput = () => screen.getByRole("textbox", { name: "Edit Age" });
    await user.clear(ageInput());
    await user.type(ageInput(), "35");
    await user.keyboard("{Enter}");
    await user.dblClick(cellAt(1, 0));
    await user.clear(nameInput());
    await user.type(nameInput(), "Erik B");
    await user.keyboard("{Enter}");

    expect(commits.length).toBe(0);
    expect(cellAt(0, 1)).toHaveAttribute("data-dirty", "true");
    expect(cellAt(1, 0)).toHaveAttribute("data-dirty", "true");

    await user.click(screen.getByRole("button", { name: "Save 2 rows" }));

    await waitFor(() => expect(commits.length).toBe(2));
    expect(screen.getByRole("button", { name: "Save 0 rows" })).toBeDisabled();
  });

  it("DraftActions' Discard drops every draft", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <DraftGrid onCommit={(args) => void commits.push(args)} />,
    );

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Draft");
    await user.keyboard("{Enter}");
    expect(cellAt(0, 0)).toHaveAttribute("data-dirty", "true");

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(commits.length).toBe(0);
    expect(cellAt(0, 0)).not.toHaveAttribute("data-dirty");
  });

  it("shows a parked draft through the column's own renderer, marked in the lane", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <DraftGrid
        columns={starColumns}
        onCommit={(args) => void commits.push(args)}
        onRowDelete={() => {}}
      />,
    );

    // Clean: `data` through the renderer, and the lane offers the trash.
    expect(cellAt(0, 0)).toHaveTextContent("*Anna*");
    expect(queryPart("delete-row", { rowId: "1" })).toBeInTheDocument();

    await user.dblClick(cellAt(0, 0));
    const input = editorInput();
    await user.clear(input);
    await user.type(input, "Annika");
    await user.keyboard("{Enter}");

    // The draft renders through the same `cell` the committed value does.
    expect(commits.length).toBe(0);
    expect(cellAt(0, 0)).toHaveTextContent("*Annika*");
    expect(bodyRows()[0]).toHaveAttribute("data-dirty", "true");

    // The lane is the marker and the revert - no per-row save, and the trash
    // stands down until the row is clean again.
    const marker = part("row-state", { rowId: "1" });
    expect(marker).toHaveAttribute("data-state", "edited");
    expect(marker).toHaveAttribute("aria-label", "Edited row");
    expect(part("revert-row", { rowId: "1" })).toHaveAttribute(
      "aria-label",
      "Revert changes",
    );
    expect(queryPart("save-row", { rowId: "1" })).not.toBeInTheDocument();
    expect(queryPart("cancel-row", { rowId: "1" })).not.toBeInTheDocument();
    expect(queryPart("delete-row", { rowId: "1" })).not.toBeInTheDocument();
  });

  it("reverts one row's draft from the lane", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <DraftGrid
        columns={starColumns}
        onCommit={(args) => void commits.push(args)}
        onRowDelete={() => {}}
      />,
    );

    await user.dblClick(cellAt(0, 0));
    await user.clear(editorInput());
    await user.type(editorInput(), "Annika");
    await user.keyboard("{Enter}");
    expect(cellAt(0, 0)).toHaveTextContent("*Annika*");

    await user.click(part("revert-row", { rowId: "1" }));

    expect(commits.length).toBe(0);
    expect(cellAt(0, 0)).toHaveTextContent("*Anna*");
    expect(bodyRows()[0]).not.toHaveAttribute("data-dirty");
    expect(queryPart("row-state", { rowId: "1" })).not.toBeInTheDocument();
    expect(queryPart("delete-row", { rowId: "1" })).toBeInTheDocument();
  });

  it("confirms an entry row into a body row of its own", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    renderWithMantine(
      <DraftGrid
        onRowAdd={(args) => void adds.push(args)}
        newRowDefaults={entryDefaults}
      />,
    );

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    // Entered, awaiting Save all: a body row like any other, marked new and
    // held in the draft store.
    const row = part("row", { rowId: "__new__1" });
    expect(row).toHaveAttribute("data-new", "true");
    expect(row).toHaveAttribute("data-draft", "true");
    expect(within(row).queryByRole("textbox")).not.toBeInTheDocument();
    expect(row).toHaveTextContent("Ny Person");
    expect(adds.length).toBe(0);
    expect(part("row-state", { rowId: "__new__1" })).toHaveAttribute(
      "data-state",
      "new",
    );
    // Nothing is open, so the entry block is gone with it.
    expect(queryPart("entry-row", { rowId: "__new__1" })).toBeNull();
    expect(document.querySelector("[data-dg-entry-block]")).toBeNull();
  });

  it("reopens a committed entry row only from a cell that takes an edit", async () => {
    const user = userEvent.setup();
    const helper = createTMDataGridColumnHelper<Employee>();
    const columns = helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor((row) => row.age * 2, {
        id: "doubleAge",
        header: "Double age",
        meta: { edit: { enabled: false } },
      }),
    ]);
    renderWithMantine(
      <DraftGrid columns={columns} newRowDefaults={entryDefaults} />,
    );

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));
    const bodyRow = () => part("row", { rowId: "__new__1" });
    expect(bodyRow()).toHaveAttribute("data-new", "true");

    // The computed column takes no edit, so its cell answers nothing - the
    // same as a body cell of that column.
    await user.dblClick(
      bodyRow().querySelector('[data-column-id="doubleAge"]')!,
    );
    expect(bodyRow()).toHaveAttribute("data-new", "true");
    expect(within(bodyRow()).queryByRole("textbox")).not.toBeInTheDocument();

    // The editable one reopens the row - back into the entry block, where it
    // was typed.
    await user.dblClick(bodyRow().querySelector('[data-column-id="name"]')!);
    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(entryRow).not.toHaveAttribute("data-committed");
    expect(entryRow.closest("[data-dg-entry-block]")).not.toBeNull();
    expect(
      within(entryRow).getByRole("textbox", { name: "Edit Name" }),
    ).toBeInTheDocument();
  });

  it("confirms an entry row on Enter inside its editor", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    renderWithMantine(
      <DraftGrid
        onRowAdd={(args) => void adds.push(args)}
        newRowDefaults={entryDefaults}
      />,
    );

    // Enter in the entry block confirms the entry - it does not park a cell
    // the way Enter in a body row does.
    await typeIntoEntryRow(user, "Ny Person");
    await user.keyboard("{Enter}");

    const row = part("row", { rowId: "__new__1" });
    expect(row).toHaveAttribute("data-new", "true");
    expect(within(row).queryByRole("textbox")).not.toBeInTheDocument();
    expect(row).toHaveTextContent("Ny Person");
    expect(adds.length).toBe(0);
  });

  it("counts an open entry row as reached without scrolling to it", async () => {
    const user = userEvent.setup();
    let slot: TMDataGridDraftActionsSlotArgs | null = null;
    renderWithMantine(
      <DraftGrid
        newRowDefaults={entryDefaults}
        renderActions={(args) => {
          slot = args;
          return null;
        }}
      />,
    );

    await typeIntoEntryRow(user, "Ny Person");

    const args = slot as unknown as TMDataGridDraftActionsSlotArgs;
    expect(args.state.openRowIds).toEqual(["__new__1"]);

    // The entry block is sticky under the header, so the row is on screen
    // already - and it is not in the virtualized order to scroll to anyway.
    let answer: boolean | null = null;
    expect(
      countScrolls(() => {
        answer = args.actions.scrollToFirstOpenRow();
      }),
    ).toBe(0);
    expect(answer).toBe(true);
  });

  it("does not let an open entry row hide an open body row", async () => {
    const user = userEvent.setup();
    let slot: TMDataGridDraftActionsSlotArgs | null = null;
    renderWithMantine(
      <DraftGrid
        mode="row"
        newRowDefaults={entryDefaults}
        renderActions={(args) => {
          slot = args;
          return null;
        }}
      />,
    );

    await typeIntoEntryRow(user, "Ny Person");
    await user.dblClick(cellAt(1, 0));
    // Scoped to the body row: the open entry row has an "Edit Name" too.
    await user.type(
      within(part("row", { rowId: "2" })).getByRole("textbox", {
        name: "Edit Name",
      }),
      " Berg",
    );

    const args = slot as unknown as TMDataGridDraftActionsSlotArgs;
    expect(args.state.openRowIds).toEqual(["__new__1", "2"]);

    // The entry row is first in the engine's order and answers true on its
    // own; the body row is what the user cannot see, so it wins.
    let answer: boolean | null = null;
    expect(
      countScrolls(() => {
        answer = args.actions.scrollToFirstOpenRow();
      }),
    ).toBe(1);
    expect(answer).toBe(true);
  });

  it("keeps a confirmed entry row sticky when newRowsSticky is set", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <DraftGrid newRowDefaults={entryDefaults} newRowsSticky />,
    );

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(entryRow).toHaveAttribute("data-committed", "true");
    expect(entryRow.closest("[data-dg-entry-block]")).not.toBeNull();
    // Held out of the body: the table never sees the row.
    expect(queryPart("row", { rowId: "__new__1" })).toBeNull();
  });

  it("re-opens a confirmed entry row from the lane's pencil", async () => {
    const user = userEvent.setup();
    renderWithMantine(<DraftGrid newRowDefaults={entryDefaults} />);

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    await user.click(part("edit-row", { rowId: "__new__1" }));

    // The editors come back over a form built from the committed values, so
    // the row reads exactly as it was left.
    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(entryRow).not.toHaveAttribute("data-committed");
    expect(
      within(entryRow).getByRole("textbox", { name: "Edit Name" }),
    ).toHaveValue("Ny Person");
    expect(queryPart("row-state", { rowId: "__new__1" })).not.toBeInTheDocument();
  });

  it("discards a confirmed entry row from the lane", async () => {
    const user = userEvent.setup();
    renderWithMantine(<DraftGrid newRowDefaults={entryDefaults} />);

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    await user.click(part("discard-new-row", { rowId: "__new__1" }));

    expect(queryPart("row", { rowId: "__new__1" })).not.toBeInTheDocument();
    expect(queryPart("entry-row", { rowId: "__new__1" })).not.toBeInTheDocument();
  });

  /** A draft grid whose api the test holds, for the sorts and the reads. */
  function renderDraftGrid(props: Parameters<typeof DraftGrid>[0] = {}) {
    let api: TMDataGridApi<Employee> | null = null;
    renderWithMantine(<DraftGrid {...props} onReady={(next) => (api = next)} />);
    if (api === null) throw new Error("grid never rendered");
    return api as TMDataGridApi<Employee>;
  }

  /** Parks a draft in the name cell of the row showing at `rowIndex`. */
  async function parkName(user: UserEvent, rowIndex: number, name: string) {
    await user.dblClick(cellAt(rowIndex, 0));
    await user.clear(editorInput());
    await user.type(editorInput(), name);
    await user.keyboard("{Enter}");
  }

  it("re-sorts a row on its parked draft, and puts it back on revert", async () => {
    const user = userEvent.setup();
    const api = renderDraftGrid({ onCommit: () => {}, onRowDelete: () => {} });

    act(() => {
      api.table.setSorting([{ id: "name", desc: false }]);
    });
    expect(renderedRowIds()).toEqual(["1", "2"]);

    // The sort reads the draft, so parking one moves the row it belongs to.
    await parkName(user, 0, "Zeb");

    await waitFor(() => expect(renderedRowIds()).toEqual(["2", "1"]));

    await user.click(part("revert-row", { rowId: "1" }));

    expect(renderedRowIds()).toEqual(["1", "2"]);
  });

  it("keeps a reopened row in its place until it commits again", async () => {
    const user = userEvent.setup();
    const api = renderDraftGrid({ onCommit: () => {}, onRowDelete: () => {} });

    act(() => {
      api.table.setSorting([{ id: "name", desc: false }]);
    });
    await parkName(user, 0, "Zeb");
    await waitFor(() => expect(renderedRowIds()).toEqual(["2", "1"]));
    const placed = part("row", { rowId: "1" }).getAttribute("aria-rowindex");

    // Reopening takes the row out of the draft store, but not out of its
    // place: the snapshot the sort reads outlives the reopen.
    await user.dblClick(cellAt(1, 1));
    expect(
      screen.getByRole("textbox", { name: "Edit Age" }),
    ).toBeInTheDocument();
    expect(part("row", { rowId: "1" })).toHaveAttribute("aria-rowindex", placed);

    await user.clear(screen.getByRole("textbox", { name: "Edit Age" }));
    await user.type(screen.getByRole("textbox", { name: "Edit Age" }), "50");
    await user.keyboard("{Enter}");

    // Committed afresh, on values the name half of which never changed.
    expect(renderedRowIds()).toEqual(["2", "1"]);
    expect(part("row", { rowId: "1" })).toHaveAttribute("aria-rowindex", placed);
  });

  it("sorts a committed entry row in with the body", async () => {
    const user = userEvent.setup();
    const api = renderDraftGrid({ newRowDefaults: entryDefaults });

    act(() => {
      api.table.setSorting([{ id: "name", desc: false }]);
    });
    await typeIntoEntryRow(user, "Berit");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    expect(part("row", { rowId: "__new__1" })).toHaveAttribute(
      "data-new",
      "true",
    );
    // Anna, Berit, Erik: the entered row takes its place by its own values.
    expect(renderedRowIds()).toEqual(["1", "__new__1", "2"]);
  });

  it("counts a committed entry row as a row of the grid", async () => {
    const user = userEvent.setup();
    renderWithMantine(<DraftGrid newRowDefaults={entryDefaults} />);

    expect(gridRowCount()).toBe(2);
    await typeIntoEntryRow(user, "Ny Person");
    // Still being typed into: undecided, and no row of the table's yet.
    expect(gridRowCount()).toBe(2);

    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    expect(gridRowCount()).toBe(3);
  });

  it("leaves a committed entry row out of the count under newRowsSticky", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <DraftGrid newRowDefaults={entryDefaults} newRowsSticky />,
    );

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    // Held in the entry block, so the table never holds it.
    expect(gridRowCount()).toBe(2);
  });

  it("reports a committed entry row once, at the front, to getRows and the table rules", async () => {
    const user = userEvent.setup();
    const seen: Array<TMDataGridTableValidateArgs<Employee>> = [];
    const api = renderDraftGrid({
      newRowDefaults: entryDefaults,
      onCommit: () => {},
      tableValidators: {
        onSubmit: (args) => {
          seen.push(args);
          return undefined;
        },
      },
    });

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));

    // The core row model's order: the entered row ahead of `data`, and each
    // row exactly once - the entry pass no longer doubles it.
    const rows = api.edit.getRows();
    expect(rows.map((row) => row.rowId)).toEqual(["__new__1", "1", "2"]);
    expect(rows.filter((row) => row.isNew).map((row) => row.rowId)).toEqual([
      "__new__1",
    ]);

    // A body row committed afterwards is handed the same collection.
    await user.dblClick(cellAt(2, 0));
    await user.clear(editorInput());
    await user.type(editorInput(), "Erik B");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(seen.length).toBe(2));
    const ids = seen[1]!.rows.map((row) => row.rowId);
    expect(ids).toEqual(["__new__1", "1", "2"]);
  });

  it("never asks the consumer's getRowId about a draft or an entered row", async () => {
    const user = userEvent.setup();
    // The records the consumer handed over, and nothing else, may reach it.
    const own = new Set<object>(editRows);
    const getRowId = vi.fn((row: Employee) => {
      if (!own.has(row)) throw new Error("getRowId saw a record it never gave");
      if (row.id === undefined) throw new Error("getRowId saw a row with no id");
      return String(row.id);
    });
    let api: TMDataGridApi<Employee> | null = null;
    function IdGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId,
        editing: {
          mode: "cell",
          draft: true,
          onCommit: () => {},
          newRowDefaults: entryDefaults,
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      api = grid;
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
    renderWithMantine(<IdGrid />);
    if (api === null) throw new Error("grid never rendered");
    const grid = api as TMDataGridApi<Employee>;

    await typeIntoEntryRow(user, "Ny Person");
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));
    await parkName(user, 1, "Zeb");
    act(() => {
      grid.table.setSorting([{ id: "name", desc: false }]);
    });

    expect(getRowId).toHaveBeenCalled();
    // Both rows still answer under the ids they were given.
    expect(renderedRowIds()).toEqual(["2", "__new__1", "1"]);
  });

  it("adds rows through the entry block and reports them with edits and deletions in one save", async () => {
    const user = userEvent.setup();
    const saves: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          draft: true,
          onSaveDrafts: (args) => void saves.push(args),
          newRowDefaults: () => ({ id: 0, name: "", age: 20, note: "" }),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button type="button" onClick={() => grid.edit.addRow()}>
              add
            </button>
            <TMDataGrid.DraftActions />
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<EntryGrid />);

    // The entry block appears with open editors; type a name.
    await user.click(screen.getByRole("button", { name: "add" }));
    const entryRow = part("entry-row", { rowId: "__new__1" });
    const entryName = within(entryRow).getByRole("textbox", {
      name: "Edit Name",
    });
    await user.type(entryName, "Ny Person");
    // OK the entry: only committed rows are part of a save. The row joins the
    // body, so it is addressed by id from here on - it sits ahead of `data`.
    await user.click(part("confirm-new-row", { rowId: "__new__1" }));
    expect(part("row", { rowId: "__new__1" })).toHaveAttribute(
      "data-new",
      "true",
    );

    // Mark row 2 deleted through the lane; it renders struck through.
    const secondRow = () => part("row", { rowId: "2" });
    await user.click(
      within(secondRow()).getByRole("button", { name: "Delete row" }),
    );
    expect(secondRow()).toHaveAttribute("data-deleted", "true");
    expect(
      within(secondRow()).getByRole("button", { name: "Restore row" }),
    ).toBeInTheDocument();
    expect(part("row-state", { rowId: "2" })).toHaveAttribute(
      "data-state",
      "deleted",
    );

    // Save: the payload carries the add and the deletion together.
    await user.click(screen.getByRole("button", { name: "Save 2 rows" }));
    await waitFor(() => expect(saves.length).toBe(1));
    const saved = saves[0] as {
      updated: unknown[];
      created: Array<{ value: { name: string } }>;
      deleted: string[];
    };
    expect(saved.updated).toEqual([]);
    expect(saved.created.map((add) => add.value.name)).toEqual(["Ny Person"]);
    expect(saved.deleted).toEqual(["2"]);
    // The entered row is gone from the body and the mark is cleared.
    expect(queryPart("row", { rowId: "__new__1" })).not.toBeInTheDocument();
    expect(queryPart("entry-row", { rowId: "__new__1" })).not.toBeInTheDocument();
    expect(secondRow()).not.toHaveAttribute("data-deleted", "true");
  });

  it("leaves an entry row that was never OK'd out of the save, still open", async () => {
    const user = userEvent.setup();
    const saves: Array<{ created: unknown[]; deleted: string[] }> = [];
    renderWithMantine(
      <DraftGrid
        newRowDefaults={entryDefaults}
        onSaveDrafts={(args) => void saves.push(args as never)}
      />,
    );

    // One entry row typed into but not OK'd, and one deletion mark, which is
    // a decision the moment it is made.
    await user.click(screen.getByRole("button", { name: "add" }));
    await user.type(
      within(part("entry-row", { rowId: "__new__1" })).getByRole("textbox", {
        name: "Edit Name",
      }),
      "Halvfärdig",
    );
    await user.click(
      within(bodyRows()[1]!).getByRole("button", { name: "Delete row" }),
    );

    // Save counts the deletion only, and says the row is still being edited.
    expect(part("open-rows-note")).toHaveTextContent("1 row still being edited");
    await user.click(screen.getByRole("button", { name: "Save 1 row" }));
    await waitFor(() => expect(saves.length).toBe(1));
    expect(saves[0]?.created).toEqual([]);
    expect(saves[0]?.deleted).toEqual(["2"]);

    // The undecided row is untouched: still open, still holding what was
    // typed, ready to be finished.
    expect(part("entry-row", { rowId: "__new__1" })).not.toHaveAttribute("data-committed");
    expect(
      within(part("entry-row", { rowId: "__new__1" })).getByRole("textbox", {
        name: "Edit Name",
      }),
    ).toHaveValue("Halvfärdig");
  });

  it("adds immediately from the entry row's check outside draft", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          onRowAdd: (args) => void adds.push(args),
          // The lane needs a reason to exist outside row mode.
          onRowDelete: () => {},
          newRowDefaults: () => ({ id: 0, name: "Ny", age: 20, note: "" }),
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

    await user.click(screen.getByRole("button", { name: "add" }));
    const entryRow = part("entry-row", { rowId: "__new__1" });
    await user.click(
      within(entryRow).getByRole("button", { name: "Add row" }),
    );

    await waitFor(() => expect(adds.length).toBe(1));
    expect(adds[0]).toMatchObject({ value: { name: "Ny" } });
    expect(queryPart("entry-row", { rowId: "__new__1" })).not.toBeInTheDocument();
  });

  it("seeds the entry row's editors from addRow's argument", async () => {
    const user = userEvent.setup();
    const adds: unknown[] = [];
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          onRowAdd: (args) => void adds.push(args),
          onRowDelete: () => {},
          newRowDefaults: () => ({ id: 0, name: "Ny", age: 20, note: "" }),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Employee>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Toolbar>
            <button
              type="button"
              onClick={() => grid.edit.addRow({ name: "Kopia", age: 44 })}
            >
              add
            </button>
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<Employee> />
        </TMDataGrid>
      );
    }
    renderWithMantine(<EntryGrid />);

    await user.click(screen.getByRole("button", { name: "add" }));
    const entryRow = part("entry-row", { rowId: "__new__1" });
    // The editors open on the argument, not on newRowDefaults' "Ny".
    expect(
      within(entryRow).getByRole("textbox", { name: "Edit Name" }),
    ).toHaveValue("Kopia");
    expect(
      within(entryRow).getByRole("textbox", { name: "Edit Age" }),
    ).toHaveValue("44");

    await user.click(within(entryRow).getByRole("button", { name: "Add row" }));

    await waitFor(() => expect(adds.length).toBe(1));
    // What the argument left out still comes from newRowDefaults.
    expect(adds[0]).toMatchObject({
      value: { name: "Kopia", age: 44, note: "" },
    });
  });

  it("clears the cell on Delete and commits the empty value", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    // Age carries no rule, so clearing it commits the type's empty value.
    await user.click(cellAt(1, 1));
    await user.keyboard("{Delete}");

    await waitFor(() => expect(commits.length).toBe(1));
    const commit = commits[0] as { changes: unknown[] };
    expect(commit.changes).toEqual([
      { columnId: "age", field: "age", previous: 41, next: null },
    ]);
  });

  it("refuses Delete on a cell whose column rule rejects the empty value", async () => {
    const user = userEvent.setup();
    const commits: unknown[] = [];
    renderWithMantine(
      <EditGrid editing={{ onCommit: (args) => void commits.push(args) }} />,
    );

    // Name is `min(2)`. Delete opens no editor, so the column's validator
    // only runs because the engine runs it - the commit has to be refused
    // rather than writing "" past the rule.
    await user.click(cellAt(1, 0));
    await user.keyboard("{Delete}");

    await waitFor(() =>
      expect(cellAt(1, 0)).toHaveAttribute("data-invalid", "true"),
    );
    expect(commits).toEqual([]);
  });

  it("puts the caret in a new entry row's first editable cell", async () => {
    const user = userEvent.setup();
    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: editColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          newRowDefaults: () => ({ id: 0, name: "", age: 20, note: "" }),
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

    await user.click(screen.getByRole("button", { name: "add" }));

    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(document.activeElement).toBe(
      within(entryRow).getByRole("textbox", { name: "Edit Name" }),
    );
  });

  it("puts the caret in an entry row whose first editor is a custom one", async () => {
    const user = userEvent.setup();

    /** Focuses nothing itself, exactly like the body-row case above. */
    const BareEditor: TMDataGridEditorComponent = ({ field }) => (
      <input
        aria-label="Bare Name"
        value={typeof field.state.value === "string" ? field.state.value : ""}
        onChange={(event) => field.handleChange(event.target.value)}
      />
    );
    const bareColumns = (() => {
      const helper = createTMDataGridColumnHelper<Employee>();
      return helper.columns([
        helper.accessor("name", {
          header: "Name",
          meta: { edit: { editor: BareEditor } },
        }),
        helper.accessor("age", { header: "Age", meta: { type: "number" } }),
      ]);
    })();

    function EntryGrid() {
      const grid = useTMDataGrid<Employee>({
        data: editRows,
        columns: bareColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          newRowDefaults: () => ({ id: 0, name: "", age: 20, note: "" }),
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

    await user.click(screen.getByRole("button", { name: "add" }));

    const entryRow = part("entry-row", { rowId: "__new__1" });
    expect(document.activeElement).toBe(
      within(entryRow).getByRole("textbox", { name: "Bare Name" }),
    );
  });
});
