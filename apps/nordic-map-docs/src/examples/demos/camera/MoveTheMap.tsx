import { Button, Group, Stack, Text } from "@mantine/core";
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { NordicMapHandle, NordicMapView } from "@jielga/nordic-map";
import { useRef, useState } from "react";
import { cities } from "../../data/cities.ts";

const south = ["malmo", "lund", "helsingborg"];

export function MoveTheMap() {
  const map = useRef<NordicMapHandle>(null);
  const [view, setView] = useState<NordicMapView | null>(null);

  return (
    <Stack h="100%" gap="xs">
      <Group gap="xs">
        <Button
          size="compact-sm"
          variant="default"
          onClick={() => {
            map.current?.flyTo({ lat: 59.33, lon: 18.07, zoom: 12 });
          }}
        >
          Fly to Stockholm
        </Button>
        <Button
          size="compact-sm"
          variant="default"
          onClick={() => {
            map.current?.fitPins(south);
          }}
        >
          Fit Skåne's cities
        </Button>
        <Button
          size="compact-sm"
          variant="default"
          onClick={() => {
            map.current?.fitBounds({ west: 18.1, south: 56.9, east: 19.4, north: 58.0 });
          }}
        >
          Show Gotland
        </Button>
        <Button
          size="compact-sm"
          variant="default"
          onClick={() => {
            map.current?.reset();
          }}
        >
          Whole map
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        {view
          ? `Zoom ${view.zoom.toFixed(1)}×, center ${view.center.lat.toFixed(2)}° N ${view.center.lon.toFixed(2)}° E`
          : "Loading"}
      </Text>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NordicMap ref={map} source={swedenOsmSource} label="Cities" pins={cities} onViewChange={setView} />
      </div>
    </Stack>
  );
}
