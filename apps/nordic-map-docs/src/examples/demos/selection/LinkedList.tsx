import { Checkbox, Group, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { NordicMap, swedenOsmSource } from "@jielga/nordic-map";
import { useState } from "react";
import { cities } from "../../data/cities.ts";

export function LinkedList() {
  const [selected, setSelected] = useState<string[]>([]);
  // The row under the pointer and the pin under the pointer are the same city
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <Group h="100%" gap="sm" wrap="nowrap" align="stretch">
      <div style={{ flex: 1, minWidth: 0 }}>
        <NordicMap
          source={swedenOsmSource}
          label="Cities"
          pins={cities}
          selected={selected}
          onSelectionChange={setSelected}
          highlighted={hovered}
          onPinHover={(pin) => {
            setHovered(pin?.id ?? null);
          }}
        />
      </div>
      <ScrollArea w={200}>
        <Stack gap={0}>
          {cities.map((city) => {
            return (
              <UnstyledButton
                key={city.id}
                px="xs"
                py={4}
                bg={hovered === city.id ? "var(--mantine-color-default-hover)" : undefined}
                onMouseEnter={() => {
                  setHovered(city.id);
                }}
                onMouseLeave={() => {
                  setHovered(null);
                }}
                onClick={() => {
                  setSelected((current) => {
                    return current.includes(city.id)
                      ? current.filter((id) => {
                          return id !== city.id;
                        })
                      : [...current, city.id];
                  });
                }}
              >
                <Group gap="xs" wrap="nowrap">
                  <Checkbox size="xs" checked={selected.includes(city.id)} readOnly tabIndex={-1} aria-hidden />
                  <Text size="sm">{city.label}</Text>
                </Group>
              </UnstyledButton>
            );
          })}
        </Stack>
      </ScrollArea>
    </Group>
  );
}
