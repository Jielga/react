import type { TMDataGridLabels } from "./labels";

/**
 * The complete Swedish dictionary. Typed as {@link TMDataGridLabels} rather
 * than as an override, so a label added to the grid without a Swedish
 * translation is a compile error here instead of English quietly leaking
 * through.
 *
 * ```tsx
 * useTMDataGrid({ data, columns, labels: TMDATAGRID_LABELS_SV });
 * ```
 */
export const TMDATAGRID_LABELS_SV: TMDataGridLabels = {
  operators: {
    contains: "innehåller",
    equals: "är lika med",
    notEquals: "är inte lika med",
    startsWith: "börjar med",
    endsWith: "slutar med",
    greaterThan: "är större än",
    greaterThanOrEqual: "är större än eller lika med",
    lessThan: "är mindre än",
    lessThanOrEqual: "är mindre än eller lika med",
    between: "är mellan",
    before: "är före",
    after: "är efter",
    onOrBefore: "är på eller före",
    onOrAfter: "är på eller efter",
    isAnyOf: "är någon av",
    isNoneOf: "är ingen av",
    isEmpty: "är tom",
    isNotEmpty: "är inte tom",
  },

  filters: "Filter",
  searchPlaceholder: "Sök",
  searchLabel: "Sök rader",
  clearSearch: "Rensa sökningen",

  menuButton: "Meny",
  manageColumns: "Hantera kolumner",

  columnsSearchPlaceholder: "Sök",
  columnsNoMatch: (search) => `Inga kolumner matchar ”${search}”`,
  columnsShowHideAll: "Visa/dölj alla",
  columnsReset: "Återställ layout",
  columnsResetHint:
    "Återställer kolumnernas synlighet, ordning, bredd, låsning och gruppering",
  rowNumberColumnLabel: "Radnummer",
  noRows: "Inga rader att visa",

  views: "Vyer",
  viewsPresets: "Förinställda",
  viewsMine: "Mina vyer",
  viewsNone: "Inga sparade vyer",
  viewsNoneSelected: "Ingen vy vald",
  viewsPresetLocked: "Förinställd vy, kan inte ändras",
  viewsRestore: (name) => `Återställ ”${name}”`,
  viewsOverwrite: (name) => `Skriv över ”${name}”`,
  viewsSaveAs: "Spara som ny vy",
  viewsName: "Namn på vyn",
  viewsSave: "Spara",
  viewsDelete: (name) => `Ta bort ”${name}”`,
  viewsNameEmpty: "Ange ett namn",
  viewsNameDuplicate: "Det finns redan en vy med det namnet",
  viewsSaveFailed: "Vyn kunde inte sparas",

  filterColumn: "Kolumn",
  filterOperator: "Operator",
  filterValue: "Värde",
  filterValuePlaceholder: "Filtervärde",
  filterFrom: "Från",
  filterTo: "Till",
  filterAll: "Alla",
  booleanTrue: "Ja",
  booleanFalse: "Nej",
  addFilter: "Lägg till filter",
  clearAllFilters: "Rensa alla",
  closeFilters: "Stäng filter",
  removeFilter: "Ta bort filter",
  filterOperatorFor: (column) => `Filteroperator för ${column}`,

  activeFilters: "Aktiva filter",
  clearFilter: (column) => `Rensa filtret för ${column}`,

  sortAsc: "Sortera stigande",
  sortDesc: "Sortera fallande",
  filterMenuItem: "Filtrera",
  groupBy: (column) => `Gruppera efter ${column}`,
  ungroup: (column) => `Sluta gruppera efter ${column}`,
  expandAllGroups: "Expandera alla grupper",
  collapseAllGroups: "Fäll ihop alla grupper",
  pinLeft: "Lås till vänster",
  pinRight: "Lås till höger",
  unpin: "Lås upp",
  moveLeft: "Flytta åt vänster",
  moveRight: "Flytta åt höger",
  autosizeColumn: "Autopassa kolumnbredd",
  hideColumn: "Dölj kolumn",
  filterOn: (column) => `Filtrera på ${column}`,
  sortColumn: (column) => `Sortera ${column}`,
  columnMenu: (column) => `Kolumnmeny för ${column}`,

  rowsPerPage: "Rader per sida:",
  pageRange: ({ from, to, total }) => `${from}–${to} av ${total}`,
  pageNumber: ({ page, pageCount }) =>
    pageCount < 0 ? `Sida ${page}` : `Sida ${page} av ${pageCount}`,
  groupedAllRows: (total) => `Grupperad · alla ${total} rader`,
  pagingSuspendedHint:
    "Sidindelningen är avstängd medan raderna är grupperade, och alla rader visas. Sluta gruppera för att bläddra igen.",
  previousPage: "Föregående sida",
  nextPage: "Nästa sida",

  noResults: "Inga rader matchar dina filter",
  loading: "Laddar",

  editCell: (column) => `Redigera ${column}`,
  confirmEdit: "Spara",
  cancelEdit: "Avbryt",
  editColumnLabel: "Redigera",
  editRow: "Redigera rad",
  saveRow: "Spara rad",
  cancelRowEdit: "Avbryt redigering",
  editRowErrors: "Åtgärda de markerade cellerna",
  saveAllEdits: (rows) => (rows === 1 ? "Spara 1 rad" : `Spara ${rows} rader`),
  discardAllEdits: "Ångra alla",
  editRowsStillOpen: (rows) =>
    rows === 1 ? "1 rad redigeras fortfarande" : `${rows} rader redigeras fortfarande`,
  confirmNewRow: "Lägg till rad",
  discardNewRow: "Avbryt ny rad",
  deleteRow: "Ta bort rad",
  restoreRow: "Återställ rad",
  revertRow: "Ångra ändringar",
  rowStateNew: "Ny rad",
  rowStateEdited: "Ändrad rad",
  rowStateDeleted: "Markerad för borttagning",

  cellCount: (count) => (count === 1 ? "1 cell" : `${count} celler`),
  copy: "Kopiera",
  exportCells: "Exportera celler",
  includeHeaders: "Ta med rubriker",

  exportAll: "Exportera alla rader",
  exportSelected: (count) =>
    count === 1 ? "Exportera 1 markerad rad" : `Exportera ${count} markerade rader`,
  exportPickerTitle: (format) => `Exportera som ${format}`,
  exportPickerHint: (selected) =>
    selected === null
      ? "Välj kolumner att exportera"
      : selected === 1
        ? "Välj kolumner att exportera för den markerade raden"
        : `Välj kolumner att exportera för de ${selected} markerade raderna`,
  exportPickerConfirm: "Exportera",
  exportPickerCancel: "Avbryt",
  exportPickerSelectAll: "Markera alla",
  exportPickerCount: (checked, total) => `${checked} av ${total}`,
  exportPickerHidden: "Dold",

  selectColumnLabel: "Radmarkering",
  selectAllRows: "Markera alla rader",
  selectRow: "Markera rad",
  selectGroup: "Markera grupp",

  detailsColumnLabel: "Detaljer",
  showDetails: "Visa detaljer",
  hideDetails: "Dölj detaljer",
  expandAllDetails: "Visa alla detaljer",
  collapseAllDetails: "Dölj alla detaljer",

  groupColumnLabel: "Grupp",
  blankGroupValue: "(Tomt)",
  expandGroup: (label) => `Expandera ${label}`,
  collapseGroup: (label) => `Fäll ihop ${label}`,
};
