import { Stack, Text } from "@mantine/core";
import { loadSwedenMunicipalities, NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import type { MapArea } from "@jielga/nordic-map";
import { useEffect, useState } from "react";

export function Municipalities() {
  const [municipalities, setMunicipalities] = useState<MapArea[]>([]);
  const [hovered, setHovered] = useState<MapArea | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    void loadSwedenMunicipalities().then(setMunicipalities);
  }, []);

  // A picked municipality gets a fill of its own
  const areas = municipalities.map((area) => {
    return picked.includes(area.id) ? { ...area, fill: "rgb(214 51 108 / 55%)" } : area;
  });

  return (
    <Stack h="100%" gap="xs">
      <Text size="sm">
        {hovered ? `${hovered.label} (${hovered.id})` : "Point at a municipality"} · {picked.length} picked
      </Text>
      <div style={{ flex: 1, minHeight: 0 }}>
        <NordicMap
          source={swedenOsmSource}
          label="Municipalities"
          areas={areas}
          showRoads={false}
          showPlaceLabels={false}
          onAreaHover={setHovered}
          onAreaClick={(area) => {
            setPicked((current) => {
              return current.includes(area.id)
                ? current.filter((id) => {
                    return id !== area.id;
                  })
                : [...current, area.id];
            });
          }}
        />
      </div>
    </Stack>
  );
}
