import { describe, expect, it } from "vitest";
import { resizePreview, type TMDataGridColumnTrack } from "./resizePreview";

const TRACKS: Array<TMDataGridColumnTrack> = [
  { id: "select", track: "36px", minWidth: 36 },
  { id: "name", track: "200px", minWidth: 200 },
  { id: "city", track: "minmax(120px, 1fr)", minWidth: 120 },
];

const IDLE = {
  isResizingColumn: false as const,
  columnSizingStart: [],
  deltaPercentage: null,
};

const boundsOf = () => ({});

describe("resizePreview", () => {
  it("is nothing to paint while no drag is running", () => {
    expect(
      resizePreview({
        progress: IDLE,
        tracks: TRACKS,
        boundsOf,
        leftLane: [],
        rightLane: [],
      }),
    ).toBeNull();
  });

  it("puts the dragged width on its own track and leaves the rest alone", () => {
    const preview = resizePreview({
      progress: {
        isResizingColumn: "name",
        columnSizingStart: [["name", 200]],
        deltaPercentage: 0.25,
      },
      tracks: TRACKS,
      boundsOf,
      leftLane: [],
      rightLane: [],
    });

    expect(preview?.gridTemplateColumns).toBe(
      "36px 250px minmax(120px, 1fr)",
    );
    // The grid's minimum grows with the column, or the drag would stop at the
    // viewport instead of scrolling.
    expect(preview?.minWidth).toBe(36 + 250 + 120);
    expect(preview?.offsets).toEqual([]);
  });

  it("clamps to the column's own bounds, the way the commit will", () => {
    const preview = resizePreview({
      progress: {
        isResizingColumn: "name",
        columnSizingStart: [["name", 200]],
        deltaPercentage: 4,
      },
      tracks: TRACKS,
      boundsOf: () => ({ minSize: 80, maxSize: 400 }),
      leftLane: [],
      rightLane: [],
    });

    expect(preview?.gridTemplateColumns).toContain("400px");
  });

  it("moves the sticky offsets of the lane it is resizing", () => {
    const preview = resizePreview({
      progress: {
        isResizingColumn: "select",
        columnSizingStart: [["select", 36]],
        deltaPercentage: 1,
      },
      tracks: TRACKS,
      boundsOf,
      leftLane: ["select", "name"],
      rightLane: [],
    });

    expect(preview?.offsets).toEqual([
      { columnId: "select", side: "left", offset: 0 },
      // Pushed out by the column it sits behind, live rather than on release.
      { columnId: "name", side: "left", offset: 72 },
    ]);
  });

  it("leaves the lanes alone when the drag is nowhere near them", () => {
    const preview = resizePreview({
      progress: {
        isResizingColumn: "city",
        columnSizingStart: [["city", 120]],
        deltaPercentage: 0.5,
      },
      tracks: TRACKS,
      boundsOf,
      leftLane: ["select"],
      rightLane: [],
    });

    expect(preview?.offsets).toEqual([]);
  });
});
