import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MantineWrapper } from "../../test/gridHarness";
import { draftCellContext } from "./draftCellContext";
import {
  createTMDataGridColumnHelper,
  useTMDataGrid,
  type TMDataGridApi,
  type TMDataGridRowData,
  type UseTMDataGridOptions,
} from "../index";

/**
 * The tripwire for a `@tanstack/table-core` beta bump. `draftCellContext`
 * rests on v9 building rows and cells as `Object.create(prototype)` instances
 * whose API methods dispatch on `this`, and on `row.getValue` reading
 * `_valuesCache` before it runs the column's accessor. A release that
 * constructs either differently, or moves the caches, breaks the wrapper
 * silently in the app and loudly here.
 */

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
  // A nested path - the accessor walks the dots into the draft.
  helper.accessor("address.city", { header: "City", id: "city" }),
  // No accessorKey: the value is derived, and `meta.edit.field` is what makes
  // the column editable at all.
  helper.accessor((row) => `${row.name} (${String(row.age)})`, {
    id: "display",
    header: "Display",
    meta: { edit: { field: "name" } },
  }),
]);

const people: Array<Person> = [
  { id: 1, name: "Anna", age: 34, address: { city: "Stockholm" } },
];

/** The row as drafted - every field moved away from `data`. */
const draft: TMDataGridRowData = {
  id: 1,
  name: "Annika",
  age: 35,
  address: { city: "Uppsala" },
};

/**
 * Real `Cell`s off a real table, the same erasure the context provider
 * performs: `draftCellContext` is written against the erased row type.
 */
function renderCells() {
  const { result } = renderHook(
    () =>
      useTMDataGrid<Person>({
        data: people,
        columns,
        getRowId: (row) => String(row.id),
      } as UseTMDataGridOptions<Person>),
    { wrapper: MantineWrapper },
  );
  const table = result.current
    .table as unknown as TMDataGridApi<TMDataGridRowData>["table"];
  const row = table.getRow("1");
  const cells = new Map(row.getAllCells().map((cell) => [cell.column.id, cell]));
  return (columnId: string) => {
    const cell = cells.get(columnId);
    if (cell === undefined) throw new Error(`No cell for ${columnId}`);
    return cell;
  };
}

describe("draftCellContext", () => {
  it("serves the draft's value to getValue and renderValue", () => {
    const cellFor = renderCells();

    const context = draftCellContext(cellFor("name"), draft);

    expect(context.getValue()).toBe("Annika");
    expect(context.renderValue()).toBe("Annika");
  });

  it("hands the renderer the draft as the row", () => {
    const cellFor = renderCells();

    const context = draftCellContext(cellFor("name"), draft);

    // The object itself, not a copy: a renderer reading `row.original.age`
    // reads the draft's age.
    expect(context.row.original).toBe(draft);
    expect(context.row.getValue("name")).toBe("Annika");
    expect(context.row.getValue("age")).toBe(35);
  });

  it("re-derives an accessorFn column from the draft", () => {
    const cellFor = renderCells();

    const context = draftCellContext(cellFor("display"), draft);

    // The accessor ran again over the draft - the caches the wrapper owns are
    // its own and start empty.
    expect(context.getValue()).toBe("Annika (35)");
  });

  it("reads a dot-path accessorKey out of the draft", () => {
    const cellFor = renderCells();

    const context = draftCellContext(cellFor("city"), draft);

    expect(context.getValue()).toBe("Uppsala");
  });

  it("leaves the real cell and row untouched", () => {
    const cellFor = renderCells();
    const cell = cellFor("name");

    draftCellContext(cell, draft);

    // Building a wrapper is not an edit: the committed row still reports
    // `data`, caches included.
    expect(cell.getValue()).toBe("Anna");
    expect(cell.renderValue()).toBe("Anna");
    expect(cell.row.original).toBe(people[0]);
    expect(cell.row.getValue("city")).toBe("Stockholm");
    expect(cellFor("display").getValue()).toBe("Anna (34)");
  });
});
