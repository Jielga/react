import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MantineWrapper,
  part,
  queryPart,
  renderGrid,
  type TestRow,
} from "../../test/gridHarness";
import { TMDataGrid } from "./TMDataGrid";
import { createTMDataGridColumnHelper } from "../useTMDataGrid";

/**
 * jsdom lays nothing out, so every header measures 0 there. The tests hand the
 * header cells a width of their own - the width an `fr` track would have
 * resolved to in a browser, which is deliberately not the declared `size` the
 * columns fall back to (150).
 */
function stubHeaderWidths(widths: Record<string, number>) {
  vi.spyOn(
    window.Element.prototype,
    "getBoundingClientRect",
  ).mockImplementation(function (this: Element) {
    const columnId = this.getAttribute("data-column-id");
    const width =
      this.getAttribute("role") === "columnheader" && columnId
        ? (widths[columnId] ?? 0)
        : 0;
    return { ...new DOMRect(0, 0, width, 0), width } as DOMRect;
  });
}

function renderTable(grid: ReturnType<typeof renderGrid>["result"]) {
  return render(
    <TMDataGrid {...grid.current}>
      <TMDataGrid.Table<TestRow> />
    </TMDataGrid>,
    { wrapper: MantineWrapper },
  );
}

/** The resize handle of a resizable column. */
function separator(container: HTMLElement, columnId: string) {
  return part("header-resize", { columnId }, container);
}

/** The one element the whole layout hangs off. */
function gridElement(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>(
    '[role="table"], [role="grid"]',
  );
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

describe("column resizing", () => {
  it("marks the separator as a resize handle only where the column resizes", () => {
    const { result: resizable } = renderGrid();
    const { container: resizableContainer } = renderTable(resizable);
    expect(
      queryPart("header-resize", { columnId: "name" }, resizableContainer),
    ).not.toBeNull();

    const { result: fixed } = renderGrid({ enableColumnResizing: false });
    const { container: fixedContainer } = renderTable(fixed);
    expect(
      queryPart("header-resize", { columnId: "name" }, fixedContainer),
    ).toBeNull();
  });

  it("starts the drag from the width the column is rendered with", () => {
    stubHeaderWidths({ name: 260 });
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const { table } = result.current;

    fireEvent.mouseDown(separator(container, "name"), { clientX: 260 });
    // The rendered width, not the declared 150: a column that jumps on
    // mousedown drops the divider out from under the pointer.
    expect(table.store.state.columnSizing.name).toBe(260);

    fireEvent.mouseUp(document, { clientX: 260 });
    expect(table.store.state.columnResizing.isResizingColumn).toBe(false);
  });

  it("paints the drag on the grid's own tracks, and commits it on release", () => {
    stubHeaderWidths({ name: 260 });
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const { table } = result.current;
    const grid = gridElement(container);

    fireEvent.mouseDown(separator(container, "name"), { clientX: 260 });
    fireEvent.mouseMove(document, { clientX: 280 });

    // The pointer's width is on the element, and nowhere in state yet: state
    // published per pointer move is what makes the drag choppy.
    expect(grid.style.gridTemplateColumns).toContain("280px");
    expect(table.store.state.columnSizing.name).toBe(260);

    fireEvent.mouseUp(document, { clientX: 280 });
    expect(table.store.state.columnSizing.name).toBe(280);
  });

  it("leaves the untouched columns fluid", () => {
    stubHeaderWidths({ name: 260, city: 200 });
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const { table } = result.current;

    fireEvent.mouseDown(separator(container, "name"), { clientX: 260 });
    fireEvent.mouseUp(document, { clientX: 260 });

    expect(Object.keys(table.store.state.columnSizing)).toEqual(["name"]);
  });

  it("stops every header from starting a move while a column resizes", () => {
    stubHeaderWidths({ name: 260 });
    const { result } = renderGrid();
    const { container } = renderTable(result);
    const headers = () =>
      Array.from(container.querySelectorAll('[role="columnheader"]'));

    fireEvent.mouseDown(separator(container, "name"), { clientX: 260 });
    // Not only the resized one: the divider moves across its neighbours, and
    // a native drag started there swallows the mouseup the resize ends on.
    expect(
      headers().filter((header) => header.getAttribute("draggable") === "true"),
    ).toHaveLength(0);

    fireEvent.mouseUp(document, { clientX: 260 });
    expect(
      headers().filter((header) => header.getAttribute("draggable") === "true"),
    ).not.toHaveLength(0);
  });

  it("listens for the drag on the grid's own document, not the global one", () => {
    stubHeaderWidths({ name: 260 });
    const { result } = renderGrid();
    const { table } = result.current;
    // A grid rendered through a portal into a window opened with
    // `window.open` lives in that window's document. The opener's global
    // `document` never sees the pointer move there.
    const popupDocument = document.implementation.createHTMLDocument("popup");
    const { container } = render(
      <TMDataGrid {...result.current}>
        <TMDataGrid.Table<TestRow> />
      </TMDataGrid>,
      { wrapper: MantineWrapper, container: popupDocument.body },
    );

    // Dispatched by hand: `fireEvent` refuses a document with no window, and
    // one made by `createHTMLDocument` has none.
    const mouse = (target: EventTarget, type: string, clientX: number) =>
      act(() => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX }));
      });

    mouse(separator(container, "name"), "mousedown", 260);
    mouse(document, "mousemove", 300);
    mouse(document, "mouseup", 300);
    // The opener's document heard nothing: the drag is still on.
    expect(table.store.state.columnResizing.isResizingColumn).toBe("name");
    expect(table.store.state.columnSizing.name).toBe(260);

    mouse(popupDocument, "mousemove", 280);
    mouse(popupDocument, "mouseup", 280);
    expect(table.store.state.columnSizing.name).toBe(280);
    expect(table.store.state.columnResizing.isResizingColumn).toBe(false);
  });
});

describe("column minSize", () => {
  const helper = createTMDataGridColumnHelper<TestRow>();
  /** Built once: `useTMDataGrid` memoizes on the columns reference. */
  const columns = helper.columns([helper.accessor("name", { header: "Name" })]);

  it("floors a column with no minSize at 80", () => {
    const { result } = renderGrid({ columns });
    const { table } = result.current;

    act(() => table.setColumnSizing({ name: 10 }));

    expect(table.getColumn("name")?.getSize()).toBe(80);
  });

  it("lets the consumer's defaultColumn.minSize win", () => {
    const { result } = renderGrid({ columns, defaultColumn: { minSize: 40 } });
    const { table } = result.current;

    act(() => table.setColumnSizing({ name: 10 }));

    expect(table.getColumn("name")?.getSize()).toBe(40);
  });
});
