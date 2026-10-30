import { act, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Grid,
  type GridProps,
  MantineWrapper,
  openColumnMenu,
  queryPart,
  part,
  renderedRowIds,
  renderWithMantine,
  type TestRow,
} from "../../test/gridHarness";
import {
  createTMDataGridColumnHelper,
  type UseTMDataGridOptions,
  useTMDataGrid,
} from "../useTMDataGrid";

/**
 * `sortMode: "frozen"`: the order is taken when the sort is applied and held
 * until the user sorts again. The rows are plain records here, re-passed
 * through `data` the way a consumer applies an edit.
 */
const helper = createTMDataGridColumnHelper<TestRow>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("age", {
    header: "Age",
    meta: { type: "number" },
    aggregationFn: "sum",
  }),
  helper.accessor("city", { header: "City" }),
]);

const ROWS: Array<TestRow> = [
  { id: 1, name: "Anna", age: 30, city: "Stockholm" },
  { id: 2, name: "Erik", age: 10, city: "Göteborg" },
  { id: 3, name: "Maria", age: 20, city: "Stockholm" },
  { id: 4, name: "Lars", age: 40, city: "Göteborg" },
];

type Options = Partial<UseTMDataGridOptions<TestRow>>;

function renderFrozen(options: Options = {}, data: Array<TestRow> = ROWS) {
  const rendered = renderHook(
    ({ data, options }: { data: Array<TestRow>; options: Options }) =>
      useTMDataGrid<TestRow>({
        data,
        columns,
        getRowId: (row) => String(row.id),
        sortMode: "frozen",
        initialState: { sorting: [{ id: "age", desc: false }] },
        ...options,
      } as UseTMDataGridOptions<TestRow>),
    { initialProps: { data, options }, wrapper: MantineWrapper },
  );
  const setData = (next: Array<TestRow>) =>
    rendered.rerender({ data: next, options });
  return { ...rendered, setData };
}

const withAge = (rows: Array<TestRow>, id: number, age: number) =>
  rows.map((row) => (row.id === id ? { ...row, age } : row));

type Api = ReturnType<typeof renderFrozen>["result"]["current"];
const order = (api: Api) => api.table.getRowModel().rows.map((row) => row.id);

describe("sortMode: frozen", () => {
  it("re-sorts on every edit under the default live mode", () => {
    const { result, setData } = renderFrozen({ sortMode: undefined });
    expect(order(result.current)).toEqual(["2", "3", "1", "4"]);

    setData(withAge(ROWS, 2, 50));

    expect(order(result.current)).toEqual(["3", "1", "4", "2"]);
    expect(result.current.sortStale).toBe(false);
  });

  it("keeps an edited row in place and reports the order as stale", () => {
    const { result, setData } = renderFrozen();
    expect(order(result.current)).toEqual(["2", "3", "1", "4"]);
    expect(result.current.sortStale).toBe(false);

    setData(withAge(ROWS, 2, 50));

    expect(order(result.current)).toEqual(["2", "3", "1", "4"]);
    expect(result.current.sortStale).toBe(true);
  });

  it("is not stale when an edit leaves the sorted order as it was", () => {
    const { result, setData } = renderFrozen();

    setData(withAge(ROWS, 2, 15));

    expect(order(result.current)).toEqual(["2", "3", "1", "4"]);
    expect(result.current.sortStale).toBe(false);
  });

  it("sorts again on the current values with sortAgain", () => {
    const { result, setData } = renderFrozen();
    setData(withAge(ROWS, 2, 50));

    act(() => result.current.sortAgain());

    expect(order(result.current)).toEqual(["3", "1", "4", "2"]);
    expect(result.current.sortStale).toBe(false);
    expect(result.current.table.store.state.sorting).toEqual([
      { id: "age", desc: false },
    ]);
  });

  it("holds the new order after sortAgain until the next change", () => {
    const { result, setData } = renderFrozen();
    const edited = withAge(ROWS, 2, 50);
    setData(edited);
    act(() => result.current.sortAgain());

    setData(withAge(edited, 4, 5));

    expect(order(result.current)).toEqual(["3", "1", "4", "2"]);
    expect(result.current.sortStale).toBe(true);
  });

  it("takes the order again when the sort changes", () => {
    const { result, setData } = renderFrozen();
    setData(withAge(ROWS, 2, 50));

    act(() => result.current.table.setSorting([{ id: "age", desc: true }]));

    expect(order(result.current)).toEqual(["2", "4", "1", "3"]);
    expect(result.current.sortStale).toBe(false);
  });

  it("keeps holding when the same sort is set again", () => {
    const { result, setData } = renderFrozen();
    setData(withAge(ROWS, 2, 50));

    act(() => result.current.table.setSorting([{ id: "age", desc: false }]));

    expect(order(result.current)).toEqual(["2", "3", "1", "4"]);
    expect(result.current.sortStale).toBe(true);
  });

  it("places a new row after the row it follows in a fresh sort, then holds it", () => {
    const { result, setData } = renderFrozen();
    // Erik moves to the end, but stays first; the new row sorts after Maria.
    const edited = withAge(ROWS, 2, 50);
    const added = [
      ...edited,
      { id: 5, name: "Sofia", age: 25, city: "Malmö" },
    ];
    setData(added);
    expect(order(result.current)).toEqual(["2", "3", "5", "1", "4"]);

    setData(withAge(added, 5, 99));

    expect(order(result.current)).toEqual(["2", "3", "5", "1", "4"]);
  });

  it("places new rows that sort first ahead of every held row", () => {
    const { result, setData } = renderFrozen();

    setData([
      { id: 5, name: "Sofia", age: 1, city: "Malmö" },
      { id: 6, name: "Olle", age: 2, city: "Malmö" },
      ...ROWS,
    ]);

    expect(order(result.current)).toEqual(["5", "6", "2", "3", "1", "4"]);
  });

  it("drops a removed row and keeps the rest in place", () => {
    const { result, setData } = renderFrozen();
    const edited = withAge(ROWS, 2, 50);
    setData(edited);

    setData(edited.filter((row) => row.id !== 3));

    expect(order(result.current)).toEqual(["2", "1", "4"]);
  });

  it("puts a row back in its place when a filter lets it through again", () => {
    const { result, setData } = renderFrozen();
    setData(withAge(ROWS, 2, 50));

    act(() =>
      result.current.table.setColumnFilters([
        { id: "name", value: { operator: "notEquals", value: "Erik" } },
      ]),
    );
    expect(order(result.current)).toEqual(["3", "1", "4"]);

    act(() => result.current.table.setColumnFilters([]));

    expect(order(result.current)).toEqual(["2", "3", "1", "4"]);
  });

  it("holds a multi-column sort", () => {
    const { result, setData } = renderFrozen({
      initialState: {
        sorting: [
          { id: "city", desc: false },
          { id: "age", desc: false },
        ],
      },
    });
    expect(order(result.current)).toEqual(["2", "4", "3", "1"]);

    setData(withAge(ROWS, 4, 1));

    expect(order(result.current)).toEqual(["2", "4", "3", "1"]);
    expect(result.current.sortStale).toBe(true);

    act(() => result.current.sortAgain());

    expect(order(result.current)).toEqual(["4", "2", "3", "1"]);
  });

  describe("under grouping", () => {
    const groupOrder = (api: Api) =>
      api.table.getSortedRowModel().rows.map((row) => ({
        group: row.id,
        rows: row.subRows.map((sub) => sub.id),
      }));

    it("holds the order of the groups and of the rows inside them", () => {
      const { result, setData } = renderFrozen({
        initialState: {
          sorting: [{ id: "age", desc: false }],
          grouping: ["city"],
        },
      });
      // Göteborg sums to 50, Stockholm to 50 as well - the data order breaks
      // the tie - so make Stockholm the smaller group first.
      const start = withAge(ROWS, 1, 25);
      setData(start);
      act(() => result.current.sortAgain());
      const held = groupOrder(result.current);
      expect(held).toEqual([
        { group: "city:Stockholm", rows: ["3", "1"] },
        { group: "city:Göteborg", rows: ["2", "4"] },
      ]);

      // Raises Stockholm's sum past Göteborg's, and Maria past Anna.
      setData(withAge(start, 3, 90));

      expect(groupOrder(result.current)).toEqual(held);
      expect(result.current.sortStale).toBe(true);

      act(() => result.current.sortAgain());

      expect(groupOrder(result.current)).toEqual([
        { group: "city:Göteborg", rows: ["2", "4"] },
        { group: "city:Stockholm", rows: ["1", "3"] },
      ]);
    });

    it("takes the order again when the grouping changes", () => {
      const { result, setData } = renderFrozen();
      setData(withAge(ROWS, 2, 50));

      act(() => result.current.table.setGrouping(["city"]));
      act(() => result.current.table.setGrouping([]));

      expect(order(result.current)).toEqual(["3", "1", "4", "2"]);
      expect(result.current.sortStale).toBe(false);
    });
  });

  it("keeps a committed draft in place under editing.draft", async () => {
    const { result } = renderFrozen({
      editing: { mode: "cell", draft: true },
    });

    await act(async () => {
      await result.current.edit.setCellValue("2", "age", 50);
    });

    expect(order(result.current)).toEqual(["2", "3", "1", "4"]);
    expect(result.current.sortStale).toBe(true);
  });

  it("has no effect under manualSorting", () => {
    const { result, setData } = renderFrozen({ manualSorting: true });
    expect(result.current.features.frozenSort).toBe(false);

    setData(withAge(ROWS, 2, 50));

    // The server owns the order: the rows stay as `data` has them.
    expect(order(result.current)).toEqual(["1", "2", "3", "4"]);
    expect(result.current.sortStale).toBe(false);
  });
});

describe("the sort-again controls", () => {
  function renderFrozenUi(sortMode: "live" | "frozen" = "frozen") {
    const props: GridProps = {
      data: ROWS,
      columns,
      sortMode,
      initialState: { sorting: [{ id: "age", desc: false }] },
    };
    const rendered = renderWithMantine(<Grid {...props} />);
    const setData = (data: Array<TestRow>) =>
      rendered.rerender(<Grid {...props} data={data} />);
    return { ...rendered, setData };
  }

  it("shows a button on the sorted header once the order is stale", async () => {
    const user = userEvent.setup();
    const { setData } = renderFrozenUi();
    expect(queryPart("sort-again")).not.toBeInTheDocument();

    setData(withAge(ROWS, 2, 50));

    const button = part("sort-again", { columnId: "age" });
    expect(button).toHaveAccessibleName("Sort again");
    expect(renderedRowIds()).toEqual(["2", "3", "1", "4"]);

    await user.click(button);

    expect(renderedRowIds()).toEqual(["3", "1", "4", "2"]);
    expect(queryPart("sort-again")).not.toBeInTheDocument();
    // The click stays on the button: the sort did not advance to descending.
    expect(part("header", { columnId: "age" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("offers Sort again in the sorted column's menu", async () => {
    const user = userEvent.setup();
    const { setData } = renderFrozenUi();
    setData(withAge(ROWS, 2, 50));

    await openColumnMenu(user, "Age");
    await user.click(screen.getByRole("menuitem", { name: "Sort again" }));

    expect(renderedRowIds()).toEqual(["3", "1", "4", "2"]);
  });

  it("leaves Sort again out of an unsorted column's menu", async () => {
    const user = userEvent.setup();
    renderFrozenUi();

    await openColumnMenu(user, "Name");

    expect(
      screen.queryByRole("menuitem", { name: "Sort again" }),
    ).not.toBeInTheDocument();
  });

  it("has neither control under live mode", async () => {
    const user = userEvent.setup();
    const { setData } = renderFrozenUi("live");
    setData(withAge(ROWS, 2, 50));

    expect(queryPart("sort-again")).not.toBeInTheDocument();
    await openColumnMenu(user, "Age");
    expect(
      screen.queryByRole("menuitem", { name: "Sort again" }),
    ).not.toBeInTheDocument();
  });
});
