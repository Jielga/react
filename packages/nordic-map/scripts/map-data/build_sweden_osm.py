"""
Builds the Sweden map data from OpenStreetMap: land, coast and border, large lakes and main roads,
in three detail levels cut into grid cells.

Inputs, in .cache/geodata (see README.md in this folder for where to download them):
- sweden-latest.osm.pbf: Geofabrik extract of Sweden
- land-3857.zip: OSM simplified land polygons, from osmdata.openstreetmap.de
- sweden-boundary.geojson: Sweden's boundary relation 52822, including territorial waters
- ne-borders.zip: Natural Earth 1:10m land borders between countries (public domain), for the background

Output: src/data/swedenOsm/cells/*.json and src/data/swedenOsm/cellUrls.ts.
The data is (c) OpenStreetMap contributors, under the Open Database License (ODbL).
"""

from __future__ import annotations

import json
import math
import pickle
import re
import sys
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import osmium
import shapefile  # pyshp
import shapely
from pyproj import Transformer
from shapely.geometry import (
    LineString,
    MultiLineString,
    MultiPolygon,
    Point,
    Polygon,
    box,
    mapping,
    shape,
)
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / ".cache" / "geodata"
OUTPUT = ROOT / "src" / "data" / "swedenOsm"
REGIONS_OUTPUT = ROOT / "src" / "data" / "swedenRegions"

# Simplification of the counties and municipalities, in meters, and the smallest island they keep, in square kilometers
REGION_TOLERANCE = 200
REGION_MIN_ISLAND_KM2 = 0.5
REGION_PRECISION = 4

# Area to read, in degrees. A little larger than Sweden.
WEST, SOUTH, EAST, NORTH = 10.0, 55.0, 24.5, 69.2

# Area of the background land around Sweden, in degrees. Wide enough for any pan at the whole-map zoom.
CONTEXT_AREA = (-10.0, 50.0, 45.0, 75.0)

CACHE = SOURCES / "osm-extract.pickle"
PLACES_CACHE = SOURCES / "osm-places-regions.pickle"

# OSM `place` values the map names, from the most important
PLACE_CLASSES = ("city", "town", "village")

to_metric = Transformer.from_crs("EPSG:4326", "EPSG:3006", always_xy=True)
to_degrees = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)
web_mercator_to_degrees = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)


def reproject(geometry, transformer: Transformer):
    def change(coordinates: np.ndarray) -> np.ndarray:
        x, y = transformer.transform(coordinates[:, 0], coordinates[:, 1])
        return np.column_stack([x, y])

    return shapely.transform(geometry, change)


@dataclass(frozen=True)
class Level:
    min_zoom: float
    cell_size: float
    # Douglas-Peucker tolerance in meters
    tolerance: float
    road_classes: tuple[str, ...]
    # Smallest lake to keep, in square kilometers
    min_lake_km2: float
    # Smallest island, and smallest island in a lake, to keep, in square kilometers
    min_island_km2: float
    # Decimals kept in coordinates
    precision: int
    # OSM `place` classes the level names
    place_classes: tuple[str, ...] = ()


LEVELS = [
    Level(
        min_zoom=1,
        cell_size=360,
        tolerance=700,
        road_classes=("european", "national"),
        min_lake_km2=150,
        min_island_km2=3,
        precision=4,
        place_classes=("city",),
    ),
    Level(
        min_zoom=3,
        cell_size=2,
        tolerance=150,
        road_classes=("european", "national", "regional"),
        min_lake_km2=20,
        min_island_km2=0.2,
        precision=5,
        place_classes=("city", "town"),
    ),
    Level(
        min_zoom=10,
        cell_size=1,
        tolerance=25,
        road_classes=("european", "national", "regional"),
        min_lake_km2=3,
        min_island_km2=0.01,
        precision=5,
        place_classes=PLACE_CLASSES,
    ),
]

# Simplification of the background land around Sweden. Coarse on purpose: it shows no detail.
CONTEXT_LEVEL = Level(
    min_zoom=1,
    cell_size=360,
    tolerance=1500,
    road_classes=(),
    min_lake_km2=0,
    min_island_km2=20,
    precision=4,
)

# Where the overview puts each E-road's label [lon, lat]. The label snaps to the nearest point on the road.
LABEL_HINTS = {
    "E4": (20.9, 64.7),  # Skellefteå
    "E6": (12.25, 57.1),  # Varberg
    "E10": (19.6, 68.2),  # Abisko
    "E12": (17.1, 65.1),  # Storuman
    "E14": (16.0, 62.9),  # Östersund-Sundsvall
    "E16": (14.0, 60.45),  # Vansbro
    "E18": (14.5, 59.3),  # Karlstad-Örebro
    "E20": (13.4, 58.3),  # Skara
    "E22": (16.5, 57.6),  # Västervik
    "E45": (14.5, 61.8),  # Sveg
    "E65": (13.6, 55.47),  # Skurup
}


def log(message: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


# ---------------------------------------------------------------- reading


def read_sweden_boundary() -> MultiPolygon:
    data = json.loads((SOURCES / "sweden-boundary.geojson").read_text(encoding="utf-8"))
    geometry = shape(data["geometries"][0] if data.get("type") == "GeometryCollection" else data)
    return shapely.make_valid(geometry)


def read_land(area: tuple[float, float, float, float]) -> MultiPolygon:
    """OSM simplified land polygons inside `area` (west, south, east, north), in degrees."""
    west_limit, south_limit, east_limit, north_limit = area
    area_box = box(*area)
    pieces = []
    with zipfile.ZipFile(SOURCES / "land-3857.zip") as archive:
        base = next(name[:-4] for name in archive.namelist() if name.endswith(".shp"))
        reader = shapefile.Reader(
            shp=archive.open(f"{base}.shp"), shx=archive.open(f"{base}.shx"), dbf=archive.open(f"{base}.dbf")
        )
        for item in reader.iterShapes():
            west, south = web_mercator_to_degrees.transform(item.bbox[0], item.bbox[1])
            east, north = web_mercator_to_degrees.transform(item.bbox[2], item.bbox[3])
            if east < west_limit or west > east_limit or north < south_limit or south > north_limit:
                continue
            polygon = shapely.make_valid(reproject(shape(item.__geo_interface__), web_mercator_to_degrees))
            if polygon.intersects(area_box):
                pieces.append(polygon.intersection(area_box))
    return as_multipolygon(shapely.make_valid(shapely.union_all(pieces)))


def read_sweden_land(boundary: MultiPolygon) -> MultiPolygon:
    """Land inside Sweden's boundary. The boundary includes the territorial sea, so this cuts out the land."""
    return as_multipolygon(read_land((WEST, SOUTH, EAST, NORTH)).intersection(boundary))


def read_context(boundary: MultiPolygon) -> dict:
    """
    Background around Sweden: the land of the neighbouring countries and the land borders between them,
    without any detail inside. Sweden's own territory is cut out, so Sweden draws its own coast and border.
    """
    land = simplify_area(read_land(CONTEXT_AREA), CONTEXT_LEVEL)
    # Matches Sweden's border closely enough at every zoom, without carrying all of its points
    sweden = shapely.make_valid(simplify_degrees(boundary, 20, preserve_topology=True))
    # The map draws the outline of this land as the neighbours' coasts, so coasts are not stored separately
    context_land = as_multipolygon(shapely.make_valid(land.difference(sweden)))

    borders = []
    with zipfile.ZipFile(SOURCES / "ne-borders.zip") as archive:
        base = next(name[:-4] for name in archive.namelist() if name.endswith(".shp"))
        reader = shapefile.Reader(
            shp=archive.open(f"{base}.shp"), shx=archive.open(f"{base}.shx"), dbf=archive.open(f"{base}.dbf")
        )
        area_box = box(*CONTEXT_AREA)
        for item in reader.iterShapeRecords():
            sides = (item.record["ADM0_LEFT"], item.record["ADM0_RIGHT"])
            if "Sweden" in sides:
                continue
            line = shape(item.shape.__geo_interface__)
            if line.intersects(area_box):
                borders.extend(as_lines(line.intersection(area_box).difference(sweden)))

    precision = CONTEXT_LEVEL.precision
    return {
        "land": [geometry_json(polygon, precision) for polygon in context_land.geoms],
        "borders": [geometry_json(line, precision) for line in borders],
    }


def e_refs(ref: str) -> list[str]:
    refs = []
    for part in ref.split(";"):
        # E-road numbers have at most three digits. Longer ones are tagging mistakes.
        match = re.fullmatch(r"\s*E\s*(\d{1,3})\s*", part)
        if match:
            refs.append(f"E{int(match.group(1))}")
    return refs


def road_class(highway: str, ref: str) -> tuple[str, str] | None:
    """Road class and label text, or None for roads the map leaves out."""
    europe = e_refs(ref)
    if europe:
        return "european", ";".join(europe)
    first = ref.split(";")[0].strip()
    if highway in ("motorway", "trunk"):
        return "national", first
    if highway == "primary":
        # Swedish national roads (riksvägar) are numbered below 100, some are tagged primary
        if first.isdigit() and int(first) < 100:
            return "national", first
        return "regional", first
    return None


def read_osm(boundary: MultiPolygon) -> tuple[dict[tuple[str, str], list[LineString]], list[Polygon]]:
    """Main roads grouped by class and ref, and lakes, from the Geofabrik extract."""
    roads: dict[tuple[str, str], list[LineString]] = {}
    lakes: list[Polygon] = []
    wkb = osmium.geom.WKBFactory()
    processor = (
        osmium.FileProcessor(str(SOURCES / "sweden-latest.osm.pbf"))
        .with_locations()
        .with_areas(osmium.filter.TagFilter(("natural", "water")))
        .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY | osmium.osm.AREA))
    )
    count = 0
    for item in processor:
        count += 1
        if count % 2_000_000 == 0:
            log(f"  {count:,} ways and areas read")
        if item.is_area():
            if item.tags.get("natural") != "water" or item.tags.get("water") not in (None, "lake", "reservoir"):
                continue
            try:
                lake = shapely.from_wkb(wkb.create_multipolygon(item))
            except RuntimeError:
                continue
            # Cheap first cut in square degrees: 3 km2 is about 0.0004 square degrees at Swedish latitudes
            if lake.area >= 0.0002:
                lakes.append(lake)
            continue
        highway = item.tags.get("highway")
        if highway not in ("motorway", "trunk", "primary"):
            continue
        result = road_class(highway, item.tags.get("ref", ""))
        if result is None:
            continue
        try:
            coordinates = [(node.lon, node.lat) for node in item.nodes]
        except osmium.InvalidLocationError:
            continue
        if len(coordinates) >= 2:
            roads.setdefault(result, []).append(LineString(coordinates))

    log(f"  {sum(len(lines) for lines in roads.values()):,} road ways, {len(lakes):,} water areas")
    prepared = prep(boundary)
    roads = {
        key: [line for line in lines if prepared.intersects(line)] for key, lines in roads.items()
    }
    return roads, lakes


@dataclass(frozen=True)
class Place:
    name: str
    place_class: str
    population: int | None
    lon: float
    lat: float


@dataclass(frozen=True)
class Region:
    admin_level: int
    tags: dict[str, str]
    geometry: MultiPolygon


def parse_population(value: str | None) -> int | None:
    digits = re.sub(r"[\s,.]", "", value or "")
    return int(digits) if digits.isdigit() else None


def read_places_and_regions(boundary: MultiPolygon) -> tuple[list[Place], list[Region]]:
    """Named cities, towns and villages, and the county and municipality areas, from the Geofabrik extract."""
    places: list[Place] = []
    regions: list[Region] = []
    wkb = osmium.geom.WKBFactory()
    processor = (
        osmium.FileProcessor(str(SOURCES / "sweden-latest.osm.pbf"))
        .with_locations()
        .with_areas(osmium.filter.TagFilter(("boundary", "administrative")))
        .with_filter(osmium.filter.EntityFilter(osmium.osm.NODE | osmium.osm.AREA))
        .with_filter(osmium.filter.KeyFilter("place").enable_for(osmium.osm.NODE))
        .with_filter(osmium.filter.TagFilter(("boundary", "administrative")).enable_for(osmium.osm.AREA))
    )
    for item in processor:
        if item.is_area():
            level = item.tags.get("admin_level")
            if level not in ("4", "7") or item.from_way():
                continue
            try:
                geometry = shapely.make_valid(shapely.from_wkb(wkb.create_multipolygon(item)))
            except RuntimeError:
                continue
            regions.append(Region(admin_level=int(level), tags=dict(item.tags), geometry=as_multipolygon(geometry)))
            continue
        place_class = item.tags.get("place")
        name = item.tags.get("name")
        if place_class not in PLACE_CLASSES or not name or not item.location.valid():
            continue
        places.append(
            Place(
                name=name,
                place_class=place_class,
                population=parse_population(item.tags.get("population")),
                lon=item.location.lon,
                lat=item.location.lat,
            )
        )
    prepared = prep(boundary)
    places = [place for place in places if prepared.contains(Point(place.lon, place.lat))]
    log(f"  {len(places):,} places, {len(regions)} counties and municipalities")
    return places, regions


# ---------------------------------------------------------------- geometry


def as_multipolygon(geometry) -> MultiPolygon:
    parts = [part for part in getattr(geometry, "geoms", [geometry]) if isinstance(part, Polygon) and not part.is_empty]
    nested = [
        polygon
        for part in getattr(geometry, "geoms", [geometry])
        if isinstance(part, MultiPolygon)
        for polygon in part.geoms
    ]
    return MultiPolygon(parts + nested)


def as_lines(geometry) -> list[LineString]:
    if geometry.is_empty:
        return []
    if isinstance(geometry, LineString):
        return [geometry]
    if isinstance(geometry, MultiLineString):
        return list(geometry.geoms)
    if hasattr(geometry, "geoms"):
        return [line for part in geometry.geoms for line in as_lines(part)]
    return []


def simplify_degrees(geometry, tolerance: float, preserve_topology: bool):
    """Simplifies in meters (SWEREF 99 TM), so the tolerance means the same everywhere in Sweden."""
    simplified = reproject(geometry, to_metric).simplify(tolerance, preserve_topology=preserve_topology)
    return reproject(simplified, to_degrees)


def drop_small(geometry: MultiPolygon, min_km2: float) -> MultiPolygon:
    """Removes polygons and holes smaller than `min_km2`, in SWEREF 99 TM so the areas are true."""
    min_area = min_km2 * 1_000_000
    kept = []
    for polygon in reproject(geometry, to_metric).geoms:
        if polygon.area < min_area:
            continue
        holes = [ring for ring in polygon.interiors if Polygon(ring).area >= min_area]
        kept.append(Polygon(polygon.exterior, holes))
    return reproject(MultiPolygon(kept), to_degrees) if kept else MultiPolygon()


def simplify_area(geometry, level: Level) -> MultiPolygon:
    """Drops what the level is too coarse to show, simplifies, and repairs. Simplifying can make nearby islands overlap."""
    small_removed = drop_small(as_multipolygon(geometry), level.min_island_km2)
    return as_multipolygon(shapely.make_valid(simplify_degrees(small_removed, level.tolerance, preserve_topology=True)))


def km2(polygon) -> float:
    return reproject(polygon, to_metric).area / 1_000_000


def rounded(value, precision: int):
    if isinstance(value, float):
        return round(value, precision)
    if isinstance(value, (list, tuple)):
        return [rounded(item, precision) for item in value]
    return value


def geometry_json(geometry, precision: int) -> dict:
    data = mapping(geometry)
    return {"type": data["type"], "coordinates": rounded(data["coordinates"], precision)}


# ---------------------------------------------------------------- labels


def label_on(lines: list[LineString], hint: tuple[float, float] | None) -> tuple[float, float] | None:
    if not lines:
        return None
    if hint:
        target = Point(hint)
        best = min(lines, key=lambda line: line.distance(target))
        point = best.interpolate(best.project(target))
    else:
        longest = max(lines, key=lambda line: line.length)
        point = longest.interpolate(0.5, normalized=True)
    return (point.x, point.y)


# ---------------------------------------------------------------- building


@dataclass
class LevelData:
    land: MultiPolygon
    borders: list[LineString]
    lakes: list[Polygon]
    roads: dict[tuple[str, str], list[LineString]]


def build_level(level: Level, land: MultiPolygon, lakes: list[Polygon], roads) -> LevelData:
    simple_land = simplify_area(land, level)
    # The outline of the simplified land is the coast and the land border, so lines and fill match exactly
    borders = as_lines(simple_land.boundary)
    simple_lakes = []
    for lake in lakes:
        if km2(lake) >= level.min_lake_km2:
            simplified = simplify_area(lake, level)
            if not simplified.is_empty:
                simple_lakes.append(simplified)
    simple_roads = {}
    for (road_class_name, ref), lines in roads.items():
        if road_class_name not in level.road_classes:
            continue
        merged = shapely.line_merge(MultiLineString(lines))
        simple_roads[(road_class_name, ref)] = as_lines(simplify_degrees(merged, level.tolerance, preserve_topology=False))
    return LevelData(land=simple_land, borders=borders, lakes=simple_lakes, roads=simple_roads)


def cell_places(places: list[Place], area, level: Level) -> list[dict]:
    """The places of the level whose point is in the cell. A point on an edge belongs to the cell east or north of it."""
    west, south, east, north = area.bounds
    inside = [
        place
        for place in places
        if place.place_class in level.place_classes and west <= place.lon < east and south <= place.lat < north
    ]
    rank = {name: index for index, name in enumerate(PLACE_CLASSES)}
    inside.sort(key=lambda place: (rank[place.place_class], -(place.population or 0), place.name))
    return [
        {
            "name": place.name,
            "at": rounded([place.lon, place.lat], level.precision),
            "placeClass": place.place_class,
            **({"population": place.population} if place.population is not None else {}),
        }
        for place in inside
    ]


def cell_layers(data: LevelData, area, level: Level, level_index: int, places: list[Place]) -> dict | None:
    precision = level.precision
    land = as_multipolygon(data.land.intersection(area))
    borders = [line for border in data.borders for line in as_lines(border.intersection(area))]
    water = [as_multipolygon(lake.intersection(area)) for lake in data.lakes if lake.intersects(area)]
    water = [lake for lake in water if not lake.is_empty]
    roads = []
    # Pieces of each E-road in this cell, by number. A road with two numbers counts for both.
    e_road_lines: dict[str, list[LineString]] = {}
    for (road_class_name, ref), lines in sorted(data.roads.items()):
        clipped = [piece for line in lines if line.intersects(area) for piece in as_lines(line.intersection(area))]
        if not clipped:
            continue
        roads.append(
            {
                "geometry": geometry_json(MultiLineString(clipped), precision),
                "roadClass": road_class_name,
                **({"ref": ref} if ref else {}),
            }
        )
        if road_class_name == "european":
            for single in ref.split(";"):
                e_road_lines.setdefault(single, []).extend(clipped)
    road_labels = []
    for single, lines in sorted(e_road_lines.items()):
        at = label_on(lines, LABEL_HINTS.get(single) if level_index == 0 else None)
        if at:
            road_labels.append({"text": single, "at": rounded(list(at), precision)})
    named = cell_places(places, area, level)
    if land.is_empty and not roads and not water and not named:
        return None
    return {
        "land": [geometry_json(polygon, precision) for polygon in land.geoms],
        "water": [geometry_json(lake, precision) for lake in water],
        "borders": [geometry_json(line, precision) for line in borders],
        "roads": roads,
        "roadLabels": road_labels,
        "places": named,
    }


# ---------------------------------------------------------------- counties and municipalities


def shared_arc_simplify(areas: dict[str, MultiPolygon], tolerance: float) -> dict[str, MultiPolygon]:
    """
    Simplifies areas that share borders so they still meet exactly. Simplifying each area on its own moves the
    two copies of a shared border differently, which leaves slivers and gaps between neighbours. Here the borders
    are cut into arcs between the points where three areas or the coast meet, each arc is simplified once,
    and the areas are built again from the simplified arcs.
    """
    metric = {key: reproject(area, to_metric) for key, area in areas.items()}
    # union_all nodes the lines where they meet, and line_merge joins the pieces between those nodes into arcs
    linework = shapely.line_merge(shapely.union_all([area.boundary for area in metric.values()]))
    arcs = [arc.simplify(tolerance, preserve_topology=False) for arc in as_lines(linework)]
    # Simplified arcs can cross where the coast is dense, and polygonize only builds faces from lines that meet
    # at their ends. Noding them again splits them at every crossing; the small faces that adds are assigned below.
    faces = list(shapely.get_parts(shapely.polygonize(as_lines(shapely.union_all(arcs)))))
    prepared = {key: prep(area) for key, area in metric.items()}
    pieces: dict[str, list[Polygon]] = {key: [] for key in metric}
    for face in faces:
        point = face.representative_point()
        owner = next((key for key, area in prepared.items() if area.contains(point)), None)
        if owner is not None:
            pieces[owner].append(face)
    result = {}
    for key, parts in pieces.items():
        merged = as_multipolygon(shapely.make_valid(shapely.union_all(parts))) if parts else MultiPolygon()
        kept = merged.area / max(metric[key].area, 1)
        if kept < 0.97:
            log(f"  warning: {key} kept {kept:.1%} of its area after simplifying")
        result[key] = reproject(merged, to_degrees)
    return result


def area_json(key: str, label: str, geometry: MultiPolygon) -> dict:
    return {"id": key, "label": label, "geometry": geometry_json(geometry, REGION_PRECISION)}


def build_regions(regions: list[Region], land: MultiPolygon) -> None:
    """Writes the municipalities, and the counties built from them, as `MapArea` lists clipped to the land."""
    municipalities = {region.tags["ref:scb"]: region for region in regions if region.admin_level == 7}
    counties = {region.tags["ref:SE:scb"]: region for region in regions if region.admin_level == 4}
    log(f"Building {len(municipalities)} municipalities and {len(counties)} counties")
    clipped = {
        key: drop_small(as_multipolygon(shapely.make_valid(region.geometry.intersection(land))), REGION_MIN_ISLAND_KM2)
        for key, region in municipalities.items()
    }
    simple = shared_arc_simplify(clipped, REGION_TOLERANCE)
    # A municipality code starts with the code of its county, so the counties are unions of the same faces
    # and share their borders exactly
    county_areas = {
        code: as_multipolygon(shapely.make_valid(shapely.union_all([area for key, area in simple.items() if key[:2] == code])))
        for code in counties
    }
    REGIONS_OUTPUT.mkdir(parents=True, exist_ok=True)
    outputs = {
        "sweden-municipalities.json": [
            area_json(key, municipalities[key].tags["name"], simple[key]) for key in sorted(simple) if not simple[key].is_empty
        ],
        "sweden-counties.json": [
            area_json(code, counties[code].tags["name"], county_areas[code]) for code in sorted(county_areas)
        ],
    }
    for name, areas in outputs.items():
        text = json.dumps(areas, separators=(",", ":"), ensure_ascii=False)
        (REGIONS_OUTPUT / name).write_text(text, encoding="utf-8")
        log(f"  {name}: {len(areas)} areas, {len(text.encode('utf-8')) / 1e6:.2f} MB")


def cell_range(start: float, end: float, origin: float, size: float) -> range:
    return range(math.floor((start + origin) / size), math.floor((end + origin) / size) + 1)


def main() -> None:
    log("Reading Sweden's boundary")
    boundary = read_sweden_boundary()
    log("Reading land polygons")
    land = read_sweden_land(boundary)
    log(f"  land: {len(land.geoms)} polygons")
    pbf = SOURCES / "sweden-latest.osm.pbf"
    if CACHE.exists() and CACHE.stat().st_mtime > pbf.stat().st_mtime:
        log("Reading roads and lakes from the cache of the OSM extract")
        roads, water_areas = pickle.loads(CACHE.read_bytes())
    else:
        log("Reading roads and lakes from the OSM extract (takes a few minutes)")
        roads, water_areas = read_osm(boundary)
        CACHE.write_bytes(pickle.dumps((roads, water_areas)))
    if PLACES_CACHE.exists() and PLACES_CACHE.stat().st_mtime > pbf.stat().st_mtime:
        log("Reading places, counties and municipalities from their cache")
        places, regions = pickle.loads(PLACES_CACHE.read_bytes())
    else:
        log("Reading places, counties and municipalities from the OSM extract")
        places, regions = read_places_and_regions(boundary)
        PLACES_CACHE.write_bytes(pickle.dumps((places, regions)))
    land_area = prep(land)
    lakes = [as_multipolygon(lake.intersection(land)) for lake in water_areas if km2(lake) >= 3 and land_area.intersects(lake)]
    lakes = [lake for lake in lakes if not lake.is_empty]
    log(f"  {len(lakes)} lakes of 3 km2 or more")
    log("Reading the background land and borders around Sweden")
    context = read_context(boundary)
    log(f"  {len(context['land'])} land polygons, {len(context['borders'])} lines")

    cells_dir = OUTPUT / "cells"
    cells_dir.mkdir(parents=True, exist_ok=True)
    for old in cells_dir.glob("*.json"):
        old.unlink()

    written: list[str] = []
    total_bytes = 0
    for level_index, level in enumerate(LEVELS):
        log(f"Level {level_index}: simplifying with {level.tolerance} m")
        data = build_level(level, land, lakes, roads)
        size = level.cell_size
        level_bytes = 0
        for x in cell_range(WEST, EAST, 180, size):
            for y in cell_range(SOUTH, NORTH, 90, size):
                west, south = x * size - 180, y * size - 90
                area = box(west, south, west + size, south + size)
                layers = cell_layers(data, area, level, level_index, places)
                if layers is None:
                    continue
                if level_index == 0:
                    layers["context"] = context
                name = f"{level_index}-{x}-{y}.json"
                text = json.dumps(layers, separators=(",", ":"), ensure_ascii=False)
                (cells_dir / name).write_text(text, encoding="utf-8")
                written.append(f"{level_index}/{x}/{y}")
                level_bytes += len(text.encode("utf-8"))
        total_bytes += level_bytes
        log(f"  level {level_index}: {sum(1 for key in written if key.startswith(f'{level_index}/'))} cells, {level_bytes / 1e6:.2f} MB")

    lines = [
        "// Generated by scripts/map-data/build_sweden_osm.py. Do not edit.",
        "// Data (c) OpenStreetMap contributors, under the Open Database License (ODbL).",
        "",
        "/** The levels of the Sweden OSM data, as built */",
        "export const levels = " + json.dumps([{"minZoom": level.min_zoom, "cellSize": level.cell_size} for level in LEVELS]) + ";",
        "",
        "/**",
        " * URL of each cell file. Static `new URL` calls, so bundlers copy the files and the data works offline.",
        " * `?no-inline` keeps them files in the library build, where Vite would otherwise inline every asset.",
        " */",
        "export const cellUrls: Record<string, URL> = {",
    ]
    for key in written:
        level_index, x, y = key.split("/")
        lines.append(f'  "{key}": new URL("./cells/{level_index}-{x}-{y}.json?no-inline", import.meta.url),')
    lines.append("};")
    (OUTPUT / "cellUrls.ts").write_text("\n".join(lines) + "\n", encoding="utf-8")
    log(f"Done: {len(written)} cells, {total_bytes / 1e6:.2f} MB in total")

    build_regions(regions, land)


if __name__ == "__main__":
    sys.exit(main())
