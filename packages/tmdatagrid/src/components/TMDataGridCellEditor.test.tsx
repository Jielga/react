import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "../../test/gridHarness";
import { TMDataGrid } from "./TMDataGrid";
import {
  createTMDataGridColumnHelper,
  TMDataGridStringEditor,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
  type TMDataGridEditingOptions,
  type TMDataGridEditorComponent,
  type UseTMDataGridOptions,
} from "../index";

/**
 * The built-in typed editors, opened and driven the way a user does it -
 * through the grid, not the components in isolation. Each editor's one
 * distinctive behaviour is the thing under test: what it writes back, and
 * when it commits. The string editor's open/commit/cancel/seed flows live in
 * TMDataGrid.test.tsx's "cell editing".
 */
type Task = {
  id: number;
  done: boolean;
  due: Date | null;
  dueIso: string;
  status: string;
  tags: Array<string>;
};

const helper = createTMDataGridColumnHelper<Task>();

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
const taskColumns = helper.columns([
  helper.accessor("done", {
    header: "Done",
    meta: { type: "boolean" },
    cell: (info) => (info.getValue() ? "yes" : "no"),
  }),
  helper.accessor("due", { header: "Due", meta: { type: "date" } }),
  helper.accessor("dueIso", { header: "Due ISO", meta: { type: "date" } }),
  helper.accessor("status", {
    header: "Status",
    meta: { type: "select", options: ["Pending", "Paid", "Overdue"] },
  }),
  helper.accessor("tags", {
    header: "Tags",
    meta: { type: "multiSelect", options: ["red", "blue", "green"] },
  }),
]);

const tasks: Array<Task> = [
  {
    id: 1,
    done: false,
    due: new Date(2026, 7, 1), // 2026-08-01 local
    dueIso: "2026-08-01",
    status: "Pending",
    tags: ["red"],
  },
];

type Commit = TMDataGridEditCommitArgs<Task>;

/** `editing` is partial here: the tests override members of the default. */
type EditorGridProps = Omit<Partial<UseTMDataGridOptions<Task>>, "editing"> & {
  editing?: Partial<TMDataGridEditingOptions<Task>>;
};

function EditorGrid({ editing, ...options }: EditorGridProps) {
  const grid = useTMDataGrid<Task>({
    data: tasks,
    columns: taskColumns,
    getRowId: (row) => String(row.id),
    editing: { mode: "cell", ...editing },
    selectionMode: "highlight",
    ...options,
  } as UseTMDataGridOptions<Task>);
  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Table<Task> />
    </TMDataGrid>
  );
}

/** By the published coordinates - the way a consumer's test would. */
function cell(container: HTMLElement, columnId: string) {
  const found = container.querySelector<HTMLElement>(
    `[role="gridcell"][data-row-id="1"][data-column-id="${columnId}"]`,
  );
  if (found === null) throw new Error(`no cell for column "${columnId}"`);
  return found;
}

function renderEditorGrid() {
  const commits: Array<Commit> = [];
  const rendered = renderWithMantine(
    <EditorGrid
      editing={{ onCommit: (args) => void commits.push(args as Commit) }}
    />,
  );
  return { ...rendered, commits };
}

describe("the boolean editor", () => {
  it("edits through a checkbox and writes a boolean back", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "done"));
    const box = screen.getByRole("checkbox", { name: "Edit Done" });
    await user.click(box);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes).toEqual([
      { columnId: "done", field: "done", previous: false, next: true },
    ]);
  });
});

describe("the date editor", () => {
  it("keeps writing Dates to a cell that held a Date", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "due"));
    const input = screen.getByLabelText("Edit Due");
    // The native date input presents the Date's local day.
    expect(input).toHaveValue("2026-08-01");
    fireEvent.change(input, { target: { value: "2026-08-20" } });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    const next = commits[0]?.changes[0]?.next;
    if (!(next instanceof Date)) throw new Error("expected a Date back");
    expect(next.toLocaleDateString("sv-SE")).toBe("2026-08-20");
  });

  it("keeps writing strings to a cell that held an ISO string", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "dueIso"));
    fireEvent.change(screen.getByLabelText("Edit Due ISO"), {
      target: { value: "2026-08-20" },
    });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes).toEqual([
      {
        columnId: "dueIso",
        field: "dueIso",
        previous: "2026-08-01",
        next: "2026-08-20",
      },
    ]);
  });

  it("writes null for a cleared date, whichever shape the cell held", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "due"));
    fireEvent.change(screen.getByLabelText("Edit Due"), {
      target: { value: "" },
    });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe(null);
  });
});

describe("the select editor", () => {
  it("commits on pick under cell mode - the pick is the edit", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "status"));
    await user.click(screen.getByRole("combobox", { name: "Edit Status" }));
    await user.click(await screen.findByRole("option", { name: "Paid" }));

    // No Enter - picking committed and closed the editor.
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes).toEqual([
      { columnId: "status", field: "status", previous: "Pending", next: "Paid" },
    ]);
    expect(
      screen.queryByRole("combobox", { name: "Edit Status" }),
    ).not.toBeInTheDocument();
  });
});

describe("the multiSelect editor", () => {
  it("builds the set across picks and only commits on Enter", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderEditorGrid();

    await user.dblClick(cell(container, "tags"));
    const input = screen.getByRole("combobox", { name: "Edit Tags" });
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "blue" }));
    await user.click(await screen.findByRole("option", { name: "green" }));

    // Building a set takes several picks; none of them is the commit.
    expect(commits.length).toBe(0);

    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toEqual(["red", "blue", "green"]);
  });
});

/**
 * Mantine's NumberInput reports a number once one can be parsed and the raw
 * text while it cannot - "" for an emptied box, "-" on the way to a negative
 * number. What is tested here is the editor's answer to that text: the field
 * holds nothing, and the text stays on screen so the user can finish it.
 */
describe("the number editor", () => {
  type Reading = { id: number; celsius: number };

  const readingColumns = (() => {
    const helper = createTMDataGridColumnHelper<Reading>();
    return helper.columns([
      helper.accessor("celsius", {
        header: "Celsius",
        meta: { type: "number" },
      }),
    ]);
  })();

  const readings: Array<Reading> = [{ id: 1, celsius: 12 }];

  type ReadingCommit = TMDataGridEditCommitArgs<Reading>;

  function renderReadingGrid() {
    const commits: Array<ReadingCommit> = [];
    function ReadingGrid() {
      const grid = useTMDataGrid<Reading>({
        data: readings,
        columns: readingColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          onCommit: (args) => void commits.push(args as ReadingCommit),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Reading>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<Reading> />
        </TMDataGrid>
      );
    }
    const { container } = renderWithMantine(<ReadingGrid />);
    return { container, commits };
  }

  async function openCelsius() {
    const user = userEvent.setup();
    const { container, commits } = renderReadingGrid();
    await user.dblClick(cell(container, "celsius"));
    return { user, commits, input: screen.getByLabelText("Edit Celsius") };
  }

  it("keeps a half-typed number on screen and writes null, never NaN", async () => {
    const { user, commits, input } = await openCelsius();

    fireEvent.change(input, { target: { value: "-" } });

    // NaN is a number to every validator and would commit as one, with no
    // message a user could act on - so the field holds nothing while the text
    // it cannot parse stays in the box.
    expect(input).toHaveValue("-");

    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes).toEqual([
      { columnId: "celsius", field: "celsius", previous: 12, next: null },
    ]);
  });

  it("writes the number as soon as the typing makes one", async () => {
    const { user, commits, input } = await openCelsius();

    fireEvent.change(input, { target: { value: "-" } });
    fireEvent.change(input, { target: { value: "-5" } });

    expect(input).toHaveValue("-5");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe(-5);
  });

  it("writes null for a box the user emptied", async () => {
    const { user, commits, input } = await openCelsius();

    fireEvent.change(input, { target: { value: "" } });

    expect(input).toHaveValue("");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe(null);
  });
});

/**
 * `meta.edit.mapValue` sits in the editor host rather than in any one editor,
 * so these drive it through the same gestures a user has: typing, the
 * type-to-edit seed, and a custom editor that knows nothing about it.
 */
describe("mapping the value on its way in", () => {
  type Code = { id: number; code: string; slots: number };

  const upperColumns = (() => {
    const helper = createTMDataGridColumnHelper<Code>();
    return helper.columns([
      helper.accessor("code", {
        header: "Code",
        meta: {
          edit: {
            mapValue: ({ value }) =>
              typeof value === "string" ? value.toUpperCase() : value,
          },
        },
      }),
      helper.accessor("slots", {
        header: "Slots",
        meta: {
          type: "number",
          edit: {
            mapValue: ({ value }) =>
              typeof value === "number" ? Math.min(value, 10) : value,
          },
        },
      }),
    ]);
  })();

  const codeRows: Array<Code> = [{ id: 1, code: "ab", slots: 2 }];

  type CodeCommit = TMDataGridEditCommitArgs<Code>;

  function renderCodeGrid(
    columns: typeof upperColumns = upperColumns,
  ): { container: HTMLElement; commits: Array<CodeCommit> } {
    const commits: Array<CodeCommit> = [];
    function CodeGrid() {
      const grid = useTMDataGrid<Code>({
        data: codeRows,
        columns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          onCommit: (args) => void commits.push(args as CodeCommit),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Code>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<Code> />
        </TMDataGrid>
      );
    }
    const { container } = renderWithMantine(<CodeGrid />);
    return { container, commits };
  }

  /** By the published coordinates, as the tests above do. */
  function codeCell(container: HTMLElement, columnId: string): HTMLElement {
    const found = container.querySelector<HTMLElement>(
      `[role="gridcell"][data-row-id="1"][data-column-id="${columnId}"]`,
    );
    if (found === null) throw new Error(`no cell for column "${columnId}"`);
    return found;
  }

  it("maps every keystroke, and commits what it mapped", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderCodeGrid();

    await user.dblClick(codeCell(container, "code"));
    const input = screen.getByLabelText("Edit Code") as HTMLInputElement;
    await user.keyboard("xy");

    expect(input.value).toBe("XY");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes).toEqual([
      { columnId: "code", field: "code", previous: "ab", next: "XY" },
    ]);
  });

  it("maps the character that typing opened the editor with", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderCodeGrid();

    // The seed is written by the grid, not by the editor, and would arrive
    // unmapped if the host did not write it through the same path.
    await user.click(codeCell(container, "code"));
    await user.keyboard("q");

    const input = screen.getByLabelText("Edit Code") as HTMLInputElement;
    expect(input.value).toBe("Q");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe("Q");
  });

  it("leaves the value alone at open, so a pristine cell stays pristine", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderCodeGrid();
    const cellElement = codeCell(container, "code");

    await user.dblClick(cellElement);
    const input = screen.getByLabelText("Edit Code") as HTMLInputElement;

    // Stored lowercase and untouched: mapping here would dirty a row nobody
    // edited, and would eat the select-all that makes typing replace.
    expect(input.value).toBe("ab");
    expect(cellElement).not.toHaveAttribute("data-dirty");

    await user.keyboard("z");
    expect(input.value).toBe("Z");
    await user.keyboard("{Escape}");
    expect(commits.length).toBe(0);
  });

  it("keeps the caret where it was typed", async () => {
    const user = userEvent.setup();
    const { container } = renderCodeGrid();

    await user.dblClick(codeCell(container, "code"));
    const input = screen.getByLabelText("Edit Code") as HTMLInputElement;
    await user.keyboard("xy");

    // A mapped value differs from what the input holds, so React reassigns it
    // and the browser would otherwise drop the caret at the end.
    input.setSelectionRange(0, 0);
    await user.keyboard("z");
    expect(input.value).toBe("ZXY");
    expect(input.selectionStart).toBe(1);

    await user.keyboard("w");
    expect(input.value).toBe("ZWXY");
  });

  it("maps a number editor's writes too", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderCodeGrid();

    await user.dblClick(codeCell(container, "slots"));
    const input = screen.getByLabelText("Edit Slots");
    fireEvent.change(input, { target: { value: "42" } });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe(10);
  });

  it("maps what a custom editor writes, without the editor knowing", async () => {
    const user = userEvent.setup();
    const helper = createTMDataGridColumnHelper<Code>();
    const customColumns = helper.columns([
      helper.accessor("code", {
        header: "Code",
        meta: {
          edit: {
            editor: ({ field }) => (
              <input
                aria-label="Bare Code"
                value={typeof field.state.value === "string" ? field.state.value : ""}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            ),
            mapValue: ({ value }) =>
              typeof value === "string" ? value.toUpperCase() : value,
          },
        },
      }),
      helper.accessor("slots", { header: "Slots", meta: { type: "number" } }),
    ]);
    const { container, commits } = renderCodeGrid(customColumns);

    await user.dblClick(codeCell(container, "code"));
    const input = screen.getByLabelText("Bare Code") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "zz");

    expect(input.value).toBe("ZZ");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe("ZZ");
  });

  it("validates what the map produced, not what was typed", async () => {
    const user = userEvent.setup();
    const helper = createTMDataGridColumnHelper<Code>();
    const validatedColumns = helper.columns([
      helper.accessor("code", {
        header: "Code",
        meta: {
          edit: {
            mapValue: ({ value }) =>
              typeof value === "string" ? value.toUpperCase() : value,
            // Passes only for the mapped value: a validator that ran on the
            // raw keystrokes would reject every one of them.
            validate: ({ value }: { value: string }) =>
              value === value.toUpperCase() ? undefined : "Must be upper case",
          },
        },
      }),
      helper.accessor("slots", { header: "Slots", meta: { type: "number" } }),
    ]);
    const { container, commits } = renderCodeGrid(validatedColumns);

    await user.dblClick(codeCell(container, "code"));
    await user.keyboard("xy{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe("XY");
  });

  it("does not map the empty value Delete writes", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderCodeGrid();

    // Clearing writes the type's empty value through the form, not through an
    // editor: there is no user input to map.
    await user.click(codeCell(container, "code"));
    await user.keyboard("{Delete}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe("");
  });
});

/**
 * `inputProps` hands a consumer the built-in's Mantine control without
 * handing over the binding: what it adds renders, its handlers run beside the
 * grid's, and the props the grid owns keep working. The select editor's
 * dropdown placement needs a real portal, which `env="test"` renders inline,
 * so playwright/docs/extended-editors.spec.ts covers it.
 */
describe("extending a built-in editor with inputProps", () => {
  type Ticket = { id: number; code: string };

  const focused: Array<string> = [];
  const blurred: Array<string> = [];
  const consumerRef: { current: HTMLInputElement | null } = { current: null };

  const CodeEditor: TMDataGridEditorComponent = (args) => (
    <TMDataGridStringEditor
      {...args}
      inputProps={{
        leftSection: <span data-testid="code-prefix">#</span>,
        onFocus: () => void focused.push("code"),
        onBlur: () => void blurred.push("code"),
        ref: consumerRef,
        "data-testid": "code-input",
        // The grid's part wins: it is set after the spread.
        "data-dg-part": "mine",
      }}
    />
  );

  const ticketColumns = (() => {
    const helper = createTMDataGridColumnHelper<Ticket>();
    return helper.columns([
      helper.accessor("code", {
        header: "Code",
        meta: {
          edit: {
            editor: CodeEditor,
            mapValue: ({ value }) =>
              typeof value === "string" ? value.toUpperCase() : value,
          },
        },
      }),
    ]);
  })();

  const tickets: Array<Ticket> = [{ id: 1, code: "ab" }];

  type TicketCommit = TMDataGridEditCommitArgs<Ticket>;

  function renderTicketGrid(): {
    container: HTMLElement;
    commits: Array<TicketCommit>;
  } {
    const commits: Array<TicketCommit> = [];
    function TicketGrid() {
      const grid = useTMDataGrid<Ticket>({
        data: tickets,
        columns: ticketColumns,
        getRowId: (row) => String(row.id),
        editing: {
          mode: "cell",
          onCommit: (args) => void commits.push(args as TicketCommit),
        },
        selectionMode: "highlight",
      } as UseTMDataGridOptions<Ticket>);
      return (
        <TMDataGrid {...grid}>
          <TMDataGrid.Table<Ticket> />
        </TMDataGrid>
      );
    }
    const { container } = renderWithMantine(<TicketGrid />);
    return { container, commits };
  }

  function ticketCell(container: HTMLElement, columnId: string): HTMLElement {
    const found = container.querySelector<HTMLElement>(
      `[role="gridcell"][data-row-id="1"][data-column-id="${columnId}"]`,
    );
    if (found === null) throw new Error(`no cell for column "${columnId}"`);
    return found;
  }

  it("renders what inputProps adds, and still edits and commits", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderTicketGrid();

    await user.dblClick(ticketCell(container, "code"));
    expect(screen.getByTestId("code-prefix")).toBeInTheDocument();
    const input = screen.getByLabelText("Edit Code") as HTMLInputElement;
    expect(input).toHaveAttribute("data-dg-part", "editor-input");
    await user.keyboard("xy{Enter}");

    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe("XY");
  });

  it("runs the consumer's onFocus and onBlur after the grid's own", async () => {
    const user = userEvent.setup();
    focused.length = 0;
    blurred.length = 0;
    const { container } = renderTicketGrid();

    await user.dblClick(ticketCell(container, "code"));
    const input = screen.getByLabelText("Edit Code") as HTMLInputElement;
    // The grid's select-all ran, so typing replaces the value.
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(focused).toEqual(["code"]);

    // Tab and Enter close the editor before the focus moves, so no blur fires
    // there; focus leaving the grid is the blur a consumer sees.
    fireEvent.blur(input);
    expect(blurred).toEqual(["code"]);
  });

  it("hands the input to the consumer's ref and keeps the grid's own", async () => {
    const user = userEvent.setup();
    const { container, commits } = renderTicketGrid();

    await user.dblClick(ticketCell(container, "code"));
    const input = screen.getByTestId("code-input") as HTMLInputElement;
    expect(consumerRef.current).toBe(input);
    expect(input).toHaveAttribute("data-dg-part", "editor-input");

    // The grid's ref still reaches the input: the column's mapValue rewrites
    // what was typed, and the caret stays where it was typed.
    await user.keyboard("xy");
    input.setSelectionRange(0, 0);
    await user.keyboard("z");
    expect(input).toHaveValue("ZXY");
    expect(input.selectionStart).toBe(1);

    await user.keyboard("{Enter}");
    await waitFor(() => expect(commits.length).toBe(1));
    expect(commits[0]?.changes[0]?.next).toBe("ZXY");
  });
});
