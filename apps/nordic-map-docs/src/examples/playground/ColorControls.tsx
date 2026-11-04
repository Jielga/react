import { Button, ColorInput, Group, Stack, Text } from "@mantine/core";
import { colorFields, darkColors, lightColors, sameColors } from "./mapColors.ts";
import type { MapColors } from "./mapColors.ts";

type ColorControlsProps = {
  value: MapColors;
  onChange: (value: MapColors) => void;
};

const presets = [
  { label: "Dark", colors: darkColors },
  { label: "Light", colors: lightColors },
];

/** Light and dark presets, and a color picker for each map color */
export function ColorControls({ value, onChange }: ColorControlsProps) {
  return (
    <Stack gap="sm">
      <Group gap="xs" align="center">
        <Text size="sm" fw={500}>
          Preset
        </Text>
        {presets.map((preset) => {
          const active = sameColors(value, preset.colors);
          return (
            <Button
              key={preset.label}
              size="compact-sm"
              variant={active ? "filled" : "default"}
              aria-pressed={active}
              onClick={() => {
                onChange(preset.colors);
              }}
            >
              {preset.label}
            </Button>
          );
        })}
      </Group>

      {colorFields.map(({ key, label }) => {
        return (
          <ColorInput
            key={key}
            size="xs"
            label={label}
            format="hex"
            value={value[key]}
            onChange={(color) => {
              onChange({ ...value, [key]: color });
            }}
          />
        );
      })}
    </Stack>
  );
}
