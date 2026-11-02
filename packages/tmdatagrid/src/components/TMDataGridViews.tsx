import {
  ActionIcon,
  Button,
  Menu,
  Select,
  TextInput,
  Tooltip,
  type ComboboxData,
  type MenuProps,
} from "@mantine/core";
import {
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import classes from "./TMDataGridViews.module.css";
import { useTMDataGridContext } from "../TMDataGridContext";
import type { TMDataGridViewEntry, TMDataGridViewsApi } from "../core/views";
import {
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  PlusIcon,
  RestoreIcon,
  SaveIcon,
  TrashIcon,
  ViewsIcon,
} from "./icons";
import { TMDataGridMenuResetLayout } from "./TMDataGridMenu";

/** The width of every dropdown that lists the views. */
const VIEWS_DROPDOWN_WIDTH = 280;

/** `Menu.Item` writes `role="menuitem"` after its props; see `asCheckboxItem`. */
const asRadioItem = (props: ComponentPropsWithoutRef<"button">) => (
  <button {...props} role="menuitemradio" />
);

/**
 * Keeps the keys a menu acts on inside the name field. Mantine's dropdown
 * moves focus to its first item on ArrowUp / ArrowDown from anywhere in it,
 * which would take the caret out of the field. Escape still closes the menu.
 */
const keepKeysInField = (event: KeyboardEvent<HTMLInputElement>) => {
  if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    event.stopPropagation();
  }
};

/** The selected view, when it is one of the user's own and they may change it. */
function ownActiveView(views: TMDataGridViewsApi): TMDataGridViewEntry | null {
  return views.allowUserViews && views.active?.source === "user"
    ? views.active
    : null;
}

/**
 * The name field and its submit. The submit is disabled while the name is
 * empty or taken, and the reason shows under the field as the user types.
 *
 * In a menu the submit is an icon inside the field, so the form takes one
 * row; in the panel it is a button beside it.
 */
function SaveViewForm({
  variant,
  className,
  onSaved,
}: {
  variant: "menu" | "panel";
  className?: string;
  onSaved?: () => void;
}) {
  const { views, labels, controlSize } = useTMDataGridContext();
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);

  const nameError = views.validateName(name);
  const error = failed
    ? labels.viewsSaveFailed
    : nameError === "duplicate"
      ? labels.viewsNameDuplicate
      : nameError === "empty" && submitted
        ? labels.viewsNameEmpty
        : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (nameError !== null) return;
    const result = await views.saveAs(name);
    if (result.ok) {
      setName("");
      setSubmitted(false);
      onSaved?.();
    } else {
      setFailed(result.error === "store");
    }
  };

  const inMenu = variant === "menu";
  return (
    <form
      className={[classes.saveForm, className].filter(Boolean).join(" ")}
      onSubmit={(event) => void submit(event)}
      data-dg-part="views-save-form"
    >
      <TextInput
        size={inMenu ? "xs" : controlSize}
        aria-label={labels.viewsName}
        placeholder={labels.viewsName}
        value={name}
        onChange={(event) => {
          setName(event.currentTarget.value);
          setFailed(false);
        }}
        onKeyDown={keepKeysInField}
        error={error}
        data-dg-part="views-name"
        // In the menu the field replaces the item that was clicked.
        autoFocus={inMenu}
        rightSectionPointerEvents="all"
        rightSection={
          inMenu ? (
            <ActionIcon
              type="submit"
              size="sm"
              aria-label={labels.viewsSave}
              disabled={nameError !== null}
              data-dg-part="views-save"
            >
              <CheckIcon size={14} stroke={2.2} />
            </ActionIcon>
          ) : undefined
        }
      />
      {!inMenu && (
        <Button
          type="submit"
          size={controlSize}
          disabled={nameError !== null}
          data-dg-part="views-save"
        >
          {labels.viewsSaveAs}
        </Button>
      )}
    </form>
  );
}

/**
 * The view list and Save current layout as new view, shared by
 * `TMDataGrid.Menu.Views` and the Views submenu of `TMDataGrid.Menu.Columns`.
 * `naming` is lifted so the submenu can stay open while the user types.
 */
function ViewsMenuItems({
  naming,
  setNaming,
}: {
  naming: boolean;
  setNaming: (naming: boolean) => void;
}) {
  const { views, labels } = useTMDataGridContext();
  if (!views.enabled) return null;

  const presets = views.list.filter((entry) => entry.source === "preset");
  const mine = views.list.filter((entry) => entry.source === "user");

  const item = (entry: TMDataGridViewEntry) => {
    const checked = entry.id === views.activeId;
    const modified = checked && views.modified;
    const radio = (
      <Menu.Item
        key={entry.id}
        renderRoot={asRadioItem}
        aria-checked={checked}
        leftSection={
          checked ? (
            <CheckIcon size={16} stroke={1.8} />
          ) : (
            <span className={classes.iconSpacer} />
          )
        }
        rightSection={
          // Only where the user could change a view: in a list of presets
          // alone, every entry would carry it.
          entry.source === "preset" && views.allowUserViews ? (
            <LockIcon
              size={14}
              stroke={1.6}
              role="img"
              aria-label={labels.viewsPresetLocked}
            />
          ) : undefined
        }
        // Selecting the selected view applies it again, which is how its
        // changes are discarded.
        onClick={() => views.select(entry.id)}
        data-dg-part="views-item"
        data-view-id={entry.id}
        data-modified={modified || undefined}
        flex={checked ? 1 : undefined}
        miw={0}
      >
        {entry.name}
        {modified && (
          <span className={classes.modified}>{labels.viewsModified}</span>
        )}
      </Menu.Item>
    );
    if (!checked) return radio;

    // The actions sit on the selected view, so which view they act on is
    // never in doubt. Overwrite only shows when there is a change to save.
    const own = views.allowUserViews && entry.source === "user";
    return (
      <div key={entry.id} className={classes.selectedRow}>
        {modified ? (
          <Tooltip label={labels.viewsDiscardChanges} openDelay={400}>
            {radio}
          </Tooltip>
        ) : (
          radio
        )}
        {own && modified && (
          <RowAction
            label={labels.viewsOverwrite}
            onClick={() => void views.overwrite()}
            part="views-overwrite"
          >
            <SaveIcon size={16} stroke={1.6} />
          </RowAction>
        )}
        {own && (
          <RowAction
            label={labels.viewsDelete}
            color="red"
            onClick={() => void views.remove(entry.id)}
            part="views-delete"
          >
            <TrashIcon size={16} stroke={1.6} />
          </RowAction>
        )}
      </div>
    );
  };

  return (
    <>
      {presets.length > 0 && mine.length > 0 ? (
        <>
          <Menu.Label>{labels.viewsPresets}</Menu.Label>
          {presets.map(item)}
          <Menu.Label>{labels.viewsMine}</Menu.Label>
          {mine.map(item)}
        </>
      ) : (
        <>
          <Menu.Label>{labels.views}</Menu.Label>
          {views.list.length === 0 ? (
            <Menu.Label data-dg-part="views-none">{labels.viewsNone}</Menu.Label>
          ) : (
            views.list.map(item)
          )}
        </>
      )}
      {views.allowUserViews && (
        <>
          <Menu.Divider />
          {naming ? (
            <SaveViewForm
              variant="menu"
              className={classes.menuSaveForm}
              onSaved={() => setNaming(false)}
            />
          ) : (
            // The field opens in place rather than in a submenu: a hover
            // submenu closes when the pointer drifts off it, which a field
            // being typed into cannot afford.
            <Menu.Item
              leftSection={<PlusIcon size={16} stroke={1.6} />}
              closeMenuOnClick={false}
              onClick={() => setNaming(true)}
              data-dg-part="views-save-as"
            >
              {labels.viewsSaveAs}
            </Menu.Item>
          )}
        </>
      )}
    </>
  );
}

/**
 * An icon action on the selected view's row. A `Menu.Item`, so the arrow
 * keys reach it like any other item; the tooltip and `aria-label` carry the
 * text.
 */
function RowAction({
  label,
  color,
  onClick,
  part,
  children,
}: {
  label: string;
  color?: string;
  onClick: () => void;
  part: string;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label} openDelay={300} withArrow>
      <Menu.Item
        aria-label={label}
        color={color}
        onClick={onClick}
        data-dg-part={part}
        // Style props, not a class: an inline style wins over Mantine's item
        // width whichever stylesheet layer each comes from.
        w="auto"
        flex="none"
        px={6}
      >
        {children}
      </Menu.Item>
    </Tooltip>
  );
}

/**
 * The saved views as menu items, for any `Menu.Dropdown` under the grid: the
 * list, with Save changes to view and Delete view on the selected view's row,
 * then Save current layout as new view. Renders nothing when the `views`
 * option is not set.
 *
 * `TMDataGrid.Menu.Columns` shows it in a Views submenu;
 * `TMDataGrid.ViewsMenu` is it behind a button of its own.
 */
export function TMDataGridMenuViews() {
  const [naming, setNaming] = useState(false);
  return <ViewsMenuItems naming={naming} setNaming={setNaming} />;
}

/**
 * The Views item of `TMDataGrid.Menu.Columns`: the selected view's name, a
 * dot while the layout has moved away from it, and the views in a submenu.
 *
 * @internal Rendered by `TMDataGrid.Menu.Columns`; not exported on its own.
 */
export function TMDataGridMenuViewsSub() {
  const { views, labels } = useTMDataGridContext();
  const [opened, setOpened] = useState(false);
  const [naming, setNaming] = useState(false);
  if (!views.enabled) return null;

  // Held open while the name field is in use, wherever the pointer goes, and
  // still open once it is done, so the new view shows selected.
  const endNaming = (next: boolean) => {
    setNaming(next);
    if (!next) setOpened(true);
  };

  return (
    <Menu.Sub
      opened={opened || naming}
      onChange={setOpened}
      width={VIEWS_DROPDOWN_WIDTH}
    >
      <Menu.Sub.Target>
        <Menu.Sub.Item
          leftSection={<ViewsIcon size={16} stroke={1.6} />}
          rightSection={
            <span className={classes.subValue}>
              {views.active && (
                <span className={classes.subValueName}>{views.active.name}</span>
              )}
              {views.modified && (
                <span
                  className={classes.modifiedDot}
                  role="img"
                  aria-label={labels.viewsModified}
                />
              )}
              <ChevronRightIcon size={14} stroke={1.6} />
            </span>
          }
          data-dg-part="views-submenu"
        >
          {labels.views}
        </Menu.Sub.Item>
      </Menu.Sub.Target>
      <Menu.Sub.Dropdown>
        <ViewsMenuItems naming={naming} setNaming={endNaming} />
      </Menu.Sub.Dropdown>
    </Menu.Sub>
  );
}

export type TMDataGridViewsMenuProps = Omit<MenuProps, "children"> & {
  /** Replaces the icon on the trigger. */
  icon?: ReactNode;
  /** Tooltip and `aria-label` of the trigger. Default `labels.views`. */
  label?: string;
  /** Adds Reset layout at the bottom of the dropdown. Default `true`. */
  withResetLayout?: boolean;
};

/**
 * The saved views behind a toolbar button of their own - beside the burger,
 * or anywhere else under `<TMDataGrid>`. Every Mantine `Menu` prop is
 * accepted and wins over the defaults. Renders nothing when the `views`
 * option is not set.
 *
 * Pass `views={false}` to `TMDataGrid.Menu.Columns` alongside it, so the
 * views are not listed twice.
 */
export function TMDataGridViewsMenu({
  icon,
  label,
  withResetLayout = true,
  ...menuProps
}: TMDataGridViewsMenuProps) {
  const { views, labels, controlSize } = useTMDataGridContext();
  if (!views.enabled) return null;
  const triggerLabel = label ?? labels.views;

  return (
    <Menu
      position="bottom-end"
      shadow="md"
      width={VIEWS_DROPDOWN_WIDTH}
      withinPortal
      {...menuProps}
    >
      {/* Outside the Target, as in `TMDataGrid.Menu`. */}
      <Tooltip label={triggerLabel} openDelay={400}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={controlSize}
            aria-label={triggerLabel}
            data-dg-part="views-button"
          >
            {icon ?? <ViewsIcon size={18} stroke={1.6} />}
          </ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown>
        <TMDataGridMenuViews />
        {withResetLayout && (
          <>
            <Menu.Divider />
            <TMDataGridMenuResetLayout />
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * The views row of `TMDataGrid.ColumnsPanel`: a picker, icon buttons for
 * Discard changes, Save changes to view and Delete view, and the name field.
 *
 * A `Select` does not report picking the value it already holds, so the
 * panel has its own Discard changes where the menu re-selects the view.
 *
 * @internal Rendered by the panel; not exported on its own.
 */
export function TMDataGridColumnsPanelViews() {
  const { views, labels, controlSize } = useTMDataGridContext();
  if (!views.enabled) return null;

  const presets = views.list.filter((entry) => entry.source === "preset");
  const mine = views.list.filter((entry) => entry.source === "user");
  const toOption = (entry: TMDataGridViewEntry) => ({
    value: entry.id,
    label: entry.name,
  });
  const data: ComboboxData =
    presets.length > 0 && mine.length > 0
      ? [
          { group: labels.viewsPresets, items: presets.map(toOption) },
          { group: labels.viewsMine, items: mine.map(toOption) },
        ]
      : views.list.map(toOption);
  const active = views.active;
  const own = ownActiveView(views);

  return (
    <div className={classes.panelViews} data-dg-part="views-panel">
      <div className={classes.panelViewsRow}>
        <Select
          size={controlSize}
          label={labels.views}
          description={views.modified ? labels.viewsModified : undefined}
          placeholder={
            views.list.length === 0 ? labels.viewsNone : labels.viewsNoneSelected
          }
          data={data}
          value={views.activeId}
          onChange={(id) => {
            if (id !== null) views.select(id);
          }}
          allowDeselect={false}
          disabled={views.list.length === 0}
          // Inside a Popover the panel usually is: a portaled dropdown counts
          // as a click outside it and would close the host.
          comboboxProps={{ withinPortal: false }}
          data-dg-part="views-select"
        />
        {active !== null && views.modified && (
          <Tooltip label={labels.viewsDiscardChanges} withArrow>
            <ActionIcon
              variant="default"
              size={controlSize}
              aria-label={labels.viewsDiscardChanges}
              onClick={() => views.select(active.id)}
              data-dg-part="views-discard"
            >
              <RestoreIcon size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        )}
        {own !== null && views.modified && (
          <Tooltip label={labels.viewsOverwrite} withArrow>
            <ActionIcon
              variant="default"
              size={controlSize}
              aria-label={labels.viewsOverwrite}
              onClick={() => void views.overwrite()}
              data-dg-part="views-overwrite"
            >
              <SaveIcon size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        )}
        {own !== null && (
          <Tooltip label={labels.viewsDelete} withArrow>
            <ActionIcon
              variant="default"
              color="red"
              size={controlSize}
              aria-label={labels.viewsDelete}
              onClick={() => void views.remove(own.id)}
              data-dg-part="views-delete"
            >
              <TrashIcon size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
      {views.allowUserViews && <SaveViewForm variant="panel" />}
    </div>
  );
}
