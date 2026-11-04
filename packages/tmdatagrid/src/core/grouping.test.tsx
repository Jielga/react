import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  erased,
  part,
  renderGrid,
  renderWithMantine,
  visibleColumnIds,
} from "../../test/gridHarness";
import { TMDataGrid } from "../components/TMDataGrid";
import { GROUP_COLUMN_ID } from "../components/TMDataGridGroupColumn";
import { createTMDataGridColumnHelper, useTMDataGrid } from "../useTMDataGrid";
import { TMDATAGRID_LABELS_SV } from "./labelsSv";
import { getGroupDataRows } from "./grouping";
import {
  getDisplayedRows,
  getSelectableRowIds,
  isPagingActive,
} from "./rowSelection";

/**
 * Grouping is TanStack's; what is tested here is the grid's half of it - that
 * the tree column comes and goes with the grouping state, that grouping a
 * column takes it out of the grid, and that a group row selects the rows it
 * stands for rather than itself.
 *
 * The harness rows cycle through three cities, so grouping on `city` gives
 * three groups over twelve rows.
 */
function groupedGrid(...columnIds: Array<string>) {
  const rendered = renderGrid();
  const api = erased(rendered.result.current);
  act(() => {
    api.table.setGrouping(columnIds);
  });
  return { ...rendered, api };
}

const displayed = (api: ReturnType<typeof erased>) =>
  getDisplayedRows(api.table, api.features);

describe("the tree column", () => {
  it("stays hidden while nothing is grouped", () => {
    const { result } = renderGrid();

    // Present as a column (it has to hold its place in the leaf order), but
    // not rendered.
    expect(erased(result.current).table.getColumn(GROUP_COLUMN_ID)).toBeDefined();
    expect(visibleColumnIds(result.current)).not.toContain(GROUP_COLUMN_ID);
  });

  it("appears with the first grouped column and goes again with the last", () => {
    const { result, api } = groupedGrid("city");

    expect(visibleColumnIds(result.current)).toContain(GROUP_COLUMN_ID);

    act(() => {
      api.table.setGrouping([]);
    });
    expect(visibleColumnIds(result.current)).not.toContain(GROUP_COLUMN_ID);
  });

  it("leads the row, pinned ahead of the data columns", () => {
    const { result } = groupedGrid("city");

    // After the checkbox lane, before anything the consumer defined.
    expect(visibleColumnIds(result.current)[1]).toBe(GROUP_COLUMN_ID);
  });

  it("restores visible when the grouping is restored", () => {
    const { result } = renderGrid({ initialState: { grouping: ["city"] } });

    expect(visibleColumnIds(result.current)).toContain(GROUP_COLUMN_ID);
  });
});

describe("grouped columns", () => {
  it("are taken out of the grid, their values having moved to the tree", () => {
    const { result } = groupedGrid("city");

    expect(visibleColumnIds(result.current)).not.toContain("city");
    expect(visibleColumnIds(result.current)).toContain("name");
  });

  it("come back when ungrouped", () => {
    const { result, api } = groupedGrid("city");

    act(() => {
      api.table.getColumn("city")?.toggleGrouping();
    });
    expect(visibleColumnIds(result.current)).toContain("city");
  });

  /**
   * The regression test for the memo workaround in `useTMDataGrid`. Grouping a
   * second column changes nothing else, so without the re-published
   * `columnVisibility` / `columnOrder` the per-region column APIs keep handing
   * back the list they built for the first grouping - and the second column
   * holds its header and its grid track while its cells have gone.
   */
  it("are removed on the second grouping too, not just the first", () => {
    const { result, api } = groupedGrid("city");

    expect(api.table.getAllLeafColumns().map((c) => c.id)).not.toContain("city");

    act(() => {
      api.table.setGrouping(["city", "name"]);
    });

    // The source of truth and what the grid renders from have to agree.
    expect(api.table.getAllLeafColumns().map((c) => c.id)).not.toContain("name");
    expect(visibleColumnIds(result.current)).not.toContain("name");
  });

  it("keeps headers and tracks in step when a grouping is removed", () => {
    const { result, api } = groupedGrid("city", "name");

    act(() => {
      api.table.setGrouping(["city"]);
    });

    expect(visibleColumnIds(result.current)).toContain("name");
    expect(visibleColumnIds(result.current)).not.toContain("city");
  });
});

describe("group rows", () => {
  it("replaces the flat list with one row per group, collapsed", () => {
    const { api } = groupedGrid("city");
    const rows = displayed(api);

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.getIsGrouped())).toBe(true);
    expect(rows.map((row) => row.groupingValue).sort()).toEqual([
      "Göteborg",
      "Malmö",
      "Stockholm",
    ]);
  });

  it("counts the data rows under it, not its direct children", () => {
    const { api } = groupedGrid("city");

    // Twelve rows over three cities.
    for (const row of displayed(api)) {
      expect(getGroupDataRows(row)).toHaveLength(4);
    }
  });

  it("counts records rather than sub-groups when nested", () => {
    const { api } = groupedGrid("city", "name");
    const group = displayed(api)[0];

    // `getLeafRows()` keeps the branches it flattens, so it would report the
    // four rows plus the name groups holding them.
    expect(group && getGroupDataRows(group)).toHaveLength(4);
    expect(group?.getLeafRows().length).toBeGreaterThan(4);
  });

  it("brings its rows into view when expanded", () => {
    const { api } = groupedGrid("city");
    const group = displayed(api)[0];

    act(() => {
      group?.toggleExpanded();
    });

    const rows = displayed(api);
    expect(rows).toHaveLength(3 + 4);
    expect(rows.filter((row) => !row.getIsGrouped())).toHaveLength(4);
  });

  it("nests, one level per grouped column", () => {
    const { api } = groupedGrid("city", "name");

    act(() => {
      api.table.toggleAllRowsExpanded(true);
    });

    const rows = displayed(api);
    // Depth 0 cities, depth 1 names inside them, depth 2 the data rows.
    expect(rows.filter((row) => row.depth === 0)).toHaveLength(3);
    expect(rows.some((row) => row.depth === 1 && row.getIsGrouped())).toBe(true);
    expect(rows.filter((row) => !row.getIsGrouped())).toHaveLength(12);
  });
});

describe("grouping and pagination", () => {
  const pagedGrid = () =>
    renderGrid({
      enablePagination: true,
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    });

  it("pages as usual until something is grouped", () => {
    const api = erased(pagedGrid().result.current);

    expect(isPagingActive(api.table, api.features)).toBe(true);
    expect(displayed(api)).toHaveLength(5);
  });

  it("suspends paging while grouped, so the whole tree is rendered", () => {
    const api = erased(pagedGrid().result.current);

    act(() => {
      api.table.setGrouping(["city"]);
    });

    expect(isPagingActive(api.table, api.features)).toBe(false);
    // Three groups, none of them sliced away by a page size of five.
    expect(displayed(api)).toHaveLength(3);

    act(() => {
      displayed(api)[0]?.toggleExpanded();
    });
    // And an opened group keeps every other group in view rather than pushing
    // them onto pages the user would have to go looking for.
    const rows = displayed(api);
    expect(rows.filter((row) => row.getIsGrouped())).toHaveLength(3);
    expect(rows.filter((row) => !row.getIsGrouped())).toHaveLength(4);
  });

  it("pages again once the grouping is dropped", () => {
    const api = erased(pagedGrid().result.current);

    act(() => {
      api.table.setGrouping(["city"]);
    });
    act(() => {
      api.table.setGrouping([]);
    });

    expect(isPagingActive(api.table, api.features)).toBe(true);
    expect(displayed(api)).toHaveLength(5);
  });

  it("is never active on a grid that does not page at all", () => {
    const { api } = groupedGrid("city");

    expect(isPagingActive(api.table, api.features)).toBe(false);
  });
});

describe("selecting a group", () => {
  it("resolves to every leaf under it, not to the group row", () => {
    const { api } = groupedGrid("city");
    const group = displayed(api)[0];

    const ids = group ? getSelectableRowIds(group) : [];
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain(group?.id);
  });

  it("reaches leaves that are collapsed out of view", () => {
    const { api } = groupedGrid("city");
    const group = displayed(api)[0];

    // Nothing is expanded, so none of these rows are displayed.
    expect(displayed(api)).toHaveLength(3);
    expect(group && getSelectableRowIds(group)).toHaveLength(4);
  });

  it("takes the whole subtree from a top-level group when nested", () => {
    const { api } = groupedGrid("city", "name");
    const group = displayed(api)[0];

    // Leaves, so the sub-groups in between do not stop it.
    expect(group && getSelectableRowIds(group)).toHaveLength(4);
  });

  it("lights the group up once its rows are all selected", () => {
    const { api } = groupedGrid("city");
    const group = displayed(api)[0];
    const ids = group ? getSelectableRowIds(group) : [];

    act(() => {
      api.table.setRowSelection(
        Object.fromEntries(ids.map((id) => [id, true])),
      );
    });
    // `getIsAllSubRowsSelected()`, not `getIsSelected()`: the selection map only
    // ever holds leaves, and TanStack's `getIsSelected()` is a lookup by id, so
    // a group row reports false however many of its rows are ticked. The
    // checkbox column asks the same question.
    expect(group?.getIsAllSubRowsSelected()).toBe(true);
    expect(group?.getIsSelected()).toBe(false);

    act(() => {
      api.table.setRowSelection({ [ids[0] ?? ""]: true });
    });
    expect(group?.getIsAllSubRowsSelected()).toBe(false);
    expect(group?.getIsSomeSelected()).toBe(true);
  });

  it("leaves a plain row resolving to itself", () => {
    const { api } = groupedGrid("city");
    const group = displayed(api)[0];

    act(() => {
      group?.toggleExpanded();
    });

    const leaf = displayed(api).find((row) => !row.getIsGrouped());
    expect(leaf && getSelectableRowIds(leaf)).toEqual([leaf?.id]);
  });
});

describe("aggregation", () => {
  it("reports nothing for a column that was not told how to summarise", () => {
    const { api } = groupedGrid("city");
    const group = displayed(api)[0];

    // What keeps a plain "group by" a tree rather than a half-filled summary.
    expect(group?.getValue("age")).toBeUndefined();
  });

  it("summarises a column that declares an aggregationFn", () => {
    const rendered = renderGrid({
      columns: [
        { accessorKey: "id", header: "ID" },
        { accessorKey: "city", header: "City" },
        { accessorKey: "age", header: "Age", aggregationFn: "sum" },
      ],
    } as never);
    const api = erased(rendered.result.current);

    act(() => {
      api.table.setGrouping(["city"]);
    });

    const group = displayed(api)[0];
    const summed = group
      ?.getLeafRows()
      .reduce((total, row) => total + Number(row.getValue("age")), 0);

    expect(group?.getValue("age")).toBe(summed);
  });
});

describe("the group label", () => {
  type LabelRow = {
    id: number;
    active: boolean;
    status: string;
    hired: Date;
    note: string | null;
  };
  const HIRED = new Date(2026, 0, 15);
  const helper = createTMDataGridColumnHelper<LabelRow>();
  const columns = helper.columns([
    helper.accessor("active", { header: "Aktiv", meta: { type: "boolean" } }),
    helper.accessor("status", {
      header: "Status",
      meta: { type: "select", options: [{ value: "leave", label: "Ledig" }] },
    }),
    helper.accessor("hired", { header: "Anställd", meta: { type: "date" } }),
    helper.accessor("note", { header: "Not" }),
  ]);
  const rows: LabelRow[] = [
    { id: 1, active: true, status: "leave", hired: HIRED, note: null },
    { id: 2, active: false, status: "leave", hired: HIRED, note: null },
  ];

  function LabelGrid({ groupBy }: { groupBy: string }) {
    const grid = useTMDataGrid<LabelRow>({
      data: rows,
      columns,
      getRowId: (row) => String(row.id),
      labels: TMDATAGRID_LABELS_SV,
      enableGrouping: true,
      initialState: { grouping: [groupBy] },
    });
    return (
      <TMDataGrid {...grid}>
        <TMDataGrid.Table<LabelRow> />
      </TMDataGrid>
    );
  }

  // TanStack keys a group by the value turned into a string, so the label is
  // read from the record: otherwise `true` reads "true" and `null` "null".
  it("writes a boolean group through the boolean labels", () => {
    renderWithMantine(<LabelGrid groupBy="active" />);

    expect(part("group-toggle", { rowId: "active:true" })).toHaveTextContent("Ja");
    expect(part("group-toggle", { rowId: "active:false" })).toHaveAccessibleName(
      "Expandera Nej",
    );
  });

  it("writes a select group as its option's label", () => {
    renderWithMantine(<LabelGrid groupBy="status" />);

    expect(part("group-toggle", { rowId: "status:leave" })).toHaveTextContent("Ledig");
  });

  it("writes a date group as a date", () => {
    renderWithMantine(<LabelGrid groupBy="hired" />);

    expect(
      part("group-toggle", { rowId: `hired:${String(HIRED)}` }),
    ).toHaveTextContent(HIRED.toLocaleDateString());
  });

  it("writes a null group as the blank label", () => {
    renderWithMantine(<LabelGrid groupBy="note" />);

    expect(part("group-toggle", { rowId: "note:null" })).toHaveTextContent("(Tomt)");
  });
});
