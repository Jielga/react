# Map data scripts

These scripts build the map data in `src/data/` from public sources.
The output is committed, so the scripts only need to run when the data should change.

## Sweden from OpenStreetMap

`build_sweden_osm.py` writes `src/data/swedenOsm/cells/*.json`, `src/data/swedenOsm/cellUrls.ts`, and the counties and municipalities in `src/data/swedenRegions/*.json`.

It builds three detail levels:

| Level | Shown from zoom | Cell size | Simplified to | Content |
| --- | --- | --- | --- | --- |
| 0 | 1 | one cell | 700 m | E-roads, national roads, lakes from 150 km², cities, and the background of the neighbouring countries |
| 1 | 3 | 2° | 150 m | All three road classes, lakes from 20 km², cities and towns |
| 2 | 10 | 1° | 25 m | All three road classes, lakes from 3 km², cities, towns and villages |

Roads are OpenStreetMap `highway=motorway`, `trunk` and `primary`.
A road with an E-number is an E-road.
Other motorways and trunk roads, and primary roads numbered below 100, are national roads.
The remaining primary roads are regional roads.

Place names are OpenStreetMap nodes with `place=city`, `town` or `village` and a `name`, inside Sweden.
Each is stored in the one cell its point is in, with its `population` tag when it has one.

## Counties and municipalities

The municipalities are the OpenStreetMap boundaries with `admin_level=7`, keyed by their `ref:scb` code, clipped to the land and with islands under 0.5 km² dropped.
They are simplified to 200 m along shared arcs: the borders are cut where three areas or the coast meet, each piece is simplified once, and the areas are built again from the pieces, so neighbours still meet exactly.
The counties, `admin_level=4` keyed by `ref:SE:scb`, are the unions of their municipalities, whose codes start with the county's code.
The script warns when an area keeps less than 97 % of its area after simplifying.

### Sources

Download these into `.cache/geodata/` in `packages/nordic-map/`.
The folder is ignored by git.

| File | Source | License |
| --- | --- | --- |
| `sweden-latest.osm.pbf` | https://download.geofabrik.de/europe/sweden-latest.osm.pbf | ODbL |
| `land-3857.zip` | https://osmdata.openstreetmap.de/download/simplified-land-polygons-complete-3857.zip | ODbL |
| `sweden-boundary.geojson` | https://polygons.openstreetmap.fr/get_geojson.py?id=52822&params=0 | ODbL |
| `ne-borders.zip` | https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_boundary_lines_land.zip | Public domain |

### Running

Run these from `packages/nordic-map/`:

```sh
python -m venv scripts/map-data/.venv
scripts/map-data/.venv/Scripts/python -m pip install -r scripts/map-data/requirements.txt
scripts/map-data/.venv/Scripts/python scripts/map-data/build_sweden_osm.py
```

On macOS and Linux the Python path is `scripts/map-data/.venv/bin/python`.
The first run reads the whole extract, which takes a few minutes.
Later runs use `.cache/geodata/osm-extract.pickle` and `.cache/geodata/osm-places-regions.pickle` until the extract is downloaded again.

### License of the output

The OpenStreetMap data is © OpenStreetMap contributors, under the Open Database License (ODbL).
The cell files and the county and municipality files are a derived database, so they are also under the ODbL.
A map that shows them must credit "© OpenStreetMap contributors".
`swedenOsmSource` sets this credit, and `NordicMap` shows it in the corner.
