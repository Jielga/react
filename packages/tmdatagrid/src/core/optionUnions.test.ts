import { describe, expect, it } from "vitest";
import type { UseTMDataGridOptions } from "../useTMDataGrid";
import { useTMDataGrid } from "../useTMDataGrid";
import type { TMDataGridSortMode } from "./frozenSort";

/**
 * Compile-time contracts for the option unions. Nothing here runs: the hook
 * calls live in a function that is never invoked, and `tsc` is the assertion
 * - it fails the build on a missing error exactly as it does on a real one,
 * because an `@ts-expect-error` with nothing to swallow is itself an error.
 */

type Person = { id: number; name: string };
declare const data: Person[];
declare const columns: UseTMDataGridOptions<Person>["columns"];
declare const getRowId: (row: Person) => string;
declare const sortMode: TMDataGridSortMode;

export function useCompileTimeContracts() {
  // Legal: a draft store with its bulk save.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: { mode: "cell", draft: true, onSaveDrafts: async () => {} },
  });
  // Legal: a draft store without it - `saveDrafts` falls back to `onCommit`.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: { mode: "cell", draft: true },
  });
  // Legal: every mode combines with the flag - the axes are independent.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: { mode: "row", draft: true, onSaveDrafts: async () => {} },
  });
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: { mode: "cellConfirm", draft: true },
  });
  // Legal: the default - commits go straight out.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: { mode: "cell", onCommit: () => {} },
  });
  // Legal: the flag written out as its default.
  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: { mode: "row", draft: false, onCommit: () => {} },
  });
  // Legal: no editing at all.
  useTMDataGrid<Person>({ data, columns });
  // Legal: editing switched off by a condition - the object may be undefined.
  useTMDataGrid<Person>({ data, columns, getRowId, editing: undefined });

  // @ts-expect-error -- editing requires getRowId: the forms are keyed by row
  // id, and the index fallback points at a different record after any sort.
  useTMDataGrid<Person>({ data, columns, editing: { mode: "cell" } });

  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    // @ts-expect-error -- there is no store to save without `draft: true`,
    // so nothing would ever call this.
    editing: { mode: "cell", onSaveDrafts: async () => {} },
  });

  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    // @ts-expect-error -- entry rows only park under `draft: true`, so there
    // is nothing for them to stay sticky until.
    editing: { mode: "cell", newRowsSticky: true },
  });

  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    editing: {
      mode: "cell",
      draft: true,
      // @ts-expect-error -- the rename left no alias behind: `onCommitBatch`
      // is not an option under any configuration.
      onCommitBatch: async () => {},
    },
  });

  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    // @ts-expect-error -- `draft` is where a commit goes, not what counts as
    // one: it never replaced the mode.
    editing: { mode: "draft" },
  });

  useTMDataGrid<Person>({
    data,
    columns,
    getRowId,
    // @ts-expect-error -- `mode` is what the rest of the object acts on, so
    // an editing object without one is a compile error, not a dead option.
    editing: { onCommit: () => {} },
  });

  // Legal: a frozen sort with ids, and the mode from a variable.
  useTMDataGrid<Person>({ data, columns, getRowId, sortMode: "frozen" });
  useTMDataGrid<Person>({ data, columns, getRowId, sortMode });
  // Legal: the default needs no ids.
  useTMDataGrid<Person>({ data, columns, sortMode: "live" });

  // @ts-expect-error -- a frozen sort requires getRowId: the held order is
  // keyed by row id, and the index fallback moves it to another record.
  useTMDataGrid<Person>({ data, columns, sortMode: "frozen" });
  // @ts-expect-error -- the same for a mode that may be "frozen".
  useTMDataGrid<Person>({ data, columns, sortMode });
}

describe("option unions", () => {
  it("holds its contracts at compile time (see useCompileTimeContracts)", () => {
    // The real assertions are the @ts-expect-error lines above; this test
    // exists so the file counts as a suite.
    expect(typeof useCompileTimeContracts).toBe("function");
  });
});
