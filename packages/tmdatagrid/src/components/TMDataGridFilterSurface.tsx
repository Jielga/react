import { ActionIcon, ScrollArea, Text } from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef } from "react";
import classes from "./TMDataGridFilterSurface.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { isElement } from "../core/dom";
import { CloseIcon } from "./icons";
import { TMDataGridFilterPanel } from "./TMDataGridFilterPanel";

/**
 * The title row both automatic surfaces wear: the "Filters" heading and the
 * close button that puts the surface away without touching the filters.
 */
function FilterSurfaceHeader() {
  const { ui, labels, controlSize } = useTMDataGridContext();
  return (
    <div className={classes.surfaceHeader}>
      <Text span size={controlSize} fw={600}>
        {labels.filters}
      </Text>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label={labels.closeFilters}
        data-dg-part="filter-panel-close"
        onClick={ui.actions.closeFilterPanel}
      >
        <CloseIcon size={16} stroke={1.6} />
      </ActionIcon>
    </div>
  );
}

/**
 * Closes the popup once its last filter row goes, covering both ways that
 * happens - removed by hand, or "Clear all" - without either of them having
 * to know which surface is showing.
 *
 * On the transition to zero, not on being zero: a popup asked to start open
 * with no filters yet would otherwise close itself before its first paint.
 */
function useCloseWhenEmptied(opened: boolean) {
  const { table, ui } = useTMDataGridContext();
  const filterCount = useSelector(
    table.store,
    (state) => state.columnFilters.length,
  );
  const previousCount = useRef(filterCount);
  useEffect(() => {
    const emptied = previousCount.current > 0 && filterCount === 0;
    previousCount.current = filterCount;
    if (opened && emptied) ui.actions.closeFilterPanel();
  }, [opened, filterCount, ui]);
}

/**
 * `filters.surface: "popup"` - the panel floating over the first body rows,
 * anchored under the header. The default surface, and the only one before
 * `filters` existed.
 *
 * Everything that makes it floating lives here rather than in the panel: a
 * pointerdown outside closes it, Escape closes it, and emptying it closes it.
 *
 * @internal Rendered by `TMDataGrid.Table`.
 */
export function TMDataGridFilterPopup() {
  const { ui, labels } = useTMDataGridContext();
  const opened = useSelector(ui, (state) => state.filterPanelOpen);
  const popupRef = useRef<HTMLDivElement>(null);
  useCloseWhenEmptied(opened);

  // Clicking away hides the popup, the way any floating surface behaves. On
  // pointerdown rather than click, so a press that starts outside dismisses it
  // even when the pointer is released somewhere else.
  useEffect(() => {
    if (!opened) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!isElement(target)) return;
      if (popupRef.current?.contains(target)) return;
      // The toolbar button toggles the popup itself. Closing from here first
      // would leave its click reopening what the user meant to close.
      if (target.closest('[data-dg-part="filter-button"]')) return;
      // A portalled overlay - a header filter's dropdown, a custom control's
      // portalled picker - is outside the popup in the DOM but not in meaning:
      // a press in one is a press in a control, not a click away. Mantine
      // stamps `data-portal` on every portal node it creates.
      if (target.closest("[data-portal]")) return;
      ui.actions.closeFilterPanel();
    };

    // The popup's own document, not the global one: rendered through a
    // portal into a window opened with `window.open`, the global `document`
    // is the opener's and never sees a press in the grid's window.
    const doc = popupRef.current?.ownerDocument ?? document;
    doc.addEventListener("pointerdown", handlePointerDown);
    return () => doc.removeEventListener("pointerdown", handlePointerDown);
  }, [opened, ui]);

  if (!opened) return null;

  return (
    <div
      ref={popupRef}
      data-dg-part="filter-popup"
      className={classes.filterPopup}
      aria-label={labels.filters}
      // Escape is what closes a floating surface, and every control that can
      // hold focus in here sits inside this element.
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        ui.actions.closeFilterPanel();
      }}
    >
      <FilterSurfaceHeader />
      <TMDataGridFilterPanel />
    </div>
  );
}

/**
 * `filters.surface: "sidebar"` - the panel beside the table, inside the grid
 * frame and under the toolbar, taking width from the rows rather than covering
 * them.
 *
 * Not a floating surface: a click in the table is a click on the rows the
 * sidebar is filtering, so nothing about it dismisses the panel, and clearing
 * the filters leaves it standing with its "Add filter" button - a place to
 * work from rather than a thing that appears and goes away. Escape closes it,
 * because a keyboard user inside it needs a way back out to the grid.
 *
 * @internal Rendered by `TMDataGrid.Table`.
 */
export function TMDataGridFilterSidebar() {
  const { ui, filters, labels } = useTMDataGridContext();
  const opened = useSelector(ui, (state) => state.filterPanelOpen);

  if (!opened) return null;

  return (
    <div
      data-dg-part="filter-sidebar"
      data-side={filters.sidebarSide}
      className={classes.filterSidebar}
      style={{ width: filters.sidebarWidth }}
      aria-label={labels.filters}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        ui.actions.closeFilterPanel();
      }}
    >
      <FilterSurfaceHeader />
      {/* The panel's rows are as tall as the filters put in them, and the
          sidebar is as tall as the table beside it - so the overflow is the
          sidebar's to scroll, not the page's. */}
      <ScrollArea type="auto" className={classes.filterSidebarBody}>
        {/* Stacked, not side by side: a filter row wants about 550px laid out
            in a line, and the sidebar is 280. */}
        <TMDataGridFilterPanel layout="stacked" />
      </ScrollArea>
    </div>
  );
}
