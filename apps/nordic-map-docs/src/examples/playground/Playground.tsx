import {
  Box,
  Button,
  Group,
  List,
  Pill,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Tabs,
  Text,
  useComputedColorScheme,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadSwedenCounties, NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapArea, NordicMapHandle, SelectionMode } from "@jielga/nordic-map";
import { toMapAreas } from "../../editor/areaFiles.ts";
import { boundsOfParts } from "../../editor/editorModel.ts";
import type { EditorArea } from "../../editor/editorModel.ts";
import { useStoredAreas } from "../../editor/editorStorage.ts";
import { cities } from "../data/cities.ts";
import { ColorControls } from "./ColorControls.tsx";
import { CustomAreasControl } from "./CustomAreasControl.tsx";
import { LayerControl } from "./LayerControl.tsx";
import { toVisibility } from "./layerSetting.ts";
import { isBoolean, isNumber, useStoredState } from "../../useStoredState.ts";
import { isLayerSetting, isPickedColors, isSelectionMode } from "./playgroundSettings.ts";
import type { LayerSetting } from "./layerSetting.ts";
import { darkColors, lightColors } from "./mapColors.ts";
import type { MapColors } from "./mapColors.ts";

/** Full precision: these areas are shown, not exported */
const SHOWN_DECIMALS = 9;

/** The areas as MapAreas, with ids under `prefix` so areas from two sources never share an id */
function shownAreas({ areas, prefix }: { areas: EditorArea[]; prefix: string }): MapArea[] {
  return toMapAreas({ areas, decimals: SHOWN_DECIMALS }).map((area) => {
    return { ...area, id: `${prefix}:${area.id}` };
  });
}

const allZooms: LayerSetting = { enabled: true, range: [1, 50] };
const pinLabelZooms: LayerSetting = { enabled: true, range: [3, 50] };

function cityLabel(id: string): string {
  return (
    cities.find((city) => {
      return city.id === id;
    })?.label ?? id
  );
}

/** Every layer, color and pin option of the map, behind switches */
export function Playground() {
  // Read on the first render, so a dark page does not start with the light colors
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: false });
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [border, setBorder] = useStoredState({ key: "playground:border", initial: allZooms, isValid: isLayerSetting });
  const [borderWidth, setBorderWidth] = useStoredState({ key: "playground:borderWidth", initial: 1, isValid: isNumber });
  const [roads, setRoads] = useStoredState({ key: "playground:roads", initial: allZooms, isValid: isLayerSetting });
  const [roadLabels, setRoadLabels] = useStoredState({ key: "playground:roadLabels", initial: allZooms, isValid: isLayerSetting });
  const [places, setPlaces] = useStoredState({ key: "playground:places", initial: allZooms, isValid: isLayerSetting });
  const [pins, setPins] = useStoredState({ key: "playground:pins", initial: allZooms, isValid: isLayerSetting });
  const [pinLabels, setPinLabels] = useStoredState({ key: "playground:pinLabels", initial: pinLabelZooms, isValid: isLayerSetting });
  const [cluster, setCluster] = useStoredState({ key: "playground:cluster", initial: false, isValid: isBoolean });
  const [selectionMode, setSelectionMode] = useStoredState<SelectionMode>({ key: "playground:selectionMode", initial: "multiple", isValid: isSelectionMode });
  const [selectByArea, setSelectByArea] = useStoredState({ key: "playground:selectByArea", initial: false, isValid: isBoolean });
  const [showCounties, setShowCounties] = useStoredState({ key: "playground:counties", initial: false, isValid: isBoolean });
  const [counties, setCounties] = useState<MapArea[]>([]);
  const storedAreas = useStoredAreas();
  const [showStored, setShowStored] = useStoredState({ key: "playground:myAreas", initial: false, isValid: isBoolean });
  const [imported, setImported] = useState<EditorArea[]>([]);
  const map = useRef<NordicMapHandle>(null);
  const areas = useMemo(() => {
    return [
      ...(showCounties ? counties : []),
      ...(showStored ? shownAreas({ areas: storedAreas, prefix: "editor" }) : []),
      ...shownAreas({ areas: imported, prefix: "import" }),
    ];
  }, [showCounties, counties, showStored, storedAreas, imported]);
  // The map follows the site's light or dark scheme until colors are picked here
  const [pickedColors, setPickedColors] = useStoredState<MapColors | null>({ key: "playground:colors", initial: null, isValid: isPickedColors });
  const colors = pickedColors ?? (colorScheme === "dark" ? darkColors : lightColors);

  useEffect(() => {
    if (!showCounties || counties.length > 0) {
      return;
    }
    let cancelled = false;
    void loadSwedenCounties().then((areas) => {
      if (!cancelled) {
        setCounties(areas);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [showCounties, counties.length]);

  return (
    <Box h="100%" style={{ overflowY: "auto" }}>
      <Group align="flex-start" gap="xl" wrap="wrap" p="lg">
        <Box h="calc(100vh - 120px)" mih={520} miw={320} style={{ flex: "1 1 420px" }}>
          <NordicMap
            ref={map}
            source={swedenOsmSource}
            label="Map of Sweden"
            colorScheme={colorScheme}
            mapStyle={{ ...colors, borderWidth }}
            pins={cities}
            selected={selected}
            onSelectionChange={setSelected}
            selectionMode={selectionMode}
            selectPinsByArea={selectByArea}
            cluster={cluster}
            showBorder={toVisibility(border)}
            showRoads={toVisibility(roads)}
            showRoadLabels={toVisibility(roadLabels)}
            showPlaceLabels={toVisibility(places)}
            showPins={toVisibility(pins)}
            showPinLabels={toVisibility(pinLabels)}
            areas={areas}
            onViewChange={(view) => {
              setZoom(view.zoom);
            }}
          />
        </Box>

        <Stack gap="sm" w={320}>
          <Text size="sm" c="dimmed">
            Zoom {zoom.toFixed(1)}×
          </Text>

          <Tabs defaultValue="layers" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="layers">Layers</Tabs.Tab>
              <Tabs.Tab value="pins">Pins</Tabs.Tab>
              <Tabs.Tab value="colors">Colors</Tabs.Tab>
              <Tabs.Tab value="help">Help</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="layers" pt="md">
              <LayerControl label="Swedish coast and border" value={border} onChange={setBorder} />
              <Stack gap={4} pb="lg">
                <Text size="sm">Border width: {borderWidth} px</Text>
                <Slider
                  size="sm"
                  min={0.25}
                  max={3}
                  step={0.25}
                  thumbLabel="Border width"
                  value={borderWidth}
                  onChange={setBorderWidth}
                  label={(value) => {
                    return `${value} px`;
                  }}
                />
              </Stack>
              <LayerControl label="Roads" value={roads} onChange={setRoads} />
              <LayerControl label="Road signs" value={roadLabels} onChange={setRoadLabels} />
              <LayerControl label="Place names" value={places} onChange={setPlaces} />
              <Switch
                size="sm"
                label="Counties"
                checked={showCounties}
                onChange={(event) => {
                  setShowCounties(event.currentTarget.checked);
                }}
              />
              <CustomAreasControl
                stored={storedAreas}
                showStored={showStored}
                onShowStoredChange={setShowStored}
                imported={imported}
                onImport={(added) => {
                  setImported([...imported, ...added]);
                  const box = boundsOfParts(
                    added.flatMap((area) => {
                      return area.parts;
                    }),
                  );
                  if (box) {
                    map.current?.fitBounds(box);
                  }
                }}
                onClearImported={() => {
                  setImported([]);
                }}
              />
            </Tabs.Panel>

            <Tabs.Panel value="pins" pt="md">
              <LayerControl label="Pins" value={pins} onChange={setPins} />
              <LayerControl label="Pin labels" value={pinLabels} onChange={setPinLabels} />
              <Stack gap="sm" pb="lg">
                <Switch
                  size="sm"
                  label="Cluster close pins"
                  checked={cluster}
                  onChange={(event) => {
                    setCluster(event.currentTarget.checked);
                  }}
                />
                <Text size="sm">Selection</Text>
                <SegmentedControl
                  size="xs"
                  value={selectionMode}
                  onChange={(value) => {
                    setSelectionMode(value as SelectionMode);
                  }}
                  data={[
                    { value: "multiple", label: "Multiple" },
                    { value: "single", label: "Single" },
                    { value: "none", label: "None" },
                  ]}
                />
                <Switch
                  size="sm"
                  label="Click an area to select its pins"
                  description={
                    selectionMode === "multiple"
                      ? "Shift, Ctrl or Cmd + click adds. Show areas on the Layers tab."
                      : "Works with Multiple selection."
                  }
                  disabled={selectionMode !== "multiple"}
                  checked={selectByArea && selectionMode === "multiple"}
                  onChange={(event) => {
                    setSelectByArea(event.currentTarget.checked);
                  }}
                />
              </Stack>
              <Group justify="space-between" pb="xs">
                <Text size="sm">{selected.length} selected</Text>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  disabled={selected.length === 0}
                  onClick={() => {
                    setSelected([]);
                  }}
                >
                  Clear
                </Button>
              </Group>
              <Pill.Group>
                {selected.map((id) => {
                  return (
                    <Pill
                      key={id}
                      withRemoveButton
                      onRemove={() => {
                        setSelected((current) => {
                          return current.filter((item) => {
                            return item !== id;
                          });
                        });
                      }}
                    >
                      {cityLabel(id)}
                    </Pill>
                  );
                })}
              </Pill.Group>
            </Tabs.Panel>

            <Tabs.Panel value="colors" pt="md">
              <ColorControls value={colors} onChange={setPickedColors} />
            </Tabs.Panel>

            <Tabs.Panel value="help" pt="md">
              <List size="sm" spacing={4}>
                <List.Item>Drag a box to select pins. Shift, Ctrl or Cmd + drag adds to the selection.</List.Item>
                <List.Item>Click a pin to toggle it. Click the empty map to clear.</List.Item>
                <List.Item>Mouse wheel, trackpad pinch or two fingers to zoom, up to 50 times.</List.Item>
                <List.Item>Right mouse drag, Space + drag or two fingers to pan. Let go while moving and the map glides.</List.Item>
                <List.Item>Keyboard: + and - zoom, arrow keys pan, 0 shows the whole map, Tab moves through the pins.</List.Item>
              </List>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Group>
    </Box>
  );
}
