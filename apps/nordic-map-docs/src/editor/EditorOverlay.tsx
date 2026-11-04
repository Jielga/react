import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { LonLat, NordicMapHandle } from "@jielga/nordic-map";
import classes from "./AreaEditor.module.css";
import { insertVertex, moveVertex, vertexAt } from "./editorModel.ts";
import type { Part, Ring, VertexRef } from "./editorModel.ts";
import { buildSnapIndex, findSnap } from "./snapping.ts";
import type { ScreenPoint, Snap, SnapIndex } from "./snapping.ts";
import { useStoreValue } from "./valueStore.ts";
import type { ValueStore } from "./valueStore.ts";

export type PointerState = { point: ScreenPoint; free: boolean } | null;

/** Pixels within which a point snaps */
export const SNAP_RADIUS = 10;
/** More points than this on screen, and the handles are left out until the view is zoomed in */
export const MAX_HANDLES = 400;
/** Pixels a press may move and still count as a click */
const CLICK_SLOP = 3;
/** Edges shorter than this on screen get no handle in their middle */
const MIN_MIDPOINT_EDGE = 28;

type Drag = {
  ref: VertexRef;
  /** A press on the middle of an edge inserts the point on its first move */
  insert: boolean;
  start: ScreenPoint;
  moved: boolean;
  base: Part[];
  indexes: SnapIndex[];
};

type Props = {
  map: RefObject<NordicMapHandle | null>;
  /** Changes on every view change, so the handles follow the map */
  viewStore: ValueStore<number>;
  pointerStore: ValueStore<PointerState>;
  /** The parts of the selected area */
  parts: Part[] | null;
  selectedVertex: VertexRef | null;
  /** The ring being drawn */
  drawing: Ring | null;
  snapping: boolean;
  /** What a drawn point snaps to */
  drawIndexes: SnapIndex[];
  /** The shapes of the other areas, which a dragged point snaps to */
  otherShapes: Part[][];
  /** More for a dragged point to snap to: the regions shown, and the coast */
  extraIndexes: SnapIndex[];
  onSelectVertex: (ref: VertexRef | null) => void;
  onPreview: (parts: Part[]) => void;
  onCommit: (parts: Part[]) => void;
  /** Ends a drag without a change */
  onCancel: () => void;
  onFinishDrawing: () => void;
};

function pathOf(points: (ScreenPoint | null)[], closed: boolean): string {
  const valid = points.filter((point) => {
    return point !== null;
  });
  if (valid.length === 0) {
    return "";
  }
  const line = valid
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join("");
  return closed ? `${line}Z` : line;
}

function sameRef(a: VertexRef | null, b: VertexRef): boolean {
  return a !== null && a.part === b.part && a.ring === b.ring && a.index === b.index;
}

/** The handles of the selected area, the ring being drawn, and the snap marker, in an SVG over the map */
export function EditorOverlay({
  map,
  viewStore,
  pointerStore,
  parts,
  selectedVertex,
  drawing,
  snapping,
  drawIndexes,
  otherShapes,
  extraIndexes,
  onSelectVertex,
  onPreview,
  onCommit,
  onCancel,
  onFinishDrawing,
}: Props) {
  useStoreValue(viewStore);
  const pointer = useStoreValue(pointerStore);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dragSnap, setDragSnap] = useState<Snap | null>(null);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect();
      setSize((current) => {
        return current.width === width && current.height === height ? current : { width, height };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => {
      observer.disconnect();
    };
  }, []);

  // A wheel over a handle zooms the map, as it does everywhere else. The map listens natively, so pass it on.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const listener = (event: WheelEvent) => {
      const target = svg.parentElement?.querySelector('[aria-roledescription="map"]');
      if (target) {
        event.preventDefault();
        target.dispatchEvent(new WheelEvent("wheel", event));
      }
    };
    svg.addEventListener("wheel", listener, { passive: false });
    return () => {
      svg.removeEventListener("wheel", listener);
    };
  }, []);

  const handle = map.current;
  const project = (point: LonLat): ScreenPoint | null => {
    return handle?.project({ lon: point[0], lat: point[1] }) ?? null;
  };

  function localPoint(event: { clientX: number; clientY: number }): ScreenPoint {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: event.clientX, y: event.clientY };
  }

  function targetFor({ point, free, indexes }: { point: ScreenPoint; free: boolean; indexes: SnapIndex[] }): { at: LonLat; snap: Snap | null } | null {
    if (!handle) {
      return null;
    }
    const snap = snapping && !free ? findSnap({ pointer: point, indexes, projection: handle, radius: SNAP_RADIUS }) : null;
    if (snap) {
      return { at: snap.at, snap };
    }
    const position = handle.unproject(point);
    return position ? { at: [position.lon, position.lat], snap: null } : null;
  }

  function startDrag({ event, ref, insert }: { event: ReactPointerEvent<SVGCircleElement>; ref: VertexRef; insert: boolean }) {
    if (!parts || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const dragged = insert ? undefined : (vertexAt({ parts, ref }) ?? undefined);
    const ownIndex = buildSnapIndex({ shapes: [parts, ...otherShapes], exclude: dragged });
    drag.current = {
      ref,
      insert,
      start: localPoint(event),
      moved: false,
      base: parts,
      indexes: [ownIndex, ...extraIndexes],
    };
    const move = (moveEvent: PointerEvent) => {
      const current = drag.current;
      if (!current) {
        return;
      }
      const point = localPoint(moveEvent);
      if (!current.moved && Math.hypot(point.x - current.start.x, point.y - current.start.y) < CLICK_SLOP) {
        return;
      }
      current.moved = true;
      const target = targetFor({ point, free: moveEvent.altKey, indexes: current.indexes });
      if (!target) {
        return;
      }
      setDragSnap(target.snap);
      const from = current.insert ? insertVertex({ parts: current.base, ref: current.ref, at: target.at }) : current.base;
      onPreview(moveVertex({ parts: from, ref: current.ref, to: target.at }));
    };
    const end = (endEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const current = drag.current;
      drag.current = null;
      setDragSnap(null);
      if (!current) {
        return;
      }
      const target = current.moved && endEvent.type === "pointerup" ? targetFor({ point: localPoint(endEvent), free: endEvent.altKey, indexes: current.indexes }) : null;
      if (current.moved) {
        if (!target) {
          onCancel();
          return;
        }
        const from = current.insert ? insertVertex({ parts: current.base, ref: current.ref, at: target.at }) : current.base;
        onCommit(moveVertex({ parts: from, ref: current.ref, to: target.at }));
        onSelectVertex(current.ref);
        return;
      }
      if (endEvent.type === "pointercancel") {
        return;
      }
      if (current.insert) {
        // A click on the middle of an edge adds a point there
        const ring = current.base[current.ref.part]?.[current.ref.ring];
        const a = ring?.[current.ref.index - 1];
        const b = ring?.[current.ref.index % ring.length];
        if (a && b) {
          onCommit(insertVertex({ parts: current.base, ref: current.ref, at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }));
          onSelectVertex(current.ref);
        }
        return;
      }
      onSelectVertex(sameRef(selectedVertex, current.ref) ? null : current.ref);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  // The selected area on screen
  const rings =
    parts?.flatMap((part, partIndex) => {
      return part.map((ring, ringIndex) => {
        return { partIndex, ringIndex, points: ring.map(project) };
      });
    }) ?? [];
  const margin = 20;
  const onScreen = (point: ScreenPoint | null): point is ScreenPoint => {
    return point !== null && point.x >= -margin && point.y >= -margin && point.x <= size.width + margin && point.y <= size.height + margin;
  };
  let visibleCount = 0;
  for (const ring of rings) {
    visibleCount += ring.points.filter(onScreen).length;
  }
  const showHandles = drawing === null && visibleCount <= MAX_HANDLES;

  // The ring being drawn, its rubber band to the pointer, and where the next point snaps
  const drawn = drawing?.map(project) ?? [];
  const drawSnap =
    drawing && pointer && handle && snapping && !pointer.free
      ? findSnap({ pointer: pointer.point, indexes: drawIndexes, projection: handle, radius: SNAP_RADIUS })
      : null;
  const next = drawSnap ? project(drawSnap.at) : (pointer?.point ?? null);
  const last = drawn.at(-1) ?? null;
  const first = drawn[0] ?? null;
  const snap = dragSnap ?? drawSnap;
  const snapPoint = snap ? project(snap.at) : null;

  return (
    <svg ref={svgRef} className={classes.overlay} data-editor-overlay="">
      {rings.map(({ partIndex, ringIndex, points }) => {
        return <path key={`${partIndex}-${ringIndex}`} className={classes.outline} d={pathOf(points, true)} />;
      })}

      {showHandles &&
        rings.map(({ partIndex, ringIndex, points }) => {
          return points.map((point, index) => {
            const nextPoint = points[(index + 1) % points.length] ?? null;
            if (!onScreen(point) || !nextPoint || Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y) < MIN_MIDPOINT_EDGE) {
              return null;
            }
            const ref = { part: partIndex, ring: ringIndex, index: index + 1 };
            return (
              <circle
                key={`m${partIndex}-${ringIndex}-${index}`}
                className={classes.midpoint}
                cx={(point.x + nextPoint.x) / 2}
                cy={(point.y + nextPoint.y) / 2}
                r={4}
                data-editor-part="midpoint"
                onPointerDown={(event) => {
                  startDrag({ event, ref, insert: true });
                }}
              />
            );
          });
        })}

      {showHandles &&
        rings.map(({ partIndex, ringIndex, points }) => {
          return points.map((point, index) => {
            if (!onScreen(point)) {
              return null;
            }
            const ref = { part: partIndex, ring: ringIndex, index };
            return (
              <circle
                key={`v${partIndex}-${ringIndex}-${index}`}
                className={classes.vertex}
                data-selected={sameRef(selectedVertex, ref) || undefined}
                cx={point.x}
                cy={point.y}
                r={5.5}
                data-editor-part="vertex"
                onPointerDown={(event) => {
                  startDrag({ event, ref, insert: false });
                }}
              />
            );
          });
        })}

      {drawing && (
        <>
          <path className={classes.drawn} d={pathOf(drawn, false)} />
          {last && next && <path className={classes.rubberBand} d={pathOf([last, next], false)} />}
          {drawing.length >= 3 && first && next && <path className={classes.rubberBand} d={pathOf([next, first], false)} />}
          {drawn.map((point, index) => {
            if (!point) {
              return null;
            }
            const closes = index === 0 && drawing.length >= 3;
            return (
              <circle
                key={index}
                className={closes ? classes.closeHandle : classes.drawnVertex}
                cx={point.x}
                cy={point.y}
                r={closes ? 7 : 4}
                data-editor-part={closes ? "close" : undefined}
                onPointerDown={
                  closes
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    : undefined
                }
                onClick={closes ? onFinishDrawing : undefined}
              />
            );
          })}
        </>
      )}

      {snapPoint && (
        <circle
          className={snap?.kind === "vertex" ? classes.snapVertex : classes.snapEdge}
          cx={snapPoint.x}
          cy={snapPoint.y}
          r={8}
          data-editor-part="snap"
          data-snap-kind={snap?.kind}
        />
      )}

      {parts && drawing === null && !showHandles && (
        <text className={classes.hint} x={size.width / 2} y={28} textAnchor="middle">
          Zoom in to edit the points of this area
        </text>
      )}
    </svg>
  );
}
