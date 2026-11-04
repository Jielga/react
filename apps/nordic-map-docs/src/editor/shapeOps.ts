import { intersection, union } from "polyclip-ts";
import type { Geom } from "polyclip-ts";
import { boundsOfParts } from "./editorModel.ts";
import type { Part } from "./editorModel.ts";

function toGeom(parts: Part[]): Geom {
  return parts.map((part) => {
    return part.map((ring) => {
      const first = ring[0];
      return first ? [...ring, first] : ring;
    });
  });
}

/** polyclip-ts returns closed rings; parts keep them open */
function fromGeom(polygons: Geom): Part[] {
  return (polygons as [number, number][][][]).flatMap((polygon) => {
    const part = polygon.flatMap((ring) => {
      const open = ring.slice(0, -1);
      return open.length >= 3 ? [open] : [];
    });
    return part.length > 0 ? [part] : [];
  });
}

/** The shapes joined into one, with the borders they share removed */
export function unionParts(shapes: Part[][]): Part[] {
  const [first, ...rest] = shapes.filter((parts) => {
    return parts.length > 0;
  });
  if (!first) {
    return [];
  }
  return fromGeom(union(toGeom(first), ...rest.map(toGeom)));
}

/**
 * The parts of `parts` that lie inside any of `land`. Each land shape is cut on its own and the pieces are joined,
 * because an intersection with many shapes at once keeps only what lies inside all of them.
 */
export function clipParts({ parts, land }: { parts: Part[]; land: Part[][] }): Part[] {
  const box = boundsOfParts(parts);
  if (!box) {
    return [];
  }
  const shape = toGeom(parts);
  const pieces = land.flatMap((landParts) => {
    const landBox = boundsOfParts(landParts);
    if (!landBox || landBox.west > box.east || landBox.east < box.west || landBox.south > box.north || landBox.north < box.south) {
      return [];
    }
    const piece = fromGeom(intersection(shape, toGeom(landParts)));
    return piece.length > 0 ? [piece] : [];
  });
  return unionParts(pieces);
}
