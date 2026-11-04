/** Every text the map shows or gives to assistive technology */
export type NordicMapLabels = {
  /** Accessible name of the map when the `label` prop is left out */
  map: string;
  zoomIn: string;
  zoomOut: string;
  showWholeMap: string;
  /** Accessible name of the loading indicator */
  loading: string;
  /** Shown when the map data could not be loaded */
  loadError: string;
  /** Name of a cluster of pins, for its tooltip and for screen readers */
  cluster: (count: number) => string;
};

export const NORDIC_MAP_LABELS_EN: NordicMapLabels = {
  map: "Map",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  showWholeMap: "Show whole map",
  loading: "Loading map",
  loadError: "Could not load the map.",
  cluster: (count) => {
    return `${count} pins`;
  },
};

export const NORDIC_MAP_LABELS_SV: NordicMapLabels = {
  map: "Karta",
  zoomIn: "Zooma in",
  zoomOut: "Zooma ut",
  showWholeMap: "Visa hela kartan",
  loading: "Laddar kartan",
  loadError: "Kunde inte ladda kartan.",
  cluster: (count) => {
    return `${count} nålar`;
  },
};
