import type { MultiPolygon, Polygon } from "geojson";
import type { MapArea } from "@jielga/nordic-map";
import { geometryFromParts, partsFromGeometry } from "./editorModel.ts";
import type { EditorArea } from "./editorModel.ts";

export type ExportFormat = "typescript" | "json" | "geojson";

/** 5 decimals of a degree is about 1 m */
export const EXPORT_DECIMALS = 5;

export const FILE_NAMES: Record<ExportFormat, string> = {
  typescript: "areas.ts",
  json: "areas.json",
  geojson: "areas.geojson",
};

const DEFAULT_FILL = "rgba(28, 126, 214, 0.35)";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: Json | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : typeof value === "number" ? String(value) : undefined;
}

function asGeometry(value: Json | undefined): Polygon | MultiPolygon | null {
  if (!isObject(value) || !Array.isArray(value.coordinates)) {
    return null;
  }
  // The positions are checked one by one when they become parts
  if (value.type === "Polygon") {
    return { type: "Polygon", coordinates: value.coordinates as Polygon["coordinates"] };
  }
  if (value.type === "MultiPolygon") {
    return { type: "MultiPolygon", coordinates: value.coordinates as MultiPolygon["coordinates"] };
  }
  return null;
}

type Candidate = { id?: string; label?: string; fill?: string; stroke?: string; geometry: Json | undefined };

/** The areas in a MapArea list, a GeoJSON FeatureCollection, a Feature, or a bare Polygon or MultiPolygon */
function candidatesOf(value: Json): Candidate[] | string {
  if (Array.isArray(value)) {
    return value.map((item): Candidate => {
      if (!isObject(item)) {
        return { geometry: undefined };
      }
      return { id: text(item.id), label: text(item.label), fill: text(item.fill), stroke: text(item.stroke), geometry: item.geometry };
    });
  }
  if (!isObject(value)) {
    return "Expected a list of areas, or GeoJSON.";
  }
  if (value.type === "FeatureCollection") {
    if (!Array.isArray(value.features)) {
      return "The FeatureCollection has no features list.";
    }
    return value.features.map((feature) => {
      return featureCandidate(feature);
    });
  }
  if (value.type === "Feature") {
    return [featureCandidate(value)];
  }
  if (value.type === "Polygon" || value.type === "MultiPolygon") {
    return [{ geometry: value }];
  }
  return `Expected a list of areas, or GeoJSON, not a "${String(value.type)}".`;
}

function featureCandidate(feature: Json): Candidate {
  if (!isObject(feature)) {
    return { geometry: undefined };
  }
  const properties = isObject(feature.properties) ? feature.properties : {};
  return {
    id: text(properties.id) ?? text(feature.id),
    label: text(properties.label) ?? text(properties.name),
    fill: text(properties.fill),
    stroke: text(properties.stroke),
    geometry: feature.geometry,
  };
}

/** The value of `export const x: T = value;` in a TypeScript module, such as the one `exportAreas` writes */
function moduleValue(input: string): string {
  const match = /export\s+const\s+\w+\s*(?::[^=]*)?=\s*([\s\S]*?);?\s*$/.exec(input);
  return match?.[1] ?? input;
}

export type ParseResult = { areas: EditorArea[]; skipped: number } | { error: string };

/**
 * Reads areas from text. Entries without a Polygon or MultiPolygon are skipped and counted. Ids that are
 * missing, or already in `takenIds` or earlier in the text, get a free id.
 */
export function parseAreas({ input, takenIds = [] }: { input: string; takenIds?: string[] }): ParseResult {
  let value: Json;
  try {
    value = JSON.parse(moduleValue(input)) as Json;
  } catch (error) {
    return { error: `Not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const candidates = candidatesOf(value);
  if (typeof candidates === "string") {
    return { error: candidates };
  }
  const taken = new Set(takenIds);
  const areas: EditorArea[] = [];
  let skipped = 0;
  for (const candidate of candidates) {
    const geometry = asGeometry(candidate.geometry);
    const parts = geometry ? partsFromGeometry(geometry) : [];
    if (parts.length === 0) {
      skipped += 1;
      continue;
    }
    const id = freeId({ wanted: candidate.id, taken });
    taken.add(id);
    areas.push({
      id,
      label: candidate.label ?? "",
      fill: candidate.fill ?? DEFAULT_FILL,
      ...(candidate.stroke ? { stroke: candidate.stroke } : {}),
      parts,
    });
  }
  return { areas, skipped };
}

/** `wanted` if it is free, or else the first free `wanted-2`, `wanted-3`, ..., or `area-1`, `area-2`, ... */
export function freeId({ wanted, taken }: { wanted?: string; taken: Set<string> }): string {
  if (wanted && !taken.has(wanted)) {
    return wanted;
  }
  const base = wanted ?? "area";
  for (let number = wanted ? 2 : 1; ; number += 1) {
    const id = `${base}-${number}`;
    if (!taken.has(id)) {
      return id;
    }
  }
}

/** The areas that have a shape, as `MapArea`s */
export function toMapAreas({ areas, decimals }: { areas: EditorArea[]; decimals: number }): MapArea[] {
  return areas.flatMap((area): MapArea[] => {
    const geometry = geometryFromParts({ parts: area.parts, decimals });
    if (!geometry) {
      return [];
    }
    return [
      {
        id: area.id,
        ...(area.label ? { label: area.label } : {}),
        fill: area.fill,
        ...(area.stroke ? { stroke: area.stroke } : {}),
        geometry,
      },
    ];
  });
}

/**
 * Pretty JSON, but with each `coordinates` array on one line: indented, a polygon of a thousand points would be
 * thousands of lines.
 */
function stringify(value: unknown): string {
  const coordinates: string[] = [];
  const marked = JSON.stringify(
    value,
    (key, item: unknown) => {
      if (key === "coordinates") {
        coordinates.push(JSON.stringify(item));
        return `\u0000${coordinates.length - 1}`;
      }
      return item;
    },
    2,
  );
  return marked.replace(/"\\u0000(\d+)"/g, (_match, index: string) => {
    return coordinates[Number(index)] ?? "[]";
  });
}

export function exportAreas({ areas, format, decimals = EXPORT_DECIMALS }: { areas: EditorArea[]; format: ExportFormat; decimals?: number }): string {
  const mapAreas = toMapAreas({ areas, decimals });
  switch (format) {
    case "json":
      return `${stringify(mapAreas)}\n`;
    case "typescript":
      return `import type { MapArea } from "@jielga/nordic-map";\n\nexport const areas: MapArea[] = ${stringify(mapAreas)};\n`;
    case "geojson":
      return `${stringify({
        type: "FeatureCollection",
        features: mapAreas.map(({ id, geometry, ...properties }) => {
          return { type: "Feature", id, properties: { id, ...properties }, geometry };
        }),
      })}\n`;
  }
}
