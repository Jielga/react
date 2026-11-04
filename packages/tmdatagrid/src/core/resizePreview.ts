/**
 * What a running column resize drag paints, frame by frame.
 *
 * The grid's whole layout is one `grid-template-columns` on the grid element -
 * every row follows it through `subgrid` - so a drag only has to rewrite that
 * one string. Rendering the drag through React state instead costs a pass over
 * every mounted cell per pointer move, which is what makes a resize feel heavy
 * on a wide grid.
 *
 * This module computes the frame; `TMDataGridTable` writes it to the DOM and
 * TanStack commits the width into `columnSizing` when the pointer is released.
 */

/** One entry of the grid's track list, paired with the column it sizes. */
export type TMDataGridColumnTrack = {
  id: string;
  /** The `grid-template-columns` entry - `120px` or `minmax(120px, 1fr)`. */
  track: string;
  /** The exact width where the track is exact, the floor where it is fluid. */
  minWidth: number;
};

/** TanStack's transient `columnResizing` state, narrowed to what a frame reads. */
export type TMDataGridResizeProgress = {
  isResizingColumn: string | false;
  columnSizingStart: Array<[string, number]>;
  deltaPercentage: number | null;
};

/** A column's declared bounds, as `column_getSize` reads them. */
export type TMDataGridSizeBounds = { minSize?: number; maxSize?: number };

/** A sticky offset the drag has moved. */
export type TMDataGridOffsetPatch = {
  columnId: string;
  side: "left" | "right";
  offset: number;
};

export type TMDataGridResizePreview = {
  gridTemplateColumns: string;
  minWidth: number;
  offsets: Array<TMDataGridOffsetPatch>;
};

/**
 * TanStack's own defaults, from `getDefaultColumnSizingColumnDef()`. Not
 * exported by the package, and the preview has to clamp exactly the way
 * `column_getSize` will once the width is committed - a preview that rounds
 * differently makes the column settle by a pixel when the pointer is released.
 */
const DEFAULT_MIN_SIZE = 20;
const DEFAULT_MAX_SIZE = Number.MAX_SAFE_INTEGER;

/** The width `columnSizing` would hold if the drag ended on this delta. */
function draggedWidth(
  startWidth: number,
  deltaPercentage: number,
  bounds: TMDataGridSizeBounds,
): number {
  // Two decimals and the `max(…, 0)` are what `header_getResizeHandler`
  // commits; the clamp around it is what `column_getSize` applies on read.
  const dragged =
    Math.round(Math.max(startWidth + startWidth * deltaPercentage, 0) * 100) /
    100;
  return Math.min(
    Math.max(bounds.minSize ?? DEFAULT_MIN_SIZE, dragged),
    bounds.maxSize ?? DEFAULT_MAX_SIZE,
  );
}

function* laneOffsets(
  lane: Array<string>,
  side: "left" | "right",
  widthOf: (columnId: string) => number,
): Generator<TMDataGridOffsetPatch> {
  let offset = 0;
  for (const columnId of lane) {
    yield { columnId, side, offset };
    offset += widthOf(columnId);
  }
}

/**
 * The frame to paint for the drag in `progress`, or `null` when no drag is
 * running - which is also the answer for the first publish of a gesture, made
 * before the pointer has moved at all.
 *
 * `leftLane` and `rightLane` are the pinned lanes in the order the grid stacks
 * them: left to right, and outermost last on the right. Their offsets come
 * back only when the drag is resizing a pinned column, since nothing else
 * moves them.
 */
export function resizePreview({
  progress,
  tracks,
  boundsOf,
  leftLane,
  rightLane,
}: {
  progress: TMDataGridResizeProgress;
  tracks: Array<TMDataGridColumnTrack>;
  boundsOf: (columnId: string) => TMDataGridSizeBounds;
  leftLane: Array<string>;
  rightLane: Array<string>;
}): TMDataGridResizePreview | null {
  if (progress.isResizingColumn === false) return null;
  if (progress.columnSizingStart.length === 0) return null;

  const deltaPercentage = progress.deltaPercentage ?? 0;
  const widths = new Map<string, number>();
  for (const [columnId, startWidth] of progress.columnSizingStart) {
    widths.set(
      columnId,
      draggedWidth(startWidth, deltaPercentage, boundsOf(columnId)),
    );
  }

  const template: Array<string> = [];
  let minWidth = 0;
  for (const track of tracks) {
    const width = widths.get(track.id);
    template.push(width === undefined ? track.track : `${width}px`);
    minWidth += width ?? track.minWidth;
  }

  const inLane = (lane: Array<string>) => lane.some((id) => widths.has(id));
  const widthOf = (columnId: string) =>
    widths.get(columnId) ??
    tracks.find((track) => track.id === columnId)?.minWidth ??
    0;

  return {
    gridTemplateColumns: template.join(" "),
    minWidth,
    offsets: [
      ...(inLane(leftLane) ? laneOffsets(leftLane, "left", widthOf) : []),
      ...(inLane(rightLane) ? laneOffsets(rightLane, "right", widthOf) : []),
    ],
  };
}
