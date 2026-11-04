import { describe, expect, it } from "vitest";
import { mergeLabels, TMDATAGRID_LABELS_EN } from "./labels";
import { FILTER_OPERATOR_LABELS } from "./filterOperators";

describe("mergeLabels", () => {
  it("returns the English defaults untouched with no override", () => {
    // Identity on purpose, not just equality: a stable reference is what lets
    // memoized chrome skip re-rendering when no labels were passed.
    expect(mergeLabels()).toBe(TMDATAGRID_LABELS_EN);
  });

  it("folds a partial override over the defaults", () => {
    const labels = mergeLabels({ noResults: "Inga rader" });
    expect(labels.noResults).toBe("Inga rader");
    expect(labels.filters).toBe(TMDATAGRID_LABELS_EN.filters);
  });

  it("merges operators without dropping the unmentioned ones", () => {
    const labels = mergeLabels({ operators: { contains: "innehåller" } });
    expect(labels.operators.contains).toBe("innehåller");
    expect(labels.operators.equals).toBe(FILTER_OPERATOR_LABELS.equals);
  });

  it("keeps function labels callable through an override", () => {
    const labels = mergeLabels({ groupBy: (column) => `Gruppera efter ${column}` });
    expect(labels.groupBy("Avdelning")).toBe("Gruppera efter Avdelning");
    expect(labels.ungroup("Age")).toBe("Ungroup Age");
  });

  it("uses the operator labels as the operators default", () => {
    expect(TMDATAGRID_LABELS_EN.operators).toBe(FILTER_OPERATOR_LABELS);
  });
});
