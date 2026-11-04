import { scaleOf, toMap, toScreen } from "./camera.ts";
import type { Camera, Frame, MapBounds, Point } from "./camera.ts";
import type { PreparedArea, PreparedPath } from "./overlays.ts";
import type { ScreenMarker } from "./renderMap.ts";

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** The marker nearest to `point`, within its radius plus `slop` pixels */
export function hitMarker<T>({
  markers,
  point,
  slop,
}: {
  markers: ScreenMarker<T>[];
  point: Point;
  slop: number;
}): ScreenMarker<T> | null {
  let hit: ScreenMarker<T> | null = null;
  let hitDistance = Infinity;
  for (const candidate of markers) {
    const d = distance([candidate.x, candidate.y], point);
    if (d <= candidate.radius + slop && d < hitDistance) {
      hit = candidate;
      hitDistance = d;
    }
  }
  return hit;
}

function contains(bounds: MapBounds, point: Point, margin: number): boolean {
  return (
    point[0] >= bounds.minX - margin &&
    point[0] <= bounds.maxX + margin &&
    point[1] >= bounds.minY - margin &&
    point[1] <= bounds.maxY + margin
  );
}

/**
 * Sets the canvas transform from map units to screen pixels. The canvas compares a point against a path
 * after this transform, so `point` is then given in screen pixels too.
 */
function applyMapTransform({ context, camera, frame }: { context: CanvasRenderingContext2D; camera: Camera; frame: Frame }) {
  const scale = scaleOf({ camera, frame });
  const [originX, originY] = toScreen({ camera, frame, point: [0, 0] });
  context.setTransform(scale, 0, 0, scale, originX, originY);
  return scale;
}

/** The area under `point` (screen pixels). The last area is drawn on top, so it is checked first. */
export function hitArea({
  context,
  areas,
  camera,
  frame,
  point,
}: {
  context: CanvasRenderingContext2D;
  areas: PreparedArea[];
  camera: Camera;
  frame: Frame;
  point: Point;
}): PreparedArea | null {
  const mapPoint = toMap({ camera, frame, point });
  context.save();
  applyMapTransform({ context, camera, frame });
  let hit: PreparedArea | null = null;
  for (let index = areas.length - 1; index >= 0; index -= 1) {
    const candidate = areas[index];
    if (candidate && contains(candidate.bounds, mapPoint, 0) && context.isPointInPath(candidate.shape, point[0], point[1])) {
      hit = candidate;
      break;
    }
  }
  context.restore();
  return hit;
}

/** The path under `point` (screen pixels), within `slop` pixels of its line */
export function hitPath({
  context,
  paths,
  camera,
  frame,
  point,
  slop,
  defaultWidth,
}: {
  context: CanvasRenderingContext2D;
  paths: PreparedPath[];
  camera: Camera;
  frame: Frame;
  point: Point;
  slop: number;
  defaultWidth: number;
}): PreparedPath | null {
  const mapPoint = toMap({ camera, frame, point });
  context.save();
  const scale = applyMapTransform({ context, camera, frame });
  let hit: PreparedPath | null = null;
  for (let index = paths.length - 1; index >= 0; index -= 1) {
    const candidate = paths[index];
    if (!candidate) {
      continue;
    }
    const lineWidth = (candidate.path.width ?? defaultWidth) + slop * 2;
    if (!contains(candidate.bounds, mapPoint, lineWidth / scale)) {
      continue;
    }
    context.lineWidth = lineWidth / scale;
    context.lineCap = "round";
    context.lineJoin = "round";
    if (context.isPointInStroke(candidate.shape, point[0], point[1])) {
      hit = candidate;
      break;
    }
  }
  context.restore();
  return hit;
}
