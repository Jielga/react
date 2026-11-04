import { describe, expect, it } from "vitest";
import { createLabelPlacer, overlaps } from "./labelPlacer.ts";

describe("overlaps", () => {
  it("is false for boxes that only touch", () => {
    expect(overlaps({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
  });
});

describe("createLabelPlacer", () => {
  it("keeps a box from being placed over one added before", () => {
    const placer = createLabelPlacer();
    placer.add({ left: 0, top: 0, right: 100, bottom: 20 });
    expect(placer.fits({ left: 90, top: 10, right: 150, bottom: 30 })).toBe(false);
    expect(placer.fits({ left: 100, top: 0, right: 150, bottom: 20 })).toBe(true);
  });

  it("finds boxes that span several grid buckets", () => {
    const placer = createLabelPlacer();
    placer.add({ left: -500, top: -10, right: 500, bottom: 10 });
    expect(placer.fits({ left: 300, top: 0, right: 310, bottom: 5 })).toBe(false);
  });
});
