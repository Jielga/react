import { Stack, Text } from "@mantine/core";
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapPin } from "@jielga/nordic-map";
import { useState } from "react";

type Office = { staff: number };

const offices: MapPin<Office>[] = [
  // The head office keeps its label when labels collide
  { id: "sto", lat: 59.33, lon: 18.07, label: "Head office", priority: 10, color: "#d6336c", data: { staff: 420 } },
  { id: "upp", lat: 59.86, lon: 17.64, label: "Uppsala", data: { staff: 35 } },
  { id: "vas", lat: 59.61, lon: 16.54, label: "Västerås", data: { staff: 28 } },
  { id: "ore", lat: 59.27, lon: 15.21, label: "Örebro", data: { staff: 19 } },
  { id: "nrk", lat: 58.59, lon: 16.19, label: "Norrköping", data: { staff: 22 } },
  { id: "got", lat: 57.71, lon: 11.97, label: "Göteborg", data: { staff: 120 } },
  { id: "mal", lat: 55.61, lon: 13.0, label: "Malmö", data: { staff: 64 } },
];

export function PinLabels() {
  const [clicked, setClicked] = useState<MapPin<Office> | null>(null);

  return (
    <Stack h="100%" gap="xs">
      <Text size="sm">{clicked ? `${clicked.label}: ${clicked.data?.staff} staff` : "Click an office"}</Text>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NordicMap
          source={swedenOsmSource}
          label="Offices"
          pins={offices}
          selectionMode="none"
          showPinLabels
          // Place names would compete with the pin labels
          showPlaceLabels={{ minZoom: 6 }}
          onPinClick={setClicked}
        />
      </div>
    </Stack>
  );
}
