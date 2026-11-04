/** A point in pixels on screen, or in projected map units, depending on context */
export type Point = [number, number];

export type Size = {
  width: number;
  height: number;
};

/** Rectangle in projected map units */
export type MapBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * What the map shows. `k` is the zoom factor, where 1 fits the whole map in the view.
 * `center` is the map point in the middle of the view, in projected map units.
 */
export type Camera = {
  k: number;
  center: Point;
};

/** The fixed facts a camera is used with. Changes when the view is resized. */
export type Frame = {
  size: Size;
  bounds: MapBounds;
  /** Space in pixels kept around the map at zoom 1 */
  padding: number;
  maxZoom: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Pixels per map unit at zoom 1 */
export function fitScale(frame: Frame): number {
  const { size, bounds, padding } = frame;
  const width = Math.max(size.width - padding * 2, 1);
  const height = Math.max(size.height - padding * 2, 1);
  return Math.min(width / Math.max(bounds.maxX - bounds.minX, 1e-9), height / Math.max(bounds.maxY - bounds.minY, 1e-9));
}

/** Pixels per map unit */
export function scaleOf({ camera, frame }: { camera: Camera; frame: Frame }): number {
  return fitScale(frame) * camera.k;
}

export function homeCamera(frame: Frame): Camera {
  const { bounds } = frame;
  return { k: 1, center: [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2] };
}

export function toScreen({ camera, frame, point }: { camera: Camera; frame: Frame; point: Point }): Point {
  const scale = scaleOf({ camera, frame });
  return [
    (point[0] - camera.center[0]) * scale + frame.size.width / 2,
    (point[1] - camera.center[1]) * scale + frame.size.height / 2,
  ];
}

export function toMap({ camera, frame, point }: { camera: Camera; frame: Frame; point: Point }): Point {
  const scale = scaleOf({ camera, frame });
  return [
    (point[0] - frame.size.width / 2) / scale + camera.center[0],
    (point[1] - frame.size.height / 2) / scale + camera.center[1],
  ];
}

/**
 * Keeps the zoom between 1 and `maxZoom`, and the middle of the view over the map's area.
 * The rule is loose on purpose: a stricter one, like "the map must cover the view", has to push the map
 * while zooming near an edge, and then the point under the cursor slides away.
 */
export function clampCamera({ camera, frame }: { camera: Camera; frame: Frame }): Camera {
  const { bounds } = frame;
  return {
    k: clamp(camera.k, 1, frame.maxZoom),
    center: [clamp(camera.center[0], bounds.minX, bounds.maxX), clamp(camera.center[1], bounds.minY, bounds.maxY)],
  };
}

/** Zooms to `k` and keeps the map point under `anchor` (screen pixels) under it. */
export function zoomAround({
  camera,
  frame,
  anchor,
  k,
}: {
  camera: Camera;
  frame: Frame;
  anchor: Point;
  k: number;
}): Camera {
  const mapPoint = toMap({ camera, frame, point: anchor });
  const nextK = clamp(k, 1, frame.maxZoom);
  const scale = fitScale(frame) * nextK;
  return clampCamera({
    camera: {
      k: nextK,
      center: [
        mapPoint[0] - (anchor[0] - frame.size.width / 2) / scale,
        mapPoint[1] - (anchor[1] - frame.size.height / 2) / scale,
      ],
    },
    frame,
  });
}

/** Moves the map along with a drag of `delta` screen pixels. */
export function panBy({ camera, frame, delta }: { camera: Camera; frame: Frame; delta: Point }): Camera {
  const scale = scaleOf({ camera, frame });
  return clampCamera({
    camera: { k: camera.k, center: [camera.center[0] - delta[0] / scale, camera.center[1] - delta[1] / scale] },
    frame,
  });
}

/**
 * Two-finger gesture: the map point under the fingers' midpoint at the start follows the midpoint,
 * and the zoom changes with the distance between the fingers.
 */
export function pinchCamera({
  start,
  frame,
  startMid,
  startDistance,
  mid,
  distance,
}: {
  start: Camera;
  frame: Frame;
  startMid: Point;
  startDistance: number;
  mid: Point;
  distance: number;
}): Camera {
  const mapPoint = toMap({ camera: start, frame, point: startMid });
  const k = clamp(start.k * (distance / Math.max(startDistance, 1)), 1, frame.maxZoom);
  const scale = fitScale(frame) * k;
  return clampCamera({
    camera: {
      k,
      center: [
        mapPoint[0] - (mid[0] - frame.size.width / 2) / scale,
        mapPoint[1] - (mid[1] - frame.size.height / 2) / scale,
      ],
    },
    frame,
  });
}

/**
 * The camera that shows `bounds` (map units) as large as fits, with `margin` pixels around it.
 * The zoom stays between 1 and `maxZoom`, so a very small area, such as a single point, shows at `maxZoom`.
 */
export function cameraForBounds({ frame, bounds, margin }: { frame: Frame; bounds: MapBounds; margin: number }): Camera {
  const width = Math.max(frame.size.width - margin * 2, 1);
  const height = Math.max(frame.size.height - margin * 2, 1);
  const scale = Math.min(
    width / Math.max(bounds.maxX - bounds.minX, 1e-9),
    height / Math.max(bounds.maxY - bounds.minY, 1e-9),
  );
  return clampCamera({
    camera: { k: scale / fitScale(frame), center: [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2] },
    frame,
  });
}

/** The smallest rectangle around `points`, or null when there are none */
export function boundsOfPoints(points: Point[]): MapBounds | null {
  if (points.length === 0) {
    return null;
  }
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of points) {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  }
  return bounds;
}

export function sameCamera(a: Camera, b: Camera): boolean {
  return a.k === b.k && a.center[0] === b.center[0] && a.center[1] === b.center[1];
}
