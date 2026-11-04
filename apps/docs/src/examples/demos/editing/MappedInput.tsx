import { Code, Group, Text } from "@mantine/core";
import { useCallback, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
} from "@jielga/tmdatagrid";

type Asset = {
  id: number;
  code: string;
  reference: string;
  slots: number;
};

const ASSETS: Array<Asset> = [
  { id: 1, code: "sthlm-01", reference: "4021 8890", slots: 4 },
  { id: 2, code: "gbg-14", reference: "5511 2003", slots: 12 },
  { id: 3, code: "malmo-07", reference: "6640 7781", slots: 2 },
];

const columnHelper = createTMDataGridColumnHelper<Asset>();

const columns = columnHelper.columns([
  columnHelper.accessor("code", {
    header: "Code",
    minSize: 140,
    // Runs on every keystroke, so the cell never shows a lower-case character
    // even for the moment before it commits.
    meta: {
      edit: {
        mapValue: ({ value }) =>
          typeof value === "string" ? value.toUpperCase() : value,
      },
    },
  }),
  columnHelper.accessor("reference", {
    header: "Reference",
    minSize: 150,
    // A map may refuse input as well as rewrite it: anything but a digit is
    // dropped as it is typed.
    meta: {
      edit: {
        mapValue: ({ value }) =>
          typeof value === "string" ? value.replace(/[^0-9]/g, "") : value,
      },
    },
  }),
  columnHelper.accessor("slots", {
    header: "Slots",
    minSize: 110,
    // Clamping belongs here rather than in a validator: a validator would
    // reject 40 and make the user fix it, this accepts the intent as 10.
    meta: {
      type: "number",
      align: "right",
      edit: {
        mapValue: ({ value }) =>
          typeof value === "number" ? Math.min(Math.max(value, 0), 10) : value,
      },
    },
  }),
]);

export function MappedInput() {
  const [assets, setAssets] = useState(ASSETS);
  const [lastCommit, setLastCommit] = useState("-");

  const onCommit = useCallback(
    ({ rowId, value, changes }: TMDataGridEditCommitArgs<Asset>) => {
      setAssets((previous) =>
        previous.map((asset) => (String(asset.id) === rowId ? value : asset)),
      );
      const change = changes[0];
      setLastCommit(
        change === undefined
          ? "-"
          : `${change.field}: ${String(change.previous)} to ${String(change.next)}`,
      );
    },
    [],
  );

  const grid = useTMDataGrid({
    data: assets,
    columns,
    getRowId: (row) => String(row.id),
    editing: { mode: "cell", onCommit },
    selectionMode: "highlight",
  });

  return (
    <>
      <Group gap="xs" mb="xs">
        <Text size="sm" c="dimmed">
          Committed:
        </Text>
        <Code>{lastCommit}</Code>
      </Group>
      <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Table<Asset> />
      </TMDataGrid>
    </>
  );
}
