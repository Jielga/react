import { Stack, Text } from "@mantine/core";
import { loadSwedenCounties, NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapArea } from "@jielga/nordic-map";
import { useEffect, useState } from "react";
import { countyPopulation } from "../../data/countyPopulation.ts";

/** Blue, from light for few inhabitants to dark for many, on a log scale */
function fillFor(population: number): string {
  const t = (Math.log10(population) - 4.7) / (6.4 - 4.7);
  const lightness = 88 - Math.min(Math.max(t, 0), 1) * 58;
  return `hsl(212 70% ${lightness}% / 85%)`;
}

export function CountyChoropleth() {
  const [counties, setCounties] = useState<MapArea[]>([]);
  const [clicked, setClicked] = useState<MapArea | null>(null);

  useEffect(() => {
    void loadSwedenCounties().then((areas) => {
      setCounties(
        areas.map((area) => {
          return { ...area, fill: fillFor(countyPopulation[area.id] ?? 0) };
        }),
      );
    });
  }, []);

  return (
    <Stack h="100%" gap="xs">
      <Text size="sm">
        {clicked
          ? `${clicked.label}: ${countyPopulation[clicked.id]?.toLocaleString("sv-SE")} inhabitants`
          : "Click a county"}
      </Text>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NordicMap
          source={swedenOsmSource}
          label="Inhabitants per county"
          areas={counties}
          onAreaClick={setClicked}
          showRoads={false}
          showPlaceLabels={{ minZoom: 3 }}
        />
      </div>
    </Stack>
  );
}
