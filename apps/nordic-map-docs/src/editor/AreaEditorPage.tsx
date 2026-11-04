import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  ColorSwatch,
  Divider,
  Group,
  Kbd,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconDownload,
  IconPlus,
  IconPolygon,
  IconSquarePlus,
  IconUpload,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { LonLat, MapArea, NordicMapHandle } from "@jielga/nordic-map";
import classes from "./AreaEditor.module.css";
import { swatchFor } from "./areaColors.ts";
import { AreaDetails } from "./AreaDetails.tsx";
import { freeId } from "./areaFiles.ts";
import {
  boundsOfParts,
  geometryFromParts,
  partsContain,
  partsCrossThemselves,
  removePart,
  removeVertex,
} from "./editorModel.ts";
import type { EditorArea, Part, Ring, VertexRef } from "./editorModel.ts";
import { EditorOverlay, SNAP_RADIUS } from "./EditorOverlay.tsx";
import type { PointerState } from "./EditorOverlay.tsx";
import { ExportDialog } from "./ExportDialog.tsx";
import { ImportDialog } from "./ImportDialog.tsx";
import { unionParts } from "./shapeOps.ts";
import { buildSnapIndex, findSnap } from "./snapping.ts";
import { useEditorSettings } from "./editorStorage.ts";
import type { MapLayerSettings } from "./editorStorage.ts";
import { useEditorHistory } from "./useEditorHistory.ts";
import { useCoastIndex } from "./useCoastIndex.ts";
import { useReferenceRegions } from "./useReferenceRegions.ts";
import type { ReferenceLayer } from "./useReferenceRegions.ts";
import { createValueStore } from "./valueStore.ts";

type Mode =
  | { kind: "select" }
  /** `target` is the area that gets the new part, or null for a new area */
  | { kind: "draw"; target: string | null; ring: Ring }
  /** `ids` are the selected regions, in the order they were clicked */
  | { kind: "selectRegions"; ids: string[] };

type Dialog = "import" | "export" | "clear" | null;

const LAYER_SWITCHES: { key: keyof MapLayerSettings; label: string }[] = [
  { key: "places", label: "Place names" },
  { key: "roads", label: "Roads" },
  { key: "roadLabels", label: "Road signs" },
  { key: "border", label: "Coast and border" },
];

/** Full precision on the map; the export rounds */
const DISPLAY_DECIMALS = 9;
const REFERENCE_STYLE = { fill: "rgba(0, 0, 0, 0)", stroke: "rgba(80, 90, 105, 0.5)" };
const SELECTED_REGION_STYLE = { fill: "rgba(28, 126, 214, 0.4)", stroke: "rgba(28, 126, 214, 0.9)" };
/** Names listed for a region selection before the rest are counted */
const LISTED_REGIONS = 6;

/** The map shapes of the areas, kept per parts object so the map projects only the area that changed */
const geometryCache = new WeakMap<Part[], MapArea["geometry"] | null>();
function geometryOf(parts: Part[]): MapArea["geometry"] | null {
  if (!geometryCache.has(parts)) {
    geometryCache.set(parts, geometryFromParts({ parts, decimals: DISPLAY_DECIMALS }));
  }
  return geometryCache.get(parts) ?? null;
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function ModeHint({ mode, drawingPoints }: { mode: Mode; drawingPoints: number }) {
  if (mode.kind === "draw") {
    return (
      <Alert color="blue" p="xs">
        <Text size="sm">Click the map to add points, at least 3.</Text>
        {drawingPoints >= 3 && (
          <Text size="sm">
            To finish, click the first point or press <Kbd size="xs">Enter</Kbd>
          </Text>
        )}
        <Text size="xs" c="dimmed" mt={4}>
          <Kbd size="xs">Backspace</Kbd> removes the last point, <Kbd size="xs">Esc</Kbd> cancels. Drag to pan.
        </Text>
      </Alert>
    );
  }
  if (mode.kind === "selectRegions") {
    return (
      <Alert color="blue" p="xs">
        <Text size="sm">Click regions to select them, and again to unselect. The outer edge of the selection becomes the area.</Text>
        <Text size="xs" c="dimmed" mt={4}>
          <Kbd size="xs">Enter</Kbd> creates the area, <Kbd size="xs">Esc</Kbd> stops.
        </Text>
      </Alert>
    );
  }
  return (
    <Text size="xs" c="dimmed">
      Click an area to select it. Drag a point to move it, drag the dot in the middle of an edge to add a point, and
      press <Kbd size="xs">Delete</Kbd> to remove the selected point, or the selected area when no point is selected.{" "}
      <Kbd size="xs">Ctrl</Kbd>+<Kbd size="xs">Z</Kbd> undoes.
    </Text>
  );
}

/** Draws areas over the map of Sweden and exports them as `MapArea` data */
export function AreaEditorPage() {
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: false });
  const history = useEditorHistory();
  const { areas } = history;
  const map = useRef<NordicMapHandle>(null);
  const [viewStore] = useState(() => {
    return createValueStore(0);
  });
  const [pointerStore] = useState(() => {
    return createValueStore<PointerState>(null);
  });
  const [onViewChange] = useState(() => {
    return () => {
      viewStore.set(viewStore.get() + 1);
    };
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<VertexRef | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "select" });
  const [settings, setSettings] = useEditorSettings();
  const { reference, snapping, layers } = settings;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState<{ color: string; text: string } | null>(null);
  const references = useReferenceRegions(reference);
  const coastIndex = useCoastIndex(snapping && layers.border);

  const selected =
    areas.find((area) => {
      return area.id === selectedId;
    }) ?? null;
  const ids = areas.map((area) => {
    return area.id;
  });
  const drawing = mode.kind === "draw" ? mode.ring : null;

  const selectedRegionIds = mode.kind === "selectRegions" ? mode.ids : null;
  const referenceAreas = useMemo(() => {
    const chosen = new Set(selectedRegionIds);
    return references.regions.map(({ area }): MapArea => {
      return { ...area, ...(chosen.has(area.id) ? SELECTED_REGION_STYLE : REFERENCE_STYLE) };
    });
  }, [references.regions, selectedRegionIds]);
  const selectedRegions =
    selectedRegionIds?.flatMap((id) => {
      const region = references.regions.find(({ area }) => {
        return area.id === id;
      });
      return region ? [region] : [];
    }) ?? [];
  const mapAreas = useMemo(() => {
    const own = areas.flatMap((area): MapArea[] => {
      const geometry = geometryOf(area.parts);
      return geometry
        ? [{ id: `area:${area.id}`, label: area.label || area.id, fill: area.fill, ...(area.stroke ? { stroke: area.stroke } : {}), geometry }]
        : [];
    });
    return [...referenceAreas, ...own];
  }, [areas, referenceAreas]);

  const areaIndex = useMemo(() => {
    return buildSnapIndex({
      shapes: areas.map((area) => {
        return area.parts;
      }),
    });
  }, [areas]);
  // The regions shown and the coast, as well as the areas
  const extraIndexes = [references.index, coastIndex].filter((index) => {
    return index !== null;
  });
  const drawIndexes = [areaIndex, ...extraIndexes];
  const otherShapes = areas
    .filter((area) => {
      return area !== selected;
    })
    .map((area) => {
      return area.parts;
    });

  const crossing = useMemo(() => {
    return new Set(
      areas
        .filter((area) => {
          return partsCrossThemselves(area.parts);
        })
        .map((area) => {
          return area.id;
        }),
    );
  }, [areas]);

  function replaceArea({ id, next }: { id: string; next: EditorArea }) {
    history.commit(
      areas.map((area) => {
        return area.id === id ? next : area;
      }),
    );
  }

  function updateSelectedParts({ parts, preview }: { parts: Part[]; preview: boolean }) {
    if (!selected) {
      return;
    }
    const next = areas.map((area) => {
      return area.id === selected.id ? { ...area, parts } : area;
    });
    if (preview) {
      history.preview(next);
    } else {
      history.commit(next);
    }
  }

  function newArea({ parts, label }: { parts: Part[]; label?: string }): EditorArea {
    const id = freeId({ taken: new Set(ids) });
    return { id, label: label ?? `Area ${id.replace("area-", "")}`, fill: swatchFor(areas.length), parts };
  }

  function select(id: string | null) {
    setSelectedId(id);
    setSelectedVertex(null);
  }

  function finishDrawing() {
    if (mode.kind !== "draw" || mode.ring.length < 3) {
      return;
    }
    const target = mode.target === null ? null : areas.find((area) => area.id === mode.target);
    if (target) {
      replaceArea({ id: target.id, next: { ...target, parts: [...target.parts, [mode.ring]] } });
      select(target.id);
    } else {
      const area = newArea({ parts: [[mode.ring]] });
      history.commit([...areas, area]);
      select(area.id);
    }
    setMode({ kind: "select" });
    pointerStore.set(null);
  }

  function toggleRegionAt({ point, ids: chosen }: { point: LonLat; ids: string[] }) {
    const region = references.regions.find(({ parts }) => {
      return partsContain({ parts, point });
    });
    if (!region) {
      return;
    }
    const { id } = region.area;
    setMode({
      kind: "selectRegions",
      ids: chosen.includes(id)
        ? chosen.filter((other) => {
            return other !== id;
          })
        : [...chosen, id],
    });
  }

  /** Joins the selected regions into a new area, or into `target` */
  function joinRegions({ target }: { target: EditorArea | null }) {
    if (selectedRegions.length === 0) {
      return;
    }
    try {
      const joined = unionParts(
        selectedRegions.map(({ parts }) => {
          return parts;
        }),
      );
      if (target) {
        replaceArea({ id: target.id, next: { ...target, parts: unionParts([target.parts, joined]) } });
        select(target.id);
      } else {
        const [only] = selectedRegions;
        const area = newArea({ parts: joined, label: selectedRegions.length === 1 ? only?.area.label : undefined });
        history.commit([...areas, area]);
        select(area.id);
      }
      setMessage(null);
      setMode({ kind: "select" });
    } catch (error) {
      setMessage({ color: "red", text: `Could not join the regions: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  function handleMapClick(position: { lat: number; lon: number }) {
    const point: LonLat = [position.lon, position.lat];
    if (mode.kind === "draw") {
      const handle = map.current;
      const screen = handle?.project(position);
      const free = pointerStore.get()?.free ?? false;
      const snap = handle && screen && snapping && !free ? findSnap({ pointer: screen, indexes: drawIndexes, projection: handle, radius: SNAP_RADIUS }) : null;
      setMode({ ...mode, ring: [...mode.ring, snap?.at ?? point] });
      return;
    }
    if (mode.kind === "selectRegions") {
      toggleRegionAt({ point, ids: mode.ids });
      return;
    }
    // Later areas are drawn over earlier ones, so the last area under the click is the one on top
    const hit = areas.findLast((area) => {
      return partsContain({ parts: area.parts, point });
    });
    select(hit?.id ?? null);
  }

  function deleteSelectedVertex() {
    if (selected && selectedVertex) {
      updateSelectedParts({ parts: removeVertex({ parts: selected.parts, ref: selectedVertex }), preview: false });
      setSelectedVertex(null);
    }
  }

  function deleteArea(id: string) {
    history.commit(
      areas.filter((area) => {
        return area.id !== id;
      }),
    );
    select(null);
  }

  function undo() {
    history.undo();
    setSelectedVertex(null);
  }

  function redo() {
    history.redo();
    setSelectedVertex(null);
  }

  // The newest handler, so the listener is added once
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (event) => {
      if (dialog !== null || isTextField(event.target) || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
        event.preventDefault();
        if (key === "y" || event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === "Escape") {
        if (mode.kind !== "select") {
          setMode({ kind: "select" });
          pointerStore.set(null);
        } else {
          setSelectedVertex(null);
        }
      } else if (event.key === "Enter" && mode.kind === "draw") {
        event.preventDefault();
        finishDrawing();
      } else if (event.key === "Enter" && mode.kind === "selectRegions" && !(event.target instanceof HTMLButtonElement)) {
        // Enter on a focused button presses that button instead
        event.preventDefault();
        joinRegions({ target: null });
      } else if (event.key === "Backspace" || event.key === "Delete") {
        if (mode.kind === "draw") {
          event.preventDefault();
          setMode({ ...mode, ring: mode.ring.slice(0, -1) });
        } else if (selectedVertex) {
          event.preventDefault();
          deleteSelectedVertex();
        } else if (selected && mode.kind === "select") {
          event.preventDefault();
          deleteArea(selected.id);
        }
      }
    };
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      keyHandler.current(event);
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, []);

  function trackPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (mode.kind !== "draw") {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    pointerStore.set({ point: { x: event.clientX - rect.left, y: event.clientY - rect.top }, free: event.altKey });
  }

  const hasShapes = areas.some((area) => {
    return area.parts.length > 0;
  });

  return (
    <div className={classes.page}>
      <div
        className={classes.mapPane}
        data-mode={mode.kind}
        onPointerMove={trackPointer}
        onPointerLeave={() => {
          pointerStore.set(null);
        }}
      >
        <NordicMap
          ref={map}
          source={swedenOsmSource}
          label="Map of Sweden"
          colorScheme={colorScheme}
          selectionMode="none"
          areas={mapAreas}
          onMapClick={handleMapClick}
          onViewChange={onViewChange}
          showPlaceLabels={layers.places}
          showRoads={layers.roads}
          showRoadLabels={layers.roadLabels}
          showBorder={layers.border}
        />
        <EditorOverlay
          map={map}
          viewStore={viewStore}
          pointerStore={pointerStore}
          parts={mode.kind === "select" ? (selected?.parts ?? null) : null}
          selectedVertex={selectedVertex}
          drawing={drawing}
          snapping={snapping}
          drawIndexes={drawIndexes}
          otherShapes={otherShapes}
          extraIndexes={extraIndexes}
          onSelectVertex={setSelectedVertex}
          onPreview={(parts) => {
            updateSelectedParts({ parts, preview: true });
          }}
          onCommit={(parts) => {
            updateSelectedParts({ parts, preview: false });
          }}
          onCancel={history.cancelPreview}
          onFinishDrawing={finishDrawing}
        />
      </div>

      <aside className={classes.panel} aria-label="Area editor">
        <Stack gap="md">
          <div>
            <Title order={2} size="h4">
              Area editor
            </Title>
            <Text size="sm" c="dimmed">
              Draw areas over the map and export them as data for the <code>areas</code> prop. Your work is kept in this browser.
            </Text>
          </div>

          <Group gap="xs">
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              variant={mode.kind === "draw" && mode.target === null ? "filled" : "default"}
              onClick={() => {
                select(null);
                setMode({ kind: "draw", target: null, ring: [] });
              }}
            >
              New area
            </Button>
            <Tooltip label="Select an area first" disabled={selected !== null}>
              <Button
                size="xs"
                leftSection={<IconPolygon size={14} />}
                variant={mode.kind === "draw" && mode.target !== null ? "filled" : "default"}
                disabled={!selected}
                onClick={() => {
                  if (selected) {
                    setSelectedVertex(null);
                    setMode({ kind: "draw", target: selected.id, ring: [] });
                  }
                }}
              >
                Draw part
              </Button>
            </Tooltip>
            <Tooltip label="Show counties or municipalities first" disabled={reference !== "none"}>
              <Button
                size="xs"
                leftSection={<IconSquarePlus size={14} />}
                variant={mode.kind === "selectRegions" ? "filled" : "default"}
                disabled={reference === "none" || references.regions.length === 0}
                onClick={() => {
                  setSelectedVertex(null);
                  setMode(mode.kind === "selectRegions" ? { kind: "select" } : { kind: "selectRegions", ids: [] });
                }}
              >
                Select regions
              </Button>
            </Tooltip>
          </Group>

          <ModeHint mode={mode} drawingPoints={drawing?.length ?? 0} />
          {mode.kind === "selectRegions" && (
            <Stack gap="xs">
              <Text size="sm">
                {selectedRegions.length === 0
                  ? "No regions selected."
                  : `${selectedRegions.length} selected: ${selectedRegions
                      .slice(0, LISTED_REGIONS)
                      .map(({ area }) => {
                        return area.label ?? area.id;
                      })
                      .join(", ")}${selectedRegions.length > LISTED_REGIONS ? ` and ${selectedRegions.length - LISTED_REGIONS} more` : ""}`}
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  disabled={selectedRegions.length === 0}
                  onClick={() => {
                    joinRegions({ target: null });
                  }}
                >
                  Create area
                </Button>
                {selected && (
                  <Button
                    size="xs"
                    variant="default"
                    disabled={selectedRegions.length === 0}
                    onClick={() => {
                      joinRegions({ target: selected });
                    }}
                  >
                    Add to {selected.label || selected.id}
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={selectedRegions.length === 0}
                  onClick={() => {
                    setMode({ kind: "selectRegions", ids: [] });
                  }}
                >
                  Clear
                </Button>
              </Group>
            </Stack>
          )}
          {message && (
            <Alert
              color={message.color}
              p="xs"
              withCloseButton
              onClose={() => {
                setMessage(null);
              }}
            >
              {message.text}
            </Alert>
          )}

          <Group gap="xs" justify="space-between">
            <Group gap={4}>
              <Tooltip label="Undo">
                <ActionIcon variant="default" aria-label="Undo" disabled={!history.canUndo} onClick={undo}>
                  <IconArrowBackUp size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Redo">
                <ActionIcon variant="default" aria-label="Redo" disabled={!history.canRedo} onClick={redo}>
                  <IconArrowForwardUp size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                leftSection={<IconUpload size={14} />}
                onClick={() => {
                  setDialog("import");
                }}
              >
                Import
              </Button>
              <Button
                size="xs"
                leftSection={<IconDownload size={14} />}
                disabled={!hasShapes}
                onClick={() => {
                  setDialog("export");
                }}
              >
                Export
              </Button>
            </Group>
          </Group>

          <Divider />

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Map layers
            </Text>
            {LAYER_SWITCHES.map(({ key, label }) => {
              return (
                <Switch
                  key={key}
                  size="sm"
                  label={label}
                  checked={layers[key]}
                  // The map shows road signs only where it shows roads
                  disabled={key === "roadLabels" && !layers.roads}
                  onChange={(event) => {
                    setSettings({ ...settings, layers: { ...layers, [key]: event.currentTarget.checked } });
                  }}
                />
              );
            })}
          </Stack>

          <Divider />

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Regions to trace
            </Text>
            <SegmentedControl
              size="xs"
              value={reference}
              onChange={(value) => {
                const next = value as ReferenceLayer;
                setSettings({ ...settings, reference: next });
                // Region ids belong to one layer, so a selection does not carry over
                if (mode.kind === "selectRegions") {
                  setMode({ kind: "select" });
                }
              }}
              data={[
                { value: "none", label: "None" },
                { value: "counties", label: "Counties" },
                { value: "municipalities", label: "Municipalities" },
              ]}
            />
            {references.loading && (
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="xs">Loading the regions…</Text>
              </Group>
            )}
            {references.error && (
              <Text size="xs" c="red">
                {references.error}
              </Text>
            )}
            <Switch
              size="sm"
              mt={4}
              label="Snap to points and edges"
              description="To your areas, the regions shown, and the coast and border while they show. Hold Alt to place a point freely."
              checked={snapping}
              onChange={(event) => {
                setSettings({ ...settings, snapping: event.currentTarget.checked });
              }}
            />
          </Stack>

          <Divider />

          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Areas
            </Text>
            {areas.length === 0 && (
              <Text size="sm" c="dimmed">
                No areas yet. Start with New area.
              </Text>
            )}
            {areas.map((area) => {
              return (
                <UnstyledButton
                  key={area.id}
                  className={classes.areaRow}
                  data-selected={area.id === selectedId || undefined}
                  aria-pressed={area.id === selectedId}
                  onClick={() => {
                    select(area.id === selectedId ? null : area.id);
                    if (mode.kind === "draw") {
                      setMode({ kind: "select" });
                    }
                  }}
                >
                  <ColorSwatch color={area.fill} size={16} />
                  <div className={classes.areaName}>
                    <Text size="sm" truncate>
                      {area.label || area.id}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {area.id}
                    </Text>
                  </div>
                  {area.parts.length === 0 && (
                    <Badge size="xs" color="gray" variant="light">
                      No shape
                    </Badge>
                  )}
                  {area.parts.length > 1 && (
                    <Badge size="xs" color="gray" variant="light">
                      {area.parts.length} parts
                    </Badge>
                  )}
                  {crossing.has(area.id) && (
                    <Tooltip label="An edge crosses another edge of the same ring, so the fill may show gaps">
                      <Badge size="xs" color="yellow" variant="light">
                        Crosses itself
                      </Badge>
                    </Tooltip>
                  )}
                </UnstyledButton>
              );
            })}
          </Stack>

          {selected && (
            <>
              <Divider label={selected.label || selected.id} labelPosition="left" />
              {selectedVertex && (
                <Group gap="xs">
                  <Button size="xs" variant="default" onClick={deleteSelectedVertex}>
                    Delete point
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => {
                      updateSelectedParts({ parts: removePart({ parts: selected.parts, part: selectedVertex.part }), preview: false });
                      setSelectedVertex(null);
                    }}
                  >
                    Delete this part
                  </Button>
                </Group>
              )}
              <AreaDetails
                key={selected.id}
                area={selected}
                takenIds={ids}
                onChange={(next) => {
                  replaceArea({ id: selected.id, next });
                  if (next.id !== selected.id) {
                    setSelectedId(next.id);
                  }
                }}
                onZoomTo={() => {
                  const box = boundsOfParts(selected.parts);
                  if (box) {
                    map.current?.fitBounds(box);
                  }
                }}
                onDelete={() => {
                  deleteArea(selected.id);
                }}
              />
            </>
          )}

          {areas.length > 0 && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              onClick={() => {
                setDialog("clear");
              }}
            >
              Delete all areas
            </Button>
          )}
        </Stack>
      </aside>

      <ExportDialog
        opened={dialog === "export"}
        onClose={() => {
          setDialog(null);
        }}
        areas={areas}
      />
      <ImportDialog
        opened={dialog === "import"}
        onClose={() => {
          setDialog(null);
        }}
        takenIds={ids}
        onImport={(imported, skipped) => {
          history.commit([...areas, ...imported]);
          setMessage({
            color: "green",
            text: `Added ${imported.length} ${imported.length === 1 ? "area" : "areas"}${skipped > 0 ? `, and skipped ${skipped} without a polygon` : ""}.`,
          });
          const box = boundsOfParts(
            imported.flatMap((area) => {
              return area.parts;
            }),
          );
          if (box) {
            map.current?.fitBounds(box);
          }
        }}
      />
      <Modal
        opened={dialog === "clear"}
        onClose={() => {
          setDialog(null);
        }}
        title="Delete all areas?"
        size="sm"
      >
        <Text size="sm">Undo brings them back.</Text>
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => {
              setDialog(null);
            }}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              history.commit([]);
              select(null);
              setMode({ kind: "select" });
              setDialog(null);
            }}
          >
            Delete all
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
