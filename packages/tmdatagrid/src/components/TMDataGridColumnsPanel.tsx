import {
  Box,
  type BoxProps,
  Button,
  Checkbox,
  ScrollArea,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useState } from "react";
import classes from "./TMDataGridColumnsPanel.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import {
  getColumnLabel,
  showColumnSearch,
  type TMDataGridColumnSearchable,
} from "../core/columnUtils";
import { useHideableColumns } from "./useHideableColumns";
import { SearchIcon } from "./icons";

/**
 * The "Manage columns" surface as plain controls, for a host that is not a
 * menu - a Popover, a Drawer, an inline layout. `TMDataGrid.Menu.Columns` is
 * the same chooser as menu items.
 */
/** Mantine's style props (`w={320}`, `p="sm"`) are set on the panel block. */
export type TMDataGridColumnsPanelProps = BoxProps & {
  /**
   * The search box over the list: `"auto"` (the default) from six hideable
   * columns, a number from that many, `true` always, `false` never.
   */
  searchable?: TMDataGridColumnSearchable;
};

export function TMDataGridColumnsPanel({
  className,
  searchable = "auto",
  ...others
}: TMDataGridColumnsPanelProps = {}) {
  const { labels, controlSize, resetSettings } = useTMDataGridContext();
  const [search, setSearch] = useState("");

  const { columns, columnVisibility, shownCount, setAllVisible } =
    useHideableColumns();

  const needle = search.trim().toLowerCase();
  const visibleInPanel = needle
    ? columns.filter((column) =>
        getColumnLabel(column).toLowerCase().includes(needle),
      )
    : columns;

  return (
    <Box
      data-dg-part="columns-panel"
      className={[classes.columnsPanel, className].filter(Boolean).join(" ")}
      {...others}
    >
      {showColumnSearch(searchable, columns.length) && (
        <div className={classes.columnsPanelSearch}>
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder={labels.columnsSearchPlaceholder}
            leftSection={<SearchIcon size={16} stroke={1.6} />}
            size={controlSize}
            data-dg-part="columns-search"
            data-autofocus
          />
        </div>
      )}

      <ScrollArea.Autosize mah={260} type="auto">
        <div className={classes.columnsPanelList}>
          {visibleInPanel.map((column) => (
            <Checkbox
              key={column.id}
              size={controlSize}
              label={getColumnLabel(column)}
              data-dg-part="columns-toggle"
              data-column-id={column.id}
              checked={columnVisibility[column.id] !== false}
              onChange={(event) =>
                column.toggleVisibility(event.currentTarget.checked)
              }
            />
          ))}
          {visibleInPanel.length === 0 && (
            <Text span size={controlSize} c="dimmed">
              {labels.columnsNoMatch(search)}
            </Text>
          )}
        </div>
      </ScrollArea.Autosize>

      <div className={classes.columnsPanelFooter}>
        <Checkbox
          size={controlSize}
          label={labels.columnsShowHideAll}
          data-dg-part="columns-toggle-all"
          checked={shownCount === columns.length}
          indeterminate={shownCount > 0 && shownCount < columns.length}
          onChange={(event) => setAllVisible(event.currentTarget.checked)}
        />
        {/* The whole layout, not only visibility: one reset with an honest
            scope, stated in the tooltip. `table.resetColumnVisibility()` would
            also be wrong under persistence - it resets to `initialState`,
            which the mount built *from* the persisted payload. */}
        <Tooltip label={labels.columnsResetHint} withArrow>
          <Button
            variant="subtle"
            size="compact-sm"
            data-dg-part="columns-reset"
            onClick={() => resetSettings()}
          >
            {labels.columnsReset}
          </Button>
        </Tooltip>
      </div>
    </Box>
  );
}
