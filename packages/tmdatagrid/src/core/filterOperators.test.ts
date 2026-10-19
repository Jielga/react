import { describe, expect, it } from "vitest";
import { createTMDataGridColumnHelper } from "../useTMDataGrid";
import { TMDATAGRID_LABELS_SV } from "./labelsSv";
import {
  activeColumnFilters,
  emptyValueForOperator,
  formatFilterLabel,
  getDefaultOperator,
  getOperatorsForType,
  isFilterActive,
  isTMDataGridFilterValue,
  matchesFilter,
  operatorNeedsValue,
  operatorTakesArrayValue,
  operatorTakesRangeValue,
  type TMDataGridFilterFn,
  type TMDataGridFilterOperator,
  tmDataGridFilterFn,
} from "./filterOperators";

const match = (
  cellValue: unknown,
  operator: TMDataGridFilterOperator,
  value: string | ReadonlyArray<string> = "",
) => matchesFilter(cellValue, { operator, value });

describe("matchesFilter", () => {
  describe("string operators", () => {
    it("compares case-insensitively", () => {
      expect(match("Stockholm", "contains", "STOCK")).toBe(true);
      expect(match("Stockholm", "equals", "stockholm")).toBe(true);
      expect(match("Stockholm", "startsWith", "STO")).toBe(true);
      expect(match("Stockholm", "endsWith", "HOLM")).toBe(true);
    });

    it("rejects what does not match", () => {
      expect(match("Stockholm", "contains", "Malmö")).toBe(false);
      expect(match("Stockholm", "startsWith", "holm")).toBe(false);
      expect(match("Stockholm", "endsWith", "stock")).toBe(false);
      expect(match("Stockholm", "notEquals", "Stockholm")).toBe(false);
      expect(match("Stockholm", "notEquals", "Malmö")).toBe(true);
    });

    it("coerces a non-string cell to text", () => {
      expect(match(42, "contains", "4")).toBe(true);
      expect(match(null, "contains", "null")).toBe(false);
      expect(match(undefined, "startsWith", "undef")).toBe(false);
    });

    it("trims the needle and matches everything when it is blank", () => {
      expect(match("Stockholm", "contains", "  stock  ")).toBe(true);
      expect(match("Stockholm", "equals", "   ")).toBe(true);
    });
  });

  describe("numeric operators", () => {
    it("compares numerically when both sides are numbers", () => {
      expect(match(50, "greaterThan", "40")).toBe(true);
      expect(match(50, "greaterThanOrEqual", "50")).toBe(true);
      expect(match(50, "lessThan", "60")).toBe(true);
      expect(match(50, "lessThanOrEqual", "50")).toBe(true);
      expect(match(50, "lessThan", "40")).toBe(false);
    });

    it("prefers a numeric comparison for equals on numeric cells", () => {
      // "50" and "50.0" are different strings but the same number.
      expect(match(50, "equals", "50.0")).toBe(true);
      expect(match(50, "notEquals", "50.0")).toBe(false);
    });

    it("never matches an ordering operator on a non-numeric cell", () => {
      expect(match("Stockholm", "greaterThan", "40")).toBe(false);
      expect(match(null, "lessThan", "40")).toBe(false);
      expect(match(50, "greaterThan", "abc")).toBe(false);
    });
  });

  describe("date operators", () => {
    it("orders by calendar day, for Date cells and ISO-string cells alike", () => {
      const day = new Date(2026, 6, 15); // 2026-07-15 local
      expect(match(day, "before", "2026-07-16")).toBe(true);
      expect(match(day, "before", "2026-07-15")).toBe(false);
      expect(match(day, "after", "2026-07-14")).toBe(true);
      expect(match(day, "onOrBefore", "2026-07-15")).toBe(true);
      expect(match(day, "onOrAfter", "2026-07-15")).toBe(true);
      expect(match("2026-07-15", "before", "2026-07-16")).toBe(true);
      expect(match("2026-07-15T09:30:00", "onOrAfter", "2026-07-15")).toBe(true);
    });

    it("treats equals as day equality for a Date cell", () => {
      expect(match(new Date(2026, 6, 15), "equals", "2026-07-15")).toBe(true);
      expect(match(new Date(2026, 6, 15), "equals", "2026-07-16")).toBe(false);
      expect(match(new Date(2026, 6, 15), "notEquals", "2026-07-16")).toBe(true);
    });

    it("never matches an ordering operator on something that has no day", () => {
      expect(match("Stockholm", "before", "2026-07-16")).toBe(false);
      expect(match(null, "after", "2026-07-16")).toBe(false);
      expect(match(new Date(2026, 6, 15), "before", "not a date")).toBe(false);
    });
  });

  describe("between", () => {
    it("keeps what lies inside a closed numeric interval", () => {
      expect(match(50, "between", ["40", "60"])).toBe(true);
      expect(match(40, "between", ["40", "60"])).toBe(true);
      expect(match(60, "between", ["40", "60"])).toBe(true);
      expect(match(39, "between", ["40", "60"])).toBe(false);
      expect(match(61, "between", ["40", "60"])).toBe(false);
    });

    it("treats an empty end as open", () => {
      expect(match(999, "between", ["40", ""])).toBe(true);
      expect(match(39, "between", ["40", ""])).toBe(false);
      expect(match(-5, "between", ["", "60"])).toBe(true);
      expect(match(61, "between", ["", "60"])).toBe(false);
    });

    it("matches everything while both ends are empty", () => {
      expect(match(50, "between", ["", ""])).toBe(true);
      expect(match("anything", "between", ["", ""])).toBe(true);
    });

    it("reads a stray single value as the lower bound", () => {
      expect(match(50, "between", "40")).toBe(true);
      expect(match(30, "between", "40")).toBe(false);
    });

    it("compares dates by calendar day", () => {
      const day = new Date(2026, 6, 15); // 2026-07-15 local
      expect(match(day, "between", ["2026-07-01", "2026-07-31"])).toBe(true);
      expect(match(day, "between", ["2026-07-16", "2026-07-31"])).toBe(false);
      expect(match("2026-07-15", "between", ["2026-07-15", ""])).toBe(true);
    });

    it("never matches a cell that is neither number nor day", () => {
      expect(match("Stockholm", "between", ["40", "60"])).toBe(false);
      expect(match(null, "between", ["40", ""])).toBe(false);
    });
  });

  describe("set operators", () => {
    it("tests scalar cells for membership", () => {
      expect(match("Paid", "isAnyOf", ["Paid", "Pending"])).toBe(true);
      expect(match("Overdue", "isAnyOf", ["Paid", "Pending"])).toBe(false);
      expect(match("Overdue", "isNoneOf", ["Paid", "Pending"])).toBe(true);
      expect(match("Paid", "isNoneOf", ["Paid"])).toBe(false);
    });

    it("intersects array cells with the set", () => {
      expect(match(["a", "b"], "isAnyOf", ["b", "c"])).toBe(true);
      expect(match(["a", "b"], "isAnyOf", ["c"])).toBe(false);
      expect(match(["a", "b"], "isNoneOf", ["c"])).toBe(true);
      expect(match(["a", "b"], "isNoneOf", ["b"])).toBe(false);
    });

    it("compares case-insensitively and matches everything on an empty set", () => {
      expect(match("PAID", "isAnyOf", ["paid"])).toBe(true);
      expect(match("anything", "isAnyOf", [])).toBe(true);
      expect(match("anything", "isNoneOf", [])).toBe(true);
    });
  });

  describe("boolean cells", () => {
    it("matches the stringly filter value a boolean filter stores", () => {
      // The filter panel writes "true"/"false"; the cell holds a boolean.
      expect(match(true, "equals", "true")).toBe(true);
      expect(match(false, "equals", "true")).toBe(false);
      expect(match(false, "notEquals", "true")).toBe(true);
    });
  });

  describe("valueless operators", () => {
    it("treats null, undefined and empty string as empty", () => {
      expect(match(null, "isEmpty")).toBe(true);
      expect(match(undefined, "isEmpty")).toBe(true);
      expect(match("", "isEmpty")).toBe(true);
      expect(match(0, "isEmpty")).toBe(false);
      expect(match("x", "isEmpty")).toBe(false);
    });

    it("inverts for isNotEmpty", () => {
      expect(match(null, "isNotEmpty")).toBe(false);
      expect(match(0, "isNotEmpty")).toBe(true);
      expect(match("x", "isNotEmpty")).toBe(true);
    });

    it("ignores any value carried alongside", () => {
      expect(match(null, "isEmpty", "ignored")).toBe(true);
    });
  });
});

describe("isFilterActive", () => {
  it("is false for anything that is not a filter value", () => {
    expect(isFilterActive(undefined)).toBe(false);
    expect(isFilterActive(null)).toBe(false);
    expect(isFilterActive("contains")).toBe(false);
    expect(isFilterActive({ value: "x" })).toBe(false);
  });

  it("is false while a value operator has nothing to compare", () => {
    expect(isFilterActive({ operator: "contains", value: "" })).toBe(false);
    expect(isFilterActive({ operator: "contains", value: "   " })).toBe(false);
    expect(isFilterActive({ operator: "contains", value: "a" })).toBe(true);
  });

  it("is true for a valueless operator regardless of value", () => {
    expect(isFilterActive({ operator: "isEmpty", value: "" })).toBe(true);
    expect(isFilterActive({ operator: "isNotEmpty", value: "" })).toBe(true);
  });

  it("follows the set's emptiness for an array value", () => {
    expect(isFilterActive({ operator: "isAnyOf", value: [] })).toBe(false);
    expect(isFilterActive({ operator: "isAnyOf", value: ["Paid"] })).toBe(true);
  });

  it("needs at least one spoken end of a between pair", () => {
    expect(isFilterActive({ operator: "between", value: ["", ""] })).toBe(false);
    expect(isFilterActive({ operator: "between", value: ["40", ""] })).toBe(
      true,
    );
    expect(isFilterActive({ operator: "between", value: ["", "60"] })).toBe(
      true,
    );
  });
});

describe("formatFilterLabel", () => {
  // This is the text on a filter pill - the one place the filter model is
  // read back to the user in words.
  it("leaves the type's default operator implicit", () => {
    expect(
      formatFilterLabel({
        label: "First name",
        type: "string",
        filter: { operator: "contains", value: "Sofia" },
      }),
    ).toBe("First name: Sofia");
    expect(
      formatFilterLabel({
        label: "Salary",
        type: "number",
        filter: { operator: "equals", value: "40" },
      }),
    ).toBe("Salary: 40");
  });

  it("spells out any operator that is not the type's default", () => {
    expect(
      formatFilterLabel({
        label: "First name",
        type: "string",
        filter: { operator: "startsWith", value: "So" },
      }),
    ).toBe("First name starts with So");
  });

  it("says a valueless operator without the colon or a value", () => {
    expect(
      formatFilterLabel({
        label: "City",
        type: "string",
        filter: { operator: "isEmpty", value: "" },
      }),
    ).toBe("City is empty");
  });

  it("joins a set value with commas", () => {
    // `isAnyOf` is a select's default, so it elides like any default.
    expect(
      formatFilterLabel({
        label: "Status",
        type: "select",
        filter: { operator: "isAnyOf", value: ["Paid", "Pending"] },
      }),
    ).toBe("Status: Paid, Pending");
    expect(
      formatFilterLabel({
        label: "Status",
        type: "select",
        filter: { operator: "isNoneOf", value: ["Paid", "Pending"] },
      }),
    ).toBe("Status is none of Paid, Pending");
  });

  it("formats a between pill as an interval", () => {
    expect(
      formatFilterLabel({
        label: "Salary",
        type: "number",
        filter: { operator: "between", value: ["40000", "60000"] },
      }),
    ).toBe("Salary is between 40000–60000");
  });

  it("speaks the caller's language through operatorLabels", () => {
    expect(
      formatFilterLabel({
        label: "Stad",
        type: "string",
        filter: { operator: "isEmpty", value: "" },
        operatorLabels: TMDATAGRID_LABELS_SV.operators,
      }),
    ).toBe("Stad är tom");
  });
});

describe("isTMDataGridFilterValue", () => {
  it("requires a string operator", () => {
    expect(isTMDataGridFilterValue({ operator: "contains", value: "" })).toBe(
      true,
    );
    expect(isTMDataGridFilterValue({ operator: 1, value: "" })).toBe(false);
    expect(isTMDataGridFilterValue({ value: "" })).toBe(false);
    expect(isTMDataGridFilterValue(null)).toBe(false);
    expect(isTMDataGridFilterValue("contains")).toBe(false);
  });
});

describe("operator sets", () => {
  it("offers ordering operators to numbers only", () => {
    expect(getOperatorsForType("number")).toContain("greaterThan");
    expect(getOperatorsForType("string")).not.toContain("greaterThan");
    expect(getOperatorsForType("string")).toContain("contains");
  });

  it("defaults to contains for strings and equals for numbers", () => {
    expect(getDefaultOperator("string")).toBe("contains");
    expect(getDefaultOperator("number")).toBe("equals");
  });

  it("agrees with itself about which operators take a value", () => {
    expect(operatorNeedsValue("contains")).toBe(true);
    expect(operatorNeedsValue("isEmpty")).toBe(false);
    expect(operatorNeedsValue("isNotEmpty")).toBe(false);
  });

  it("gives each new type its own set", () => {
    expect(getOperatorsForType("date")).toContain("before");
    expect(getOperatorsForType("date")).not.toContain("contains");
    expect(getOperatorsForType("boolean")).toEqual([
      "equals",
      "notEquals",
      "isEmpty",
      "isNotEmpty",
    ]);
    expect(getOperatorsForType("select")).toContain("isAnyOf");
    expect(getOperatorsForType("multiSelect")).toContain("isNoneOf");
    expect(getOperatorsForType("select")).not.toContain("equals");
  });

  it("marks exactly the set operators as array-valued", () => {
    expect(operatorTakesArrayValue("isAnyOf")).toBe(true);
    expect(operatorTakesArrayValue("isNoneOf")).toBe(true);
    expect(operatorTakesArrayValue("equals")).toBe(false);
    expect(operatorTakesArrayValue("before")).toBe(false);
    expect(operatorTakesArrayValue("between")).toBe(false);
  });

  it("offers between to numbers and dates, as a range value", () => {
    expect(getOperatorsForType("number")).toContain("between");
    expect(getOperatorsForType("date")).toContain("between");
    expect(getOperatorsForType("string")).not.toContain("between");
    expect(operatorTakesRangeValue("between")).toBe(true);
    expect(operatorTakesRangeValue("isAnyOf")).toBe(false);
  });

  it("starts each operator with its shape of nothing", () => {
    expect(emptyValueForOperator("contains")).toBe("");
    expect(emptyValueForOperator("isAnyOf")).toEqual([]);
    expect(emptyValueForOperator("between")).toEqual(["", ""]);
  });

  it("only offers operators the default is a member of", () => {
    for (const type of [
      "string",
      "number",
      "boolean",
      "date",
      "select",
      "multiSelect",
    ] as const) {
      expect(getOperatorsForType(type)).toContain(getDefaultOperator(type));
    }
  });
});

describe("activeColumnFilters", () => {
  const columnFilters = [
    { id: "name", value: { operator: "contains", value: "holm" } },
    // Seeded by the filter panel and not typed into yet: matches every row.
    { id: "city", value: { operator: "contains", value: "" } },
    { id: "status", value: { operator: "isAnyOf", value: ["Paid"] } },
    // Not the grid's own shape - a consumer's raw filterFn value.
    { id: "age", value: 30 },
  ];

  it("keeps the filters that narrow anything, and types their values", () => {
    const active = activeColumnFilters(columnFilters as never);

    expect(active).toEqual([
      { id: "name", value: { operator: "contains", value: "holm" } },
      { id: "status", value: { operator: "isAnyOf", value: ["Paid"] } },
    ]);
    // The point of the helper: no cast at the call site.
    expect(active[0]?.value.operator).toBe("contains");
  });

  it("reads the slice off a table too", () => {
    const table = { store: { state: { columnFilters } } };

    expect(activeColumnFilters(table as never).map((f) => f.id)).toEqual([
      "name",
      "status",
    ]);
  });
});

describe("TMDataGridFilterFn", () => {
  type FilterRow = { x: string };

  it("types a column filterFn that delegates to tmDataGridFilterFn", () => {
    // The assertion is the typecheck: the envelope is the third argument, the
    // built-in matcher accepts it as is, and the column def accepts the function.
    const filterFn: TMDataGridFilterFn<FilterRow> = (row, columnId, filter) =>
      filter.operator === "isEmpty"
        ? row.getValue(columnId) === "-"
        : tmDataGridFilterFn(row, columnId, filter);
    const column = createTMDataGridColumnHelper<FilterRow>().accessor("x", {
      filterFn,
    });

    expect(column.filterFn).toBe(filterFn);
  });
});
