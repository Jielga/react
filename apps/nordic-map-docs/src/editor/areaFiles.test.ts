import { describe, expect, it } from "vitest";
import { exportAreas, parseAreas } from "./areaFiles.ts";
import type { EditorArea } from "./editorModel.ts";

const north: EditorArea = {
  id: "north",
  label: "North",
  fill: "rgba(28, 126, 214, 0.35)",
  parts: [
    [
      [
        [17.123456789, 63],
        [20, 63],
        [20, 65],
      ],
    ],
  ],
};

function parsed(input: string, takenIds?: string[]): EditorArea[] {
  const result = parseAreas({ input, takenIds });
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result.areas;
}

describe("areaFiles", () => {
  it("reads back each format it writes", () => {
    for (const format of ["typescript", "json", "geojson"] as const) {
      const [area] = parsed(exportAreas({ areas: [north], format }));
      expect(area?.id).toBe("north");
      expect(area?.label).toBe("North");
      expect(area?.fill).toBe(north.fill);
      // Rounded to 5 decimals
      expect(area?.parts[0]?.[0]?.[0]).toEqual([17.12346, 63]);
    }
  });

  it("writes MapArea JSON with each coordinates list on one line", () => {
    const json = exportAreas({ areas: [north], format: "json" });
    expect(json).toContain('"coordinates": [[[17.12346,63],[20,63],[20,65],[17.12346,63]]]');
    expect(JSON.parse(json)).toEqual([
      {
        id: "north",
        label: "North",
        fill: north.fill,
        geometry: { type: "Polygon", coordinates: [[[17.12346, 63], [20, 63], [20, 65], [17.12346, 63]]] },
      },
    ]);
  });

  it("leaves areas without a shape out of the export", () => {
    const empty: EditorArea = { id: "empty", label: "", fill: north.fill, parts: [] };
    expect(JSON.parse(exportAreas({ areas: [empty, north], format: "json" }))).toHaveLength(1);
  });

  it("reads a Feature and a bare geometry, and takes the label from a name", () => {
    const feature = parsed(
      JSON.stringify({
        type: "Feature",
        id: 7,
        properties: { name: "Seven" },
        geometry: { type: "Polygon", coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] },
      }),
    );
    expect(feature[0]).toMatchObject({ id: "7", label: "Seven" });

    const bare = parsed(JSON.stringify({ type: "Polygon", coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] }));
    expect(bare[0]?.id).toBe("area-1");
  });

  it("gives taken and missing ids a free one", () => {
    const input = exportAreas({ areas: [north, north], format: "json" });
    expect(
      parsed(input, ["north"]).map((area) => {
        return area.id;
      }),
    ).toEqual(["north-2", "north-3"]);
  });

  it("skips entries without a polygon, and reports text it cannot read", () => {
    const result = parseAreas({
      input: JSON.stringify({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [1, 1] } },
          { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[1, 1], [2, 1], [2, 2]]] } },
        ],
      }),
    });
    expect(result).toMatchObject({ skipped: 1 });
    expect(parseAreas({ input: "not json" })).toHaveProperty("error");
    expect(parseAreas({ input: '{ "type": "Point", "coordinates": [1, 1] }' })).toHaveProperty("error");
  });
});
