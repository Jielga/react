import { act } from "react";
import { describe, expect, it } from "vitest";
import { erased, renderGrid, visibleColumnIds } from "../../test/gridHarness";
import { EDIT_COLUMN_ID } from "../components/TMDataGridEditColumn";
import { GROUP_COLUMN_ID } from "../components/TMDataGridGroupColumn";
import { SELECT_COLUMN_ID } from "../components/TMDataGridSelectColumn";
import {
  getColumnRegion,
  getStepTargetColumn,
  keepGeneratedColumnsOutermost,
  moveColumn,
  moveColumnByStep,
} from "./columnOrdering";

describe("getColumnRegion", () => {
  const pinning = { start: ["a"], end: ["z"] };

  it("reads the lane off the pinning state", () => {
    expect(getColumnRegion(pinning, "a")).toBe("start");
    expect(getColumnRegion(pinning, "z")).toBe("end");
    expect(getColumnRegion(pinning, "m")).toBe("center");
    // An unknown id is centre, the lane that needs no membership.
    expect(getColumnRegion(pinning, "nope")).toBe("center");
  });
});

describe("moveColumn", () => {
  it("moves a column before and after a target", () => {
    const { result } = renderGrid();
    const table = erased(result.current).table;

    act(() => {
      moveColumn({ table, columnId: "city", targetId: "name", side: "before" });
    });
    expect(visibleColumnIds(result.current)).toEqual([
      SELECT_COLUMN_ID,
      "id",
      "city",
      "name",
      "age",
    ]);

    act(() => {
      moveColumn({ table, columnId: "city", targetId: "age", side: "after" });
    });
    expect(visibleColumnIds(result.current)).toEqual([
      SELECT_COLUMN_ID,
      "id",
      "name",
      "age",
      "city",
    ]);
  });

  it("is a no-op when source and target are the same", () => {
    const { result } = renderGrid();
    const before = visibleColumnIds(result.current);

    act(() => {
      moveColumn({
        table: erased(result.current).table,
        columnId: "name",
        targetId: "name",
        side: "before",
      });
    });

    expect(visibleColumnIds(result.current)).toEqual(before);
  });

  it("refuses to move across pinned lanes", () => {
    const { result } = renderGrid();
    const table = erased(result.current).table;

    act(() => {
      table.setColumnPinning({ start: [SELECT_COLUMN_ID, "id"], end: [] });
    });
    const before = visibleColumnIds(result.current);

    // "name" is centre, "id" is pinned left - a move between them would be a
    // pin, not a reorder.
    act(() => {
      moveColumn({ table, columnId: "name", targetId: "id", side: "after" });
    });

    expect(visibleColumnIds(result.current)).toEqual(before);
  });

  it("reorders inside a pinned lane and updates the pinning state", () => {
    const { result } = renderGrid();
    const table = erased(result.current).table;

    act(() => {
      table.setColumnPinning({
        start: [SELECT_COLUMN_ID, "id", "name"],
        end: [],
      });
    });

    act(() => {
      moveColumn({ table, columnId: "name", targetId: "id", side: "before" });
    });

    expect(table.store.state.columnPinning.start).toEqual([
      SELECT_COLUMN_ID,
      "name",
      "id",
    ]);
    expect(visibleColumnIds(result.current).slice(0, 3)).toEqual([
      SELECT_COLUMN_ID,
      "name",
      "id",
    ]);
  });

  it("writes the full leaf order, so a hidden column keeps its place", () => {
    const { result } = renderGrid();
    const table = erased(result.current).table;

    act(() => {
      table.getColumn("age")?.toggleVisibility(false);
    });
    act(() => {
      moveColumn({ table, columnId: "city", targetId: "name", side: "before" });
    });

    // "age" is not rendered, but it is still ordered between name and city.
    // The tree column is in the order for the same reason: hidden while nothing
    // is grouped, but still a leaf column that has to hold its place.
    expect(table.store.state.columnOrder).toEqual([
      SELECT_COLUMN_ID,
      GROUP_COLUMN_ID,
      "id",
      "city",
      "name",
      "age",
    ]);

    act(() => {
      table.getColumn("age")?.toggleVisibility(true);
    });
    expect(visibleColumnIds(result.current)).toEqual([
      SELECT_COLUMN_ID,
      "id",
      "city",
      "name",
      "age",
    ]);
  });

  it("ignores an unknown target", () => {
    const { result } = renderGrid();
    const before = visibleColumnIds(result.current);

    act(() => {
      moveColumn({
        table: erased(result.current).table,
        columnId: "name",
        targetId: "nope",
        side: "before",
      });
    });

    expect(visibleColumnIds(result.current)).toEqual(before);
  });
});

describe("getStepTargetColumn", () => {
  it("returns the neighbour in each direction", () => {
    const { result } = renderGrid();
    const table = erased(result.current).table;

    expect(
      getStepTargetColumn({ table, columnId: "name", direction: -1 })?.id,
    ).toBe("id");
    expect(
      getStepTargetColumn({ table, columnId: "name", direction: 1 })?.id,
    ).toBe("age");
  });

  it("returns null at the edges of a lane", () => {
    const { result } = renderGrid();
    const table = erased(result.current).table;

    expect(
      getStepTargetColumn({ table, columnId: "id", direction: -1 }),
    ).toBeNull();
    expect(
      getStepTargetColumn({ table, columnId: "city", direction: 1 }),
    ).toBeNull();
  });

  it("treats a column that cannot be reordered as a wall, not a gap", () => {
    // The checkbox column sets meta.enableOrdering: false and anchors the left
    // lane, so nothing can step in front of it.
    const { result } = renderGrid();
    const table = erased(result.current).table;

    act(() => {
      table.setColumnPinning({ start: [SELECT_COLUMN_ID, "id"], end: [] });
    });

    expect(
      getStepTargetColumn({ table, columnId: "id", direction: -1 }),
    ).toBeNull();
  });

  it("returns null for an unknown column", () => {
    const { result } = renderGrid();

    expect(
      getStepTargetColumn({
        table: erased(result.current).table,
        columnId: "nope",
        direction: 1,
      }),
    ).toBeNull();
  });

  it("steps over a hidden column", () => {
    const { result } = renderGrid();
    const table = erased(result.current).table;

    act(() => {
      table.getColumn("age")?.toggleVisibility(false);
    });

    expect(
      getStepTargetColumn({ table, columnId: "name", direction: 1 })?.id,
    ).toBe("city");
  });
});

describe("moveColumnByStep", () => {
  it("moves one position in each direction", () => {
    const { result } = renderGrid();
    const table = erased(result.current).table;

    act(() => {
      moveColumnByStep({ table, columnId: "name", direction: 1 });
    });
    expect(visibleColumnIds(result.current)).toEqual([
      SELECT_COLUMN_ID,
      "id",
      "age",
      "name",
      "city",
    ]);

    act(() => {
      moveColumnByStep({ table, columnId: "name", direction: -1 });
    });
    expect(visibleColumnIds(result.current)).toEqual([
      SELECT_COLUMN_ID,
      "id",
      "name",
      "age",
      "city",
    ]);
  });

  it("does nothing at the edge of a lane", () => {
    const { result } = renderGrid();
    const before = visibleColumnIds(result.current);

    act(() => {
      moveColumnByStep({
        table: erased(result.current).table,
        columnId: "city",
        direction: 1,
      });
    });

    expect(visibleColumnIds(result.current)).toEqual(before);
  });
});

describe("keepGeneratedColumnsOutermost", () => {
  it("keeps the generated lanes on the outside of both pinned lanes", () => {
    expect(
      keepGeneratedColumnsOutermost({
        start: ["name", SELECT_COLUMN_ID, GROUP_COLUMN_ID],
        end: [EDIT_COLUMN_ID, "city"],
      }),
    ).toEqual({
      start: [SELECT_COLUMN_ID, GROUP_COLUMN_ID, "name"],
      end: ["city", EDIT_COLUMN_ID],
    });
  });

  it("leaves the consumer's own order alone inside each part", () => {
    const pinning = { start: ["id", "name"], end: ["age", "city"] };
    expect(keepGeneratedColumnsOutermost(pinning)).toEqual(pinning);
  });
});
