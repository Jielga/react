/**
 * Where the grid puts its filter controls.
 *
 * | Surface | Where it renders |
 * | --- | --- |
 * | `"popup"` | Floating over the first body rows, under the header |
 * | `"sidebar"` | Beside the table, inside the grid frame |
 * | `"none"` | Nowhere - the grid renders no panel of its own |
 *
 * Header filters are not one of these: they are a second row of controls in
 * the header, always visible, and they coexist with any of the three. See
 * {@link TMDataGridFiltersOptions.inHeader}.
 */
export type TMDataGridFilterSurface = "popup" | "sidebar" | "none";

/** Which side of the table the sidebar surface renders on. */
export type TMDataGridFilterSidebarSide = "left" | "right";

/**
 * `filters` on `useTMDataGrid` - everything about where the filter controls
 * are, as opposed to what they do.
 *
 * Named for the option key, the way `editing` has `TMDataGridEditingOptions`.
 * Not to be confused with `TMDataGridColumnFilterOptions`, which is one
 * column's `meta.filter`.
 *
 * ```tsx
 * useTMDataGrid({ data, columns, filters: { surface: "sidebar" } });
 * ```
 */
export type TMDataGridFiltersOptions = {
  /**
   * Which surface `TMDataGrid.Table` renders and `TMDataGrid.FilterButton`
   * toggles. Defaults to `"popup"`.
   *
   * Under `"none"` the table renders no panel and the filter button renders
   * nothing. That is what a grid running header filters alone wants, and it is
   * also what frees a hand-placed `<TMDataGrid.FilterPanel />` to be the only
   * panel on the page - mounted, it is always visible, so drive it off
   * `ui.state.filterPanelOpen` if it belongs behind a control of your own.
   */
  surface?: TMDataGridFilterSurface;
  /** Which side the `"sidebar"` surface sits on. Defaults to `"right"`. */
  sidebarSide?: TMDataGridFilterSidebarSide;
  /** Width of the `"sidebar"` surface, any CSS length. Defaults to `"280px"`. */
  sidebarWidth?: string;
  /**
   * Whether the popup or the sidebar starts open. Read once, at mount, like
   * `initialState`.
   *
   * Defaults to `true` under `"sidebar"` and `false` everywhere else: a
   * sidebar is a layout choice, so asking for one and getting an empty strip
   * until the funnel is clicked is not what it reads like, while a popup that
   * greets you open is in the way.
   *
   * Under `"none"` it is simply the starting value of
   * `ui.state.filterPanelOpen`, which a control of your own can read.
   */
  defaultOpen?: boolean;
  /**
   * A second header row holding one value control per filterable column,
   * always visible. Off by default.
   *
   * Independent of `surface` - a grid may have header filters and a popup at
   * once. What it does change is the column chrome: the header's funnel
   * indicator and the column menu's "Filter" item both come off, because
   * their only job was to reveal a control that is now already on screen.
   *
   * A header cell has room for a value and an operator button, not for the
   * panel's column / operator / value triple. Everything else about a filter
   * is unchanged - the same operators, the same `meta.filter.control`, the
   * same `columnFilters` state.
   */
  inHeader?: boolean;
};

/** {@link TMDataGridFiltersOptions} with every default filled in. */
export type TMDataGridFiltersSettings = Required<TMDataGridFiltersOptions>;

/**
 * Fills the defaults in. Field by field rather than by spreading, so an
 * explicit `undefined` - which is what destructuring an absent option group
 * hands over - reads as "not set" rather than overwriting the default with it.
 *
 * `defaultOpen` is the one default that is not a constant: it follows the
 * surface, so there is no flat table of defaults to export.
 */
export function resolveFilterOptions(
  options: TMDataGridFiltersOptions = {},
): TMDataGridFiltersSettings {
  const surface = options.surface ?? "popup";
  return {
    surface,
    sidebarSide: options.sidebarSide ?? "right",
    sidebarWidth: options.sidebarWidth ?? "280px",
    defaultOpen: options.defaultOpen ?? surface === "sidebar",
    inHeader: options.inHeader ?? false,
  };
}
