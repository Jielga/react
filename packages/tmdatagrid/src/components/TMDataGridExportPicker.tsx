import {
  Button,
  Checkbox,
  Group,
  type MantineSize,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import classes from "./TMDataGridExportPicker.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import { getColumnLabel, showColumnSearch } from "../core/columnUtils";
import {
  countSelectedExportRows,
  getExportableColumns,
  resolveExportOptions,
  type TMDataGridExportPickerRequest,
} from "../core/export";
import type { TMDataGridSize } from "../core/sizes";
import { useTMDataGridExport } from "../useTMDataGridExport";
import { SearchIcon } from "./icons";

/**
 * The column picker behind `columns="custom"` on the export menu items: a
 * list of every exportable column, the visible ones ticked and the hidden
 * ones marked, a select-all row over the list, a search box once the list is
 * long, and an Export button that downloads the ticked ones.
 *
 * Mounted once by the root and driven by `ui.state.exportPicker`, because the
 * menu item that opens it unmounts with the dropdown on the click. The form
 * inside is keyed on the request, so each opening starts from the visible
 * columns again rather than from the last choice.
 *
 * Never opens under `enableDownload: false`, where its Export button would
 * have nothing to do.
 */
export function TMDataGridExportPicker() {
  const { ui, labels, size, controlSize, exportOptions, features } =
    useTMDataGridContext();
  const opened = useSelector(ui, (state) => state.exportPicker);
  const request = features.download ? opened : null;
  const format = request
    ? resolveExportOptions(exportOptions, request.options).format
    : null;

  return (
    <Modal
      opened={request !== null}
      onClose={() => ui.actions.closeExportPicker()}
      title={format && labels.exportPickerTitle(format.extension.toUpperCase())}
      size={MODAL_WIDTH[size]}
      closeButtonProps={{ size: CLOSE_BUTTON_SIZE[controlSize] }}
      classNames={{ title: classes.title }}
      styles={{
        title: { fontSize: `var(--mantine-font-size-${controlSize})` },
      }}
    >
      {request && <PickerForm request={request} />}
    </Modal>
  );
}

/** Dialog width per grid size: the same three steps as the controls. */
const MODAL_WIDTH: Record<TMDataGridSize, MantineSize> = {
  xs: "xs",
  sm: "xs",
  md: "sm",
  lg: "sm",
  xl: "md",
};

/** The close button one step above the controls, which is Mantine's own ratio. */
const CLOSE_BUTTON_SIZE: Record<string, MantineSize> = {
  xs: "sm",
  sm: "md",
  md: "lg",
};

function PickerForm({ request }: { request: TMDataGridExportPickerRequest }) {
  const { table, ui, labels, controlSize } = useTMDataGridContext();
  const { exportAll, exportSelected } = useTMDataGridExport(request.options);
  const columns = getExportableColumns(table);
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        columns
          .filter((column) => column.getIsVisible())
          .map((column) => column.id),
      ),
  );

  const searchable = showColumnSearch("auto", columns.length);
  const needle = search.trim().toLowerCase();
  const listed = needle
    ? columns.filter((column) =>
        getColumnLabel(column).toLowerCase().includes(needle),
      )
    : columns;

  const listedChecked = listed.filter((column) => checked.has(column.id));
  const allListed = listed.length > 0 && listedChecked.length === listed.length;
  const someListed = listedChecked.length > 0 && !allListed;

  const toggle = (columnId: string, on: boolean) =>
    setChecked((previous) => {
      const next = new Set(previous);
      if (on) next.add(columnId);
      else next.delete(columnId);
      return next;
    });

  const toggleListed = (on: boolean) =>
    setChecked((previous) => {
      const next = new Set(previous);
      for (const column of listed) {
        if (on) next.add(column.id);
        else next.delete(column.id);
      }
      return next;
    });

  const confirm = async () => {
    const ids = columns
      .filter((column) => checked.has(column.id))
      .map((column) => column.id);
    const run = request.rows === "selected" ? exportSelected : exportAll;
    await run({ columns: ids });
    ui.actions.closeExportPicker();
  };

  const hint = labels.exportPickerHint(
    request.rows === "selected" ? countSelectedExportRows(table) : null,
  );

  return (
    <Stack gap="sm" data-dg-part="export-picker">
      <Text size={controlSize} c="dimmed" data-dg-part="export-picker-hint">
        {hint}
      </Text>

      {searchable && (
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={labels.columnsSearchPlaceholder}
          leftSection={<SearchIcon size={16} stroke={1.6} />}
          size={controlSize}
          data-dg-part="export-picker-search"
          data-autofocus
        />
      )}

      <div className={classes.list}>
        <div className={classes.listHeader}>
          <Checkbox
            size={controlSize}
            label={labels.exportPickerSelectAll}
            checked={allListed}
            indeterminate={someListed}
            onChange={(event) => toggleListed(event.currentTarget.checked)}
            classNames={{ label: classes.headerLabel }}
            data-dg-part="export-column-all"
          />
          <Text size="xs" c="dimmed" data-dg-part="export-picker-count">
            {labels.exportPickerCount(checked.size, columns.length)}
          </Text>
        </div>

        <ScrollArea.Autosize mah="50vh" type="auto">
          <div className={classes.rows}>
            {listed.map((column) => (
              <Checkbox
                key={column.id}
                size={controlSize}
                label={
                  <>
                    <span className={classes.rowText}>
                      {getColumnLabel(column)}
                    </span>
                    {!column.getIsVisible() && (
                      <span className={classes.rowHint}>
                        {labels.exportPickerHidden}
                      </span>
                    )}
                  </>
                }
                checked={checked.has(column.id)}
                onChange={(event) =>
                  toggle(column.id, event.currentTarget.checked)
                }
                classNames={{
                  root: classes.row,
                  body: classes.rowBody,
                  labelWrapper: classes.rowLabelWrapper,
                  label: classes.rowLabel,
                }}
                data-dg-part="export-column"
                data-column-id={column.id}
              />
            ))}
            {listed.length === 0 && (
              <Text size={controlSize} c="dimmed" className={classes.empty}>
                {labels.columnsNoMatch(search)}
              </Text>
            )}
          </div>
        </ScrollArea.Autosize>
      </div>

      <Group justify="flex-end" gap="xs">
        <Button
          variant="default"
          size={controlSize}
          onClick={() => ui.actions.closeExportPicker()}
          data-dg-part="export-picker-cancel"
        >
          {labels.exportPickerCancel}
        </Button>
        <Button
          size={controlSize}
          disabled={checked.size === 0}
          onClick={() => void confirm()}
          data-dg-part="export-picker-confirm"
        >
          {labels.exportPickerConfirm}
        </Button>
      </Group>
    </Stack>
  );
}
