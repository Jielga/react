import { Input, SegmentedControl } from "@mantine/core";
import type { TMDataGridFilterControlArgs } from "../../core/filterControls";
import {
  operatorNeedsValue,
  operatorTakesArrayValue,
  operatorTakesRangeValue,
} from "../../core/filterOperators";
import { filterFieldProps } from "./controlLayout";
import { TMDataGridFilterValueInput } from "./TMDataGridFilterValueInput";

/**
 * A built-in `meta.filter.control` for `boolean` columns: an All / Yes / No
 * segmented control - All clears the value, which deactivates the filter.
 * Set or range operators fall back to the standard input.
 */
export function DgTriStateFilter(args: TMDataGridFilterControlArgs) {
  const { operator, value, onChange, size, labels } = args;
  if (operatorTakesArrayValue(operator) || operatorTakesRangeValue(operator)) {
    return <TMDataGridFilterValueInput {...args} />;
  }
  const needsValue = operatorNeedsValue(operator);
  const scalar = typeof value === "string" ? value : "";

  return (
    <Input.Wrapper
      {...filterFieldProps(args, { label: labels.filterValue })}
      size={size}
    >
      <SegmentedControl
        size={size}
        disabled={!needsValue}
        data={[
          { value: "all", label: labels.filterAll },
          { value: "true", label: labels.booleanTrue },
          { value: "false", label: labels.booleanFalse },
        ]}
        value={scalar === "true" || scalar === "false" ? scalar : "all"}
        onChange={(next) => onChange(next === "all" ? "" : next)}
      />
    </Input.Wrapper>
  );
}
