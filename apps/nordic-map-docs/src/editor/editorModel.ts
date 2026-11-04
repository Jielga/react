import type { MultiPolygon, Polygon, Position } from "geojson";
import type { LonLat, LonLatBox } from "@jielga/nordic-map";

/** One ring, open: the last point is not a copy of the first */
export type Ring = LonLat[];
/** One polygon: its outer ring, then its holes */
export type Part = Ring[];

export type EditorArea = {
  id: string;
  label: string;
  fill: string;
  stroke?: string;
  /** Empty while the area has no shape yet */
  parts: Part[];
};

/** A point of an area: which part, which ring of that part, and which point of that ring */
export type VertexRef = { part: number; ring: number; index: number };

/** Rings with fewer points than this are no shape */
const MIN_RING = 3;

function toLonLat(position: Position): LonLat | null {
  const [lon, lat] = position;
  return typeof lon === "number" && typeof lat === "number" && Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function samePoint(a: LonLat, b: LonLat): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** An open ring from GeoJSON positions: the closing point and repeated points dropped */
function openRing(positions: Position[]): Ring | null {
  const ring: Ring = [];
  for (const position of positions) {
    const point = toLonLat(position);
    if (!point) {
      return null;
    }
    const previous = ring.at(-1);
    if (!previous || !samePoint(previous, point)) {
      ring.push(point);
    }
  }
  const first = ring[0];
  const last = ring.at(-1);
  if (ring.length > 1 && first && last && samePoint(first, last)) {
    ring.pop();
  }
  return ring.length >= MIN_RING ? ring : null;
}

function partFromPolygon(rings: Position[][]): Part | null {
  const [outerPositions, ...holePositions] = rings;
  const outer = outerPositions ? openRing(outerPositions) : null;
  if (!outer) {
    return null;
  }
  const holes = holePositions.flatMap((positions) => {
    const hole = openRing(positions);
    return hole ? [hole] : [];
  });
  return [outer, ...holes];
}

/** The parts of a GeoJSON geometry. Rings with fewer than 3 points are dropped. */
export function partsFromGeometry(geometry: Polygon | MultiPolygon): Part[] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((rings) => {
    const part = partFromPolygon(rings);
    return part ? [part] : [];
  });
}

export function roundTo({ value, decimals }: { value: number; decimals: number }): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function closedRing({ ring, decimals }: { ring: Ring; decimals: number }): Position[] {
  const positions = ring.map(([lon, lat]): Position => {
    return [roundTo({ value: lon, decimals }), roundTo({ value: lat, decimals })];
  });
  const first = positions[0];
  return first ? [...positions, first] : positions;
}

/** GeoJSON for the parts, with closed rings rounded to `decimals`: a Polygon for one part, a MultiPolygon for more */
export function geometryFromParts({ parts, decimals }: { parts: Part[]; decimals: number }): Polygon | MultiPolygon | null {
  const polygons = parts.map((part) => {
    return part.map((ring) => {
      return closedRing({ ring, decimals });
    });
  });
  const [only] = polygons;
  if (!only) {
    return null;
  }
  return polygons.length === 1 ? { type: "Polygon", coordinates: only } : { type: "MultiPolygon", coordinates: polygons };
}

function replaceRing({ parts, ref, ring }: { parts: Part[]; ref: VertexRef; ring: Ring }): Part[] {
  return parts.map((part, partIndex) => {
    return partIndex === ref.part
      ? part.map((current, ringIndex) => {
          return ringIndex === ref.ring ? ring : current;
        })
      : part;
  });
}

export function vertexAt({ parts, ref }: { parts: Part[]; ref: VertexRef }): LonLat | null {
  return parts[ref.part]?.[ref.ring]?.[ref.index] ?? null;
}

export function moveVertex({ parts, ref, to }: { parts: Part[]; ref: VertexRef; to: LonLat }): Part[] {
  const ring = parts[ref.part]?.[ref.ring];
  if (!ring || !ring[ref.index]) {
    return parts;
  }
  return replaceRing({
    parts,
    ref,
    ring: ring.map((point, index) => {
      return index === ref.index ? to : point;
    }),
  });
}

/** Inserts a point so that it gets index `ref.index` */
export function insertVertex({ parts, ref, at }: { parts: Part[]; ref: VertexRef; at: LonLat }): Part[] {
  const ring = parts[ref.part]?.[ref.ring];
  if (!ring) {
    return parts;
  }
  return replaceRing({ parts, ref, ring: [...ring.slice(0, ref.index), at, ...ring.slice(ref.index)] });
}

/**
 * Removes a point. A ring left with fewer than 3 points is removed, and a part whose outer ring is removed goes
 * with its holes.
 */
export function removeVertex({ parts, ref }: { parts: Part[]; ref: VertexRef }): Part[] {
  const part = parts[ref.part];
  const ring = part?.[ref.ring];
  if (!part || !ring) {
    return parts;
  }
  const remaining = ring.filter((_point, index) => {
    return index !== ref.index;
  });
  if (remaining.length >= MIN_RING) {
    return replaceRing({ parts, ref, ring: remaining });
  }
  if (ref.ring === 0) {
    return removePart({ parts, part: ref.part });
  }
  return parts.map((current, partIndex) => {
    return partIndex === ref.part
      ? current.filter((_ring, ringIndex) => {
          return ringIndex !== ref.ring;
        })
      : current;
  });
}

export function removePart({ parts, part }: { parts: Part[]; part: number }): Part[] {
  return parts.filter((_part, index) => {
    return index !== part;
  });
}

export function vertexCount(parts: Part[]): number {
  let count = 0;
  for (const part of parts) {
    for (const ring of part) {
      count += ring.length;
    }
  }
  return count;
}

export function boundsOfParts(parts: Part[]): LonLatBox | null {
  const box: LonLatBox = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const part of parts) {
    for (const ring of part) {
      for (const [lon, lat] of ring) {
        box.west = Math.min(box.west, lon);
        box.east = Math.max(box.east, lon);
        box.south = Math.min(box.south, lat);
        box.north = Math.max(box.north, lat);
      }
    }
  }
  return Number.isFinite(box.west) ? box : null;
}

function cross(o: LonLat, a: LonLat, b: LonLat): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Whether segments ab and cd cross, or touch away from a shared end */
function segmentsMeet(a: LonLat, b: LonLat, c: LonLat, d: LonLat): boolean {
  if (
    Math.max(a[0], b[0]) < Math.min(c[0], d[0]) ||
    Math.max(c[0], d[0]) < Math.min(a[0], b[0]) ||
    Math.max(a[1], b[1]) < Math.min(c[1], d[1]) ||
    Math.max(c[1], d[1]) < Math.min(a[1], b[1])
  ) {
    return false;
  }
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // Collinear overlap, or one segment ending on the other
  const onSegment = (p: LonLat, q: LonLat, r: LonLat) => {
    return Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0]) && Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);
  };
  return (d1 === 0 && onSegment(c, d, a)) || (d2 === 0 && onSegment(c, d, b)) || (d3 === 0 && onSegment(a, b, c)) || (d4 === 0 && onSegment(a, b, d));
}

/** Rings longer than this are not checked, because the check takes time in the square of the length */
const MAX_CHECKED_RING = 4000;

/** Whether a ring crosses itself. Null when the ring is too long to check. */
export function ringCrossesItself(ring: Ring): boolean | null {
  const count = ring.length;
  if (count > MAX_CHECKED_RING) {
    return null;
  }
  for (let i = 0; i < count; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % count];
    if (!a || !b) {
      continue;
    }
    // Neighbouring segments share a point, so they are skipped, and so is the pair of the last and the first
    for (let j = i + 2; j < count; j += 1) {
      if (i === 0 && j === count - 1) {
        continue;
      }
      const c = ring[j];
      const d = ring[(j + 1) % count];
      if (c && d && segmentsMeet(a, b, c, d)) {
        return true;
      }
    }
  }
  return false;
}

/** Whether any ring of the parts crosses itself */
export function partsCrossThemselves(parts: Part[]): boolean {
  return parts.some((part) => {
    return part.some((ring) => {
      return ringCrossesItself(ring) === true;
    });
  });
}

/** Whether a point lies inside the parts, holes left out. Planar, which is close enough for a click. */
export function partsContain({ parts, point }: { parts: Part[]; point: LonLat }): boolean {
  return parts.some((part) => {
    const [outer, ...holes] = part;
    return (
      outer !== undefined &&
      ringContains({ ring: outer, point }) &&
      !holes.some((hole) => {
        return ringContains({ ring: hole, point });
      })
    );
  });
}

function ringContains({ ring, point }: { ring: Ring; point: LonLat }): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (a && b && a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}
