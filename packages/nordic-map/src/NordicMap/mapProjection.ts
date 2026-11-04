import { geoTransverseMercator } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import type { MultiPoint } from "geojson";
import { boundsOfPoints, toMap } from "./camera.ts";
import type { Camera, Frame, MapBounds, Point } from "./camera.ts";
import type { LonLat, LonLatBox, MapSource } from "./mapSource.ts";

/** Size of the projected map, in map units. Only the ratio matters, the camera scales it to the view. */
const MAP_SIZE = 1000;

export type MapProjection = {
  projection: GeoProjection;
  project: (lonLat: LonLat) => Point | null;
  invert: (point: Point) => LonLat | null;
};

/** Points along the edge of the box. Its edges curve in the projection, so the corners alone are not enough. */
export
function boxOutline(box: LonLatBox): MultiPoint {
  const coordinates: LonLat[] = [];
  const steps = 16;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const lon = box.west + (box.east - box.west) * t;
    const lat = box.south + (box.north - box.south) * t;
    coordinates.push([lon, box.south], [lon, box.north], [box.west, lat], [box.east, lat]);
  }
  return { type: "MultiPoint", coordinates };
}

/**
 * Transverse Mercator around the source's central meridian. On 15°E it is close to SWEREF 99 TM,
 * so Sweden is not squashed, and it also suits Norway, Finland and Denmark.
 */
export function createMapProjection(source: MapSource): MapProjection {
  const { extent } = source;
  const meridian = source.centralMeridian ?? (extent.west + extent.east) / 2;
  const projection = geoTransverseMercator()
    .rotate([-meridian, 0])
    .fitSize([MAP_SIZE, MAP_SIZE], boxOutline(extent));
  return {
    projection,
    project: (lonLat) => {
      const point = projection(lonLat);
      return point ? [point[0], point[1]] : null;
    },
    invert: (point) => {
      const lonLat = projection.invert?.(point);
      return lonLat ? [lonLat[0], lonLat[1]] : null;
    },
  };
}

/** The box in map units, around its curved edges */
export function projectBox({ projection, box }: { projection: MapProjection; box: LonLatBox }): MapBounds | null {
  return boundsOfPoints(
    boxOutline(box).coordinates.flatMap((position) => {
      const [lon, lat] = position;
      const point = lon === undefined || lat === undefined ? null : projection.project([lon, lat]);
      return point ? [point] : [];
    }),
  );
}

/** The area the view shows, in degrees, grown by `margin` pixels on every side */
export function viewBox({
  camera,
  frame,
  projection,
  margin = 0,
}: {
  camera: Camera;
  frame: Frame;
  projection: MapProjection;
  margin?: number;
}): LonLatBox | null {
  const { width, height } = frame.size;
  const xs = [-margin, width / 2, width + margin];
  const ys = [-margin, height / 2, height + margin];
  const box: LonLatBox = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const x of xs) {
    for (const y of ys) {
      const lonLat = projection.invert(toMap({ camera, frame, point: [x, y] }));
      if (lonLat) {
        box.west = Math.min(box.west, lonLat[0]);
        box.east = Math.max(box.east, lonLat[0]);
        box.south = Math.min(box.south, lonLat[1]);
        box.north = Math.max(box.north, lonLat[1]);
      }
    }
  }
  return Number.isFinite(box.west) ? box : null;
}
