import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MantineWrapper } from "../../test/gridHarness";
import {
  clearedValueForType,
  firstErrorText,
  getEditFieldName,
  getOpenRowIds,
  hasPendingEdits,
  normalizeFieldValidate,
  type TMDataGridEditCommitArgs,
  type TMDataGridEditState,
  type TMDataGridTableValidateArgs,
  type TMDataGridTableValidators,
} from "./editEngine";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridEditingOptions,
  type TMDataGridRowData,
  type UseTMDataGridOptions,
} from "../index";

type Person = {
  id: number;
  name: string;
  age: number;
  address: { city: string };
};

const helper = createTMDataGridColumnHelper<Person>();

/** Module scope: `useTMDataGrid` memoizes on the columns reference. */
const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("age", { header: "Age", meta: { type: "number" } }),
  // A nested path: Form addresses fields by dot-path, so this edits
  // values.address.city with no extra machinery.
  helper.accessor("address.city", { header: "City", id: "city" }),
  // No accessorKey and no editField - not editable.
  helper.accessor((row) => `${row.name} (${String(row.age)})`, {
    id: "display",
    header: "Display",
  }),
  helper.accessor("name", {
    id: "readonlyName",
    header: "Locked",
    meta: { edit: { enabled: false } },
  }),
]);

const people: Array<Person> = [
  { id: 1, name: "Anna", age: 34, address: { city: "Stockholm" } },
  { id: 2, name: "Erik", age: 41, address: { city: "Malmö" } },
];

function renderEditGrid(
  editing: Partial<TMDataGridEditingOptions<Person>> = {},
) {
  const { result } = renderHook(
    () =>
      useTMDataGrid<Person>({
        data: people,
        columns,
        getRowId: (row) => String(row.id),
        editing: { mode: "cell", ...editing },
      } as UseTMDataGridOptions<Person>),
    { wrapper: MantineWrapper },
  );
  return result;
}

describe("getEditFieldName", () => {
  it("prefers meta.edit.field, falls back to accessorKey, refuses accessorFn", () => {
    expect(
      getEditFieldName({ columnDef: { meta: { edit: { field: "custom.path" } } } }),
    ).toBe("custom.path");
    expect(
      getEditFieldName({
        columnDef: { accessorKey: "address.city" } as never,
      }),
    ).toBe("address.city");
    expect(getEditFieldName({ columnDef: {} })).toBe(null);
  });
});

describe("normalizeFieldValidate", () => {
  it("lifts a bare schema or function into onChange", () => {
    const schema = z.string();
    expect(normalizeFieldValidate(schema)).toEqual({ onChange: schema });
    const fn = () => undefined;
    expect(normalizeFieldValidate(fn)).toEqual({ onChange: fn });
    expect(normalizeFieldValidate({ onBlur: schema })).toEqual({
      onBlur: schema,
    });
    expect(normalizeFieldValidate(undefined)).toBe(undefined);
  });
});

describe("clearedValueForType", () => {
  it("empties by type", () => {
    expect(clearedValueForType("string")).toBe("");
    expect(clearedValueForType("multiSelect")).toEqual([]);
    expect(clearedValueForType("boolean")).toBe(false);
    expect(clearedValueForType("number")).toBe(null);
    expect(clearedValueForType("date")).toBe(null);
  });
});

describe("getOpenRowIds", () => {
  /** A projection with only the field the predicate reads. */
  const projection = (dirtyFields: Array<string>) => ({
    dirtyFields,
    errorFields: [],
    errorMessages: [],
    hasRowError: false,
    isSubmitting: false,
    values: {},
  });

  const state = (
    over: Partial<TMDataGridEditState> = {},
  ): TMDataGridEditState => ({
    active: null,
    openRowIds: [],
    rows: {},
    committedRowIds: [],
    committedValues: {},
    newRows: [],
    deletedRowIds: [],
    isSaving: false,
    ...over,
  });

  it("counts a row with values typed in, and skips one merely opened", () => {
    expect(
      getOpenRowIds(
        state({
          openRowIds: ["1", "2"],
          rows: { 1: projection(["name"]), 2: projection([]) },
        }),
      ),
    ).toEqual(["1"]);
  });

  it("skips a row parked in the draft store, values or not", () => {
    expect(
      getOpenRowIds(
        state({
          openRowIds: ["1"],
          rows: { 1: projection(["name"]) },
          committedRowIds: ["1"],
        }),
      ),
    ).toEqual([]);
  });

  it("skips a projection with no form behind it", () => {
    // `rows` outlives nothing: a row is only open while `openRowIds` says so.
    expect(getOpenRowIds(state({ rows: { 1: projection(["name"]) } }))).toEqual(
      [],
    );
  });

  it("counts an entry row whatever it holds, until it is committed", () => {
    const entered = state({
      openRowIds: ["__new__1"],
      newRows: [{ tempId: "__new__1", committed: false }],
    });

    expect(getOpenRowIds(entered)).toEqual(["__new__1"]);
    expect(
      getOpenRowIds({
        ...entered,
        newRows: [{ tempId: "__new__1", committed: true }],
      }),
    ).toEqual([]);
  });

  it("keeps the engine's order - the order the forms were opened", () => {
    expect(
      getOpenRowIds(
        state({
          openRowIds: ["8", "3"],
          rows: { 8: projection(["name"]), 3: projection(["name"]) },
        }),
      ),
    ).toEqual(["8", "3"]);
  });
});

describe("edit engine", () => {
  it("opens a form on begin, keyed by row id", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });

    expect(edit.state.active).toEqual({ rowId: "1", columnId: "name" });
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.getForm("1")?.state.values).toEqual(people[0]);
  });

  it("refuses to open on a column that cannot edit", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "display" });
    edit.begin({ rowId: "1", columnId: "readonlyName" });

    expect(edit.state.active).toBe(null);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("projects dirty fields as values diverge, and keeps the draft with no editor mounted", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    edit.getForm("1")?.setFieldValue("name", "Annika");
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);

    // The virtualization claim, tested directly: closing the editor (a
    // scroll-away unmounts it) leaves the form and its draft in place.
    edit.deactivate();
    expect(edit.state.active).toBe(null);
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
  });

  it("projects the row as drafted, so a cell can render the draft", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    expect(edit.state.rows["1"]?.values).toEqual(people[0]);

    edit.getForm("1")?.setFieldValue("name", "Annika");

    expect(edit.state.rows["1"]?.values["name"]).toBe("Annika");
    // The form's own values object, which is what makes the projection
    // reference-stable across meta-only form events.
    expect(edit.state.rows["1"]?.values).toBe(edit.getForm("1")?.state.values);
  });

  it("commits through onCommit with the per-field diff, then drops the form", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "city" });

    edit.getForm("1")?.setFieldValue("address.city", "Uppsala");
    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onCommit).toHaveBeenCalledTimes(1);
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.rowId).toBe("1");
    expect(args.source).toBe("cell");
    expect(args.original).toEqual(people[0]);
    expect(args.value.address.city).toBe("Uppsala");
    expect(args.changes).toEqual([
      {
        columnId: "city",
        field: "address.city",
        previous: "Stockholm",
        next: "Uppsala",
      },
    ]);
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.active).toBe(null);
  });

  it("drops a pristine form on commit without calling the consumer", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("keeps the form open when the consumer rejects, with the error on the row", async () => {
    const grid = renderEditGrid({
      onCommit: () => Promise.reject(new Error("server said no")),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
    // The draft is intact - a slow or failing save never flickers back.
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
  });

  it("blocks the commit on a real Zod row schema, pathed issues onto fields", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({
      onCommit,
      rowValidators: {
        onSubmit: z.object({
          name: z.string().min(2, "Too short"),
          age: z.number(),
        }),
      },
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "A");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.errorFields).toContain("name");

    // Fixing the value lets the same commit through.
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("commits the row being left when cell mode begins on another row", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    edit.begin({ rowId: "2", columnId: "name" });
    // begin's implicit commit is async; give it a microtask.
    await vi.waitFor(() => {
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(edit.state.openRowIds).toEqual(["2"]);
      expect(edit.state.active).toEqual({ rowId: "2", columnId: "name" });
    });
  });

  it("accumulates drafts across rows under cellConfirm", () => {
    const grid = renderEditGrid({ mode: "cellConfirm" });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });

    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
  });

  it("row mode opens a second row alongside a dirty first one", () => {
    const grid = renderEditGrid({ mode: "row" });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: null });
    expect(edit.state.active).toEqual({ rowId: "1", columnId: null });

    // A dirty row is not a reason to refuse the next one, and not a reason to
    // discard it either: each row's save is its own.
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: null });

    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    expect(edit.state.active).toEqual({ rowId: "2", columnId: null });
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
  });

  it("row mode commits and cancels one open row without touching the others", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", onCommit });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: null });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: null });
    edit.getForm("2")?.setFieldValue("name", "Erik B");
    expect(edit.state.openRowIds).toEqual(["1", "2"]);

    // Row 2's Save is row 2's alone: one commit, and row 1's draft intact.
    await expect(edit.commit("2")).resolves.toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const committed = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(committed.rowId).toBe("2");
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");

    // And row 1's Cancel drops only row 1.
    edit.cancel("1");
    expect(edit.state.openRowIds).toEqual([]);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("the draft store parks a commit: validated, kept, and no consumer call", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(true);

    // Nothing reaches the consumer until saveDrafts; the row stays in the
    // grid, dirty, as data rather than as a form, and the editor it was made
    // in closes.
    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
    expect(edit.state.committedValues["1"]?.name).toBe("Annika");
    expect(edit.getForm("1")).toBeUndefined();
    expect(edit.state.active).toBe(null);
  });

  it("a parked commit still validates, and a failing one keeps its errors", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit,
      rowValidators: {
        onSubmit: z.object({
          name: z.string().min(2, "Too short"),
          age: z.number(),
        }),
      },
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "A");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.errorFields).toContain("name");
  });

  it("drops a pristine row under draft too, without a consumer call", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });

    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("every mode but draft reports a commit to the consumer", async () => {
    // The regression guard for the park: parking is draft's policy alone.
    for (const mode of ["cell", "cellConfirm", "row"] as const) {
      const onCommit = vi.fn();
      const grid = renderEditGrid({ mode, onCommit });
      const { edit } = grid.current;
      edit.begin({ rowId: "1", columnId: "name" });
      edit.getForm("1")?.setFieldValue("name", "Annika");

      await expect(edit.commit("1")).resolves.toBe(true);

      expect(onCommit, mode).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]?.[0], mode).toMatchObject({ source: mode });
      expect(edit.state.openRowIds, mode).toEqual([]);
    }
  });

  it("commitAll then saveDrafts commits every dirty row through the per-row loop", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik B");

    await expect(edit.commitAll()).resolves.toMatchObject({ ok: true });
    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("saveDrafts with onSaveDrafts makes one consumer call for the lot", async () => {
    const onCommit = vi.fn();
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit,
      onSaveDrafts,
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "age" });
    edit.getForm("2")?.setFieldValue("age", 42);

    await expect(edit.commitAll()).resolves.toMatchObject({ ok: true });
    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onSaveDrafts).toHaveBeenCalledTimes(1);
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<TMDataGridEditCommitArgs<Person>>;
    };
    expect(args.updated.map((row) => row.rowId).sort()).toEqual(["1", "2"]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("a rejected save keeps every draft", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: () => Promise.reject(new Error("no")),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik B");

    await expect(edit.commitAll()).resolves.toMatchObject({ ok: true });
    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: false });

    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    expect(edit.state.committedValues["1"]?.name).toBe("Annika");
  });

  it("addRow opens an entry form and commit adds it through onRowAdd", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({
      onRowAdd,
      newRowDefaults: () => ({
        id: 0,
        name: "",
        age: 18,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;

    const tempId = edit.addRow();
    expect(edit.state.newRows).toEqual([{ tempId, committed: false }]);
    expect(edit.getForm(tempId)?.state.values["age"]).toBe(18);

    edit.getForm(tempId)?.setFieldValue("name", "Ny Person");
    await expect(edit.commit(tempId)).resolves.toBe(true);

    expect(onRowAdd).toHaveBeenCalledTimes(1);
    const args = onRowAdd.mock.calls[0]?.[0] as {
      tempId: string;
      value: Person;
    };
    expect(args.tempId).toBe(tempId);
    expect(args.value.name).toBe("Ny Person");
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("addRow(values) seeds the entry row over newRowDefaults", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({
      onRowAdd,
      newRowDefaults: () => ({
        id: 0,
        name: "",
        age: 18,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;

    const tempId = edit.addRow({ name: "Ny Person", age: 42 });

    // The argument wins per key; what it leaves out keeps the default.
    const values = edit.getForm(tempId)?.state.values;
    expect(values?.["name"]).toBe("Ny Person");
    expect(values?.["age"]).toBe(42);
    expect(values?.["address"]).toEqual({ city: "Lund" });

    await expect(edit.commit(tempId)).resolves.toBe(true);

    const args = onRowAdd.mock.calls[0]?.[0] as { value: Person };
    expect(args.value.name).toBe("Ny Person");
    expect(args.value.age).toBe(42);
  });

  it("addRow(values) works with no newRowDefaults and leaves the next row blank", () => {
    const grid = renderEditGrid({ onRowAdd: vi.fn() });
    const { edit } = grid.current;

    const seeded = edit.addRow({ name: "Seedad" });
    expect(edit.getForm(seeded)?.state.values["name"]).toBe("Seedad");

    // Per call, not a lasting default.
    const blank = edit.addRow();
    expect(edit.getForm(blank)?.state.values["name"]).toBeUndefined();
    expect(edit.state.newRows).toEqual([
      { tempId: seeded, committed: false },
      { tempId: blank, committed: false },
    ]);
  });

  it("draft mode confirms an entry row instead of adding it, and re-opens it", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onRowAdd,
      newRowDefaults: () => ({
        id: 0,
        name: "Ny Person",
        age: 18,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();

    await expect(edit.commit(tempId)).resolves.toBe(true);

    // Entered, awaiting Save all: the form stays, the entry is marked
    // confirmed, and nothing was added anywhere.
    expect(onRowAdd).not.toHaveBeenCalled();
    expect(edit.state.newRows).toEqual([{ tempId, committed: true }]);
    expect(edit.state.openRowIds).toEqual([tempId]);

    // The re-edit gesture: begin re-arms the entry's editors.
    edit.begin({ rowId: tempId, columnId: "name" });

    expect(edit.state.newRows).toEqual([{ tempId, committed: false }]);
    expect(edit.state.active).toEqual({ rowId: tempId, columnId: "name" });
  });

  it("deleteRow reports immediately outside draft, marks idempotently under it", () => {
    const onRowDelete = vi.fn();
    const immediate = renderEditGrid({ onRowDelete });
    immediate.current.edit.deleteRow("1");
    expect(onRowDelete).toHaveBeenCalledTimes(1);
    expect(onRowDelete.mock.calls[0]?.[0]).toMatchObject({ rowId: "1" });

    const draft = renderEditGrid({ mode: "row", draft: true, onRowDelete: vi.fn() });
    draft.current.edit.deleteRow("1");
    expect(draft.current.edit.state.deletedRowIds).toEqual(["1"]);
    // Trash means trash - a second delete leaves the mark standing.
    draft.current.edit.deleteRow("1");
    expect(draft.current.edit.state.deletedRowIds).toEqual(["1"]);
  });

  it("restoreRow removes the mark, and only the mark", () => {
    const grid = renderEditGrid({ mode: "row", draft: true, onRowDelete: vi.fn() });
    const { edit } = grid.current;
    edit.deleteRow("1");
    edit.deleteRow("2");

    edit.restoreRow("1");
    expect(edit.state.deletedRowIds).toEqual(["2"]);

    // Restoring an unmarked row, or an unknown id, changes nothing.
    edit.restoreRow("1");
    edit.restoreRow("no-such-row");
    expect(edit.state.deletedRowIds).toEqual(["2"]);
  });

  it("deleteRow on an uncommitted entry row just discards the entry", () => {
    const onRowDelete = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onRowDelete });
    const { edit } = grid.current;
    const tempId = edit.addRow();

    edit.deleteRow(tempId);

    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
    expect(onRowDelete).not.toHaveBeenCalled();
  });

  it("the drafts payload carries updated, created and deleted together", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts,
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    const tempId = edit.addRow();
    edit.deleteRow("2");

    await expect(edit.commitAll()).resolves.toMatchObject({ ok: true });
    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    expect(onSaveDrafts).toHaveBeenCalledTimes(1);
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
      created: Array<{ tempId: string; value: Person }>;
      deleted: Array<string>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["1"]);
    expect(args.created.map((add) => add.tempId)).toEqual([tempId]);
    expect(args.deleted).toEqual(["2"]);
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
  });

  it("saveDrafts adds a confirmed entry row through onRowAdd on the per-row path", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onRowAdd,
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();
    await expect(edit.commit(tempId)).resolves.toBe(true);
    expect(onRowAdd).not.toHaveBeenCalled();

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    // Confirming is not adding - the add happens here, at Save all.
    expect(onRowAdd).toHaveBeenCalledTimes(1);
    expect(onRowAdd.mock.calls[0]?.[0]).toMatchObject({
      tempId,
      value: { name: "Ny" },
    });
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("saveDrafts carries a confirmed entry row in the drafts payload's created", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts,
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();
    await expect(edit.commit(tempId)).resolves.toBe(true);

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    expect(onSaveDrafts).toHaveBeenCalledTimes(1);
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      created: Array<{ tempId: string; value: Person }>;
    };
    expect(args.created.map((add) => add.tempId)).toEqual([tempId]);
    expect(args.created[0]?.value.name).toBe("Ny");
    expect(edit.state.newRows).toEqual([]);
  });

  it("a write to a committed entry row is validated at the write, not at Save", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts,
      rowValidators: {
        onSubmit: z.object({
          name: z.string().min(2, "Too short"),
          age: z.number(),
        }),
      },
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();
    await expect(edit.commit(tempId)).resolves.toBe(true);

    // A confirmed row is not frozen: a write reopens it, and the value the
    // rule refuses is refused there and then.
    await expect(edit.setCellValue(tempId, "name", "N")).resolves.toBe(false);

    // The entry is open again, carrying what the rule said, and the store has
    // nothing left to send.
    expect(edit.state.newRows).toEqual([{ tempId, committed: false }]);
    expect(edit.state.rows[tempId]?.errorFields).toContain("name");
    expect(edit.getForm(tempId)).toBeDefined();

    await expect(edit.commitAll()).resolves.toMatchObject({ ok: false });
    await edit.saveDrafts();
    expect(onSaveDrafts).not.toHaveBeenCalled();
  });

  it("cancel drops the draft without a consumer call", () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    edit.cancel("1");

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.rows["1"]).toBe(undefined);
  });

  it("clearCell writes the type's empty value and commits it", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;

    await expect(edit.clearCell("1", "age")).resolves.toBe(true);

    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes).toEqual([
      { columnId: "age", field: "age", previous: 34, next: null },
    ]);
  });

  it("clearCell parks the cleared value under draft", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;

    await expect(edit.clearCell("1", "age")).resolves.toBe(true);

    // Delete writes the empty value and parks it like any other edit.
    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["age"]);
    expect(edit.state.committedValues["1"]?.age).toBe(null);
  });

  it("cancelAll drops every draft, mark and entry in one motion", () => {
    const onCommit = vi.fn();
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts,
      onCommit,
      onRowDelete: vi.fn(),
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.deleteRow("2");
    edit.addRow();

    edit.cancelAll();

    // Back to a clean slate - the discard-all button's whole promise.
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
    expect(edit.state.active).toBe(null);
    expect(edit.getForm("1")).toBe(undefined);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onSaveDrafts).not.toHaveBeenCalled();
  });

  it("canDeleteRows follows the handlers the mode can deliver to", () => {
    // Immediate modes need onRowDelete - there is nowhere else to report.
    expect(renderEditGrid().current.edit.canDeleteRows()).toBe(false);
    expect(
      renderEditGrid({ onRowDelete: vi.fn() }).current.edit.canDeleteRows(),
    ).toBe(true);

    // Draft can also deliver deletions through the drafts commit.
    expect(
      renderEditGrid({ mode: "row", draft: true }).current.edit.canDeleteRows(),
    ).toBe(false);
    expect(
      renderEditGrid({ mode: "row", draft: true, onSaveDrafts: vi.fn() })
        .current.edit.canDeleteRows(),
    ).toBe(true);
  });

  it("gates per-row editability through isRowEditable and meta.edit.enabled", () => {
    const grid = renderEditGrid({
      isRowEditable: (row) => row.original.id !== 2,
    });
    const { edit } = grid.current;
    // The same erasure the context provider performs - canEditCell is chrome.
    const table = grid.current.table as unknown as TMDataGridApi<TMDataGridRowData>["table"];

    edit.begin({ rowId: "2", columnId: "name" });
    expect(edit.state.openRowIds).toEqual([]);

    const nameColumn = table.getColumn("name");
    const lockedColumn = table.getColumn("readonlyName");
    if (!nameColumn || !lockedColumn) throw new Error("columns missing");
    expect(edit.canEditCell(table.getRow("1"), nameColumn)).toBe(true);
    expect(edit.canEditCell(table.getRow("2"), nameColumn)).toBe(false);
    expect(edit.canEditCell(table.getRow("1"), lockedColumn)).toBe(false);
  });
});

describe("the draft store", () => {
  /** A validated column, to prove commits validate without mounted editors. */
  const validatedColumns = helper.columns([
    helper.accessor("name", {
      header: "Name",
      meta: { edit: { validate: z.string().min(2, "Too short") } },
    }),
    helper.accessor("age", { header: "Age", meta: { type: "number" } }),
  ]);

  function renderValidatedGrid(
    editing: Partial<TMDataGridEditingOptions<Person>> = {},
  ) {
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: people,
          columns: validatedColumns,
          getRowId: (row) => String(row.id),
          editing: { mode: "row", draft: true, ...editing },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    return result;
  }

  it("commit moves an existing row in, saveDrafts sends only what is in", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    // Row 1 is OK'd, row 2 only typed into - the difference the store keeps.
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna Committed");
    await expect(edit.commit("1")).resolves.toBe(true);
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik Open");

    expect(edit.state.committedRowIds).toEqual(["1"]);

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["1"]);
    // The open row is untouched by the save: still open, still holding it.
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.openRowIds).toEqual(["2"]);
    expect(edit.getForm("2")?.state.values["name"]).toBe("Erik Open");
  });

  it("names the payload buckets updated / created / deleted", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");
    edit.addRow({ name: "Ny", age: 30 });
    const tempId = edit.state.newRows[0]!.tempId;
    await edit.commit(tempId);
    edit.deleteRow("2");

    await edit.saveDrafts();

    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
      created: Array<{ tempId: string }>;
      deleted: Array<string>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["1"]);
    expect(args.created.map((row) => row.tempId)).toEqual([tempId]);
    expect(args.deleted).toEqual(["2"]);
  });

  it("hasPendingEdits follows every kind of unsaved work until the save lands", async () => {
    let settle: (() => void) | undefined;
    const onSaveDrafts = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            settle = resolve;
          }),
      );
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    // Opened is not pending; a moved value is; moving it back is not.
    edit.begin({ rowId: "1", columnId: "name" });
    expect(hasPendingEdits(edit.state)).toBe(false);
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    expect(hasPendingEdits(edit.state)).toBe(true);
    edit.getForm("1")?.setFieldValue("name", "Anna");
    expect(hasPendingEdits(edit.state)).toBe(false);

    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");
    expect(hasPendingEdits(edit.state)).toBe(true);

    // A rejected save keeps the store.
    await edit.saveDrafts().catch(() => undefined);
    expect(hasPendingEdits(edit.state)).toBe(true);

    // Pending while the save is in flight, clear once it resolves.
    const saving = edit.saveDrafts();
    expect(hasPendingEdits(edit.state)).toBe(true);
    await vi.waitFor(() => {
      expect(settle).toBeDefined();
    });
    settle?.();
    await saving;
    expect(hasPendingEdits(edit.state)).toBe(false);

    edit.deleteRow("2");
    expect(hasPendingEdits(edit.state)).toBe(true);
    edit.restoreRow("2");
    expect(hasPendingEdits(edit.state)).toBe(false);

    // An entry row counts whatever it holds.
    edit.addRow();
    expect(hasPendingEdits(edit.state)).toBe(true);
    edit.cancelAll();
    expect(hasPendingEdits(edit.state)).toBe(false);
  });

  it("keeps the drafts a result reports as failed", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: () => ({ updated: { "2": false } }),
    });
    const { edit } = grid.current;

    for (const rowId of ["1", "2"]) {
      edit.begin({ rowId, columnId: "name" });
      edit.getForm(rowId)?.setFieldValue("name", `Namn ${rowId}`);
      await edit.commit(rowId);
    }
    expect(edit.state.committedRowIds).toEqual(["1", "2"]);

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: false });

    // Row 1 saved and is gone; row 2 stays committed, values intact, so the
    // next save retries it.
    expect(edit.state.committedRowIds).toEqual(["2"]);
    expect(edit.state.committedValues["1"]).toBeUndefined();
    expect(edit.state.committedValues["2"]?.name).toBe("Namn 2");
  });

  it("keeps a failed entry row and a failed deletion mark", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: ({ created, deleted }) => ({
        created: { [created[0]!.tempId]: false },
        deleted: { [deleted[0]!]: false },
      }),
    });
    const { edit } = grid.current;

    edit.addRow({ name: "Ny", age: 30 });
    const tempId = edit.state.newRows[0]!.tempId;
    await edit.commit(tempId);
    edit.deleteRow("2");

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: false });

    expect(edit.state.newRows).toEqual([{ tempId, committed: true }]);
    expect(edit.state.deletedRowIds).toEqual(["2"]);
  });

  it("saves the whole bucket a result answers with a boolean", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: () => ({ updated: false }),
    });
    const { edit } = grid.current;

    for (const rowId of ["1", "2"]) {
      edit.begin({ rowId, columnId: "name" });
      edit.getForm(rowId)?.setFieldValue("name", `Namn ${rowId}`);
      await edit.commit(rowId);
    }

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: false });
    expect(edit.state.committedRowIds).toEqual(["1", "2"]);
  });

  it("saves everything a result does not name", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      // An empty result says nothing failed.
      onSaveDrafts: () => ({}),
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");
    edit.deleteRow("2");

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
  });

  it("a save during a save joins it instead of sending the payload twice", async () => {
    let resolveSave: () => void = () => {};
    const onSaveDrafts = vi.fn(
      () => new Promise<void>((resolve) => (resolveSave = resolve)),
    );
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");

    const first = edit.saveDrafts();
    const second = edit.saveDrafts();
    // The collector phase runs before the consumer call; release the save
    // only once it is actually awaiting.
    await vi.waitFor(() => expect(onSaveDrafts).toHaveBeenCalled());
    resolveSave();

    await expect(first).resolves.toEqual({
      ok: true,
      saved: ["1"],
      kept: [],
      reopened: [],
    });
    // The joined call gets the very same result.
    expect(await second).toBe(await first);
    expect(onSaveDrafts).toHaveBeenCalledTimes(1);
    expect(edit.state.committedRowIds).toEqual([]);
  });

  it("isSaving is true while onSaveDrafts is pending and false once it resolves", async () => {
    let resolveSave: () => void = () => {};
    const onSaveDrafts = vi.fn(
      () => new Promise<void>((resolve) => (resolveSave = resolve)),
    );
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");
    expect(edit.state.isSaving).toBe(false);

    const saving = edit.saveDrafts();
    await vi.waitFor(() => expect(onSaveDrafts).toHaveBeenCalled());
    expect(edit.state.isSaving).toBe(true);

    resolveSave();
    await expect(saving).resolves.toMatchObject({ ok: true });
    expect(edit.state.isSaving).toBe(false);
  });

  it("isSaving is false again after a rejected save", async () => {
    let rejectSave: (error: Error) => void = () => {};
    const onSaveDrafts = vi.fn(
      () => new Promise<void>((_, fail) => (rejectSave = fail)),
    );
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");

    const saving = edit.saveDrafts();
    await vi.waitFor(() => expect(onSaveDrafts).toHaveBeenCalled());
    expect(edit.state.isSaving).toBe(true);

    rejectSave(new Error("server said no"));
    await expect(saving).resolves.toMatchObject({ ok: false });
    expect(edit.state.isSaving).toBe(false);
    // The refused rows keep their drafts, so the flag is the only thing the
    // failed save moved.
    expect(edit.state.committedRowIds).toEqual(["1"]);
  });

  it("a save with nothing to send never publishes isSaving", async () => {
    const grid = renderEditGrid({ mode: "row", draft: true });
    const { edit } = grid.current;
    const seen: Array<boolean> = [];
    const subscription = edit.store.subscribe((state) => {
      seen.push(state.isSaving);
    });

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    subscription.unsubscribe();

    expect(seen).not.toContain(true);
    expect(edit.state.isSaving).toBe(false);
  });

  it("re-opening a committed row takes it back out of the store", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await edit.commit("1");
    expect(edit.state.committedRowIds).toEqual(["1"]);

    // Editing it again makes it undecided, so a save must not send it.
    edit.begin({ rowId: "1", columnId: "name" });
    expect(edit.state.committedRowIds).toEqual([]);

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    expect(onSaveDrafts).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
  });

  it("commitAll submits the open rows, holding back the ones that fail", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderValidatedGrid({ onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "E"); // fails min(2)

    await expect(edit.commitAll()).resolves.toEqual({
      ok: false,
      committed: ["1"],
      open: ["2"],
    });
    expect(edit.state.committedRowIds).toEqual(["1"]);
    expect(edit.state.rows["2"]?.errorFields).toContain("name");

    await edit.saveDrafts();
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["1"]);
  });

  it("commitAll with no open row is ok with empty lists", async () => {
    const grid = renderValidatedGrid({ onSaveDrafts: vi.fn() });
    const { edit } = grid.current;

    await expect(edit.commitAll()).resolves.toEqual({
      ok: true,
      committed: [],
      open: [],
    });
  });

  it("saveDrafts on the per-row path reports saved and reopened rows", async () => {
    let clashes = false;
    const onCommit = vi.fn(({ rowId }: { rowId: string }) => {
      if (rowId === "2") throw new Error("Server said no");
    });
    const onRowAdd = vi.fn();
    const onRowDelete = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit,
      onRowAdd,
      onRowDelete,
      tableValidators: {
        onSubmit: ({ value }: TMDataGridTableValidateArgs<Person>) =>
          clashes && value.name === "Ny" ? "Duplicate name" : undefined,
      },
    });
    const { edit } = grid.current;
    await edit.setCellValue("1", "name", "Anna B");
    await edit.setCellValue("2", "name", "Erik B");
    const tempId = edit.addRow({ name: "Ny", age: 30 });
    await expect(edit.commit(tempId)).resolves.toBe(true);
    // The rule turns on the entry row only once it is in the store - a later
    // edit elsewhere is what this stands in for.
    clashes = true;

    // Row 1 saves, row 2's onCommit throws, the entry row breaks the rule.
    await expect(edit.saveDrafts()).resolves.toEqual({
      ok: false,
      saved: ["1"],
      kept: [],
      reopened: ["2", tempId],
    });
    expect(onRowAdd).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["2", tempId]);
    expect(edit.state.rows[tempId]?.hasRowError).toBe(true);

    // A deletion onRowDelete accepts leaves the store.
    clashes = false;
    edit.deleteRow("1");
    await expect(edit.saveDrafts()).resolves.toEqual({
      ok: true,
      saved: ["1"],
      kept: [],
      reopened: [],
    });
    expect(onRowDelete).toHaveBeenCalledTimes(1);
  });

  it("saveDrafts splits a partial onSaveDrafts outcome into saved and kept", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: ({ created }) => ({
        updated: { "2": false },
        created: { [created[1]!.tempId]: false },
        deleted: false,
      }),
    });
    const { edit } = grid.current;
    await edit.setCellValue("1", "name", "Anna B");
    await edit.setCellValue("2", "name", "Erik B");
    const result = await edit.addRows(
      [
        { name: "Ny 1", age: 30 },
        { name: "Ny 2", age: 31 },
      ],
      { commit: true },
    );
    const [first, second] = result.committed;
    edit.deleteRow("1");

    // Row 1 is marked, so its edit stays under the mark and only the
    // deletion is sent.
    await expect(edit.saveDrafts()).resolves.toEqual({
      ok: false,
      saved: [first],
      kept: ["2", second, "1"],
      reopened: [],
    });
    expect(edit.state.committedRowIds).toEqual(["1", "2"]);
    expect(edit.state.newRows).toEqual([{ tempId: second, committed: true }]);
    expect(edit.state.deletedRowIds).toEqual(["1"]);
  });

  it("saveDrafts keeps every sent id when onSaveDrafts throws", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: () => Promise.reject(new Error("offline")),
    });
    const { edit } = grid.current;
    await edit.setCellValue("1", "name", "Anna B");
    const tempId = edit.addRow({ name: "Ny", age: 30 });
    await expect(edit.commit(tempId)).resolves.toBe(true);
    edit.deleteRow("2");

    await expect(edit.saveDrafts()).resolves.toEqual({
      ok: false,
      saved: [],
      kept: ["1", tempId, "2"],
      reopened: [],
    });
    expect(edit.state.committedRowIds).toEqual(["1"]);
    expect(edit.state.newRows).toEqual([{ tempId, committed: true }]);
    expect(edit.state.deletedRowIds).toEqual(["2"]);
  });

  it("saveDrafts with an empty store is ok with empty lists", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    await expect(edit.saveDrafts()).resolves.toEqual({
      ok: true,
      saved: [],
      kept: [],
      reopened: [],
    });
    expect(onSaveDrafts).not.toHaveBeenCalled();
  });

  it("validates a commit against the column rules with no editor mounted", async () => {
    const grid = renderValidatedGrid({ onSaveDrafts: vi.fn() });
    const { edit } = grid.current;

    // No editors are mounted here: the rule lives on the column, so the
    // engine has to be the one running it.
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "A");
    await expect(edit.commit("1")).resolves.toBe(false);
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.rows["1"]?.errorFields).toContain("name");

    // And the error clears once the value is fixed.
    edit.getForm("1")?.setFieldValue("name", "Anna B");
    await expect(edit.commit("1")).resolves.toBe(true);
    expect(edit.state.committedRowIds).toEqual(["1"]);
  });

  it("addRows opens a batch, and reports every row as open", async () => {
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts: vi.fn() });
    const { edit } = grid.current;

    const result = await edit.addRows([
      { name: "Ett", age: 1 },
      { name: "Tva", age: 2 },
    ]);

    expect(result.ok).toBe(false);
    expect(result.committed).toEqual([]);
    expect(result.open).toHaveLength(2);
    expect(edit.state.newRows.every((newRow) => !newRow.committed)).toBe(true);
    expect(edit.getForm(result.open[0]!)?.state.values["name"]).toBe("Ett");
  });

  it("addRows with commit lands the valid rows and leaves the rest open", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderValidatedGrid({ onSaveDrafts });
    const { edit } = grid.current;

    // The import case: raw data in, validated, only the bad rows left open.
    const result = await edit.addRows(
      [
        { name: "Giltig", age: 1 },
        { name: "X", age: 2 },
        { name: "Ocksa giltig", age: 3 },
      ],
      { commit: true },
    );

    expect(result.ok).toBe(false);
    expect(result.committed).toHaveLength(2);
    expect(result.open).toHaveLength(1);
    expect(edit.getForm(result.open[0]!)?.state.values["name"]).toBe("X");
    expect(edit.state.rows[result.open[0]!]?.errorFields).toContain("name");

    await edit.saveDrafts();
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      created: Array<{ value: Person }>;
    };
    expect(args.created.map((add) => add.value.name)).toEqual([
      "Giltig",
      "Ocksa giltig",
    ]);
    // The rejected row is still there to be fixed.
    expect(edit.state.newRows).toHaveLength(1);
  });

  it("addRows with commit adds through onRowAdd under the immediate modes", async () => {
    const onRowAdd = vi.fn();
    const grid = renderEditGrid({ mode: "cell", onRowAdd });
    const { edit } = grid.current;

    // No draft store to park in, so a commit is the add - one call per row.
    const result = await edit.addRows(
      [
        { name: "Ett", age: 1 },
        { name: "Tva", age: 2 },
      ],
      { commit: true },
    );

    expect(result.ok).toBe(true);
    expect(result.committed).toHaveLength(2);
    expect(onRowAdd).toHaveBeenCalledTimes(2);
    expect(edit.state.newRows).toEqual([]);
  });

  it("addRows with commit is one publish for the whole import", async () => {
    const grid = renderValidatedGrid({ onSaveDrafts: vi.fn() });
    const { edit } = grid.current;
    const publishes = vi.fn();
    const subscription = edit.store.subscribe(publishes);

    // An import: every row that validates lands committed in the same
    // publish that shows it. One render for the lot, not one per row - the
    // difference between a second and minutes at ten thousand rows.
    const result = await edit.addRows(
      Array.from({ length: 500 }, (_, index) => ({
        name: index % 100 === 99 ? "X" : `Rad ${String(index)}`,
        age: index,
      })),
      { commit: true },
    );
    subscription.unsubscribe();

    expect(publishes).toHaveBeenCalledTimes(1);
    expect(result.committed).toHaveLength(495);
    expect(result.open).toHaveLength(5);
    expect(getOpenRowIds(edit.state)).toEqual(result.open);
    expect(
      edit.state.newRows.filter((newRow) => newRow.committed),
    ).toHaveLength(495);
    // The file's order, whichever way each row went.
    expect(result.committed[0]).toBe(edit.state.newRows[0]?.tempId);
    expect(result.open[0]).toBe(edit.state.newRows[99]?.tempId);
  });

  it("saveDrafts sends an import in the order it committed, in one call", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderValidatedGrid({ onSaveDrafts });
    const { edit } = grid.current;

    const names = Array.from({ length: 200 }, (_, index) => `Rad ${String(index)}`);
    await edit.addRows(
      names.map((name, index) => ({ name, age: index })),
      { commit: true },
    );
    const publishes = vi.fn();
    const subscription = edit.store.subscribe(publishes);
    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    subscription.unsubscribe();

    expect(onSaveDrafts).toHaveBeenCalledTimes(1);
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      created: Array<{ value: Person }>;
    };
    expect(args.created.map((add) => add.value.name)).toEqual(names);
    expect(edit.state.newRows).toEqual([]);
    expect(edit.state.openRowIds).toEqual([]);
    // The two `isSaving` flips, the submit pass and the drop of the saved
    // rows - a fixed handful, not one per row.
    expect(publishes.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("a table validator during an import sees the rows imported with it", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
      tableValidators: {
        onSubmit: ({ value, rows }: TMDataGridTableValidateArgs<Person>) =>
          rows.filter((row) => row.value.name === value.name).length > 1
            ? "Duplicate name"
            : undefined,
      },
    });
    const { edit } = grid.current;

    // The two "Anna" rows see each other, so both stay open; "Bo" lands.
    const result = await edit.addRows(
      [
        { name: "Anna", age: 1 },
        { name: "Bo", age: 2 },
        { name: "Anna", age: 3 },
      ],
      { commit: true },
    );

    expect(result.committed).toHaveLength(1);
    expect(edit.state.committedValues[result.committed[0]!]?.name).toBe("Bo");
    expect(result.open).toHaveLength(2);
    for (const tempId of result.open) {
      expect(edit.state.rows[tempId]?.hasRowError).toBe(true);
    }
  });

  it("saveDrafts sends nothing while the store is empty", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Bara oppen");

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    expect(onSaveDrafts).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
  });

  it("commit drops the form and keeps the row as data", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);

    // Decided, so there is nothing left for a form to hold: the row is the
    // values and the markers that go with them.
    expect(edit.getForm("1")).toBeUndefined();
    expect(edit.state.committedValues["1"]?.name).toBe("Annika");
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
    // One object behind both, so a cell and the table cannot disagree.
    expect(edit.state.rows["1"]?.values).toBe(edit.state.committedValues["1"]);
    expect(edit.state.openRowIds).toEqual(["1"]);
  });

  it("reopen restores an editable form seeded with the committed values", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);

    edit.begin({ rowId: "1", columnId: "age" });

    const form = edit.getForm("1");
    expect(form?.state.values).toEqual({ ...people[0], name: "Annika" });
    expect(edit.state.committedRowIds).toEqual([]);
    // The snapshot stands until the next decision - the row holds its place
    // in the sort while the second cell is typed into.
    expect(edit.state.committedValues["1"]?.name).toBe("Annika");

    form?.setFieldValue("age", 44);
    await expect(edit.commit("1")).resolves.toBe(true);
    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    // Both edits, diffed against the data row rather than against the draft
    // the reopen started from.
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<TMDataGridEditCommitArgs<Person>>;
    };
    expect(args.updated[0]?.original).toEqual(people[0]);
    expect(args.updated[0]?.changes.map((change) => change.field)).toEqual([
      "name",
      "age",
    ]);
  });

  it("saveDrafts with no table validators runs no validator", async () => {
    const columnRule = vi.fn(() => undefined);
    const rowRule = vi.fn(() => undefined);
    const onSaveDrafts = vi.fn();
    // Built once for this test: the hook memoizes on the columns reference.
    const spiedColumns = helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { edit: { validate: { onSubmit: columnRule } } },
      }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]);
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: people,
          columns: spiedColumns,
          getRowId: (row) => String(row.id),
          editing: {
            mode: "row",
            draft: true,
            onSaveDrafts,
            rowValidators: { onSubmit: rowRule },
          },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    const { edit } = result.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);

    expect(columnRule).toHaveBeenCalled();
    expect(rowRule).toHaveBeenCalled();
    const atCommit = [columnRule.mock.calls.length, rowRule.mock.calls.length];

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    // A committed row's values cannot have moved since it committed, so the
    // rules that judge the row alone would only say what they said then.
    expect([
      columnRule.mock.calls.length,
      rowRule.mock.calls.length,
    ]).toEqual(atCommit);
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["1"]);
  });

  it("a table rule broken by a later commit reopens the earlier row at Save", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts,
      tableValidators: {
        // A name belongs to the last row that took it, so a row loses it to
        // the next one - the clash only exists once that one has committed.
        onSubmit: ({ value, rowId, rows }: TMDataGridTableValidateArgs<Person>) =>
          rows.some(
            (row) => row.rowId > rowId && row.value.name === value.name,
          )
            ? { form: "Name taken", fields: { name: "Duplicate name" } }
            : undefined,
      },
    });
    const { edit } = grid.current;

    for (const rowId of ["1", "2"]) {
      edit.begin({ rowId, columnId: "name" });
      edit.getForm(rowId)?.setFieldValue("name", "Dubblett");
      await expect(edit.commit(rowId)).resolves.toBe(true);
    }

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: false });

    // Row 2 saved and left the store; row 1 is open again, carrying what the
    // rule said, which is what the user has to fix.
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["2"]);
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
    expect(edit.state.rows["1"]?.errorFields).toContain("name");
    expect(edit.getForm("1")?.state.values["name"]).toBe("Dubblett");
  });

  it("the default save path reopens a row whose callback threw", async () => {
    const onCommit = vi.fn(({ rowId }: TMDataGridEditCommitArgs<Person>) =>
      rowId === "1"
        ? Promise.reject(new Error("server said no"))
        : Promise.resolve(),
    );
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;

    for (const rowId of ["1", "2"]) {
      edit.begin({ rowId, columnId: "name" });
      edit.getForm(rowId)?.setFieldValue("name", `Namn ${rowId}`);
      await expect(edit.commit(rowId)).resolves.toBe(true);
    }

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: false });

    // The refused row is open with the message on it, the same answer a
    // rejected commit gets outside the draft store; the other one left.
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
    expect(firstErrorText(edit.getForm("1")?.state.errors)).toBe(
      "server said no",
    );
  });

  it("a row reopened during a per-row save still receives the rejection", async () => {
    let reject: (error: Error) => void = () => {};
    const onCommit = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);

    const saving = edit.saveDrafts();
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    // The user takes the row back while the server is still deciding.
    edit.begin({ rowId: "1", columnId: "age" });
    reject(new Error("server said no"));
    await expect(saving).resolves.toMatchObject({ ok: false });

    // The refusal lands on the form the reopen built, not on a snapshot that
    // is no longer there.
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
    expect(firstErrorText(edit.getForm("1")?.state.errors)).toBe(
      "server said no",
    );
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
  });

  it("setCellValue without draft keeps publishing while the commit waits on the consumer", async () => {
    let resolve: () => void = () => {};
    const onCommit = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const grid = renderEditGrid({ mode: "row", onCommit });
    const { edit } = grid.current;

    const writing = edit.setCellValue("1", "name", "Annika");
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));

    // Nothing is held: the written row reports its submit in flight, and the
    // caret can move to another row while the server takes its time.
    expect(edit.state.rows["1"]?.isSubmitting).toBe(true);
    edit.begin({ rowId: "2", columnId: "name" });
    expect(edit.state.active).toEqual({ rowId: "2", columnId: "name" });

    resolve();
    await expect(writing).resolves.toBe(true);
  });

  it("reopening a committed row runs rowValidators.onMount over the committed values", async () => {
    const onMount = vi.fn((_args: { value: Person }) => undefined);
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
      rowValidators: { onMount },
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    expect(onMount).toHaveBeenCalledTimes(1);
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);

    // A reopen is a new form, so the mount pass runs again - over what the
    // user last decided, not over the seed.
    edit.begin({ rowId: "1", columnId: "age" });
    expect(onMount).toHaveBeenCalledTimes(2);
    expect(onMount.mock.calls[1]?.[0]?.value.name).toBe("Annika");
  });

  it("the draft store is plain data", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
      newRowDefaults: () => ({
        id: 0,
        name: "Ny",
        age: 20,
        address: { city: "Lund" },
      }),
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);
    const tempId = edit.addRow();
    await expect(edit.commit(tempId)).resolves.toBe(true);
    edit.deleteRow("2");

    // Values, ids and flags - nothing that only lives in memory. A store that
    // survives JSON is a store a consumer could keep across a reload.
    const { state } = edit;
    const roundTripped = JSON.parse(
      JSON.stringify(state),
    ) as TMDataGridEditState;
    expect(roundTripped.committedValues).toEqual(state.committedValues);
    expect(roundTripped.newRows).toEqual(state.newRows);
    expect(roundTripped.deletedRowIds).toEqual(state.deletedRowIds);
    expect(roundTripped.committedRowIds).toEqual(state.committedRowIds);
    expect(roundTripped.openRowIds).toEqual(state.openRowIds);
  });

  it("setCellValue on a committed row reopens, writes and commits it again", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
    });
    const { edit } = grid.current;

    // Row 2 first, so the order has something to keep.
    await expect(edit.setCellValue("2", "name", "Erik B")).resolves.toBe(true);
    await expect(edit.setCellValue("1", "name", "Annika")).resolves.toBe(true);
    await expect(edit.setCellValue("1", "age", 44)).resolves.toBe(true);

    expect(edit.state.committedValues["1"]).toMatchObject({
      name: "Annika",
      age: 44,
    });
    // Back to data when the write is done, and the row never doubled up.
    expect(edit.getForm("1")).toBeUndefined();
    expect(edit.state.openRowIds).toEqual(["2", "1"]);
    expect(edit.state.committedRowIds).toEqual(["2", "1"]);
  });

  it("openRowIds keeps the entry order across a reopen", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    for (const rowId of ["1", "2"]) {
      edit.begin({ rowId, columnId: "name" });
      edit.getForm(rowId)?.setFieldValue("name", `Namn ${rowId}`);
      await expect(edit.commit(rowId)).resolves.toBe(true);
    }
    expect(edit.state.openRowIds).toEqual(["1", "2"]);

    // Out of the store and back in: the row keeps the place it entered with,
    // and so does the payload the save is built from.
    edit.begin({ rowId: "1", columnId: "name" });
    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);
    expect(edit.state.openRowIds).toEqual(["1", "2"]);

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["1", "2"]);
  });
});

/**
 * `setCellValue` and `setRowValues` - a write with no editor behind it. What
 * these guard is that it takes the same path a typed edit does: the row's own
 * form, the same commit, the same validators and the same draft store - and
 * that a cell which takes no edit refuses it outright.
 */
describe("writing a cell from outside an editor", () => {
  /** The erasure the context provider performs - `canEditCell` is chrome. */
  const erasedTable = (api: TMDataGridApi<Person>) =>
    api.table as unknown as TMDataGridApi<TMDataGridRowData>["table"];

  it("setCellValue writes the cell and commits the row", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;

    await expect(edit.setCellValue("1", "city", "Uppsala")).resolves.toBe(true);

    expect(onCommit).toHaveBeenCalledTimes(1);
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes).toEqual([
      {
        columnId: "city",
        field: "address.city",
        previous: "Stockholm",
        next: "Uppsala",
      },
    ]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("setCellValue parks the write in the draft store under draft", async () => {
    const onCommit = vi.fn();
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit,
      onSaveDrafts,
    });
    const { edit } = grid.current;

    await expect(edit.setCellValue("1", "name", "Annika")).resolves.toBe(true);

    // Parked exactly as a hand-typed edit is: nothing out to the consumer,
    // the change marked on the row, and the per-row revert still available.
    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.committedRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
    expect(edit.state.committedValues["1"]?.name).toBe("Annika");

    // And it leaves the way every other draft does.
    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<TMDataGridEditCommitArgs<Person>>;
    };
    expect(args.updated.map((row) => row.rowId)).toEqual(["1"]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("setCellValue writes a row inside a collapsed group", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const table = erasedTable(grid.current);
    act(() => {
      table.setGrouping(["city"]);
    });
    const { edit } = grid.current;

    // Groups start collapsed, so the grid displays the two group rows and
    // nothing under them - row 1 has no cell to open an editor in.
    expect(table.getPrePaginatedRowModel().rows.map((row) => row.id)).toEqual([
      "city:Stockholm",
      "city:Malmö",
    ]);

    await expect(edit.setCellValue("1", "name", "Annika")).resolves.toBe(true);

    expect(onCommit).toHaveBeenCalledTimes(1);
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes).toEqual([
      { columnId: "name", field: "name", previous: "Anna", next: "Annika" },
    ]);
  });

  it("setCellValue refuses a row or column the grid does not have", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;

    await expect(edit.setCellValue("99", "name", "Annika")).resolves.toBe(false);
    await expect(edit.setCellValue("1", "nope", "Annika")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("setCellValue refuses a column meta.edit.enabled switched off", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;

    await expect(
      edit.setCellValue("1", "readonlyName", "Annika"),
    ).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.getForm("1")).toBeUndefined();
  });

  it("setCellValue refuses a row isRowEditable turns down", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({
      onCommit,
      isRowEditable: (row) => row.original.id !== 2,
    });
    const { edit } = grid.current;

    await expect(edit.setCellValue("2", "name", "Erik B")).resolves.toBe(false);
    await expect(edit.setCellValue("1", "name", "Annika")).resolves.toBe(true);

    expect(onCommit).toHaveBeenCalledTimes(1);
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.rowId).toBe("1");
  });

  it("setCellValue joins a form already open on the row", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.setCellValue("1", "age", 40)).resolves.toBe(true);

    // One commit carrying both fields: the pending edit was joined, not
    // replaced by a form of the write's own.
    expect(onCommit).toHaveBeenCalledTimes(1);
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes.map((change) => change.columnId)).toEqual([
      "name",
      "age",
    ]);
  });

  it("setRowValues writes several cells in one commit", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;

    await expect(
      edit.setRowValues("1", { name: "Annika", city: "Uppsala" }),
    ).resolves.toBe(true);

    // One consumer call for the row, not one per column.
    expect(onCommit).toHaveBeenCalledTimes(1);
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes).toEqual([
      { columnId: "name", field: "name", previous: "Anna", next: "Annika" },
      {
        columnId: "city",
        field: "address.city",
        previous: "Stockholm",
        next: "Uppsala",
      },
    ]);
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("setRowValues parks the whole write as one draft", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;

    await expect(
      edit.setRowValues("1", { name: "Annika", age: 35 }),
    ).resolves.toBe(true);
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name", "age"]);

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    expect(onSaveDrafts).toHaveBeenCalledTimes(1);
    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<TMDataGridEditCommitArgs<Person>>;
    };
    expect(args.updated).toHaveLength(1);
    expect(args.updated[0]?.changes.map((change) => change.columnId)).toEqual([
      "name",
      "age",
    ]);
  });

  it("setRowValues writes nothing at all when one cell takes no edit", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;

    await expect(
      edit.setRowValues("1", { name: "Annika", readonlyName: "Nej" }),
    ).resolves.toBe(false);

    // All or nothing: the editable half is not written either, so a bulk
    // action cannot half-apply unnoticed.
    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
    expect(edit.getForm("1")).toBeUndefined();
  });

  it("setRowValues leaves an open form's draft alone when it refuses", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(
      edit.setRowValues("1", { city: "Uppsala", readonlyName: "Nej" }),
    ).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.getForm("1")?.state.values["name"]).toBe("Annika");
    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);
  });

  /** A mapped column and a validated one - neither has an editor here. */
  const writeColumns = helper.columns([
    helper.accessor("name", {
      header: "Name",
      meta: {
        edit: {
          mapValue: ({ value }) =>
            typeof value === "string" ? value.toUpperCase() : value,
        },
      },
    }),
    helper.accessor("age", {
      header: "Age",
      meta: {
        type: "number",
        edit: { validate: z.number().min(18, "Too young") },
      },
    }),
  ]);

  function renderWriteGrid(
    editing: Partial<TMDataGridEditingOptions<Person>> = {},
  ) {
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: people,
          columns: writeColumns,
          getRowId: (row) => String(row.id),
          editing: { mode: "cell", ...editing },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    return result;
  }

  it("writes the value as given - mapValue belongs to the editor", async () => {
    const onCommit = vi.fn();
    const grid = renderWriteGrid({ onCommit });
    const { edit } = grid.current;

    await expect(edit.setCellValue("1", "name", "annika")).resolves.toBe(true);

    // The caller writes the stored value, so the column's map - which every
    // keystroke of a typed edit goes through - has nothing to run on.
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes[0]?.next).toBe("annika");
  });

  it("refuses a value the column's validate turns down, and holds the row", async () => {
    const onCommit = vi.fn();
    const grid = renderWriteGrid({ onCommit });
    const { edit } = grid.current;

    await expect(edit.setCellValue("1", "age", 5)).resolves.toBe(false);

    // The rule is the column's, and it runs with no editor mounted; the row
    // is left open carrying the message, for the user to answer.
    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.rows["1"]?.errorFields).toContain("age");
    expect(edit.state.rows["1"]?.errorMessages).toContainEqual({
      field: "age",
      message: "Too young",
    });

    // And the same write with a value that passes lands.
    await expect(edit.setCellValue("1", "age", 40)).resolves.toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

/**
 * `getRowValues` and `getRows` - the rows as the grid shows them. What these
 * guard is the overlay: a draft wins over `data`, an entry row answers under
 * its temp id, and a deletion mark is reported rather than filtered out.
 */
describe("reading rows as shown", () => {
  it("reads data values while nothing is edited", () => {
    const grid = renderEditGrid({ mode: "row", draft: true });
    const { edit } = grid.current;

    expect(edit.getRowValues("1")).toEqual(people[0]);
    expect(edit.getRows()).toEqual([
      { rowId: "1", value: people[0], isNew: false, deleted: false },
      { rowId: "2", value: people[1], isNew: false, deleted: false },
    ]);
  });

  it("reads a parked draft, which the table's own row now holds too", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit: vi.fn(),
      onSaveDrafts: vi.fn(),
    });
    const { edit } = grid.current;

    await expect(edit.setCellValue("1", "name", "Annika")).resolves.toBe(true);

    expect(edit.getRowValues("1")?.name).toBe("Annika");
    // The draft is the row as far as the table is concerned - sorting and
    // filtering read it - while `data` itself is untouched.
    expect(grid.current.table.getRow("1").original.name).toBe("Annika");
    expect(grid.current.table.options.data[0]?.name).toBe("Annika");
    expect(people[0]?.name).toBe("Anna");
    expect(edit.getRows()[0]?.value.name).toBe("Annika");
  });

  it("reads an open row's form values", () => {
    const grid = renderEditGrid({ mode: "row", draft: true });
    const { edit } = grid.current;

    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Eva");

    expect(edit.getRowValues("2")?.name).toBe("Eva");
  });

  it("keeps a row marked deleted, flagged", () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
    });
    const { edit } = grid.current;

    edit.deleteRow("1");

    const rows = edit.getRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rowId: "1", deleted: true });
    expect(edit.getRowValues("1")).toEqual(people[0]);
  });

  it("appends an entry row under its temp id", () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
    });
    const { edit } = grid.current;

    const tempId = edit.addRow({ name: "New" });

    const rows = edit.getRows();
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ rowId: tempId, isNew: true, deleted: false });
    expect(rows[2]?.value.name).toBe("New");
    expect(edit.getRowValues(tempId)?.name).toBe("New");
  });

  it("answers undefined for a row the grid does not have", () => {
    const grid = renderEditGrid({ mode: "row", draft: true });

    expect(grid.current.edit.getRowValues("nope")).toBeUndefined();
  });

  it("hands the table the consumer's own array while nothing is committed", () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit: vi.fn(),
      onSaveDrafts: vi.fn(),
    });
    const { edit } = grid.current;

    expect(grid.current.table.options.data).toBe(people);

    // Open and undecided: the overlay is the per-cell one, and `data` is
    // still the array that came in.
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    expect(grid.current.table.options.data).toBe(people);
  });

  it("snapshots a committed row, keeps it across a reopen and drops it on cancel", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit: vi.fn(),
      onSaveDrafts: vi.fn(),
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);

    expect(edit.state.committedValues["1"]?.name).toBe("Annika");

    // Reopened: undecided again, and the snapshot stays, so the row keeps
    // the place the last decision gave it.
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annalena");
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.committedValues["1"]?.name).toBe("Annika");

    edit.cancel("1");

    expect(edit.state.committedValues["1"]).toBeUndefined();
  });

  it("refreshes the snapshot when a parked row is written to again", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onCommit: vi.fn(),
      onSaveDrafts: vi.fn(),
    });
    const { edit } = grid.current;

    await expect(edit.setCellValue("1", "name", "Annika")).resolves.toBe(true);
    expect(edit.state.committedValues["1"]?.name).toBe("Annika");

    // A second write commits the row afresh - it never left the draft store,
    // and the table has to see both values.
    await expect(edit.setCellValue("1", "age", 44)).resolves.toBe(true);

    expect(edit.state.committedValues["1"]).toMatchObject({
      name: "Annika",
      age: 44,
    });
  });
});

/**
 * `editing.columns` - the allowlist. It gates before `meta.edit` and never
 * past it, so both halves are tested: a column left out takes no edit whatever
 * its meta says, and a column listed still answers to its own meta.
 */
describe("editing.columns", () => {
  const gatedColumns = helper.columns([
    helper.accessor("name", { header: "Name" }),
    // Switched on by its own meta and left out of the list below, with a rule
    // no listed column has to satisfy.
    helper.accessor("age", {
      header: "Age",
      meta: {
        type: "number",
        edit: { enabled: true, validate: z.number().max(0, "Too big") },
      },
    }),
    // Listed below, and switched off by its own meta all the same.
    helper.accessor("address.city", {
      header: "City",
      id: "city",
      meta: { edit: { enabled: false } },
    }),
  ]);

  function renderGatedGrid(
    editing: Partial<TMDataGridEditingOptions<Person>> = {},
  ) {
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: people,
          columns: gatedColumns,
          getRowId: (row) => String(row.id),
          editing: { mode: "cell", columns: ["name", "city"], ...editing },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    return result;
  }

  /** The erasure the context provider performs - `canEditCell` is chrome. */
  const columnOf = (api: TMDataGridApi<Person>, columnId: string) => {
    const table = api.table as unknown as TMDataGridApi<TMDataGridRowData>["table"];
    const column = table.getColumn(columnId);
    if (column === undefined) throw new Error(`no column "${columnId}"`);
    return column;
  };

  it("isColumnEditable takes every column mapping to a field while it is unset", () => {
    const grid = renderEditGrid();
    const { edit } = grid.current;

    expect(edit.isColumnEditable(columnOf(grid.current, "name"))).toBe(true);
    expect(edit.isColumnEditable(columnOf(grid.current, "age"))).toBe(true);
    // No accessorKey and no meta.edit.field - nothing to write to.
    expect(edit.isColumnEditable(columnOf(grid.current, "display"))).toBe(false);
    expect(edit.isColumnEditable(columnOf(grid.current, "readonlyName"))).toBe(
      false,
    );
  });

  it("isColumnEditable gates on the list before meta.edit, and never past it", () => {
    const grid = renderGatedGrid();
    const { edit } = grid.current;

    expect(edit.isColumnEditable(columnOf(grid.current, "name"))).toBe(true);
    // Listed, and its own meta still switches it off.
    expect(edit.isColumnEditable(columnOf(grid.current, "city"))).toBe(false);
    // Switched on by its own meta, and still left out of the list.
    expect(edit.isColumnEditable(columnOf(grid.current, "age"))).toBe(false);
  });

  it("canEditCell agrees with isColumnEditable where no row predicate speaks", () => {
    const grid = renderGatedGrid();
    const { edit } = grid.current;
    const table = grid.current
      .table as unknown as TMDataGridApi<TMDataGridRowData>["table"];
    const row = table.getRow("1");

    for (const columnId of ["name", "age", "city"]) {
      const column = columnOf(grid.current, columnId);
      expect(edit.canEditCell(row, column), columnId).toBe(
        edit.isColumnEditable(column),
      );
    }
  });

  it("setCellValue refuses a column the list leaves out", async () => {
    const onCommit = vi.fn();
    const grid = renderGatedGrid({ onCommit });
    const { edit } = grid.current;

    await expect(edit.setCellValue("1", "age", 40)).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("keeps an unlisted column out of the diff and out of the submit pass", async () => {
    const onCommit = vi.fn();
    const grid = renderGatedGrid({ onCommit });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    // Past the allowlist: `age` now holds a value its own rule would reject,
    // and the row's form neither reports it as a change nor validates it.
    edit.getForm("1")?.setFieldValue("age", 99);

    expect(edit.state.rows["1"]?.dirtyFields).toEqual(["name"]);

    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onCommit).toHaveBeenCalledTimes(1);
    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes.map((change) => change.columnId)).toEqual(["name"]);
  });
});

/**
 * `editing.tableValidators` - the rules that need the other rows. What these
 * guard is the collection the validator is handed - drafts overlaid, entry
 * rows appended, deletion marks removed - and that its result lands on the
 * committing row the way every other validator's does.
 */
describe("editing.tableValidators", () => {
  /** The stock cross-row rule: no two rows may carry the same name. */
  const noDuplicateNames: TMDataGridTableValidators<Person> = {
    onSubmit: ({ value, rowId, rows }) =>
      rows.some((row) => row.rowId !== rowId && row.value.name === value.name)
        ? { fields: { name: "Duplicate name" } }
        : undefined,
  };

  it("refuses a commit that duplicates another row, with the error on the cell", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({
      onCommit,
      tableValidators: noDuplicateNames,
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Anna");

    await expect(edit.commit("2")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual(["2"]);
    expect(edit.state.rows["2"]?.errorFields).toContain("name");
    expect(edit.state.rows["2"]?.errorMessages).toContainEqual({
      field: "name",
      message: "Duplicate name",
    });

    // And the same commit lands once the clash is gone.
    edit.getForm("2")?.setFieldValue("name", "Erika");
    await expect(edit.commit("2")).resolves.toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("hands the validator every row, the committing one as drafted", async () => {
    let seen: TMDataGridTableValidateArgs<Person> | undefined;
    const grid = renderEditGrid({
      onCommit: vi.fn(),
      tableValidators: {
        onSubmit: (args) => {
          seen = args;
          return undefined;
        },
      },
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(true);

    expect(seen?.rowId).toBe("1");
    expect(seen?.isNew).toBe(false);
    expect(seen?.value.name).toBe("Annika");
    expect(seen?.rows.map((row) => row.rowId)).toEqual(["1", "2"]);
    // The committing row as submitted, not as `data` still has it; the row
    // nobody is editing exactly as `data` has it.
    expect(seen?.rows[0]?.value.name).toBe("Annika");
    expect(seen?.rows[1]?.value).toEqual(people[1]);
  });

  it("sees a parked draft, not the data its row was loaded with", async () => {
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
      tableValidators: noDuplicateNames,
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Zoe");
    await expect(edit.commit("1")).resolves.toBe(true);

    // "Zoe" is in no row's data - it exists only in row one's parked draft,
    // so this clash is one the overlay is the only way to see.
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Zoe");

    await expect(edit.commit("2")).resolves.toBe(false);

    expect(edit.state.committedRowIds).toEqual(["1"]);
    expect(edit.state.openRowIds).toEqual(["1", "2"]);
    expect(edit.state.rows["2"]?.errorFields).toContain("name");
  });

  it("re-runs the table rules at saveDrafts and reopens a draft the rule now rejects", async () => {
    const onSaveDrafts = vi.fn();
    let clashes = false;
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts,
      tableValidators: {
        onSubmit: () =>
          clashes
            ? { form: "Table rule broken", fields: { name: "Duplicate name" } }
            : undefined,
      },
    });
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");
    await expect(edit.commit("1")).resolves.toBe(true);
    expect(edit.state.committedRowIds).toEqual(["1"]);

    // The collection moved under the parked row - a later edit elsewhere is
    // what this stands in for.
    clashes = true;

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: false });

    // Nothing valid to send, and the row is open again with the rule's
    // answer on it - "committed" means validated, so a draft the rules now
    // refuse cannot stay in the store.
    expect(onSaveDrafts).not.toHaveBeenCalled();
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.getForm("1")).toBeDefined();
    expect(edit.state.rows["1"]?.errorFields).toContain("name");
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
  });

  it("leaves onSubmitAsync unasked once onSubmit has failed", async () => {
    const onSubmitAsync = vi.fn();
    const grid = renderEditGrid({
      onCommit: vi.fn(),
      tableValidators: { onSubmit: () => "Table rule broken", onSubmitAsync },
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(onSubmitAsync).not.toHaveBeenCalled();
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
  });

  it("runs onSubmitAsync when onSubmit passes, and honours its error", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({
      onCommit,
      tableValidators: {
        onSubmit: () => undefined,
        onSubmitAsync: () => Promise.resolve({ fields: { name: "Taken" } }),
      },
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.rows["1"]?.errorMessages).toContainEqual({
      field: "name",
      message: "Taken",
    });
  });

  it("carries an entry row: once in its own view, and again in the next row's", async () => {
    const seen: Array<TMDataGridTableValidateArgs<Person>> = [];
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
      tableValidators: {
        onSubmit: (args) => {
          seen.push(args);
          return undefined;
        },
      },
    });
    const { edit } = grid.current;

    const tempId = edit.addRow({ name: "Ny", age: 30 });
    await expect(edit.commit(tempId)).resolves.toBe(true);

    // The entry row's own commit: reported as new, and present in `rows`
    // exactly once - appended, never doubled by the entry-row pass.
    expect(seen[0]?.rowId).toBe(tempId);
    expect(seen[0]?.isNew).toBe(true);
    expect(seen[0]?.value.name).toBe("Ny");
    expect(seen[0]?.rows.map((row) => row.rowId)).toEqual(["1", "2", tempId]);

    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik B");
    await expect(edit.commit("2")).resolves.toBe(true);

    // And a data row committed afterwards sees the parked entry's values -
    // once, at the front: a committed entry row is in the table's own rows
    // by then, ahead of `data`.
    expect(seen[1]?.isNew).toBe(false);
    expect(seen[1]?.rows.map((row) => row.rowId)).toEqual([tempId, "1", "2"]);
    expect(seen[1]?.rows.find((row) => row.rowId === tempId)?.value.name).toBe(
      "Ny",
    );
  });

  it("leaves a row marked for deletion out of the view", async () => {
    let seen: TMDataGridTableValidateArgs<Person> | undefined;
    const grid = renderEditGrid({
      mode: "row",
      draft: true,
      onSaveDrafts: vi.fn(),
      tableValidators: {
        onSubmit: (args) => {
          seen = args;
          return undefined;
        },
      },
    });
    const { edit } = grid.current;

    edit.deleteRow("1");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Erik B");

    await expect(edit.commit("2")).resolves.toBe(true);

    // A rule counting or totalling rows must not count one on its way out.
    expect(seen?.rows.map((row) => row.rowId)).toEqual(["2"]);
  });

  it("merges its result with the row's own validators", async () => {
    const onCommit = vi.fn();
    const grid = renderEditGrid({
      onCommit,
      tableValidators: { onSubmit: () => "Table rule broken" },
      rowValidators: {
        onSubmitAsync: () => ({ fields: { age: "Too young" } }),
      },
    });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await expect(edit.commit("1")).resolves.toBe(false);

    // Both sources land: the pathless one on the row, the pathed one on its
    // cell - neither swallows the other.
    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.rows["1"]?.hasRowError).toBe(true);
    expect(edit.state.rows["1"]?.errorMessages).toContainEqual({
      field: "age",
      message: "Too young",
    });
  });

  it("wins a field the column rules also spoke for", async () => {
    const validatedColumns = helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { edit: { validate: z.string().min(2, "Too short") } },
      }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]);
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: people,
          columns: validatedColumns,
          getRowId: (row) => String(row.id),
          editing: {
            mode: "cell",
            onCommit: vi.fn(),
            tableValidators: {
              onSubmit: () => ({ fields: { name: "Duplicate name" } }),
            },
          },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    const { edit } = result.current;
    edit.begin({ rowId: "1", columnId: "name" });
    // Fails the column's rule and the table rule at once.
    edit.getForm("1")?.setFieldValue("name", "A");

    await expect(edit.commit("1")).resolves.toBe(false);

    // The column rules are the earlier source, so the table rule's message is
    // the one the cell carries.
    expect(edit.state.rows["1"]?.errorMessages).toContainEqual({
      field: "name",
      message: "Duplicate name",
    });
  });
});

describe("bulk deletes over the draft store", () => {
  const manyPeople: Array<Person> = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `Person ${index + 1}`,
    age: 20 + index,
    address: { city: "Stockholm" },
  }));

  function renderBulkGrid() {
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: manyPeople,
          columns,
          getRowId: (row) => String(row.id),
          editing: {
            mode: "row",
            draft: true,
            onSaveDrafts: vi.fn(),
            newRowDefaults: () => ({
              id: 0,
              name: "",
              age: 0,
              address: { city: "" },
            }),
          },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    return result;
  }

  /** What the Save button counts - `useDraftCount` in TMDataGridDraftActions. */
  const draftCount = (state: TMDataGridEditState): number =>
    state.committedRowIds.length +
    state.newRows.filter((newRow) => newRow.committed).length +
    state.deletedRowIds.length;

  /** Three entry rows, filled and committed - the reported setup. */
  async function commitThreeEntryRows(
    edit: TMDataGridApi<Person>["edit"],
  ): Promise<Array<string>> {
    const tempIds = [
      edit.addRow({ name: "Ny 1", age: 30 }),
      edit.addRow({ name: "Ny 2", age: 31 }),
      edit.addRow({ name: "Ny 3", age: 32 }),
    ];
    for (const tempId of tempIds) {
      await edit.commit(tempId);
    }
    return tempIds;
  }

  it("keeps the count right through the reported flow with disjoint ids", async () => {
    const grid = renderBulkGrid();
    const { edit } = grid.current;
    const tempIds = await commitThreeEntryRows(edit);
    expect(draftCount(edit.state)).toBe(3); // "Save 3 rows"

    // The trash press on one data row.
    edit.deleteRow("1");
    expect(draftCount(edit.state)).toBe(4);

    // The multi delete: two committed entry rows, two data rows - none of
    // them marked already.
    for (const rowId of [tempIds[0]!, tempIds[1]!, "2", "3"]) {
      edit.deleteRow(rowId);
    }

    expect(edit.state.newRows).toEqual([
      { tempId: tempIds[2], committed: true },
    ]);
    expect(edit.state.deletedRowIds).toEqual(["1", "2", "3"]);
    expect(edit.state.committedRowIds).toEqual([]);
    expect(draftCount(edit.state)).toBe(4);
  });

  it("a bulk delete that includes the already-marked row keeps its mark", async () => {
    const grid = renderBulkGrid();
    const { edit } = grid.current;
    await commitThreeEntryRows(edit);

    edit.deleteRow("1"); // the trash press
    // The multi delete's selection happens to include row 1 as well.
    for (const rowId of ["1", "2", "3"]) {
      edit.deleteRow(rowId);
    }

    // Deleting a row twice is still deleting it - a bulk delete must not
    // resurrect the row the user trashed by hand.
    expect(edit.state.deletedRowIds).toEqual(
      expect.arrayContaining(["1", "2", "3"]),
    );
    expect(draftCount(edit.state)).toBe(6);
  });

  it("deleteRows takes the selection as it stands - entry rows, marked rows, stale ids", async () => {
    const grid = renderBulkGrid();
    const { edit } = grid.current;
    const tempIds = await commitThreeEntryRows(edit);
    edit.deleteRow("1"); // the trash press

    // The whole selection in one call: two committed entry rows, the row
    // already marked, two data rows, a duplicate and an id nobody knows.
    edit.deleteRows([
      tempIds[0]!,
      tempIds[1]!,
      "1",
      "2",
      "3",
      "3",
      "no-such-row",
    ]);

    expect(edit.state.newRows).toEqual([
      { tempId: tempIds[2], committed: true },
    ]);
    expect(edit.state.deletedRowIds).toEqual(["1", "2", "3"]);
    expect(draftCount(edit.state)).toBe(4); // "Save 4 rows", stably
  });

  it("ignores an id the grid does not know", () => {
    const grid = renderBulkGrid();
    const { edit } = grid.current;

    edit.deleteRow("no-such-row");

    expect(edit.state.deletedRowIds).toEqual([]);
    expect(draftCount(edit.state)).toBe(0);
  });

  it("deleteRow twice on a committed entry row discards it once, marking nothing", async () => {
    const grid = renderBulkGrid();
    const { edit } = grid.current;
    const [tempId] = await commitThreeEntryRows(edit);

    // A stale selection or a double-fired handler names the entry row again
    // after the first call has already discarded it.
    edit.deleteRow(tempId!);
    edit.deleteRow(tempId!);

    // The discarded entry is gone; its temp id must not live on as a
    // deletion mark the save would then report.
    expect(
      edit.state.newRows.map((newRow) => newRow.tempId),
    ).not.toContain(tempId);
    expect(edit.state.deletedRowIds).toEqual([]);
    expect(draftCount(edit.state)).toBe(2);
  });

  it("a bulk delete drops the discarded entry rows from rowSelection, in one update", async () => {
    const grid = renderBulkGrid();
    const { edit, table } = grid.current;
    const tempIds = await commitThreeEntryRows(edit);
    // The reported flow: a selection mixing committed entry rows and data
    // rows, fed to deleteRows as it stands.
    act(() => {
      table.setRowSelection({
        [tempIds[0]!]: true,
        [tempIds[1]!]: true,
        "1": true,
        "2": true,
      });
    });
    // One selection publish for the whole batch, however many rows leave.
    let selectionPublishes = 0;
    let lastSelection = table.store.state.rowSelection;
    const subscription = table.store.subscribe((state) => {
      if (state.rowSelection !== lastSelection) {
        lastSelection = state.rowSelection;
        selectionPublishes += 1;
      }
    });

    act(() => {
      edit.deleteRows([tempIds[0]!, tempIds[1]!, "1", "2"]);
    });
    subscription.unsubscribe();

    // The entry rows left the table, and the selection with them. The data
    // rows are only marked - still in the grid, but a marked row is not
    // selectable, so they are unticked too, in the same update.
    expect(table.store.state.rowSelection).toEqual({});
    expect(table.getIsSomeRowsSelected()).toBe(false);
    expect(selectionPublishes).toBe(1);
  });

  it("select-all skips marked rows and still reads as all selected", async () => {
    const grid = renderBulkGrid();
    const { edit, table } = grid.current;
    edit.deleteRows(["1", "2"]);

    act(() => {
      table.toggleAllRowsSelected(true);
    });

    const selected = Object.keys(table.store.state.rowSelection);
    expect(selected).not.toContain("1");
    expect(selected).not.toContain("2");
    expect(selected).toHaveLength(manyPeople.length - 2);
    // Every selectable row is selected: the header box shows a tick, not a
    // dash, which is what `getIsAllRowsSelected` decides.
    expect(table.getIsAllRowsSelected()).toBe(true);
    expect(table.getRow("1").getCanSelect()).toBe(false);

    edit.restoreRow("1");
    expect(table.getRow("1").getCanSelect()).toBe(true);
  });

  it("cancelling a committed entry row drops its selection too", async () => {
    const grid = renderBulkGrid();
    const { edit, table } = grid.current;
    const [tempId] = await commitThreeEntryRows(edit);
    act(() => {
      table.setRowSelection({ [tempId!]: true, "1": true });
    });

    act(() => {
      edit.cancel(tempId!);
    });

    expect(table.store.state.rowSelection).toEqual({ "1": true });
  });

  it("saveDrafts drops saved deletions and saved entry rows from rowSelection, keeps edited rows", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit, table } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna Edited");
    await expect(edit.commit("1")).resolves.toBe(true);
    edit.deleteRow("2");
    const tempId = edit.addRow({ name: "Ny", age: 30 });
    await expect(edit.commit(tempId)).resolves.toBe(true);
    act(() => {
      table.setRowSelection({ "1": true, "2": true, [tempId]: true });
    });

    await act(async () => {
      await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    });

    // Row 2 is being deleted by the consumer and the entry row comes back
    // under its real id, so neither can stay selected. Row 1 is still the
    // same record, edited - its selection is the user's.
    expect(table.store.state.rowSelection).toEqual({ "1": true });
  });

  it("saveDrafts on the per-row path drops a deletion's selection once onRowDelete has it", async () => {
    const onRowDelete = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onRowDelete });
    const { edit, table } = grid.current;
    edit.deleteRow("2");
    act(() => {
      table.setRowSelection({ "1": true, "2": true });
    });

    await act(async () => {
      await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });
    });

    expect(onRowDelete).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: "2" }),
    );
    expect(table.store.state.rowSelection).toEqual({ "1": true });
  });

  it("saveDrafts on the per-row path keeps a deletion whose onRowDelete throws", async () => {
    const onRowDelete = vi.fn(({ rowId }: { rowId: string }) => {
      if (rowId === "2") throw new Error("Server said no");
    });
    const grid = renderEditGrid({ mode: "row", draft: true, onRowDelete });
    const { edit } = grid.current;
    edit.deleteRow("1");
    edit.deleteRow("2");

    await act(async () => {
      await expect(edit.saveDrafts()).resolves.toEqual({
        ok: false,
        saved: ["1"],
        kept: ["2"],
        reopened: [],
      });
    });

    // The refused deletion keeps its mark, and the next save sends it again.
    expect(edit.state.deletedRowIds).toEqual(["2"]);
    onRowDelete.mockImplementation(() => {});
    await act(async () => {
      await expect(edit.saveDrafts()).resolves.toMatchObject({
        ok: true,
        saved: ["2"],
      });
    });
    expect(edit.state.deletedRowIds).toEqual([]);
  });

  it("a deletion mark makes the row read-only and unselectable until restored", async () => {
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts: vi.fn() });
    const { edit, table } = grid.current;
    act(() => {
      table.setRowSelection({ "1": true, "2": true });
    });

    edit.deleteRow("1");

    // The mark drops the row from the selection and refuses it back.
    expect(table.store.state.rowSelection).toEqual({ "2": true });
    expect(table.getRow("1").getCanSelect()).toBe(false);
    // And every way into an editor - the verbs and the keyboard's `begin`.
    expect(edit.canEditRow(table.getRow("1") as never)).toBe(false);
    edit.begin({ rowId: "1", columnId: "name" });
    expect(edit.getForm("1")).toBeUndefined();
    await expect(edit.setCellValue("1", "name", "Nope")).resolves.toBe(false);
    expect(edit.getRowValues("1")?.name).toBe("Anna");

    edit.restoreRow("1");
    expect(table.getRow("1").getCanSelect()).toBe(true);
    await expect(edit.setCellValue("1", "name", "Yes")).resolves.toBe(true);
  });

  it("marking a row cancels its open editor and keeps a committed edit under the mark", async () => {
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts: vi.fn() });
    const { edit } = grid.current;
    await edit.setCellValue("1", "name", "Edited");
    edit.begin({ rowId: "2", columnId: "name" });
    edit.getForm("2")?.setFieldValue("name", "Typing");

    edit.deleteRows(["1", "2"]);

    expect(edit.getForm("2")).toBeUndefined();
    expect(edit.state.openRowIds).toEqual(["1"]);
    expect(edit.state.committedRowIds).toEqual(["1"]);
    expect(edit.state.deletedRowIds).toEqual(["1", "2"]);
    expect(edit.getRowValues("2")?.name).toBe("Erik");
    // Restore brings the row back as it was edited.
    edit.restoreRow("1");
    expect(edit.getRowValues("1")?.name).toBe("Edited");
  });

  it("saveDrafts sends a marked row as deleted only, and forgets its edit once saved", async () => {
    const onSaveDrafts = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit } = grid.current;
    await edit.setCellValue("1", "name", "Edited");
    edit.deleteRow("1");

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    const args = onSaveDrafts.mock.calls[0]?.[0] as {
      updated: Array<{ rowId: string }>;
      deleted: Array<string>;
    };
    expect(args.updated).toEqual([]);
    expect(args.deleted).toEqual(["1"]);
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
  });

  it("a rejected deletion keeps the mark and the edit under it", async () => {
    const onSaveDrafts = vi.fn().mockResolvedValue({ deleted: { "1": false } });
    const grid = renderEditGrid({ mode: "row", draft: true, onSaveDrafts });
    const { edit, table } = grid.current;
    await edit.setCellValue("1", "name", "Edited");
    edit.deleteRow("1");

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: false });

    expect(edit.state.committedRowIds).toEqual(["1"]);
    expect(edit.state.deletedRowIds).toEqual(["1"]);
    expect(edit.getRowValues("1")?.name).toBe("Edited");
    expect(table.getRow("1").getCanSelect()).toBe(false);
  });

  it("the per-row save path reports a marked row's deletion only", async () => {
    const onCommit = vi.fn();
    const onRowDelete = vi.fn();
    const grid = renderEditGrid({ mode: "row", draft: true, onCommit, onRowDelete });
    const { edit } = grid.current;
    await edit.setCellValue("1", "name", "Edited");
    edit.deleteRow("1");

    await expect(edit.saveDrafts()).resolves.toMatchObject({ ok: true });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onRowDelete).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: "1" }),
    );
    expect(edit.state.committedRowIds).toEqual([]);
  });

  /** A draft grid whose `data` can be swapped, the way a refetch would. */
  function renderSwappableGrid(
    extra: Partial<UseTMDataGridOptions<Person>> = {},
  ) {
    return renderHook(
      ({ data }: { data: Array<Person> }) =>
        useTMDataGrid<Person>({
          data,
          columns,
          getRowId: (row) => String(row.id),
          editing: {
            mode: "row",
            draft: true,
            onSaveDrafts: vi.fn(),
            newRowDefaults: () => ({
              id: 0,
              name: "",
              age: 0,
              address: { city: "" },
            }),
          },
          ...extra,
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper, initialProps: { data: people } },
    );
  }

  it("a refetch that drops a record drops its draft, its editor and its mark", async () => {
    const { result, rerender } = renderSwappableGrid();
    await result.current.edit.setCellValue("1", "name", "Edited");
    result.current.edit.deleteRow("2");
    const tempId = result.current.edit.addRow({ name: "Ny", age: 1 });

    rerender({ data: [] });

    const { edit } = result.current;
    expect(edit.state.committedRowIds).toEqual([]);
    expect(edit.state.deletedRowIds).toEqual([]);
    // Entry rows are the engine's own and stay.
    expect(edit.state.newRows.map((newRow) => newRow.tempId)).toEqual([
      tempId,
    ]);
  });

  it("keeps drafts for rows missing from a server-side page", async () => {
    const { result, rerender } = renderSwappableGrid({
      manualPagination: true,
      rowCount: 10,
    });
    await result.current.edit.setCellValue("1", "name", "Edited");
    result.current.edit.deleteRow("2");

    // The next page: the rows are elsewhere, not gone.
    rerender({ data: [] });

    expect(result.current.edit.state.committedRowIds).toEqual(["1"]);
    expect(result.current.edit.state.deletedRowIds).toEqual(["2"]);
  });

  it("a discarded entry row leaves expanded and rowPinning too", async () => {
    const { result } = renderSwappableGrid({
      enableRowPinning: true,
      renderDetails: () => null,
    });
    const api = result.current;
    let tempId = "";
    await act(async () => {
      const added = await api.edit.addRows([{ name: "Ny", age: 1 }], {
        commit: true,
      });
      tempId = added.committed[0]!;
    });
    act(() => {
      api.table.getRow(tempId).pin("top");
      api.table.getRow(tempId).toggleExpanded(true);
      api.table.getRow("1").pin("top");
      api.table.getRow("1").toggleExpanded(true);
    });

    act(() => {
      api.edit.deleteRow(tempId);
    });

    expect(api.table.store.state.rowPinning.top).toEqual(["1"]);
    expect(api.table.store.state.expanded).toEqual({ "1": true });
  });

  it("cancel during a pending commit leaves no ghost committed row", async () => {
    const grid = renderBulkGrid();
    const { edit } = grid.current;

    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Ändrad");
    const pending = edit.commit("1");
    // The row is dropped while the commit's async validation is in flight.
    edit.cancel("1");
    await pending;

    // Nothing may claim the row is in the draft store - a ghost id there
    // inflates the Save count and can never be saved or cleared. A committed
    // row has no form either, so the two assertions below are what carry
    // this: the store itself has to be empty.
    expect(edit.getForm("1")).toBe(undefined);
    expect(edit.state.committedRowIds).toEqual([]);
    expect(draftCount(edit.state)).toBe(0);
  });
});

/**
 * `meta.edit.mapCommitValue` - maps a changed field once, as its row commits.
 * What these guard is where in the commit it runs (before the validators, into
 * the form) and which writes it leaves alone.
 */
describe("meta.edit.mapCommitValue", () => {
  const trimmed = helper.columns([
    helper.accessor("name", {
      header: "Name",
      meta: {
        edit: {
          validate: { onSubmit: z.string().min(1, "Required") },
          mapCommitValue: ({ value }) =>
            typeof value === "string" ? value.trim() : value,
        },
      },
    }),
    helper.accessor("address.city", {
      id: "city",
      header: "City",
      meta: {
        edit: {
          mapCommitValue: ({ value }) =>
            typeof value === "string" ? value.trim() : value,
        },
      },
    }),
  ]);

  const spacedPeople: Array<Person> = [
    { id: 1, name: "Anna", age: 34, address: { city: "Stockholm " } },
  ];

  function renderTrimGrid(
    editing: Partial<TMDataGridEditingOptions<Person>> = {},
  ) {
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: spacedPeople,
          columns: trimmed,
          getRowId: (row) => String(row.id),
          editing: { mode: "cell", ...editing },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    return result;
  }

  it("hands onCommit the mapped value and writes it back into the form", async () => {
    const onCommit = vi.fn();
    const grid = renderTrimGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    // Typing keeps the space; only the commit trims it.
    edit.getForm("1")?.setFieldValue("name", "Annika ");
    expect(edit.getForm("1")?.state.values.name).toBe("Annika ");

    await expect(edit.commit("1")).resolves.toBe(true);

    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.value.name).toBe("Annika");
    expect(args.changes).toEqual([
      expect.objectContaining({ field: "name", previous: "Anna", next: "Annika" }),
    ]);
  });

  it("runs before the submit validators", async () => {
    const onCommit = vi.fn();
    const grid = renderTrimGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "   ");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.getForm("1")?.state.values.name).toBe("");
    expect(edit.state.rows["1"]?.errorFields).toContain("name");
  });

  it("leaves a field the user did not change as it was stored", async () => {
    const onCommit = vi.fn();
    const grid = renderTrimGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika");

    await edit.commit("1");

    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.value.address.city).toBe("Stockholm ");
  });

  it("drops a commit whose mapped value is the stored one", async () => {
    const onCommit = vi.fn();
    const grid = renderTrimGrid({ onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Anna ");

    await expect(edit.commit("1")).resolves.toBe(true);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.openRowIds).toEqual([]);
  });

  it("parks the mapped value in the draft store", async () => {
    const grid = renderTrimGrid({ mode: "row", draft: true });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "Annika ");

    await edit.commit("1");

    expect(edit.state.committedValues["1"]?.name).toBe("Annika");
  });

  it("does not run for a value the caller writes itself", async () => {
    const onCommit = vi.fn();
    const grid = renderTrimGrid({ onCommit });
    const { edit } = grid.current;

    await edit.setCellValue("1", "name", "Annika ");

    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.changes[0]?.next).toBe("Annika ");
  });

  it("maps what the user typed when a caller's write commits the same row", async () => {
    const onCommit = vi.fn();
    const grid = renderTrimGrid({ mode: "row", onCommit });
    const { edit } = grid.current;
    edit.begin({ rowId: "1", columnId: null });
    edit.getForm("1")?.setFieldValue("name", "Annika ");

    // The Delete key in another cell of the open row - its write is the
    // caller's, the name is still the user's.
    await expect(edit.clearCell("1", "city")).resolves.toBe(true);

    const args = onCommit.mock
      .calls[0]?.[0] as TMDataGridEditCommitArgs<Person>;
    expect(args.value.name).toBe("Annika");
    expect(args.value.address.city).toBe("");
  });

  it("runs before a bare validate, which means onChange", async () => {
    const required = helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: {
          edit: {
            validate: z.string().min(1, "Required"),
            mapCommitValue: ({ value }) =>
              typeof value === "string" ? value.trim() : value,
          },
        },
      }),
    ]);
    const onCommit = vi.fn();
    const { result } = renderHook(
      () =>
        useTMDataGrid<Person>({
          data: spacedPeople,
          columns: required,
          getRowId: (row) => String(row.id),
          editing: { mode: "cell", onCommit },
        } as UseTMDataGridOptions<Person>),
      { wrapper: MantineWrapper },
    );
    const { edit } = result.current;
    edit.begin({ rowId: "1", columnId: "name" });
    edit.getForm("1")?.setFieldValue("name", "   ");

    await expect(edit.commit("1")).resolves.toBe(false);

    expect(onCommit).not.toHaveBeenCalled();
    expect(edit.state.rows["1"]?.errorFields).toContain("name");
  });

  it("maps every field of a row being added", async () => {
    const onRowAdd = vi.fn();
    const grid = renderTrimGrid({
      onRowAdd,
      newRowDefaults: () => ({
        id: 9,
        name: " Nils ",
        age: 20,
        address: { city: " Lund " },
      }),
    });
    const { edit } = grid.current;
    const tempId = edit.addRow();

    await expect(edit.commit(tempId)).resolves.toBe(true);

    const args = onRowAdd.mock.calls[0]?.[0] as {
      value: Person;
    };
    expect(args.value.name).toBe("Nils");
    expect(args.value.address.city).toBe("Lund");
  });
});
