import { RangeSlider, Stack, Switch } from "@mantine/core";
import { MAX_ZOOM } from "./layerSetting.ts";
import type { LayerSetting } from "./layerSetting.ts";

const marks = [1, 3, 10, 50].map((zoom) => {
  return { value: toPosition(zoom), label: `${zoom}×` };
});

/** The slider is logarithmic, so zoom 1 to 5 gets as much room as 10 to 50 */
function toZoom(position: number): number {
  return Math.round(MAX_ZOOM ** (position / 100) * 10) / 10;
}

function toPosition(zoom: number): number {
  return (Math.log(zoom) / Math.log(MAX_ZOOM)) * 100;
}

type LayerControlProps = {
  label: string;
  value: LayerSetting;
  onChange: (value: LayerSetting) => void;
};

/** On and off switch for one map layer, with the zoom range it shows in */
export function LayerControl({ label, value, onChange }: LayerControlProps) {
  const [minZoom, maxZoom] = value.range;
  return (
    <Stack gap={8} pb="md">
      <Switch
        size="sm"
        label={label}
        checked={value.enabled}
        onChange={(event) => {
          onChange({ ...value, enabled: event.currentTarget.checked });
        }}
      />
      <RangeSlider
        size="sm"
        min={0}
        max={100}
        step={0.5}
        minRange={0}
        disabled={!value.enabled}
        thumbFromLabel={`${label} from zoom`}
        thumbToLabel={`${label} to zoom`}
        value={[toPosition(minZoom), toPosition(maxZoom)]}
        onChange={([from, to]) => {
          onChange({ ...value, range: [toZoom(from), toZoom(to)] });
        }}
        label={(position) => {
          return `${toZoom(position)}×`;
        }}
        marks={marks}
        // The mark labels hang below the slider without taking up room, so the margin makes room for them
        mb="lg"
      />
    </Stack>
  );
}
