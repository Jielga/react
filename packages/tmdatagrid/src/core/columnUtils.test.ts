import { describe, expect, it } from "vitest";
import { erased, renderGrid, type TestRow } from "../../test/gridHarness";
import { createTMDataGridColumnHelper } from "../useTMDataGrid";
import { getOperatorsForType } from "./filterOperators";
import {
  getColumnDefaultOperator,
  getColumnOperators,
  isColumnReorderable,
  showColumnSearch,
} from "./columnUtils";

/**
 * The trivial meta readers (`getColumnLabel`, `getColumnType`,
 * `getColumnAlign`) are exercised all over the component suite; what earns
 * tests here are the two helpers carrying an actual rule - the header-group
 * ordering ban, and the filter-operator fallback chain - asked of real
 * TanStack columns, whose `parent` wiring is the thing under test.
 */
const helper = createTMDataGridColumnHelper<TestRow>();

const groupedColumns = helper.columns([
  helper.group({
    id: "person",
    header: "Person",
    columns: helper.columns([
      helper.accessor("name", { header: "Name" }),
      helper.accessor("age", { header: "Age", meta: { type: "number" } }),
    ]),
  }),
  helper.accessor("city", { header: "City" }),
  helper.accessor("id", {
    header: "ID",
    meta: { type: "number", enableOrdering: false },
  }),
]);

function columnOf(id: string) {
  const api = erased(
    renderGrid({ columns: groupedColumns } as never).result.current,
  );
  const column = api.table.getColumn(id);
  if (column === undefined) throw new Error(`no column "${id}"`);
  return column;
}

describe("isColumnReorderable", () => {
  it("allows a top-level column", () => {
    expect(isColumnReorderable(columnOf("city"))).toBe(true);
  });

  it("refuses a leaf inside a header group, whatever its own meta says", () => {
    // Moving it out from under the group would leave the group header
    // spanning columns that no longer belong to it.
    expect(isColumnReorderable(columnOf("name"))).toBe(false);
    expect(isColumnReorderable(columnOf("age"))).toBe(false);
  });

  it("obeys meta.enableOrdering on a column that could otherwise move", () => {
    expect(isColumnReorderable(columnOf("id"))).toBe(false);
  });
});

describe("getColumnDefaultOperator", () => {
  it("falls back to the type's default operator", () => {
    expect(getColumnDefaultOperator(columnOf("city"))).toBe("contains");
    expect(getColumnDefaultOperator(columnOf("age"))).toBe("equals");
  });

  it("prefers meta.filter.defaultOperator when the column names one", () => {
    const columns = helper.columns([
      helper.accessor("name", {
        header: "Name",
        meta: { filter: { defaultOperator: "startsWith" } },
      }),
    ]);
    const api = erased(renderGrid({ columns } as never).result.current);

    const column = api.table.getColumn("name");
    expect(column && getColumnDefaultOperator(column)).toBe("startsWith");
  });
});

describe("getColumnOperators", () => {
  function columnWith(filter: Record<string, unknown>) {
    const columns = helper.columns([
      helper.accessor("age", { header: "Age", meta: { type: "number", filter } }),
    ]);
    const api = erased(renderGrid({ columns } as never).result.current);
    return api.table.getColumn("age")!;
  }

  it("offers the type's full list without an allowlist", () => {
    expect(getColumnOperators(columnOf("age"))).toEqual(
      getOperatorsForType("number"),
    );
  });

  it("narrows to meta.filter.operators in the type's order", () => {
    const column = columnWith({ operators: ["greaterThan", "equals", "isEmpty"] });
    expect(getColumnOperators(column)).toEqual(["equals", "greaterThan", "isEmpty"]);
  });

  it("drops operators the type does not offer, and falls back when nothing is left", () => {
    expect(getColumnOperators(columnWith({ operators: ["contains", "equals"] })))
      .toEqual(["equals"]);
    expect(getColumnOperators(columnWith({ operators: ["contains"] }))).toEqual(
      getOperatorsForType("number"),
    );
  });

  it("moves the default operator to the first offered one when the type's default is excluded", () => {
    expect(
      getColumnDefaultOperator(columnWith({ operators: ["greaterThan", "lessThan"] })),
    ).toBe("greaterThan");
    expect(
      getColumnDefaultOperator(columnWith({ operators: ["greaterThan", "equals"] })),
    ).toBe("equals");
    expect(
      getColumnDefaultOperator(
        columnWith({ operators: ["greaterThan", "lessThan"], defaultOperator: "lessThan" }),
      ),
    ).toBe("lessThan");
  });
});

describe("showColumnSearch", () => {
  it("reads `\"auto\"` as from six columns", () => {
    expect(showColumnSearch("auto", 5)).toBe(false);
    expect(showColumnSearch("auto", 6)).toBe(true);
  });

  it("reads a number as from that many columns", () => {
    expect(showColumnSearch(10, 9)).toBe(false);
    expect(showColumnSearch(10, 10)).toBe(true);
    expect(showColumnSearch(1, 1)).toBe(true);
  });

  it("reads a boolean as always or never", () => {
    expect(showColumnSearch(true, 1)).toBe(true);
    expect(showColumnSearch(false, 50)).toBe(false);
  });
});
