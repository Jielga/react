import { describe, expect, it } from "vitest";
import { boundsOfPoints, cameraForBounds, toScreen } from "./camera.ts";
import type { Frame } from "./camera.ts";

const frame: Frame = {
  size: { width: 400, height: 400 },
  bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
  padding: 0,
  maxZoom: 50,
};

describe("cameraForBounds", () => {
  it("fits the bounds inside the margin", () => {
    const camera = cameraForBounds({ frame, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, margin: 50 });
    // 0.4 pixels per unit fit the whole map, and 300 pixels for 100 units is 3, so the zoom is 7.5
    expect(camera.k).toBeCloseTo(7.5);
    expect(toScreen({ camera, frame, point: [0, 0] })).toEqual([50, 50]);
    expect(toScreen({ camera, frame, point: [100, 100] })).toEqual([350, 350]);
  });

  it("stops at maxZoom for a single point", () => {
    const camera = cameraForBounds({ frame, bounds: { minX: 5, minY: 5, maxX: 5, maxY: 5 }, margin: 50 });
    expect(camera).toEqual({ k: 50, center: [5, 5] });
  });
});

describe("boundsOfPoints", () => {
  it("is null without points", () => {
    expect(boundsOfPoints([])).toBeNull();
  });

  it("encloses every point", () => {
    expect(
      boundsOfPoints([
        [3, 4],
        [-1, 10],
      ]),
    ).toEqual({ minX: -1, minY: 4, maxX: 3, maxY: 10 });
  });
});
