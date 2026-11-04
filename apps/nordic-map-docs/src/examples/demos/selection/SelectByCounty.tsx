import { Stack, Text } from "@mantine/core";
import { loadSwedenCounties, NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapArea } from "@jielga/nordic-map";
import { useEffect, useState } from "react";
import { cities } from "../../data/cities.ts";

export function SelectByCounty() {
  const [counties, setCounties] = useState<MapArea[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    void loadSwedenCounties().then(setCounties);
  }, []);

  const names = cities
    .filter((city) => {
      return selected.includes(city.id);
    })
    .map((city) => {
      return city.label;
    });

  return (
    <Stack h="100%" gap="xs">
      <Text size="sm" truncate>
        {names.length === 0 ? "No cities selected" : `${names.length} selected: ${names.join(", ")}`}
      </Text>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NordicMap
          source={swedenOsmSource}
          label="Cities by county"
          pins={cities}
          areas={counties}
          selected={selected}
          onSelectionChange={setSelected}
          selectPinsByArea
          showRoads={false}
          showPlaceLabels={false}
        />
      </div>
    </Stack>
  );
}
