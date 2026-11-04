/** Fills for new areas, in turn, and the swatches of the fill picker */
export const SWATCHES = [
  "rgba(214, 51, 108, 0.35)",
  "rgba(28, 126, 214, 0.35)",
  "rgba(55, 178, 77, 0.35)",
  "rgba(247, 103, 7, 0.35)",
  "rgba(112, 72, 232, 0.35)",
  "rgba(16, 152, 173, 0.35)",
  "rgba(245, 159, 0, 0.35)",
  "rgba(134, 142, 150, 0.35)",
];

/** The fill of the area after `count` others */
export function swatchFor(count: number): string {
  return SWATCHES[count % SWATCHES.length] ?? "rgba(28, 126, 214, 0.35)";
}
