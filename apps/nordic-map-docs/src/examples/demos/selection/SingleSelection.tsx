import { Stack, Text } from "@mantine/core";
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import { useState } from "react";
import { cities } from "../../data/cities.ts";

export function SingleSelection() {
  const [selected, setSelected] = useState<string[]>([]);
  const city = cities.find((item) => {
    return item.id === selected[0];
  });

  return (
    <Stack h="100%" gap="xs">
      <Text size="sm">
        {city ? `${city.label}: ${city.data?.population.toLocaleString("sv-SE")} inhabitants` : "Click a city"}
      </Text>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NordicMap
          source={swedenOsmSource}
          label="Cities"
          pins={cities}
          selectionMode="single"
          selected={selected}
          onSelectionChange={setSelected}
        />
      </div>
    </Stack>
  );
}
