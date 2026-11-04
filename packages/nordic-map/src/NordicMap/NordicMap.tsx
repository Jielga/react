import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
} from "react";
import { boundsOfPoints, cameraForBounds, fitScale, homeCamera, panBy, pinchCamera, toMap, toScreen, zoomAround } from "./camera.ts";
import type { Camera, Frame, MapBounds, Point, Size } from "./camera.ts";
import { hitArea, hitMarker, hitPath } from "./hitTest.ts";
import { NORDIC_MAP_LABELS_EN } from "./labels.ts";
import type { NordicMapLabels } from "./labels.ts";
import { layerOpacity } from "./layerVisibility.ts";
import type { LayerVisibility } from "./layerVisibility.ts";
import type { ClusterOptions, MapArea, MapPath, MapPin, MapTooltipTarget, SelectionMode } from "./mapItems.ts";
import { createMapProjection, projectBox, viewBox } from "./mapProjection.ts";
import { pinsInArea } from "./pinsInArea.ts";
import { buildScene } from "./mapScene.ts";
import type { LonLatBox, MapSource } from "./mapSource.ts";
import { darkMapStyle, lightMapStyle } from "./mapStyle.ts";
import type { MapStyle } from "./mapStyle.ts";
import { MapStatus } from "./MapStatus.tsx";
import { MapTooltip } from "./MapTooltip.tsx";
import { MarkerButtons } from "./MarkerButtons.tsx";
import type { MarkerButton } from "./MarkerButtons.tsx";
import { buildMarkers, markerPins, markerRadius } from "./markers.ts";
import type { Marker, PlacedPin } from "./markers.ts";
import classes from "./NordicMap.module.css";
import { prepareAreas, preparePaths } from "./overlays.ts";
import { renderMap } from "./renderMap.ts";
import type { ScreenMarker } from "./renderMap.ts";
import { useCamera } from "./useCamera.ts";
import { useColorScheme } from "./useColorScheme.ts";
import type { MapColorScheme } from "./useColorScheme.ts";
import { useDetailCells, useOverviewCells } from "./useMapCells.ts";
import type { PreparedCell } from "./useMapCells.ts";
import { ZoomControls } from "./ZoomControls.tsx";

/** What the map shows */
export type NordicMapView = {
  /** Zoom factor, where 1 shows the whole map */
  zoom: number;
  /** The point in the middle of the view */
  center: { lat: number; lon: number };
  /** The area in view, in WGS 84 degrees */
  bounds: LonLatBox;
};

export type CameraMoveOptions = {
  /** Eases to the new view. Left out, it eases unless the user's system asks for reduced motion. */
  animate?: boolean;
};

/**
 * Moves the map from your code, through the `ref` prop. A call made while the map data is still loading
 * takes effect, without animation, once the map is shown.
 */
export type NordicMapHandle = {
  /** Centers the map on a position, at `zoom` or at the current zoom */
  flyTo: (target: { lat: number; lon: number; zoom?: number }, options?: CameraMoveOptions) => void;
  /** Shows an area as large as fits */
  fitBounds: (bounds: LonLatBox, options?: CameraMoveOptions) => void;
  /** Shows the pins with these ids, or every pin, as large as fits. A single pin shows at `maxZoom`. */
  fitPins: (ids?: string[], options?: CameraMoveOptions) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Shows the whole map */
  reset: (options?: CameraMoveOptions) => void;
  /** The current view, or null while the map data is loading */
  getView: () => NordicMapView | null;
  /**
   * The point on screen of a position, in CSS pixels from the map's top left corner. The point may lie outside
   * the view. Null while the map data is loading.
   */
  project: (position: { lat: number; lon: number }) => { x: number; y: number } | null;
  /** The position at a point on screen, given in CSS pixels from the map's top left corner. Null while the map data is loading. */
  unproject: (point: { x: number; y: number }) => { lat: number; lon: number } | null;
};

export type NordicMapProps<T = unknown> = {
  /** Where the map data comes from, for example `swedenOsmSource`. Keep it stable, such as a module constant. */
  source: MapSource;
  ref?: Ref<NordicMapHandle>;
  /** Accessible name of the map. Defaults to `labels.map`. */
  label?: string;
  /** Texts the map shows, merged over the English ones */
  labels?: Partial<NordicMapLabels>;
  /** Light or dark colors for the map and its buttons. `auto` follows the system setting. @default "auto" */
  colorScheme?: MapColorScheme;
  /** Colors and sizes, merged over the colors of the color scheme */
  mapStyle?: Partial<MapStyle>;
  className?: string;
  style?: CSSProperties;
  /** Space in pixels around the map at zoom 1 @default 16 */
  padding?: number;
  /** Largest zoom factor, where 1 shows the whole map @default 50 */
  maxZoom?: number;
  /** Zoom in, zoom out and show whole map buttons in the top right corner @default true */
  showZoomControls?: boolean;
  /** Called when the view changes. During a zoom or pan it is called on every animation frame. */
  onViewChange?: (view: NordicMapView) => void;
  /** Called with the position of a click or tap on the map that hits no pin or cluster */
  onMapClick?: (position: { lat: number; lon: number }) => void;

  /** When the coastline and border show: `true`, `false`, or a zoom range such as `{ minZoom: 8 }` @default true */
  showBorder?: LayerVisibility;
  /** When the roads show @default true */
  showRoads?: LayerVisibility;
  /** When the road number signs show. They only show where the roads show too. @default true */
  showRoadLabels?: LayerVisibility;
  /** When the names of cities, towns and villages show @default true */
  showPlaceLabels?: LayerVisibility;

  pins?: MapPin<T>[];
  /** When the pins show. Hidden pins can not be clicked, selected or reached with the keyboard. @default true */
  showPins?: LayerVisibility;
  /** When the pins' labels show next to them. They only show where the pins show too. @default false */
  showPinLabels?: LayerVisibility;
  /** Joins pins that are close on screen into clusters with a count. Clicking a cluster zooms in on it. @default false */
  cluster?: boolean | ClusterOptions;
  /** @default "multiple" */
  selectionMode?: SelectionMode;
  /** Selected pin ids. Leave out to let the map keep its own selection. */
  selected?: string[];
  /** Selection at the start, when `selected` is left out */
  defaultSelected?: string[];
  /** Called after a drag-select, a pin click, an area click that selects pins, or a clear. The ids are in `pins` order. */
  onSelectionChange?: (ids: string[]) => void;
  /**
   * With `selectionMode` `"multiple"`, a click on an area selects the pins inside it instead of clearing the
   * selection. Shift, Ctrl or Cmd + click adds them, or removes them when they are all selected. @default false
   */
  selectPinsByArea?: boolean;
  /** Pin drawn with a ring and labelled first, for example the row under the pointer in a list next to the map */
  highlighted?: string | null;
  onPinClick?: (pin: MapPin<T>) => void;
  /** Called when the pointer or the keyboard focus moves onto a pin, and with null when it leaves */
  onPinHover?: (pin: MapPin<T> | null) => void;
  /**
   * Content of the tooltip over the pin, cluster, area or path under the pointer or with keyboard focus.
   * Return null for no tooltip. Defaults to the label, and to the pin count for a cluster.
   */
  renderTooltip?: (target: MapTooltipTarget<T>) => ReactNode;

  /** Filled regions, for example counties from `loadSwedenCounties` */
  areas?: MapArea[];
  /** When the areas show @default true */
  showAreas?: LayerVisibility;
  onAreaClick?: (area: MapArea) => void;
  /** Called when the pointer moves onto an area, and with null when it leaves */
  onAreaHover?: (area: MapArea | null) => void;

  /** Lines, for example GPS tracks */
  paths?: MapPath[];
  /** When the paths show @default true */
  showPaths?: LayerVisibility;
  onPathClick?: (path: MapPath) => void;
};

type DragRect = { from: Point; to: Point };

type PanSample = { time: number; point: Point };

type Gesture =
  | { kind: "select"; start: Point; additive: boolean }
  /** `primary` is a left button or one finger: if it barely moves, it is a click */
  | { kind: "pan"; start: Point; last: Point; samples: PanSample[]; primary: boolean }
  | { kind: "pinch"; start: Camera; startMid: Point; startDistance: number }
  // A pinch has ended but a finger is still down. Wait until all fingers are up.
  | { kind: "settling" };

type Hover =
  | { kind: "marker"; key: string }
  | { kind: "area"; id: string; at: Point }
  | { kind: "path"; id: string; at: Point };

/** Zoom factor of one click on the zoom buttons or one + or - key press */
const ZOOM_STEP = 1.6;
/** Pixels an arrow key pans */
const KEY_PAN = 80;
/** Pan movement older than this, in milliseconds, does not count toward the fling speed */
const FLING_WINDOW_MS = 100;
/** Pixels kept free around pins and areas the map zooms to */
const FIT_MARGIN = 48;
/** Duration of a camera move from `flyTo`, `fitBounds`, `fitPins`, a cluster click or `reset` */
const MOVE_MS = 450;
/** Pixels a click may move and still count as a click, for a mouse and for a finger */
const CLICK_SLOP = { mouse: 4, touch: 10 };
const DEFAULT_CLUSTER_RADIUS = 40;

const noCells: PreparedCell[] = [];
const noPins: MapPin<never>[] = [];
const noAreas: MapArea[] = [];
const noPaths: MapPath[] = [];

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function unionBounds(list: (MapBounds | null)[]): MapBounds | null {
  let result: MapBounds | null = null;
  for (const bounds of list) {
    if (!bounds) {
      continue;
    }
    result = result
      ? {
          minX: Math.min(result.minX, bounds.minX),
          minY: Math.min(result.minY, bounds.minY),
          maxX: Math.max(result.maxX, bounds.maxX),
          maxY: Math.max(result.maxY, bounds.maxY),
        }
      : bounds;
  }
  return result;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function moveDuration(options: CameraMoveOptions | undefined): number {
  return (options?.animate ?? !prefersReducedMotion()) ? MOVE_MS : 0;
}

const FIELD = "\u0000";
const RECORD = "\u0001";

function encodeButtons(buttons: MarkerButton[]): string {
  return buttons
    .map((button) => {
      return [button.key, button.label, button.pressed === undefined ? "" : button.pressed ? "1" : "0"].join(FIELD);
    })
    .join(RECORD);
}

function decodeButtons(encoded: string): MarkerButton[] {
  if (encoded === "") {
    return [];
  }
  return encoded.split(RECORD).map((record) => {
    const [key = "", label = "", pressed = ""] = record.split(FIELD);
    return pressed === "" ? { key, label } : { key, label, pressed: pressed === "1" };
  });
}

function defaultTooltip<T>({ target, labels }: { target: MapTooltipTarget<T>; labels: NordicMapLabels }): ReactNode {
  switch (target.kind) {
    case "pin":
      return target.pin.label ?? null;
    case "cluster":
      return labels.cluster(target.pins.length);
    case "area":
      return target.area.label ?? null;
    case "path":
      return target.path.label ?? null;
  }
}

/**
 * Map drawn on canvas from a tiled data source, with GPS pins, areas and paths on top. Works offline when the
 * source is bundled.
 *
 * - Drag a box to select the pins in it. Shift, Ctrl or Cmd + drag adds to the selection.
 * - Click a pin to toggle it. Click the empty map to clear the selection.
 * - Mouse wheel, trackpad pinch or two fingers to zoom.
 * - Right or middle mouse drag, Space + drag, or two fingers to pan. A quick pan keeps gliding.
 * - Keyboard: + and - zoom, arrow keys pan, 0 shows the whole map, Tab moves through the pins on screen.
 */
export function NordicMap<T = unknown>({
  source,
  ref,
  label,
  labels: labelsOverride,
  colorScheme = "auto",
  mapStyle,
  className,
  style: rootStyle,
  padding = 16,
  maxZoom = 50,
  showZoomControls = true,
  onViewChange,
  onMapClick,
  showBorder = true,
  showRoads = true,
  showRoadLabels = true,
  showPlaceLabels = true,
  pins = noPins,
  showPins = true,
  showPinLabels = false,
  cluster = false,
  selectionMode = "multiple",
  selected,
  defaultSelected = [],
  onSelectionChange,
  selectPinsByArea = false,
  highlighted = null,
  onPinClick,
  onPinHover,
  renderTooltip,
  areas = noAreas,
  showAreas = true,
  onAreaClick,
  onAreaHover,
  paths = noPaths,
  showPaths = true,
  onPathClick,
}: NordicMapProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const labels: NordicMapLabels = { ...NORDIC_MAP_LABELS_EN, ...labelsOverride };
  const scheme = useColorScheme(colorScheme);
  const style: MapStyle = { ...(scheme === "dark" ? darkMapStyle : lightMapStyle), ...mapStyle };

  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const measure = () => {
      const { width, height } = root.getBoundingClientRect();
      setSize((current) => {
        return current?.width === width && current.height === height ? current : { width, height };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, []);

  const projection = useMemo(() => {
    return createMapProjection(source);
  }, [source]);

  // The overview gives the map its extent, and the extent with the view size gives the frame
  const overview = useOverviewCells({ source, projection });
  const bounds = useMemo(() => {
    return overview
      ? unionBounds(
          overview.map((cell) => {
            return cell.bounds;
          }),
        )
      : null;
  }, [overview]);
  // Every overview cell has settled, but none gave any land or border to fit the map to
  const failed = overview !== null && bounds === null;
  const frame = useMemo<Frame | null>(() => {
    return size && size.width > 0 && size.height > 0 && bounds ? { size, bounds, padding, maxZoom } : null;
  }, [size, bounds, padding, maxZoom]);

  const cameraControls = useCamera(frame);
  const { camera } = cameraControls;
  const cells = useDetailCells({ source, projection, camera, frame, overview: overview ?? noCells });
  const scene = useMemo(() => {
    return buildScene({ cells, contextCells: overview ?? noCells });
  }, [cells, overview]);

  const preparedAreas = useMemo(() => {
    return prepareAreas({ areas, projection });
  }, [areas, projection]);
  const preparedPaths = useMemo(() => {
    return preparePaths({ paths, projection });
  }, [paths, projection]);

  const k = camera?.k ?? 1;
  const opacity = {
    border: layerOpacity({ visibility: showBorder, zoom: k }),
    roads: layerOpacity({ visibility: showRoads, zoom: k }),
    // A sign without its road makes no sense, so the signs never show more than the roads
    roadLabels: Math.min(
      layerOpacity({ visibility: showRoads, zoom: k }),
      layerOpacity({ visibility: showRoadLabels, zoom: k }),
    ),
    places: layerOpacity({ visibility: showPlaceLabels, zoom: k }),
    areas: layerOpacity({ visibility: showAreas, zoom: k }),
    paths: layerOpacity({ visibility: showPaths, zoom: k }),
    pins: layerOpacity({ visibility: showPins, zoom: k }),
    pinLabels: layerOpacity({ visibility: showPinLabels, zoom: k }),
  };
  const pinsShown = opacity.pins > 0 && pins.length > 0;

  // Pins in map units, then grouped into markers, then on screen
  const placed = useMemo(() => {
    return pins.flatMap((pin, order): PlacedPin<T>[] => {
      const point = projection.project([pin.lon, pin.lat]);
      return point ? [{ pin, point, order }] : [];
    });
  }, [pins, projection]);
  const clusterRadius = cluster === false ? null : cluster === true ? DEFAULT_CLUSTER_RADIUS : (cluster.radius ?? DEFAULT_CLUSTER_RADIUS);
  // Clusters are built for zoom steps of a factor of √2, so they do not change on every frame of a zoom.
  // At the largest zoom every pin shows on its own, so a cluster of pins at one spot can still be opened.
  const clusterStep = camera && frame && clusterRadius !== null && camera.k < frame.maxZoom ? Math.floor(Math.log2(camera.k) * 2) : null;
  const pixelsPerUnit = frame ? fitScale(frame) : 1;
  const markers = useMemo(() => {
    return buildMarkers({
      placed,
      radius: clusterStep === null || clusterRadius === null ? null : clusterRadius / (pixelsPerUnit * 2 ** (clusterStep / 2)),
    });
  }, [placed, clusterStep, clusterRadius, pixelsPerUnit]);

  const [innerSelected, setInnerSelected] = useState<string[]>(defaultSelected);
  const currentSelection = selectionMode === "none" ? [] : (selected ?? innerSelected);
  const selectedSet = new Set(currentSelection);

  const screenMarkers: ScreenMarker<T>[] =
    camera && frame
      ? markers.map((marker) => {
          const [x, y] = toScreen({ camera, frame, point: marker.point });
          const members = markerPins(marker);
          const count = members.filter((pin) => {
            return selectedSet.has(pin.id);
          }).length;
          return {
            marker,
            x,
            y,
            radius: markerRadius({ marker, pinRadius: style.pinRadius }),
            selected: count === 0 ? "none" : count === members.length ? "all" : "some",
          };
        })
      : [];
  const visibleMarkers =
    pinsShown && frame
      ? screenMarkers.filter(({ x, y }) => {
          return x >= 0 && x <= frame.size.width && y >= 0 && y <= frame.size.height;
        })
      : [];

  const [hover, setHover] = useState<Hover | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const markerByKey = new Map(
    screenMarkers.map((item) => {
      return [item.marker.key, item];
    }),
  );
  const highlightedKey =
    highlighted === null
      ? null
      : (markers.find((marker) => {
          return markerPins(marker).some((pin) => {
            return pin.id === highlighted;
          });
        })?.key ?? null);
  const hoveredMarkerKey = hover?.kind === "marker" && pinsShown ? hover.key : null;
  const emphasizedKeys = new Set(
    [highlightedKey, hoveredMarkerKey, focusedKey].filter((key) => {
      return key !== null;
    }),
  );

  // Draw the map whenever the camera, the data or the style change
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame || !camera) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(frame.size.width * ratio);
    const pixelHeight = Math.round(frame.size.height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    renderMap({
      canvas,
      scene,
      camera,
      frame,
      style,
      opacity,
      areas: preparedAreas,
      paths: preparedPaths,
      hoveredAreaId: hover?.kind === "area" ? hover.id : null,
      hoveredPathId: hover?.kind === "path" ? hover.id : null,
      markers: pinsShown ? screenMarkers : [],
      emphasizedKeys,
    });
  });

  function commitSelection(ids: Set<string>) {
    const ordered = placed
      .filter(({ pin }) => {
        return ids.has(pin.id);
      })
      .map(({ pin }) => {
        return pin.id;
      });
    if (selected === undefined) {
      setInnerSelected(ordered);
    }
    onSelectionChange?.(ordered);
  }

  // Camera moves asked for through the ref before the map was shown. The latest one runs once it is.
  const pendingMove = useRef<((frame: Frame) => Camera) | null>(null);
  function moveCamera({ to, options }: { to: (frame: Frame) => Camera; options?: CameraMoveOptions }) {
    if (!camera) {
      pendingMove.current = to;
      return;
    }
    cameraControls.moveTo({ to, duration: moveDuration(options) });
  }
  useEffect(() => {
    const pending = pendingMove.current;
    if (camera && pending) {
      pendingMove.current = null;
      cameraControls.moveTo({ to: pending, duration: 0 });
    }
  });

  function fitPoints({ points, options }: { points: Point[]; options?: CameraMoveOptions }) {
    const fit = boundsOfPoints(points);
    if (fit) {
      moveCamera({
        to: (currentFrame) => {
          return cameraForBounds({ frame: currentFrame, bounds: fit, margin: FIT_MARGIN });
        },
        options,
      });
    }
  }

  function zoomCenter(factor: number) {
    if (frame) {
      cameraControls.zoomSmooth({ anchor: [frame.size.width / 2, frame.size.height / 2], factor });
    }
  }

  function currentView(): NordicMapView | null {
    if (!camera || !frame) {
      return null;
    }
    const center = projection.invert(camera.center);
    const box = viewBox({ camera, frame, projection });
    return center && box ? { zoom: camera.k, center: { lat: center[1], lon: center[0] }, bounds: box } : null;
  }

  useImperativeHandle(ref, () => {
    return {
      flyTo: ({ lat, lon, zoom }, options) => {
        const point = projection.project([lon, lat]);
        if (point) {
          moveCamera({
            to: () => {
              return { k: zoom ?? camera?.k ?? 1, center: point };
            },
            options,
          });
        }
      },
      fitBounds: (box, options) => {
        const fit = projectBox({ projection, box });
        if (fit) {
          moveCamera({
            to: (currentFrame) => {
              return cameraForBounds({ frame: currentFrame, bounds: fit, margin: FIT_MARGIN });
            },
            options,
          });
        }
      },
      fitPins: (ids, options) => {
        const wanted = ids ? new Set(ids) : null;
        fitPoints({
          points: placed
            .filter(({ pin }) => {
              return !wanted || wanted.has(pin.id);
            })
            .map(({ point }) => {
              return point;
            }),
          options,
        });
      },
      zoomIn: () => {
        zoomCenter(ZOOM_STEP);
      },
      zoomOut: () => {
        zoomCenter(1 / ZOOM_STEP);
      },
      reset: (options) => {
        moveCamera({ to: homeCamera, options });
      },
      getView: currentView,
      project: ({ lat, lon }) => {
        if (!camera || !frame) {
          return null;
        }
        const point = projection.project([lon, lat]);
        if (!point) {
          return null;
        }
        const [x, y] = toScreen({ camera, frame, point });
        return { x, y };
      },
      unproject: ({ x, y }) => {
        if (!camera || !frame) {
          return null;
        }
        const lonLat = projection.invert(toMap({ camera, frame, point: [x, y] }));
        return lonLat ? { lat: lonLat[1], lon: lonLat[0] } : null;
      },
    };
  });

  const areaSelects = selectPinsByArea && selectionMode === "multiple";

  /**
   * Selects the pins inside an area. With `additive` they are added, or removed when they are all selected
   * already.
   */
  function selectArea({ area, additive }: { area: MapArea; additive: boolean }) {
    const inside = pinsInArea(pins, area).map((pin) => {
      return pin.id;
    });
    if (!additive) {
      commitSelection(new Set(inside));
      return;
    }
    const allSelected =
      inside.length > 0 &&
      inside.every((id) => {
        return selectedSet.has(id);
      });
    const next = new Set(selectedSet);
    for (const id of inside) {
      if (allSelected) {
        next.delete(id);
      } else {
        next.add(id);
      }
    }
    commitSelection(next);
  }

  /** A click or Enter on a marker: a cluster zooms in, a pin is selected or unselected */
  function activateMarker(marker: Marker<T>) {
    if (marker.kind === "cluster") {
      fitPoints({
        points: placed
          .filter(({ pin }) => {
            return marker.pins.includes(pin);
          })
          .map(({ point }) => {
            return point;
          }),
      });
      return;
    }
    const { pin } = marker;
    if (selectionMode === "multiple") {
      const next = new Set(selectedSet);
      if (next.has(pin.id)) {
        next.delete(pin.id);
      } else {
        next.add(pin.id);
      }
      commitSelection(next);
    } else if (selectionMode === "single") {
      const onlyThis = selectedSet.size === 1 && selectedSet.has(pin.id);
      commitSelection(new Set(onlyThis ? [] : [pin.id]));
    }
    onPinClick?.(pin);
  }

  const hitContext = () => {
    return canvasRef.current?.getContext("2d") ?? null;
  };

  /** The area or path under `point`. Paths are drawn over areas, so they are checked first. */
  function hitShape(point: Point): Hover | null {
    const context = hitContext();
    if (!context || !camera || !frame) {
      return null;
    }
    if (opacity.paths > 0 && preparedPaths.length > 0) {
      const path = hitPath({
        context,
        paths: preparedPaths,
        camera,
        frame,
        point,
        slop: 3,
        defaultWidth: style.pathWidth,
      });
      if (path) {
        return { kind: "path", id: path.path.id, at: point };
      }
    }
    if (opacity.areas > 0 && preparedAreas.length > 0) {
      const area = hitArea({ context, areas: preparedAreas, camera, frame, point });
      if (area) {
        return { kind: "area", id: area.area.id, at: point };
      }
    }
    return null;
  }

  function handleClick({ point, additive, isTouch }: { point: Point; additive: boolean; isTouch: boolean }) {
    const hit = pinsShown ? hitMarker({ markers: screenMarkers, point, slop: isTouch ? CLICK_SLOP.touch : CLICK_SLOP.mouse }) : null;
    if (hit) {
      activateMarker(hit.marker);
      return;
    }
    const shape = hitShape(point);
    if (shape?.kind === "path") {
      const path = preparedPaths.find((item) => {
        return item.path.id === shape.id;
      });
      if (path) {
        onPathClick?.(path.path);
      }
    } else if (shape?.kind === "area") {
      const area = preparedAreas.find((item) => {
        return item.area.id === shape.id;
      });
      if (area) {
        if (areaSelects) {
          selectArea({ area: area.area, additive });
        }
        onAreaClick?.(area.area);
      }
    }
    if (camera && frame && onMapClick) {
      const lonLat = projection.invert(toMap({ camera, frame, point }));
      if (lonLat) {
        onMapClick({ lat: lonLat[1], lon: lonLat[0] });
      }
    }
    // A click that selected the pins of an area is not a click on the empty map
    const selectedByArea = shape?.kind === "area" && areaSelects;
    if (selectionMode !== "none" && !additive && !selectedByArea && selectedSet.size > 0) {
      commitSelection(new Set());
    }
  }

  function hoverAt(point: Point) {
    const marker = pinsShown ? hitMarker({ markers: screenMarkers, point, slop: CLICK_SLOP.mouse }) : null;
    const next: Hover | null = marker ? { kind: "marker", key: marker.marker.key } : hitShape(point);
    setHover((current) => {
      if (next?.kind === "marker" && current?.kind === "marker" && current.key === next.key) {
        return current;
      }
      return current === null && next === null ? current : next;
    });
  }

  // Pointers that are down, in pixels from the map's top left corner
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const spaceDown = useRef(false);
  const [drag, setDrag] = useState<DragRect | null>(null);
  const [panning, setPanning] = useState(false);

  function localPoint(clientX: number, clientY: number): Point {
    const rect = overlayRef.current?.getBoundingClientRect();
    return rect ? [clientX - rect.left, clientY - rect.top] : [clientX, clientY];
  }

  function twoFingers(): [Point, Point] | null {
    const [a, b] = Array.from(pointers.current.values());
    return a && b ? [a, b] : null;
  }

  // React's onWheel is passive, so it can't stop the page from scrolling. Listen natively, and read the newest
  // handler through a ref so the listener is added once.
  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const anchor = localPoint(event.clientX, event.clientY);
    if (event.ctrlKey) {
      // Trackpad pinch arrives as a wheel event with Ctrl. Its steps are small and frequent, so apply them directly.
      cameraControls.update((current, currentFrame) => {
        return zoomAround({ camera: current, frame: currentFrame, anchor, k: current.k * Math.exp(-event.deltaY * 0.01) });
      });
      return;
    }
    // deltaMode 1 is lines (Firefox), 2 is pages, 0 is pixels
    const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
    cameraControls.zoomSmooth({ anchor, factor: Math.exp(-pixels * 0.0025) });
  };
  const wheelHandler = useRef(handleWheel);
  useLayoutEffect(() => {
    wheelHandler.current = handleWheel;
  });
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    const listener = (event: WheelEvent) => {
      wheelHandler.current(event);
    };
    overlay.addEventListener("wheel", listener, { passive: false });
    return () => {
      overlay.removeEventListener("wheel", listener);
    };
  }, []);

  function startPan({ point, time, primary }: PanSample & { primary: boolean }) {
    gesture.current = { kind: "pan", start: point, last: point, samples: [{ time, point }], primary };
    setPanning(true);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const isMouse = event.pointerType === "mouse";
    // A pin's button handles its own click. Assistive technology can press it with pointer events too.
    if ((isMouse && event.button > 2) || event.target !== event.currentTarget) {
      return;
    }
    // Grabbing the map stops a glide or a zoom that is still running
    cameraControls.stop();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = localPoint(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    setHover(null);

    if (pointers.current.size === 2) {
      const fingers = twoFingers();
      if (fingers && camera) {
        gesture.current = {
          kind: "pinch",
          start: camera,
          startMid: midpoint(fingers[0], fingers[1]),
          startDistance: distance(fingers[0], fingers[1]),
        };
      }
      setDrag(null);
      setPanning(false);
      return;
    }
    if (pointers.current.size > 2) {
      return;
    }

    if ((isMouse && event.button !== 0) || spaceDown.current) {
      // Right or middle button, or Space, pans. preventDefault stops the middle button's autoscroll.
      event.preventDefault();
      startPan({ point, time: event.timeStamp, primary: false });
      return;
    }
    if (selectionMode === "multiple" && pinsShown) {
      gesture.current = { kind: "select", start: point, additive: event.shiftKey || event.ctrlKey || event.metaKey };
      setDrag({ from: point, to: point });
      return;
    }
    // Without box selection a drag pans
    startPan({ point, time: event.timeStamp, primary: true });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const point = localPoint(event.clientX, event.clientY);
    if (!pointers.current.has(event.pointerId)) {
      if (event.pointerType !== "touch" && pointers.current.size === 0) {
        hoverAt(point);
      }
      return;
    }
    pointers.current.set(event.pointerId, point);
    const current = gesture.current;

    if (current?.kind === "pinch") {
      const fingers = twoFingers();
      if (fingers) {
        cameraControls.update((_camera, currentFrame) => {
          return pinchCamera({
            start: current.start,
            frame: currentFrame,
            startMid: current.startMid,
            startDistance: current.startDistance,
            mid: midpoint(fingers[0], fingers[1]),
            distance: distance(fingers[0], fingers[1]),
          });
        });
      }
    } else if (current?.kind === "pan") {
      const delta: Point = [point[0] - current.last[0], point[1] - current.last[1]];
      current.last = point;
      const now = event.timeStamp;
      current.samples = [
        ...current.samples.filter((sample) => {
          return now - sample.time <= FLING_WINDOW_MS;
        }),
        { time: now, point },
      ];
      cameraControls.update((currentCamera, currentFrame) => {
        return panBy({ camera: currentCamera, frame: currentFrame, delta });
      });
    } else if (current?.kind === "select") {
      setDrag((rect) => {
        return rect ? { ...rect, to: point } : rect;
      });
    }
  }

  function endPan({ current, now }: { current: Extract<Gesture, { kind: "pan" }>; now: number }) {
    setPanning(false);
    const recent = current.samples.filter((sample) => {
      return now - sample.time <= FLING_WINDOW_MS;
    });
    const first = recent[0];
    const last = recent.at(-1);
    if (first && last && last.time > first.time) {
      const elapsed = last.time - first.time;
      // The map moves with the pointer, so the glide continues the pointer's direction
      cameraControls.fling([(last.point[0] - first.point[0]) / elapsed, (last.point[1] - first.point[1]) / elapsed]);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) {
      return;
    }
    const current = gesture.current;
    if (!current) {
      return;
    }
    if (current.kind === "pinch" || current.kind === "settling") {
      gesture.current = pointers.current.size === 0 ? null : { kind: "settling" };
      return;
    }
    gesture.current = null;
    const isTouch = event.pointerType === "touch";
    const end = localPoint(event.clientX, event.clientY);
    const slop = isTouch ? CLICK_SLOP.touch : CLICK_SLOP.mouse;

    if (current.kind === "pan") {
      if (current.primary && distance(end, current.start) < slop) {
        setPanning(false);
        handleClick({ point: end, additive: false, isTouch });
        return;
      }
      endPan({ current, now: event.timeStamp });
      return;
    }

    setDrag(null);
    if (distance(end, current.start) < slop) {
      handleClick({ point: end, additive: current.additive, isTouch });
      return;
    }

    // A drag: select the pins inside the box, and every pin of a cluster inside it
    const minX = Math.min(current.start[0], end[0]);
    const maxX = Math.max(current.start[0], end[0]);
    const minY = Math.min(current.start[1], end[1]);
    const maxY = Math.max(current.start[1], end[1]);
    const next = current.additive ? new Set(selectedSet) : new Set<string>();
    for (const { marker, x, y } of screenMarkers) {
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        for (const pin of markerPins(marker)) {
          next.add(pin.id);
        }
      }
    }
    commitSelection(next);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
    }
    setDrag(null);
    setPanning(false);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Space on a pin's button presses the button
    if (event.key === " " && event.target === event.currentTarget) {
      event.preventDefault();
      spaceDown.current = true;
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const pan: Record<string, Point> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    const delta = pan[event.key];
    if (delta) {
      event.preventDefault();
      cameraControls.update((current, currentFrame) => {
        return panBy({ camera: current, frame: currentFrame, delta });
      });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomCenter(ZOOM_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomCenter(1 / ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      moveCamera({ to: homeCamera });
    }
  }

  function handleKeyUp(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === " ") {
      spaceDown.current = false;
    }
  }

  // The buttons keep their handlers between frames and call the newest ones through this ref,
  // so the list of buttons only renders again when the markers on screen change
  const markerHandlers = useRef({
    activate: (_key: string) => {},
    focusLost: () => {},
  });
  useLayoutEffect(() => {
    markerHandlers.current = {
      activate: (key) => {
        const item = markerByKey.get(key);
        if (item) {
          activateMarker(item.marker);
        }
      },
      focusLost: () => {
        setFocusedKey(null);
        overlayRef.current?.focus();
      },
    };
  });
  const [buttonHandlers] = useState(() => {
    return {
      onActivate: (key: string) => {
        markerHandlers.current.activate(key);
      },
      onFocusLost: () => {
        markerHandlers.current.focusLost();
      },
    };
  });
  // The buttons as one string, so the list is rebuilt only when the buttons change, not on every frame of a pan
  const buttonsKey = encodeButtons(
    visibleMarkers.map(({ marker, selected: markerSelected }) => {
      if (marker.kind === "cluster") {
        return { key: marker.key, label: labels.cluster(marker.pins.length) };
      }
      return {
        key: marker.key,
        label: marker.pin.label ?? marker.pin.id,
        pressed: selectionMode === "none" ? undefined : markerSelected === "all",
      };
    }),
  );
  const buttons = useMemo(() => {
    return decodeButtons(buttonsKey);
  }, [buttonsKey]);

  // The pin and area under the pointer or the keyboard focus, for the hover callbacks and the tooltip
  const activeMarker = (focusedKey === null ? undefined : markerByKey.get(focusedKey)) ?? (hoveredMarkerKey === null ? undefined : markerByKey.get(hoveredMarkerKey));
  const activePin = activeMarker?.marker.kind === "pin" ? activeMarker.marker.pin : null;
  const hoveredArea =
    hover?.kind === "area"
      ? (areas.find((area) => {
          return area.id === hover.id;
        }) ?? null)
      : null;
  const hoveredPath =
    hover?.kind === "path"
      ? (paths.find((path) => {
          return path.id === hover.id;
        }) ?? null)
      : null;

  const reportedPin = useRef<MapPin<T> | null>(null);
  useEffect(() => {
    if (reportedPin.current !== activePin) {
      reportedPin.current = activePin;
      onPinHover?.(activePin);
    }
  });
  const reportedArea = useRef<MapArea | null>(null);
  useEffect(() => {
    if (reportedArea.current !== hoveredArea) {
      reportedArea.current = hoveredArea;
      onAreaHover?.(hoveredArea);
    }
  });

  // The camera object is new on every render, so the effect depends on its numbers
  const viewK = camera?.k;
  const viewX = camera?.center[0];
  const viewY = camera?.center[1];
  useEffect(() => {
    if (!onViewChange || viewK === undefined || viewX === undefined || viewY === undefined || !frame) {
      return;
    }
    const viewCamera: Camera = { k: viewK, center: [viewX, viewY] };
    const center = projection.invert(viewCamera.center);
    const box = viewBox({ camera: viewCamera, frame, projection });
    if (center && box) {
      onViewChange({ zoom: viewK, center: { lat: center[1], lon: center[0] }, bounds: box });
    }
  }, [viewK, viewX, viewY, frame, projection, onViewChange]);

  let tooltip: { target: MapTooltipTarget<T>; x: number; y: number } | null = null;
  if (activeMarker && opacity.pins > 0) {
    const { marker, x, y, radius } = activeMarker;
    tooltip = {
      target: marker.kind === "pin" ? { kind: "pin", pin: marker.pin } : { kind: "cluster", pins: marker.pins },
      x,
      y: y - radius,
    };
  } else if (hover?.kind === "area" && hoveredArea) {
    tooltip = { target: { kind: "area", area: hoveredArea }, x: hover.at[0], y: hover.at[1] };
  } else if (hover?.kind === "path" && hoveredPath) {
    tooltip = { target: { kind: "path", path: hoveredPath }, x: hover.at[0], y: hover.at[1] };
  }
  const tooltipContent = tooltip
    ? renderTooltip
      ? renderTooltip(tooltip.target)
      : defaultTooltip({ target: tooltip.target, labels })
    : null;

  const clickable =
    (hover?.kind === "marker" && pinsShown) ||
    (hover?.kind === "area" && (onAreaClick !== undefined || areaSelects)) ||
    (hover?.kind === "path" && onPathClick !== undefined);

  return (
    // The sea color is also set here, so the map area has its color while the data loads
    <div
      ref={rootRef}
      className={className ? `${classes.root} ${className}` : classes.root}
      style={{ background: style.sea, ...rootStyle }}
      data-nordic-map=""
      data-color-scheme={scheme}
    >
      <canvas ref={canvasRef} className={classes.canvas} aria-hidden />
      <div
        ref={overlayRef}
        className={classes.overlay}
        data-panning={panning || undefined}
        data-drag-pans={selectionMode !== "multiple" || !pinsShown || undefined}
        data-clickable={clickable || undefined}
        role="application"
        aria-roledescription="map"
        aria-label={label ?? labels.map}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          if (pointers.current.size === 0) {
            setHover(null);
          }
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => {
          spaceDown.current = false;
        }}
        onContextMenu={(event) => {
          // The right mouse button pans
          event.preventDefault();
        }}
      >
        <MarkerButtons
          buttons={buttons}
          focusedKey={focusedKey}
          onFocusChange={setFocusedKey}
          onActivate={buttonHandlers.onActivate}
          onFocusLost={buttonHandlers.onFocusLost}
        />
        {drag && (
          <div
            className={classes.dragBox}
            style={{
              left: Math.min(drag.from[0], drag.to[0]),
              top: Math.min(drag.from[1], drag.to[1]),
              width: Math.abs(drag.to[0] - drag.from[0]),
              height: Math.abs(drag.to[1] - drag.from[1]),
              borderColor: style.pinSelected,
              background: `color-mix(in srgb, ${style.pinSelected} 12%, transparent)`,
            }}
          />
        )}
      </div>

      {tooltip && tooltipContent !== null && tooltipContent !== undefined && tooltipContent !== "" && (
        <MapTooltip x={tooltip.x} y={tooltip.y} below={tooltip.y < 48}>
          {tooltipContent}
        </MapTooltip>
      )}

      {!camera && <MapStatus failed={failed} loadingLabel={labels.loading} errorText={labels.loadError} />}

      {source.attribution && (
        <div className={classes.attribution}>
          {source.attribution.url ? (
            <a href={source.attribution.url} target="_blank" rel="noreferrer">
              {source.attribution.text}
            </a>
          ) : (
            source.attribution.text
          )}
        </div>
      )}

      {showZoomControls && (
        <ZoomControls
          zoomInLabel={labels.zoomIn}
          zoomOutLabel={labels.zoomOut}
          resetLabel={labels.showWholeMap}
          canZoomIn={camera !== null && k < maxZoom}
          canZoomOut={camera !== null && k > 1}
          onZoomIn={() => {
            zoomCenter(ZOOM_STEP);
          }}
          onZoomOut={() => {
            zoomCenter(1 / ZOOM_STEP);
          }}
          onReset={() => {
            moveCamera({ to: homeCamera });
          }}
        />
      )}
    </div>
  );
}
