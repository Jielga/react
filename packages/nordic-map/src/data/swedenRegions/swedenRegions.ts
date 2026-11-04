import type { MapArea } from "../../NordicMap/mapItems.ts";

/**
 * The county and municipality files, built by scripts/map-data/build_sweden_osm.py from OpenStreetMap.
 * Static `new URL` calls, so bundlers copy the files, and `?no-inline` keeps them files in the library build.
 */
const countiesUrl = new URL("./sweden-counties.json?no-inline", import.meta.url);
const municipalitiesUrl = new URL("./sweden-municipalities.json?no-inline", import.meta.url);

const loaded = new Map<string, Promise<MapArea[]>>();

/** Fetches a file once, and again on the next call when it failed */
function loadAreas(url: URL): Promise<MapArea[]> {
  const key = url.href;
  const existing = loaded.get(key);
  if (existing) {
    return existing;
  }
  const request = fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Could not load ${url.pathname}: HTTP ${response.status}`);
    }
    // The files are generated in the MapArea shape by the build script
    const areas: MapArea[] = await response.json();
    return areas;
  });
  loaded.set(key, request);
  request.catch(() => {
    loaded.delete(key);
  });
  return request;
}

/**
 * Sweden's 21 counties (län) as areas, clipped to the land. Each `id` is the county code from Statistics
 * Sweden (SCB), for example `"01"` for Stockholms län, and each `label` is the county's name.
 * The file loads on the first call, and later calls share it.
 */
export function loadSwedenCounties(): Promise<MapArea[]> {
  return loadAreas(countiesUrl);
}

/**
 * Sweden's 290 municipalities (kommuner) as areas, clipped to the land. Each `id` is the municipality code
 * from Statistics Sweden (SCB), for example `"0180"` for Stockholm, and starts with the code of its county.
 * Each `label` is the municipality's name. The file loads on the first call, and later calls share it.
 */
export function loadSwedenMunicipalities(): Promise<MapArea[]> {
  return loadAreas(municipalitiesUrl);
}
