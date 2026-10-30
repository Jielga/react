import {
  ActionIcon,
  Checkbox,
  Menu,
  ScrollArea,
  Tooltip,
  type MenuProps,
} from "@mantine/core";
import {
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTMDataGridContext } from "../TMDataGridContext";
import {
  getColumnLabel,
  showColumnSearch,
  type TMDataGridColumnSearchable,
} from "../core/columnUtils";
import type {
  TMDataGridExportColumns,
  TMDataGridExportOptions,
} from "../core/export";
import { useTMDataGridExport } from "../useTMDataGridExport";
import { useHideableColumns } from "./useHideableColumns";
import { BurgerIcon, DownloadIcon, RestoreIcon } from "./icons";
import { TMDataGridMenuViews, TMDataGridMenuViewsSub } from "./TMDataGridViews";

/**
 * The column toggles are `Menu.Item`s with a `Checkbox.Indicator` in front,
 * not `Menu.CheckboxItem`: that one draws its tick only when checked, so an
 * unchecked column next to the consumer's own items reads as a plain action.
 * A box that is visibly empty says "off, click to turn on".
 *
 * `Menu.Item` writes `role="menuitem"` after the props it is given, so the
 * checkbox role goes on through `renderRoot`, the polymorphic escape hatch.
 */
const asCheckboxItem = (props: ComponentPropsWithoutRef<"button">) => (
  <button {...props} role="menuitemcheckbox" />
);

export type TMDataGridMenuProps = Omit<MenuProps, "children"> & {
  /** The dropdown's content: Mantine `Menu.Item`s and the `TMDataGrid.Menu.*` items. */
  children: ReactNode;
  /** Replaces the burger icon on the trigger. */
  icon?: ReactNode;
  /** Tooltip and `aria-label` of the trigger. Default `labels.menuButton`. */
  label?: string;
};

export type TMDataGridMenuColumnsProps = {
  /**
   * Renders a `Menu.Search` above the toggles: `"auto"` (the default) from
   * six hideable columns, `true` always, `false` never. Use `false` inside a
   * `Menu.Sub`.
   */
  searchable?: TMDataGridColumnSearchable;
  /**
   * Adds a Views item under Reset layout that opens the saved views in a
   * submenu, when the grid's `views` option is set. Default `true`; `false`
   * for a grid that shows them in a `TMDataGrid.ViewsMenu` or a menu of your
   * own instead.
   */
  views?: boolean;
};

// Documented on the `TMDataGridMenu` export below.
function TMDataGridMenuRoot({
  children,
  icon,
  label,
  ...menuProps
}: TMDataGridMenuProps) {
  const { labels, controlSize } = useTMDataGridContext();
  const triggerLabel = label ?? labels.menuButton;

  return (
    <Menu
      position="bottom-end"
      shadow="md"
      width={260}
      withinPortal
      {...menuProps}
    >
      {/* The Tooltip goes outside the Target. Inside it, the Target's
          `aria-expanded` / `aria-controls` reach the Tooltip, which hands
          unknown props to its own floating label, not to the button. */}
      <Tooltip label={triggerLabel} openDelay={400}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={controlSize}
            aria-label={triggerLabel}
            data-dg-part="menu-button"
          >
            {icon ?? <BurgerIcon size={18} stroke={1.6} />}
          </ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown>{children}</Menu.Dropdown>
    </Menu>
  );
}

/**
 * The whole column chooser as menu items: a search box, one checkbox item per
 * hideable column, show/hide all, Reset layout, and a Views submenu when the
 * grid has saved views. Renders nothing when no column can be hidden.
 *
 * `searchable` is only for a block at the top level of a dropdown.
 * `Menu.Search` registers on the root menu context (`hasSearch`), which
 * switches off type-ahead and the arrow-key handling of every dropdown of that
 * menu, so a search inside a `Menu.Sub` breaks the parent menu's keyboard
 * behaviour.
 */
export function TMDataGridMenuColumns({
  searchable = "auto",
  views = true,
}: TMDataGridMenuColumnsProps) {
  const { labels, controlSize, views: savedViews } = useTMDataGridContext();
  const { columns } = useHideableColumns();
  const [search, setSearch] = useState("");

  if (columns.length === 0) return null;

  const withSearch = showColumnSearch(searchable, columns.length);

  // `Menu.Search` walks every item of the dropdown from the top, so with items
  // placed above this block ArrowDown from the search lands on the first of
  // those - and Enter runs it. When something precedes the block, ArrowDown
  // moves focus to the first listed column instead; when nothing does,
  // Mantine's own walk already starts there and is left alone.
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowDown") return;
    const dropdown = event.currentTarget.closest('[role="menu"]');
    const first = dropdown?.querySelector('[role^="menuitem"]');
    const firstToggle = dropdown?.querySelector<HTMLElement>(
      '[data-dg-part="columns-toggle"]',
    );
    if (!first || !firstToggle || first === firstToggle) return;
    event.preventDefault();
    firstToggle.focus();
  };

  return (
    <>
      {withSearch && (
        <Menu.Search
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={labels.columnsSearchPlaceholder}
          size={controlSize}
          data-dg-part="columns-search"
        />
      )}
      <TMDataGridMenuColumnToggles search={search} />
      <Menu.Divider />
      <TMDataGridMenuShowHideAll />
      <TMDataGridMenuResetLayout />
      {views && savedViews.enabled && (
        <>
          <Menu.Divider />
          <TMDataGridMenuViewsSub />
        </>
      )}
    </>
  );
}

/**
 * One checkbox item per hideable column, narrowed to `search` when one is
 * given. Renders nothing when no column can be hidden.
 */
export function TMDataGridMenuColumnToggles({ search }: { search?: string }) {
  const { labels, controlSize } = useTMDataGridContext();
  const { columns, columnVisibility } = useHideableColumns();

  if (columns.length === 0) return null;

  const needle = (search ?? "").trim().toLowerCase();
  const listed = needle
    ? columns.filter((column) =>
        getColumnLabel(column).toLowerCase().includes(needle),
      )
    : columns;

  return (
    <ScrollArea.Autosize mah={260} type="auto">
      {listed.length === 0 ? (
        <Menu.Label>{labels.columnsNoMatch(search ?? "")}</Menu.Label>
      ) : (
        listed.map((column) => {
          const visible = columnVisibility[column.id] !== false;
          return (
            <Menu.Item
              key={column.id}
              renderRoot={asCheckboxItem}
              aria-checked={visible}
              closeMenuOnClick={false}
              leftSection={
                <Checkbox.Indicator checked={visible} size={controlSize} />
              }
              onClick={() => column.toggleVisibility(!visible)}
              data-dg-part="columns-toggle"
              data-column-id={column.id}
            >
              {getColumnLabel(column)}
            </Menu.Item>
          );
        })
      )}
    </ScrollArea.Autosize>
  );
}

/**
 * Shows or hides every listed column at once. Renders nothing when no column
 * can be hidden.
 */
export function TMDataGridMenuShowHideAll() {
  const { labels, controlSize } = useTMDataGridContext();
  const { columns, shownCount, setAllVisible } = useHideableColumns();

  if (columns.length === 0) return null;

  const all = shownCount === columns.length;
  // Some shown but not all: an indeterminate box, and a click shows all - the
  // same reading as the panel's checkbox.
  const some = shownCount > 0 && !all;

  return (
    <Menu.Item
      renderRoot={asCheckboxItem}
      aria-checked={some ? "mixed" : all}
      closeMenuOnClick={false}
      leftSection={
        <Checkbox.Indicator
          checked={all}
          indeterminate={some}
          size={controlSize}
        />
      }
      onClick={() => setAllVisible(!all)}
      data-dg-part="columns-toggle-all"
    >
      {labels.columnsShowHideAll}
    </Menu.Item>
  );
}

/**
 * Resets the whole layout, not only visibility: order, widths, pinning and
 * grouping go back too. Not `table.resetColumnVisibility()`, which resets to
 * `initialState` - and under persistence the mount built that *from* the
 * persisted payload.
 */
export function TMDataGridMenuResetLayout() {
  const { labels, resetSettings } = useTMDataGridContext();

  return (
    <Menu.Item
      leftSection={<RestoreIcon size={16} stroke={1.6} />}
      onClick={() => resetSettings()}
      data-dg-part="columns-reset"
    >
      {labels.columnsReset}
    </Menu.Item>
  );
}

/** Per-item overrides of the grid's `exportOptions`, and the item's text. */
export type TMDataGridMenuExportProps = Omit<
  TMDataGridExportOptions,
  "columns"
> & {
  /**
   * Which columns the item writes: `"visible"`, `"all"`, a list of ids, or
   * `"custom"` - a picker listing every exportable column with the visible
   * ones ticked, and the download on its Export button. Defaults to the grid's
   * `exportOptions.columns`.
   */
  columns?: TMDataGridExportColumns | "custom";
  /**
   * The item's text. Defaults to `labels.exportAll`, or for the selected-rows
   * item `labels.exportSelected(count)`. Two items offering two formats need
   * two texts, which is what this is for.
   */
  label?: ReactNode;
};

/** The item's props as export options, with `"custom"` set aside for the picker. */
function splitExportProps({ label, columns, ...rest }: TMDataGridMenuExportProps) {
  const custom = columns === "custom";
  const options: TMDataGridExportOptions = custom
    ? rest
    : { ...rest, columns };
  return { label, custom, options };
}

/**
 * Downloads every filtered and sorted row, all pages, in the grid's export
 * format. Props override `exportOptions` for this item alone, which is how one
 * menu offers two formats.
 */
export function TMDataGridMenuExport(props: TMDataGridMenuExportProps) {
  const { label, custom, options } = splitExportProps(props);
  const { ui, labels } = useTMDataGridContext();
  const { exportAll } = useTMDataGridExport(options);

  return (
    <Menu.Item
      leftSection={<DownloadIcon size={16} stroke={1.6} />}
      onClick={() => {
        if (custom) ui.actions.openExportPicker({ rows: "all", options });
        else void exportAll();
      }}
      data-dg-part="menu-export"
    >
      {label ?? labels.exportAll}
    </Menu.Item>
  );
}

/**
 * Downloads the selected rows, in grid order. Disabled while nothing is
 * selected; renders nothing when row selection is off, since then there is
 * never anything for it to do.
 */
export function TMDataGridMenuExportSelected(props: TMDataGridMenuExportProps) {
  const { label, custom, options } = splitExportProps(props);
  const { ui, labels } = useTMDataGridContext();
  const { exportSelected, selectedCount, canExportSelected } =
    useTMDataGridExport(options);

  if (!canExportSelected) return null;

  return (
    <Menu.Item
      leftSection={<DownloadIcon size={16} stroke={1.6} />}
      disabled={selectedCount === 0}
      onClick={() => {
        if (custom) ui.actions.openExportPicker({ rows: "selected", options });
        else void exportSelected();
      }}
      data-dg-part="menu-export-selected"
    >
      {label ?? labels.exportSelected(selectedCount)}
    </Menu.Item>
  );
}

/**
 * Burger menu in the grid's top-right corner, holding whatever the consumer
 * puts in it. Every Mantine `Menu` prop is accepted and wins over the defaults
 * below.
 *
 * It always renders. It cannot know whether its children render anything, so
 * a menu holding only `TMDataGrid.Menu.Columns` on a grid where nothing can be
 * hidden still shows its button over an empty dropdown - leave the menu out of
 * the toolbar in that case.
 */
export const TMDataGridMenu = Object.assign(TMDataGridMenuRoot, {
  Columns: TMDataGridMenuColumns,
  ColumnToggles: TMDataGridMenuColumnToggles,
  ShowHideAll: TMDataGridMenuShowHideAll,
  ResetLayout: TMDataGridMenuResetLayout,
  Views: TMDataGridMenuViews,
  Export: TMDataGridMenuExport,
  ExportSelected: TMDataGridMenuExportSelected,
});
