import { Group, TextInput } from "@mantine/core";
import type { TMDataGridFilterControlArgs } from "../../core/filterControls";
import { operatorTakesRangeValue } from "../../core/filterOperators";
import { filterFieldProps } from "./controlLayout";
import { TMDataGridFilterValueInput } from "./TMDataGridFilterValueInput";

/**
 * A built-in `meta.filter.control` for `date` columns: a From/To pair of
 * native date inputs writing the `between` pair - no `@mantine/dates`
 * involved, like the built-in date editor. Pair it with
 * `meta.filter.defaultOperator: "between"`; any non-range operator falls back
 * to the standard input.
 */
export function DgDateRangeFilter(args: TMDataGridFilterControlArgs) {
  const { operator, value, onChange, size, labels } = args;
  if (!operatorTakesRangeValue(operator)) {
    return <TMDataGridFilterValueInput {...args} />;
  }

  const fills = args.layout !== "row";
  const pair: [string, string] = Array.isArray(value)
    ? [String(value[0] ?? ""), String(value[1] ?? "")]
    : ["", ""];

  return (
    <Group
      gap={4}
      wrap="nowrap"
      align="flex-start"
      w={fills ? "100%" : undefined}
    >
      <TextInput
        {...filterFieldProps(
          args,
          { label: labels.filterFrom, width: 88 },
          labels.filterFrom,
        )}
        size={size}
        type="date"
        flex={fills ? 1 : undefined}
        miw={0}
        value={pair[0]}
        onChange={(event) => onChange([event.currentTarget.value, pair[1]])}
      />
      <TextInput
        {...filterFieldProps(
          args,
          { label: labels.filterTo, width: 88 },
          labels.filterTo,
        )}
        size={size}
        type="date"
        flex={fills ? 1 : undefined}
        miw={0}
        value={pair[1]}
        onChange={(event) => onChange([pair[0], event.currentTarget.value])}
      />
    </Group>
  );
}
