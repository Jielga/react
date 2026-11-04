import { Text, Stack } from "@mantine/core";
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapPin } from "@jielga/nordic-map";
import { useState } from "react";
import { cities } from "../../data/cities.ts";

/** A small random number generator with a fixed seed, so the demo shows the same stores on every load */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const random = seeded(7);

const totalPopulation = cities.reduce((sum, city) => sum + (city.data?.population ?? 0), 0);

/** A city picked at random, in proportion to its population */
function randomCity() {
  let left = random() * totalPopulation;
  return (
    cities.find((city) => {
      left -= city.data?.population ?? 0;
      return left <= 0;
    }) ?? cities[0]
  );
}

// 2 000 stores, more of them around the larger cities
const stores: MapPin[] = Array.from({ length: 2000 }, (_, index) => {
  const city = randomCity();
  const spread = 0.05 + random() * 0.6;
  const angle = random() * Math.PI * 2;
  return {
    id: `store-${index}`,
    label: `Store ${index + 1} near ${city?.label}`,
    lat: (city?.lat ?? 59) + Math.sin(angle) * spread * 0.5,
    lon: (city?.lon ?? 18) + Math.cos(angle) * spread,
  };
});

export function Clusters() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <Stack h="100%" gap="xs">
      <Text size="sm">{selected.length} stores selected</Text>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NordicMap
          source={swedenOsmSource}
          label="Stores"
          pins={stores}
          cluster
          selected={selected}
          onSelectionChange={setSelected}
        />
      </div>
    </Stack>
  );
}
