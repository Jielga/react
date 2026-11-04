import { Badge, Group, Slider } from "@mantine/core";
import { useCallback, useState } from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
  type TMDataGridEditorComponent,
} from "@jielga/tmdatagrid";
import {
  makeEmployees,
  sek,
  SKILLS,
  type Employee,
} from "../../data/employees";

/**
 * A custom editor is a component over the live TanStack Form field - not a
 * render function, so hooks are legal inside. Module scope keeps its identity
 * stable across renders.
 *
 * `field.handleChange` writes the draft; `commit` and `cancel` are what Enter
 * and Escape would have done, for an editor that wants its own buttons.
 */
const SalarySliderEditor: TMDataGridEditorComponent = ({ field }) => (
  <Slider
    w="100%"
    min={20_000}
    max={90_000}
    step={500}
    label={(value) => sek(value)}
    value={typeof field.state.value === "number" ? field.state.value : 0}
    onChange={(value) => field.handleChange(value)}
  />
);

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  // Each type opens its own editor. `meta.type` is the only declaration
  // needed, and it is the same one the filter panel reads.
  columnHelper.accessor("firstName", {
    header: "String",
    minSize: 120,
    // A bare schema means `{ onChange: it }`; the object form takes every
    // trigger TanStack Form defines. Any Standard Schema works, not just Zod.
    meta: { edit: { validate: z.string().min(2, "At least two characters") } },
  }),
  columnHelper.accessor("age", {
    header: "Number",
    minSize: 110,
    meta: {
      type: "number",
      align: "right",
      edit: {
        validate: z
          .number({ error: "A number" })
          .min(16, "16 or older")
          .max(99, "99 or younger"),
      },
    },
  }),
  columnHelper.accessor("active", {
    header: "Boolean",
    minSize: 100,
    meta: { type: "boolean", align: "center" },
    cell: (info) => (info.getValue() ? "✓" : "-"),
  }),
  columnHelper.accessor("hired", {
    header: "Date",
    minSize: 130,
    meta: { type: "date" },
  }),
  columnHelper.accessor("department", {
    header: "Select",
    minSize: 140,
    meta: { type: "select", options: "faceted" },
  }),
  columnHelper.accessor("skills", {
    header: "Multi-select",
    minSize: 200,
    meta: { type: "multiSelect", options: SKILLS },
    cell: (info) => (
      <Group gap={4} wrap="nowrap">
        {info.getValue().map((skill) => (
          <Badge key={skill} variant="light" size="sm">
            {skill}
          </Badge>
        ))}
      </Group>
    ),
  }),
  columnHelper.accessor("salary", {
    header: "Custom",
    minSize: 200,
    meta: { type: "number", align: "right", edit: { editor: SalarySliderEditor } },
    cell: (info) => sek(info.getValue()),
  }),
]);

export function EditorsAndValidation() {
  const [employees, setEmployees] = useState(() => makeEmployees(40));

  const onCommit = useCallback(
    ({ rowId, value }: TMDataGridEditCommitArgs<Employee>) => {
      setEmployees((previous) =>
        previous.map((employee) =>
          String(employee.id) === rowId ? value : employee,
        ),
      );
    },
    [],
  );

  const grid = useTMDataGrid({
    data: employees,
    columns,
    getRowId: (row) => String(row.id),
    editing: { mode: "cellConfirm", onCommit },
    selectionMode: "highlight",
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
