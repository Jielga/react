import type { MultiPolygon, Polygon, Position } from "geojson";

/** Twice the signed area of a ring in degrees, positive when the ring runs counterclockwise */
function signedArea(ring: Position[]): number {
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1 = 0, y1 = 0] = ring[index] ?? [];
    const [x2 = 0, y2 = 0] = ring[(index + 1) % ring.length] ?? [];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

function wound(ring: Position[], clockwise: boolean): Position[] {
  const isClockwise = signedArea(ring) < 0;
  return isClockwise === clockwise ? ring : [...ring].reverse();
}

function rewindRings(rings: Position[][]): Position[][] {
  return rings.map((ring, index) => {
    return wound(ring, index === 0);
  });
}

/**
 * The polygon with its outer ring clockwise and its holes counterclockwise, as d3-geo needs them.
 * d3-geo reads a ring on the sphere, and takes a counterclockwise outer ring as everything outside it, which
 * fills the whole map. GeoJSON (RFC 7946) winds the other way, so polygons are rewound before drawing.
 */
export function rewindPolygon<T extends Polygon | MultiPolygon>(geometry: T): T {
  if (geometry.type === "Polygon") {
    return { ...geometry, coordinates: rewindRings(geometry.coordinates) };
  }
  return { ...geometry, coordinates: geometry.coordinates.map(rewindRings) };
}
