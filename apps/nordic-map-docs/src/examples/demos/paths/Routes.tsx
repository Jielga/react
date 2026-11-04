import { Stack, Text } from "@mantine/core";
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapPath } from "@jielga/nordic-map";
import { useState } from "react";

const routes: MapPath[] = [
  {
    id: "vattern",
    label: "Vätternrundan, 315 km",
    geometry: {
      type: "LineString",
      // [longitude, latitude]
      coordinates: [
        [15.04, 58.54], [14.9, 58.88], [14.21, 58.86], [14.51, 58.53], [14.28, 58.3], [14.07, 57.91],
        [14.16, 57.78], [14.27, 57.79], [14.46, 58.02], [14.65, 58.23], [14.89, 58.45], [15.04, 58.54],
      ],
    },
  },
  {
    id: "west-line",
    label: "Stockholm to Göteborg by train",
    color: "#d6336c",
    width: 2,
    geometry: {
      type: "LineString",
      coordinates: [
        [18.06, 59.33], [17.63, 59.2], [16.21, 59.0], [15.11, 59.06], [13.85, 58.39], [13.02, 57.99],
        [12.53, 57.93], [11.97, 57.71],
      ],
    },
  },
];

export function Routes() {
  const [clicked, setClicked] = useState<MapPath | null>(null);

  return (
    <Stack h="100%" gap="xs">
      <Text size="sm">{clicked ? clicked.label : "Click a route"}</Text>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NordicMap source={swedenOsmSource} label="Routes" paths={routes} onPathClick={setClicked} />
      </div>
    </Stack>
  );
}
