import type { Point } from "./camera.ts";
import type { PlaceClass, RoadClass } from "./mapSource.ts";
import type { PreparedCell } from "./useMapCells.ts";

/** Everything to draw, with each layer of all cells joined into one path */
export type MapScene = {
  contextLand: Path2D | null;
  contextBorders: Path2D | null;
  land: Path2D | null;
  water: Path2D | null;
  borders: Path2D | null;
  roads: { roadClass: RoadClass; path: Path2D }[];
  roadLabels: { text: string; at: Point }[];
  /** From the most important, which gets its name drawn first */
  places: { name: string; at: Point; placeClass: PlaceClass; population: number }[];
};

const placeRank: Record<PlaceClass, number> = { city: 0, town: 1, village: 2 };

const roadClasses: RoadClass[] = ["regional", "national", "european"];

function join(paths: (Path2D | null)[]): Path2D | null {
  const present = paths.filter((path) => {
    return path !== null;
  });
  const [first] = present;
  if (present.length <= 1) {
    return first ?? null;
  }
  const joined = new Path2D();
  for (const path of present) {
    joined.addPath(path);
  }
  return joined;
}

/**
 * Joins the layers of the cells. Cells meet at their edges, and filling each cell on its own leaves a thin
 * visible seam there, because the anti-aliased edges of both sides do not add up to full coverage.
 * One fill of the joined path has no seam.
 */
export function buildScene({ cells, contextCells }: { cells: PreparedCell[]; contextCells: PreparedCell[] }): MapScene {
  return {
    contextLand: join(
      contextCells.map((cell) => {
        return cell.contextLand;
      }),
    ),
    contextBorders: join(
      contextCells.map((cell) => {
        return cell.contextBorders;
      }),
    ),
    land: join(
      cells.map((cell) => {
        return cell.land;
      }),
    ),
    water: join(
      cells.map((cell) => {
        return cell.water;
      }),
    ),
    borders: join(
      cells.map((cell) => {
        return cell.borders;
      }),
    ),
    roads: roadClasses.flatMap((roadClass) => {
      const path = join(
        cells.flatMap((cell) => {
          return cell.roads
            .filter((road) => {
              return road.roadClass === roadClass;
            })
            .map((road) => {
              return road.path;
            });
        }),
      );
      return path ? [{ roadClass, path }] : [];
    }),
    roadLabels: cells.flatMap((cell) => {
      return cell.roadLabels;
    }),
    places: cells
      .flatMap((cell) => {
        return cell.places;
      })
      .sort((a, b) => {
        return placeRank[a.placeClass] - placeRank[b.placeClass] || b.population - a.population;
      }),
  };
}
