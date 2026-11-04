import type { LonLat } from "@jielga/nordic-map";
import type { Part } from "./editorModel.ts";

export type ScreenPoint = { x: number; y: number };

/** Converts between positions and points on screen, as `NordicMapHandle` does */
export type ScreenProjection = {
  project: (position: { lat: number; lon: number }) => ScreenPoint | null;
  unproject: (point: ScreenPoint) => { lat: number; lon: number } | null;
};

type Segment = { a: LonLat; b: LonLat };

/** Segments sorted into square cells of degrees, so a snap looks only at the segments near the pointer */
export type SnapIndex = { cells: Map<string, Segment[]>; cellSize: number };

export type Snap = { at: LonLat; kind: "vertex" | "edge" };

const CELL_SIZE = 0.1;

function cellKey(column: number, row: number): string {
  return `${column}:${row}`;
}

function edgesOf(shapes: Part[][]): Segment[] {
  const edges: Segment[] = [];
  for (const parts of shapes) {
    for (const part of parts) {
      for (const ring of part) {
        ring.forEach((a, index) => {
          const b = ring[(index + 1) % ring.length];
          if (b) {
            edges.push({ a, b });
          }
        });
      }
    }
  }
  return edges;
}

function indexSegments(segments: Segment[]): SnapIndex {
  const cells = new Map<string, Segment[]>();
  for (const segment of segments) {
    const minColumn = Math.floor(Math.min(segment.a[0], segment.b[0]) / CELL_SIZE);
    const maxColumn = Math.floor(Math.max(segment.a[0], segment.b[0]) / CELL_SIZE);
    const minRow = Math.floor(Math.min(segment.a[1], segment.b[1]) / CELL_SIZE);
    const maxRow = Math.floor(Math.max(segment.a[1], segment.b[1]) / CELL_SIZE);
    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const key = cellKey(column, row);
        const list = cells.get(key);
        if (list) {
          list.push(segment);
        } else {
          cells.set(key, [segment]);
        }
      }
    }
  }
  return { cells, cellSize: CELL_SIZE };
}

/**
 * Indexes every edge of the shapes. A ring's last point connects to its first. The edges that end at the
 * `exclude` point object are left out, so a point being dragged does not snap to where it was.
 */
export function buildSnapIndex({ shapes, exclude }: { shapes: Part[][]; exclude?: LonLat }): SnapIndex {
  return indexSegments(
    edgesOf(shapes).filter(({ a, b }) => {
      return a !== exclude && b !== exclude;
    }),
  );
}

/**
 * Indexes the edges that belong to one shape only. For shapes that share their borders exactly, such as the
 * counties, that is their outline: for the counties, Sweden's coast and its border with Norway and Finland.
 */
export function buildOutlineIndex(shapes: Part[][]): SnapIndex {
  const key = ({ a, b }: Segment) => {
    const [first, second] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
    return `${first[0]},${first[1]},${second[0]},${second[1]}`;
  };
  const edges = edgesOf(shapes);
  const counts = new Map<string, number>();
  for (const edge of edges) {
    const edgeKey = key(edge);
    counts.set(edgeKey, (counts.get(edgeKey) ?? 0) + 1);
  }
  return indexSegments(
    edges.filter((edge) => {
      return counts.get(key(edge)) === 1;
    }),
  );
}

function segmentsNear({ index, west, south, east, north }: { index: SnapIndex; west: number; south: number; east: number; north: number }): Set<Segment> {
  const found = new Set<Segment>();
  const minColumn = Math.floor(west / index.cellSize);
  const maxColumn = Math.floor(east / index.cellSize);
  const minRow = Math.floor(south / index.cellSize);
  const maxRow = Math.floor(north / index.cellSize);
  // A box this large means the view is zoomed far out, where snapping to single points is not useful
  if ((maxColumn - minColumn + 1) * (maxRow - minRow + 1) > 400) {
    return found;
  }
  for (let column = minColumn; column <= maxColumn; column += 1) {
    for (let row = minRow; row <= maxRow; row += 1) {
      for (const segment of index.cells.get(cellKey(column, row)) ?? []) {
        found.add(segment);
      }
    }
  }
  return found;
}

function screenOf({ projection, point }: { projection: ScreenProjection; point: LonLat }): ScreenPoint | null {
  return projection.project({ lon: point[0], lat: point[1] });
}

/**
 * The point to snap to within `radius` pixels of `pointer`: the nearest point of an edge, or the nearest end of
 * an edge, which wins when it is within the radius too.
 */
export function findSnap({
  pointer,
  indexes,
  projection,
  radius,
}: {
  pointer: ScreenPoint;
  indexes: SnapIndex[];
  projection: ScreenProjection;
  radius: number;
}): Snap | null {
  const corners = [
    projection.unproject({ x: pointer.x - radius, y: pointer.y - radius }),
    projection.unproject({ x: pointer.x + radius, y: pointer.y - radius }),
    projection.unproject({ x: pointer.x - radius, y: pointer.y + radius }),
    projection.unproject({ x: pointer.x + radius, y: pointer.y + radius }),
  ];
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const corner of corners) {
    if (!corner) {
      return null;
    }
    west = Math.min(west, corner.lon);
    east = Math.max(east, corner.lon);
    south = Math.min(south, corner.lat);
    north = Math.max(north, corner.lat);
  }

  let vertex: { at: LonLat; distance: number } | null = null;
  let edge: { at: ScreenPoint; distance: number } | null = null;
  for (const index of indexes) {
    for (const { a, b } of segmentsNear({ index, west, south, east, north })) {
      const screenA = screenOf({ projection, point: a });
      const screenB = screenOf({ projection, point: b });
      if (!screenA || !screenB) {
        continue;
      }
      for (const [point, screen] of [
        [a, screenA],
        [b, screenB],
      ] as const) {
        const distance = Math.hypot(screen.x - pointer.x, screen.y - pointer.y);
        if (distance <= radius && (!vertex || distance < vertex.distance)) {
          vertex = { at: point, distance };
        }
      }
      const dx = screenB.x - screenA.x;
      const dy = screenB.y - screenA.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared === 0) {
        continue;
      }
      const t = Math.max(0, Math.min(1, ((pointer.x - screenA.x) * dx + (pointer.y - screenA.y) * dy) / lengthSquared));
      const nearest = { x: screenA.x + t * dx, y: screenA.y + t * dy };
      const distance = Math.hypot(nearest.x - pointer.x, nearest.y - pointer.y);
      if (distance <= radius && (!edge || distance < edge.distance)) {
        edge = { at: nearest, distance };
      }
    }
  }
  if (vertex) {
    return { at: vertex.at, kind: "vertex" };
  }
  if (edge) {
    const position = projection.unproject(edge.at);
    return position ? { at: [position.lon, position.lat], kind: "edge" } : null;
  }
  return null;
}
