/** Rectangle on screen, in pixels */
export type Box = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type LabelPlacer = {
  /** Whether `box` is free of every box added so far */
  fits: (box: Box) => boolean;
  add: (box: Box) => void;
};

/** Side of the grid buckets, in pixels. About the size of a label, so a box touches few buckets. */
const BUCKET = 64;

export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Keeps track of what is drawn on screen, so a label is only drawn where nothing more important is.
 * Whatever is added first wins: add pins before their labels, and labels in order of importance.
 * Boxes are kept in grid buckets, so a check only looks at its neighbours, not at every box on screen.
 */
export function createLabelPlacer(): LabelPlacer {
  const buckets = new Map<string, Box[]>();

  const keysOf = (box: Box) => {
    const keys: string[] = [];
    for (let x = Math.floor(box.left / BUCKET); x <= Math.floor(box.right / BUCKET); x += 1) {
      for (let y = Math.floor(box.top / BUCKET); y <= Math.floor(box.bottom / BUCKET); y += 1) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  };

  return {
    fits: (box) => {
      return keysOf(box).every((key) => {
        return !(buckets.get(key) ?? []).some((other) => {
          return overlaps(box, other);
        });
      });
    },
    add: (box) => {
      for (const key of keysOf(box)) {
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.push(box);
        } else {
          buckets.set(key, [box]);
        }
      }
    },
  };
}
