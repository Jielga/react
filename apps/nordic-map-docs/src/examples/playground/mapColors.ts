import { darkMapStyle, lightMapStyle } from "@jielga/nordic-map";
import type { MapStyle } from "@jielga/nordic-map";

/** The `MapStyle` colors the playground lets you change */
export type ColorKey =
  | "sea"
  | "land"
  | "border"
  | "contextLand"
  | "contextBorder"
  | "road"
  | "text"
  | "pin"
  | "pinStroke"
  | "pinSelected"
  | "areaFill"
  | "highlight";

export type MapColors = Pick<MapStyle, ColorKey>;

export const colorFields: { key: ColorKey; label: string }[] = [
  { key: "sea", label: "Sea and lakes" },
  { key: "land", label: "Swedish land" },
  { key: "border", label: "Swedish coast and border" },
  { key: "contextLand", label: "Neighbouring land" },
  { key: "contextBorder", label: "Neighbouring coasts and borders" },
  { key: "road", label: "Roads" },
  { key: "text", label: "Place names and pin labels" },
  { key: "pin", label: "Pins" },
  { key: "pinStroke", label: "Pin outline" },
  { key: "pinSelected", label: "Selected pins" },
  { key: "areaFill", label: "County fill" },
  { key: "highlight", label: "Hover and focus ring" },
];

function pick(style: MapStyle): MapColors {
  return Object.fromEntries(
    colorFields.map(({ key }) => {
      return [key, style[key]];
    }),
  ) as MapColors;
}

export const lightColors = pick(lightMapStyle);
export const darkColors = pick(darkMapStyle);

export function sameColors(a: MapColors, b: MapColors): boolean {
  return colorFields.every(({ key }) => {
    return a[key].toLowerCase() === b[key].toLowerCase();
  });
}
