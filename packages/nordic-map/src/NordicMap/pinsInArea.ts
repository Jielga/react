import { geoBounds, geoContains } from "d3-geo";
import type { MultiPolygon, Polygon } from "geojson";
import { rewindPolygon } from "./geometry.ts";
import type { MapArea, MapPin } from "./mapItems.ts";
import type { LonLatBox } from "./mapSource.ts";

type Prepared = { geometry: Polygon | MultiPolygon; box: LonLatBox | null };

/** Rewound geometry and its box, per geometry object, so testing many pins against one area prepares it once */
const prepared = new WeakMap<Polygon | MultiPolygon, Prepared>();

/** The box around the area on the sphere, which includes the bulge of edges that are great circles */
function boxOf(geometry: Polygon | MultiPolygon): LonLatBox | null {
  const [[west, south], [east, north]] = geoBounds(geometry);
  return [west, south, east, north].every(Number.isFinite) ? { west, south, east, north } : null;
}

function prepare(geometry: Polygon | MultiPolygon): Prepared {
  let entry = prepared.get(geometry);
  if (!entry) {
    const rewound = rewindPolygon(geometry);
    entry = { geometry: rewound, box: boxOf(rewound) };
    prepared.set(geometry, entry);
  }
  return entry;
}

/**
 * The pins inside an area, in `pins` order. A pin in a hole of the area is outside it. The edges are great
 * circles, as the map draws them.
 */
export function pinsInArea<T>(pins: MapPin<T>[], area: MapArea): MapPin<T>[] {
  const { geometry, box } = prepare(area.geometry);
  if (!box) {
    return [];
  }
  return pins.filter((pin) => {
    return (
      pin.lon >= box.west &&
      pin.lon <= box.east &&
      pin.lat >= box.south &&
      pin.lat <= box.north &&
      geoContains(geometry, [pin.lon, pin.lat])
    );
  });
}
