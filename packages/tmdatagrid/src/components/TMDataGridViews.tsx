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
  LockIcon,
  PlusIcon,
  RestoreIcon,
  SaveIcon,
  TrashIcon,
  ViewsIcon,
} from "./icons";
import { TMDataGridMenuResetLayout } from "./TMDataGridMenu";

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
 * The name field and its button. The button is disabled while the name is
 * empty or taken, and the reason shows under the field as the user types.
 */
function SaveViewForm({
  buttonLabel,
  className,
  autoFocus = false,
  onSaved,
}: {
  buttonLabel: string;
  className?: string;
  /** In the menu, where the field replaces the item that was clicked. */
  autoFocus?: boolean;
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

  return (
    <form
      className={[classes.saveForm, className].filter(Boolean).join(" ")}
      onSubmit={(event) => void submit(event)}
      data-dg-part="views-save-form"
    >
      <TextInput
        size={controlSize}
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
        autoFocus={autoFocus}
      />
      <Button
        type="submit"
        size={controlSize}
        disabled={nameError !== null}
        data-dg-part="views-save"
      >
        {buttonLabel}
      </Button>
    </form>
  );
}

/**
 * The saved views as menu items, for any `Menu.Dropdown` under the grid: the
 * list, then Restore, Overwrite, Save as new view and Delete for the selected
 * view. Overwrite and Delete only show for the user's own views. Renders
 * nothing when the `views` option is not set.
 *
 * `TMDataGrid.Menu.Columns` includes it under Reset layout;
 * `TMDataGrid.ViewsMenu` is it behind a button of its own.
 */
export function TMDataGridMenuViews() {
  const { views, labels } = useTMDataGridContext();
  // Save as new view turns into the name field in place, rather than opening
  // a submenu: a hover submenu closes when the pointer drifts off it, which a
  // field being typed into cannot afford.
  const [naming, setNaming] = useState(false);

  if (!views.enabled) return null;

  const presets = views.list.filter((entry) => entry.source === "preset");
  const mine = views.list.filter((entry) => entry.source === "user");
  const active = views.active;
  const own = ownActiveView(views);

  const item = (entry: TMDataGridViewEntry) => {
    const checked = entry.id === views.activeId;
    return (
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
        onClick={() => views.select(entry.id)}
        data-dg-part="views-item"
        data-view-id={entry.id}
      >
        {entry.name}
      </Menu.Item>
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
      {(active !== null || views.allowUserViews) && <Menu.Divider />}
      {active !== null && (
        <Menu.Item
          leftSection={<RestoreIcon size={16} stroke={1.6} />}
          onClick={() => views.restore()}
          data-dg-part="views-restore"
        >
          {labels.viewsRestore(active.name)}
        </Menu.Item>
      )}
      {own !== null && (
        <Menu.Item
          leftSection={<SaveIcon size={16} stroke={1.6} />}
          onClick={() => void views.overwrite()}
          data-dg-part="views-overwrite"
        >
          {labels.viewsOverwrite(own.name)}
        </Menu.Item>
      )}
      {views.allowUserViews &&
        (naming ? (
          <SaveViewForm
            buttonLabel={labels.viewsSave}
            className={classes.menuSaveForm}
            autoFocus
            onSaved={() => setNaming(false)}
          />
        ) : (
          <Menu.Item
            leftSection={<PlusIcon size={16} stroke={1.6} />}
            closeMenuOnClick={false}
            onClick={() => setNaming(true)}
            data-dg-part="views-save-as"
          >
            {labels.viewsSaveAs}
          </Menu.Item>
        ))}
      {own !== null && (
        <Menu.Item
          color="red"
          leftSection={<TrashIcon size={16} stroke={1.6} />}
          onClick={() => void views.remove(own.id)}
          data-dg-part="views-delete"
        >
          {labels.viewsDelete(own.name)}
        </Menu.Item>
      )}
    </>
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
      width={260}
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
 * Restore, Overwrite and Delete, and the name field.
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
        {active !== null && (
          <Tooltip label={labels.viewsRestore(active.name)} withArrow>
            <ActionIcon
              variant="default"
              size={controlSize}
              aria-label={labels.viewsRestore(active.name)}
              onClick={() => views.restore()}
              data-dg-part="views-restore"
            >
              <RestoreIcon size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        )}
        {own !== null && (
          <Tooltip label={labels.viewsOverwrite(own.name)} withArrow>
            <ActionIcon
              variant="default"
              size={controlSize}
              aria-label={labels.viewsOverwrite(own.name)}
              onClick={() => void views.overwrite()}
              data-dg-part="views-overwrite"
            >
              <SaveIcon size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        )}
        {own !== null && (
          <Tooltip label={labels.viewsDelete(own.name)} withArrow>
            <ActionIcon
              variant="default"
              color="red"
              size={controlSize}
              aria-label={labels.viewsDelete(own.name)}
              onClick={() => void views.remove(own.id)}
              data-dg-part="views-delete"
            >
              <TrashIcon size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
      {views.allowUserViews && <SaveViewForm buttonLabel={labels.viewsSaveAs} />}
    </div>
  );
}
