import { ActionIcon, Menu } from "@mantine/core";
import { IconPin, IconPinFilled } from "@tabler/icons-react";
import type { Row } from "@tanstack/react-table";
import { useSelector } from "@tanstack/react-store";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridFeatures,
} from "@jielga/tmdatagrid";
import { compactEmployeeColumns } from "../../data/employeeColumns";
import { EMPLOYEES, type Employee } from "../../data/employees";

const columnHelper = createTMDataGridColumnHelper<Employee>();

/**
 * The pin toggle. `row.pin()` and `row.getIsPinned()` are TanStack's own row
 * API, so a lane like this is a display column and nothing more.
 *
 * The pinned state is read through a subscription rather than called in the
 * component body: the `row` identity survives a pin, so the React Compiler
 * would cache the call along with it and the icon would never fill in.
 */
function PinToggle({ row }: { row: Row<TMDataGridFeatures, Employee> }) {
  const pinned = useSelector(row.table.store, () => row.getIsPinned());

  return (
    <ActionIcon
      // `light` rather than a second colour for the pinned state: Mantine's
      // subtle variant resolves both "gray" and "blue" to a near-white icon in
      // the dark scheme, so colour alone would not tell the two apart there.
      variant={pinned === false ? "subtle" : "light"}
      color={pinned === false ? "gray" : "blue"}
      size="sm"
      aria-label={pinned === false ? "Pin to top" : "Unpin"}
      // The row highlights on click; pinning is its own gesture.
      onClick={(event) => {
        event.stopPropagation();
        row.pin(pinned === false ? "top" : false);
      }}
    >
      {pinned === false ? <IconPin size={16} /> : <IconPinFilled size={16} />}
    </ActionIcon>
  );
}

const pinColumn = columnHelper.display({
  id: "pin",
  header: "",
  // Columns are fluid by default - `minmax(minSize, flex fr)` - so a control
  // lane states one width three times to opt out. `label` is what the columns
  // panel calls a column whose header is empty.
  size: 44,
  minSize: 44,
  maxSize: 44,
  meta: { label: "Pin", align: "center" },
  enableResizing: false,
  enableSorting: false,
  cell: ({ row }) => <PinToggle row={row} />,
});

export function PinningAndNumbers() {
  const grid = useTMDataGrid({
    data: EMPLOYEES,
    columns: [pinColumn, ...compactEmployeeColumns],
    getRowId: (row) => String(row.id),
    // Sticky blocks at the top and bottom edges; the body scrolls beneath.
    enableRowPinning: true,
    // A gutter outermost left. It numbers the *view*: sort or filter and the
    // numbers stay 1..n, because they answer "which row on screen", not
    // "which record". Group rows go unnumbered.
    enableRowNumbers: true,
    selectionMode: "highlight",
    initialState: { rowPinning: { top: ["2"], bottom: ["8"] } },
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee>
        renderRowContextMenu={({ row }) => (
          <>
            <Menu.Label>
              {row.original.firstName} {row.original.lastName}
            </Menu.Label>
            {row.getIsPinned() !== "top" && (
              <Menu.Item onClick={() => row.pin("top")}>Pin to top</Menu.Item>
            )}
            {row.getIsPinned() !== "bottom" && (
              <Menu.Item onClick={() => row.pin("bottom")}>
                Pin to bottom
              </Menu.Item>
            )}
            {row.getIsPinned() !== false && (
              <Menu.Item onClick={() => row.pin(false)}>Unpin</Menu.Item>
            )}
          </>
        )}
      />
    </TMDataGrid>
  );
}
