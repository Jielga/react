import type { Point } from "./camera.ts";
import type { MapPin } from "./mapItems.ts";

/** A pin projected to map units. `order` is its index in the `pins` prop. */
export type PlacedPin<T> = {
  pin: MapPin<T>;
  point: Point;
  order: number;
};

/** What the map draws for pins: a pin on its own, or a cluster of pins close together */
export type Marker<T> =
  | { kind: "pin"; key: string; pin: MapPin<T>; point: Point }
  | { kind: "cluster"; key: string; pins: MapPin<T>[]; point: Point };

/** Pixels a cluster's radius grows past a pin's, plus a little per digit of its count */
export function markerRadius({ marker, pinRadius }: { marker: Marker<unknown>; pinRadius: number }): number {
  if (marker.kind === "pin") {
    return pinRadius;
  }
  return Math.max(pinRadius + 5, 9 + String(marker.pins.length).length * 2.5);
}

export function markerPins<T>(marker: Marker<T>): MapPin<T>[] {
  return marker.kind === "pin" ? [marker.pin] : marker.pins;
}

/**
 * Groups points that lie within `radius` of each other. Greedy, in input order: the first point that is not
 * in a group yet starts one, and takes every free point within `radius` of it. Returns the groups as
 * indexes into `points`, each starting with the point that started it.
 */
export function clusterPoints({ points, radius }: { points: Point[]; radius: number }): number[][] {
  const cellOf = (point: Point) => {
    return [Math.floor(point[0] / radius), Math.floor(point[1] / radius)] as const;
  };
  const grid = new Map<string, number[]>();
  points.forEach((point, index) => {
    const [x, y] = cellOf(point);
    const key = `${x},${y}`;
    const cell = grid.get(key);
    if (cell) {
      cell.push(index);
    } else {
      grid.set(key, [index]);
    }
  });

  const taken = new Array<boolean>(points.length).fill(false);
  const groups: number[][] = [];
  points.forEach((seed, seedIndex) => {
    if (taken[seedIndex]) {
      return;
    }
    taken[seedIndex] = true;
    const group = [seedIndex];
    const [cellX, cellY] = cellOf(seed);
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      for (let y = cellY - 1; y <= cellY + 1; y += 1) {
        for (const index of grid.get(`${x},${y}`) ?? []) {
          const point = points[index];
          if (!taken[index] && point && Math.hypot(point[0] - seed[0], point[1] - seed[1]) <= radius) {
            taken[index] = true;
            group.push(index);
          }
        }
      }
    }
    groups.push(group);
  });
  return groups;
}

/**
 * The markers to draw. Without a `radius` every pin is its own marker. With one, pins within `radius`
 * (map units) of a more important pin join its cluster, which sits at the middle of its pins.
 * Markers come in the order of their first pin in `pins`, which is also their keyboard order.
 */
export function buildMarkers<T>({ placed, radius }: { placed: PlacedPin<T>[]; radius: number | null }): Marker<T>[] {
  if (radius === null || radius <= 0) {
    return placed.map(({ pin, point }) => {
      return { kind: "pin", key: `pin:${pin.id}`, pin, point };
    });
  }
  // Higher priority first, then in `pins` order, so the most important pin starts its cluster
  const ranked = [...placed].sort((a, b) => {
    return (b.pin.priority ?? 0) - (a.pin.priority ?? 0) || a.order - b.order;
  });
  const groups = clusterPoints({
    points: ranked.map(({ point }) => {
      return point;
    }),
    radius,
  }).map((indexes) => {
    return indexes.flatMap((index) => {
      const member = ranked[index];
      return member ? [member] : [];
    });
  });

  const markers = groups.flatMap((members): { marker: Marker<T>; order: number }[] => {
    const [seed] = members;
    if (!seed) {
      return [];
    }
    const order = Math.min(
      ...members.map((member) => {
        return member.order;
      }),
    );
    if (members.length === 1) {
      return [{ marker: { kind: "pin", key: `pin:${seed.pin.id}`, pin: seed.pin, point: seed.point }, order }];
    }
    const inOrder = [...members].sort((a, b) => {
      return a.order - b.order;
    });
    const x = members.reduce((sum, member) => sum + member.point[0], 0) / members.length;
    const y = members.reduce((sum, member) => sum + member.point[1], 0) / members.length;
    return [
      {
        marker: {
          kind: "cluster",
          key: `cluster:${seed.pin.id}`,
          pins: inOrder.map((member) => {
            return member.pin;
          }),
          point: [x, y],
        },
        order,
      },
    ];
  });
  return markers
    .sort((a, b) => {
      return a.order - b.order;
    })
    .map(({ marker }) => {
      return marker;
    });
}
