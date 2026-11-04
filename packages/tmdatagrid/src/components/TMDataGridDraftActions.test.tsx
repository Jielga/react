import { act, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  part,
  renderWithMantine,
  testColumns,
  testRows,
  type TestRow,
} from "../../test/gridHarness";
import {
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridApi,
  type UseTMDataGridOptions,
} from "../index";

function DraftGrid({
  onReady,
  ...options
}: Partial<UseTMDataGridOptions<TestRow>> & {
  onReady: (api: TMDataGridApi<TestRow>) => void;
}) {
  const grid = useTMDataGrid<TestRow>({
    data: testRows,
    columns: testColumns,
    getRowId: (row) => String(row.id),
    editing: { mode: "row", draft: true, onSaveDrafts: vi.fn() },
    ...options,
  } as UseTMDataGridOptions<TestRow>);
  onReady(grid);
  return (
    <TMDataGrid {...grid}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.DraftActions />
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<TestRow> />
      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}

function renderDraftGrid(options: Partial<UseTMDataGridOptions<TestRow>> = {}) {
  let api!: TMDataGridApi<TestRow>;
  renderWithMantine(<DraftGrid {...options} onReady={(grid) => (api = grid)} />);
  return api;
}

describe("TMDataGrid.DraftActions", () => {
  it("Save shows its loading state while onSaveDrafts is pending", async () => {
    let resolveSave: () => void = () => {};
    const onSaveDrafts = vi.fn(
      () => new Promise<void>((resolve) => (resolveSave = resolve)),
    );
    const api = renderDraftGrid({
      editing: { mode: "row", draft: true, onSaveDrafts },
    });

    act(() => {
      api.edit.begin({ rowId: "1", columnId: "name" });
    });
    act(() => {
      api.edit.getForm("1")?.setFieldValue("name", "Anna B");
    });
    await act(() => api.edit.commit("1"));

    act(() => {
      fireEvent.click(part("save-all"));
    });
    await vi.waitFor(() => expect(onSaveDrafts).toHaveBeenCalled());
    // Mantine's Button marks its loading state with `data-loading`.
    expect(part("save-all").hasAttribute("data-loading")).toBe(true);

    await act(async () => {
      resolveSave();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(part("save-all").hasAttribute("data-loading")).toBe(false);
  });
});
