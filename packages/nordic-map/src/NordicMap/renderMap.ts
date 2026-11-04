import { scaleOf, toScreen } from "./camera.ts";
import type { Camera, Frame } from "./camera.ts";
import { createLabelPlacer } from "./labelPlacer.ts";
import type { Box, LabelPlacer } from "./labelPlacer.ts";
import type { MapScene } from "./mapScene.ts";
import type { PlaceClass, RoadClass } from "./mapSource.ts";
import type { MapStyle } from "./mapStyle.ts";
import type { Marker } from "./markers.ts";
import type { PreparedArea, PreparedPath } from "./overlays.ts";

/** Opacity of each layer at the current zoom. 0 hides a layer. */
export type LayerOpacity = {
  border: number;
  roads: number;
  roadLabels: number;
  places: number;
  areas: number;
  paths: number;
  pins: number;
  pinLabels: number;
};

/** A marker on screen, in pixels from the map's top left corner */
export type ScreenMarker<T> = {
  marker: Marker<T>;
  x: number;
  y: number;
  radius: number;
  /** How many of its pins are selected */
  selected: "all" | "some" | "none";
};

/** Line width of each road class, relative to `roadWidth`, and its opacity */
const roadClassStyle: Record<RoadClass, { width: number; opacity: number }> = {
  european: { width: 1, opacity: 1 },
  national: { width: 0.8, opacity: 0.9 },
  regional: { width: 0.6, opacity: 0.55 },
};

const placeStyle: Record<PlaceClass, { font: string; opacity: number; dot: number; height: number }> = {
  city: { font: "600 12px system-ui, sans-serif", opacity: 0.9, dot: 3, height: 15 },
  town: { font: "500 12px system-ui, sans-serif", opacity: 0.8, dot: 2.5, height: 14 },
  village: { font: "400 11px system-ui, sans-serif", opacity: 0.7, dot: 2, height: 13 },
};

const PIN_LABEL_FONT = "700 12px system-ui, sans-serif";
const CLUSTER_FONT = "700 11px system-ui, sans-serif";
const SHIELD_FONT = "700 10px system-ui, sans-serif";
const SHIELD_HEIGHT = 15;
/** Free space kept around each label, in pixels */
const LABEL_GAP = 3;
/** Two road signs with the same number are not drawn closer than this, in pixels */
const SAME_SIGN_DISTANCE = 160;
/** Space between a pin or place dot and its label, in pixels. Larger than `LABEL_GAP` plus the pin ring, so a label never collides with its own pin. */
const PIN_LABEL_OFFSET = 6;

function isVisibleColor(color: string): boolean {
  return color !== "none" && color !== "transparent";
}

function shieldWidth(text: string): number {
  return 8 + text.length * 6.5;
}

function grow(box: Box, by: number): Box {
  return { left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by };
}

/** Text widths by font and text. Measuring is slow next to drawing, and the same names repeat every frame. */
const textWidths = new Map<string, number>();

function measure(context: CanvasRenderingContext2D, text: string): number {
  const key = `${context.font}|${text}`;
  const known = textWidths.get(key);
  if (known !== undefined) {
    return known;
  }
  if (textWidths.size > 5000) {
    textWidths.clear();
  }
  const width = context.measureText(text).width;
  textWidths.set(key, width);
  return width;
}

/** Text with an outline in the halo color, so it reads over roads, borders and areas */
function drawHaloText({
  context,
  text,
  x,
  y,
  style,
}: {
  context: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  style: MapStyle;
}) {
  if (isVisibleColor(style.textHalo)) {
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.strokeStyle = style.textHalo;
    context.strokeText(text, x, y);
  }
  context.fillStyle = style.text;
  context.fillText(text, x, y);
}

/** Green shield with white text, like Swedish E-road signs */
function drawShield({ context, text, x, y }: { context: CanvasRenderingContext2D; text: string; x: number; y: number }) {
  const width = shieldWidth(text);
  const height = SHIELD_HEIGHT;
  context.beginPath();
  context.roundRect(x - width / 2, y - height / 2, width, height, 3);
  context.fillStyle = "#1b7f3b";
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = "#ffffff";
  context.stroke();
  context.fillStyle = "#ffffff";
  context.fillText(text, x, y + 0.5);
}

type PlacedText = { box: Box; x: number; y: number; align: CanvasTextAlign };

/** Where a label goes beside a point: right of it, else left, above or below, wherever it first fits */
function placeBeside({
  placer,
  x,
  y,
  radius,
  width,
  height,
}: {
  placer: LabelPlacer;
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
}): PlacedText | null {
  const offset = radius + PIN_LABEL_OFFSET;
  const candidates: PlacedText[] = [
    { box: { left: x + offset, top: y - height / 2, right: x + offset + width, bottom: y + height / 2 }, x: x + offset, y, align: "left" },
    { box: { left: x - offset - width, top: y - height / 2, right: x - offset, bottom: y + height / 2 }, x: x - offset, y, align: "right" },
    {
      box: { left: x - width / 2, top: y - offset - height, right: x + width / 2, bottom: y - offset },
      x,
      y: y - offset - height / 2,
      align: "center",
    },
    {
      box: { left: x - width / 2, top: y + offset, right: x + width / 2, bottom: y + offset + height },
      x,
      y: y + offset + height / 2,
      align: "center",
    },
  ];
  return (
    candidates.find((candidate) => {
      return placer.fits(grow(candidate.box, LABEL_GAP));
    }) ?? null
  );
}

function drawMarker<T>({
  context,
  item,
  style,
  emphasized,
}: {
  context: CanvasRenderingContext2D;
  item: ScreenMarker<T>;
  style: MapStyle;
  emphasized: boolean;
}) {
  const { marker, x, y, radius, selected } = item;
  const circle = (r: number) => {
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
  };
  context.lineWidth = 1.5;
  if (marker.kind === "pin") {
    if (selected === "all") {
      circle(radius + 3);
      context.strokeStyle = style.pin;
      context.stroke();
    }
    circle(radius);
    context.fillStyle = selected === "all" ? style.pinSelected : (marker.pin.color ?? style.pin);
    context.fill();
    context.strokeStyle = style.pinStroke;
    context.stroke();
  } else {
    if (selected === "some") {
      circle(radius + 3);
      context.lineWidth = 2;
      context.strokeStyle = style.pinSelected;
      context.stroke();
      context.lineWidth = 1.5;
    }
    circle(radius);
    context.fillStyle = selected === "all" ? style.pinSelected : style.pin;
    context.fill();
    context.strokeStyle = style.pinStroke;
    context.stroke();
    context.font = CLUSTER_FONT;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = style.pinStroke;
    context.fillText(String(marker.pins.length), x, y + 0.5);
  }
  if (emphasized) {
    circle(radius + (selected === "none" ? 3 : 6));
    context.lineWidth = 2;
    context.strokeStyle = style.highlight;
    context.stroke();
  }
}

/**
 * Draws the scene onto the canvas. Geometry is drawn in map units under one transform, so a frame costs
 * one fill or stroke per layer. Line widths and text keep their size in pixels at every zoom.
 *
 * Text is placed by importance and never covers a pin: pins reserve their space first, then pin labels,
 * place names from cities down, and road signs take what is left. The pins are drawn last, on top.
 * A pin at a city covers the city's dot, so the city's name is left out there; the pin's label names it.
 */
export function renderMap<T>({
  canvas,
  scene,
  camera,
  frame,
  style,
  opacity,
  areas,
  paths,
  hoveredAreaId,
  hoveredPathId,
  markers,
  emphasizedKeys,
}: {
  canvas: HTMLCanvasElement;
  scene: MapScene;
  camera: Camera;
  frame: Frame;
  style: MapStyle;
  opacity: LayerOpacity;
  areas: PreparedArea[];
  paths: PreparedPath[];
  hoveredAreaId: string | null;
  hoveredPathId: string | null;
  markers: ScreenMarker<T>[];
  /** Markers drawn with a ring and labelled first: the highlighted one and the one with keyboard focus */
  emphasizedKeys: ReadonlySet<string>;
}) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const { width, height } = frame.size;
  const ratio = canvas.width / Math.max(width, 1);

  // The canvas keeps its state between frames. Start each frame from a known state, so nothing leaks from the last one.
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (isVisibleColor(style.sea)) {
    context.fillStyle = style.sea;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const scale = scaleOf({ camera, frame });
  const [originX, originY] = toScreen({ camera, frame, point: [0, 0] });
  context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * originX, ratio * originY);
  context.lineJoin = "round";
  context.lineCap = "round";

  const fill = (path: Path2D | null, color: string) => {
    if (path && isVisibleColor(color)) {
      context.fillStyle = color;
      context.fill(path);
    }
  };
  const stroke = (path: Path2D | null, color: string, lineWidth: number) => {
    if (path && isVisibleColor(color)) {
      context.strokeStyle = color;
      context.lineWidth = lineWidth / scale;
      context.stroke(path);
    }
  };
  // Areas and paths outside the view are skipped
  const view = {
    minX: -originX / scale,
    minY: -originY / scale,
    maxX: (width - originX) / scale,
    maxY: (height - originY) / scale,
  };
  const inView = (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
    return bounds.maxX >= view.minX && bounds.minX <= view.maxX && bounds.maxY >= view.minY && bounds.minY <= view.maxY;
  };

  fill(scene.contextLand, style.contextLand);
  stroke(scene.contextLand, style.contextBorder, 0.75);
  stroke(scene.contextBorders, style.contextBorder, 0.75);
  fill(scene.land, style.land);

  if (opacity.areas > 0) {
    context.globalAlpha = opacity.areas;
    for (const { area, shape, bounds } of areas) {
      if (inView(bounds)) {
        fill(shape, area.fill ?? style.areaFill);
        stroke(shape, area.stroke ?? style.areaStroke, 0.75);
      }
    }
    const hovered = areas.find(({ area }) => {
      return area.id === hoveredAreaId;
    });
    if (hovered) {
      stroke(hovered.shape, style.highlight, 2);
    }
    context.globalAlpha = 1;
  }

  // Lakes over areas, so a region colored by a value still shows its lakes
  fill(scene.water, style.lake);
  stroke(scene.water, style.lakeBorder, 0.75);

  if (opacity.border > 0) {
    context.globalAlpha = opacity.border;
    stroke(scene.borders, style.border, style.borderWidth);
    context.globalAlpha = 1;
  }

  if (opacity.roads > 0) {
    for (const road of scene.roads) {
      const { width: roadWidth, opacity: roadOpacity } = roadClassStyle[road.roadClass];
      context.globalAlpha = roadOpacity * opacity.roads;
      stroke(road.path, style.road, style.roadWidth * roadWidth);
    }
    context.globalAlpha = 1;
  }

  if (opacity.paths > 0) {
    context.globalAlpha = opacity.paths;
    for (const { path, shape, bounds } of paths) {
      if (!inView(bounds)) {
        continue;
      }
      const lineWidth = path.width ?? style.pathWidth;
      if (path.id === hoveredPathId) {
        stroke(shape, style.highlight, lineWidth + 4);
      }
      stroke(shape, path.color ?? style.path, lineWidth);
    }
    context.globalAlpha = 1;
  }

  // Everything from here is in screen pixels
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.textBaseline = "middle";
  const placer = createLabelPlacer();
  const onScreen = (x: number, y: number, margin: number) => {
    return x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
  };

  const shownMarkers = opacity.pins > 0 ? markers.filter((item) => onScreen(item.x, item.y, item.radius + 8)) : [];
  for (const { x, y, radius } of shownMarkers) {
    placer.add({ left: x - radius - 2, top: y - radius - 2, right: x + radius + 2, bottom: y + radius + 2 });
  }

  const pinLabelOpacity = Math.min(opacity.pins, opacity.pinLabels);
  if (shownMarkers.length > 0 && pinLabelOpacity > 0) {
    context.font = PIN_LABEL_FONT;
    const labelHeight = 14;
    // Emphasized pins first, then selected ones, then by priority, then in `pins` order
    const ranked = shownMarkers
      .flatMap((item, order) => {
        if (item.marker.kind !== "pin" || !item.marker.pin.label) {
          return [];
        }
        const rank = emphasizedKeys.has(item.marker.key) ? 0 : item.selected === "all" ? 1 : 2;
        return [{ item, text: item.marker.pin.label, rank, priority: item.marker.pin.priority ?? 0, order }];
      })
      .sort((a, b) => {
        return a.rank - b.rank || b.priority - a.priority || a.order - b.order;
      });
    context.globalAlpha = pinLabelOpacity;
    for (const { item, text } of ranked) {
      const placed = placeBeside({
        placer,
        x: item.x,
        y: item.y,
        radius: item.radius,
        width: measure(context, text),
        height: labelHeight,
      });
      if (placed) {
        placer.add(grow(placed.box, LABEL_GAP));
        context.textAlign = placed.align;
        drawHaloText({ context, text, x: placed.x, y: placed.y, style });
      }
    }
    context.globalAlpha = 1;
  }

  if (opacity.places > 0) {
    // A dot at the place and its name beside it. A place is left out when either would cover something.
    for (const place of scene.places) {
      const [x, y] = toScreen({ camera, frame, point: place.at });
      if (!onScreen(x, y, 80)) {
        continue;
      }
      const { font, opacity: placeOpacity, dot, height: textHeight } = placeStyle[place.placeClass];
      const dotBox = { left: x - dot - 1, top: y - dot - 1, right: x + dot + 1, bottom: y + dot + 1 };
      if (!placer.fits(dotBox)) {
        continue;
      }
      context.font = font;
      const placed = placeBeside({ placer, x, y, radius: dot, width: measure(context, place.name), height: textHeight });
      if (!placed) {
        continue;
      }
      placer.add(dotBox);
      placer.add(grow(placed.box, LABEL_GAP));
      context.globalAlpha = placeOpacity * opacity.places;
      context.beginPath();
      context.arc(x, y, dot, 0, Math.PI * 2);
      context.fillStyle = style.text;
      context.fill();
      if (isVisibleColor(style.textHalo)) {
        context.lineWidth = 1;
        context.strokeStyle = style.textHalo;
        context.stroke();
      }
      context.textAlign = placed.align;
      drawHaloText({ context, text: place.name, x: placed.x, y: placed.y, style });
    }
    context.globalAlpha = 1;
  }

  if (opacity.roadLabels > 0) {
    context.globalAlpha = opacity.roadLabels;
    context.font = SHIELD_FONT;
    context.textAlign = "center";
    // A sign is skipped when it would cover something drawn already, or repeat the same road number close by
    const signs: { text: string; x: number; y: number }[] = [];
    for (const label of scene.roadLabels) {
      const [x, y] = toScreen({ camera, frame, point: label.at });
      if (!onScreen(x, y, 40)) {
        continue;
      }
      const halfWidth = shieldWidth(label.text) / 2 + LABEL_GAP;
      const halfHeight = SHIELD_HEIGHT / 2 + LABEL_GAP;
      const box = { left: x - halfWidth, top: y - halfHeight, right: x + halfWidth, bottom: y + halfHeight };
      const repeated = signs.some((other) => {
        return other.text === label.text && Math.hypot(other.x - x, other.y - y) < SAME_SIGN_DISTANCE;
      });
      if (!repeated && placer.fits(box)) {
        placer.add(box);
        signs.push({ text: label.text, x, y });
        drawShield({ context, text: label.text, x, y });
      }
    }
    context.globalAlpha = 1;
  }

  if (shownMarkers.length > 0) {
    context.globalAlpha = opacity.pins;
    // Selected markers over unselected ones, and emphasized ones over all
    const layerOf = (item: ScreenMarker<T>) => {
      return emphasizedKeys.has(item.marker.key) ? 2 : item.selected === "none" ? 0 : 1;
    };
    for (const layer of [0, 1, 2]) {
      for (const item of shownMarkers) {
        if (layerOf(item) === layer) {
          drawMarker({ context, item, style, emphasized: layer === 2 });
        }
      }
    }
    context.globalAlpha = 1;
  }
}
