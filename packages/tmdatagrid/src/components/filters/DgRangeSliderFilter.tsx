import { Input, RangeSlider } from "@mantine/core";
import type { TMDataGridFilterControlArgs } from "../../core/filterControls";
import { operatorTakesRangeValue } from "../../core/filterOperators";
import { filterFieldProps } from "./controlLayout";
import { TMDataGridFilterValueInput } from "./TMDataGridFilterValueInput";

/**
 * A built-in `meta.filter.control` for `number` columns: a range slider whose
 * bounds are seeded from the values present in the data, writing the
 * `between` pair. Pair it with `meta.filter.defaultOperator: "between"` so
 * the filter opens on it; any non-range operator falls back to the standard
 * input.
 */
export function DgRangeSliderFilter(args: TMDataGridFilterControlArgs) {
  const { column, operator, value, onChange, size, labels } = args;
  if (!operatorTakesRangeValue(operator)) {
    return <TMDataGridFilterValueInput {...args} />;
  }

  // Bounds from the faceted index - the min and max actually in the data.
  const numbers: number[] = [];
  for (const key of column.getFacetedUniqueValues().keys()) {
    const numeric = Number(key);
    if (Number.isFinite(numeric)) numbers.push(numeric);
  }
  const min = numbers.length > 0 ? Math.min(...numbers) : 0;
  const max = numbers.length > 0 ? Math.max(...numbers) : 100;

  const pair = Array.isArray(value) ? value : ["", ""];
  const lower = pair[0] === undefined || pair[0] === "" ? min : Number(pair[0]);
  const upper = pair[1] === undefined || pair[1] === "" ? max : Number(pair[1]);

  return (
    <Input.Wrapper
      {...filterFieldProps(args, { label: labels.filterValue, width: 180 })}
      size={size}
    >
      <RangeSlider
        size={size}
        mt={6}
        min={min}
        max={max}
        minRange={0}
        value={[
          Math.min(Math.max(lower, min), max),
          Math.min(Math.max(upper, min), max),
        ]}
        thumbFromLabel={labels.filterFrom}
        thumbToLabel={labels.filterTo}
        onChange={([nextLower, nextUpper]) =>
          onChange([String(nextLower), String(nextUpper)])
        }
      />
    </Input.Wrapper>
  );
}
