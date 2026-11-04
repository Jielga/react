import { Group, MultiSelect, Select, TextInput } from "@mantine/core";
import { optionsToComboboxData } from "../../core/columnOptions";
import { getColumnType } from "../../core/columnUtils";
import type { TMDataGridFilterControlArgs } from "../../core/filterControls";
import {
  operatorNeedsValue,
  operatorTakesArrayValue,
  operatorTakesRangeValue,
} from "../../core/filterOperators";
import { filterFieldProps } from "./controlLayout";

/**
 * The built-in value control of a filter row - what renders when a column
 * declares no `meta.filter.control`. Shaped by the operator: a multi-select
 * for the set operators, a From/To pair for `between`, a Yes/No dropdown for
 * booleans, a typed input otherwise.
 *
 * Shaped by `layout` as well: in a header cell the fields drop their labels,
 * fill the column's width and name themselves through `aria-label`.
 *
 * Exported so a custom control can fall back to it for the operators it does
 * not care about, instead of rebuilding them.
 */
export function TMDataGridFilterValueInput(args: TMDataGridFilterControlArgs) {
  const { column, operator, value, onChange, options, size, labels, layout } =
    args;
  const type = getColumnType(column);
  const needsValue = operatorNeedsValue(operator);
  const scalarValue = typeof value === "string" ? value : "";
  const inputType =
    type === "number" ? "number" : type === "date" ? "date" : "text";
  const inHeader = layout === "header";
  const fills = layout !== "row";
  // Portalled everywhere: drawn inline, the dropdown is clipped - by the
  // header cell, by the grid frame's `overflow: hidden` (its corner radius)
  // under the popup, or by the sidebar's scroller. The popup's click-away
  // exempts portal nodes, so picking an option does not read as a click away.
  const comboboxProps = { withinPortal: true };
  // No placeholder in a header cell: the column name is directly above the
  // field, and "Filter value" only ever fits a wide column anyway.
  const placeholder =
    needsValue && !inHeader ? labels.filterValuePlaceholder : "";

  if (operatorTakesRangeValue(operator)) {
    const rangeValue: [string, string] = Array.isArray(value)
      ? [String(value[0] ?? ""), String(value[1] ?? "")]
      : ["", ""];
    return (
      // The interval's two ends. Either may stay empty (an open end), and
      // each writes its slot of the `[min, max]` pair.
      <Group gap={4} wrap="nowrap" align="flex-start" w={fills ? "100%" : undefined}>
        <TextInput
          {...filterFieldProps(
            args,
            { label: labels.filterFrom, width: 88 },
            labels.filterFrom,
          )}
          size={size}
          type={inputType}
          flex={fills ? 1 : undefined}
          miw={0}
          data-dg-part="filter-value-from"
          value={rangeValue[0]}
          onChange={(event) =>
            onChange([event.currentTarget.value, rangeValue[1]])
          }
        />
        <TextInput
          {...filterFieldProps(
            args,
            { label: labels.filterTo, width: 88 },
            labels.filterTo,
          )}
          size={size}
          type={inputType}
          flex={fills ? 1 : undefined}
          miw={0}
          data-dg-part="filter-value-to"
          value={rangeValue[1]}
          onChange={(event) =>
            onChange([rangeValue[0], event.currentTarget.value])
          }
        />
      </Group>
    );
  }

  if (operatorTakesArrayValue(operator)) {
    // The set the cell is tested against. Options come from `meta.options`;
    // a select column that declares none still gets the values present in
    // the data, via the faceted index.
    return (
      <MultiSelect
        {...filterFieldProps(args, { label: labels.filterValue, width: 180 })}
        size={size}
        comboboxProps={comboboxProps}
        searchable
        data-dg-part="filter-value"
        data={optionsToComboboxData(options)}
        value={Array.isArray(value) ? [...value] : []}
        onChange={onChange}
      />
    );
  }

  if (type === "boolean") {
    return (
      <Select
        {...filterFieldProps(args, { label: labels.filterValue, width: 180 })}
        size={size}
        comboboxProps={comboboxProps}
        data-dg-part="filter-value"
        disabled={!needsValue}
        clearable
        placeholder={placeholder}
        data={[
          { value: "true", label: labels.booleanTrue },
          { value: "false", label: labels.booleanFalse },
        ]}
        value={needsValue && scalarValue !== "" ? scalarValue : null}
        onChange={(next) => onChange(next ?? "")}
      />
    );
  }

  return (
    <TextInput
      {...filterFieldProps(args, { label: labels.filterValue, width: 180 })}
      size={size}
      type={needsValue ? inputType : "text"}
      data-dg-part="filter-value"
      disabled={!needsValue}
      placeholder={placeholder}
      value={needsValue ? scalarValue : ""}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
