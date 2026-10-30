"""Real-world site data: OpenStreetMap features and USGS 3DEP lidar, in local meters.

Local frame: origin at the south-west corner of the bounding box, x = east, y = north (meters).
Minecraft z = south, so z = height_of_area - y when rasterising.

OSM comes from the main API (bbox map call, ODbL — credit "© OpenStreetMap contributors").
Lidar comes from the public USGS 3DEP Entwine point tiles on AWS (EPSG:3857, heights in meters).
Both are cached under a data directory so a site is downloaded once.
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import math
import os
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np

R_MERC = 6378137.0
UA = {"User-Agent": "photo2mc (github.com/MochiBH/photo2mc)"}
EPT_INDEX = "https://raw.githubusercontent.com/hobuinc/usgs-lidar/master/boundaries/resources.geojson"


def _get(url, timeout=120, tries=4):
    import time
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep(2 ** (i + 1))


class Frame:
    """bbox (south, west, north, east) in degrees -> local meters."""

    def __init__(self, south, west, north, east):
        self.s, self.w, self.n, self.e = south, west, north, east
        self.lat0 = (south + north) / 2
        self.kx = math.radians(1) * R_MERC * math.cos(math.radians(self.lat0))
        self.ky = math.radians(1) * R_MERC
        self.width = (east - west) * self.kx
        self.height = (north - south) * self.ky

    def to_local(self, lat, lon):
        lat, lon = np.asarray(lat, float), np.asarray(lon, float)
        return (lon - self.w) * self.kx, (lat - self.s) * self.ky

    def merc_bounds(self):
        return (*to_merc(self.s, self.w), *to_merc(self.n, self.e))

    def merc_to_local(self, mx, my):
        lon = np.degrees(np.asarray(mx) / R_MERC)
        lat = np.degrees(2 * np.arctan(np.exp(np.asarray(my) / R_MERC)) - np.pi / 2)
        return self.to_local(lat, lon)


def to_merc(lat, lon):
    return math.radians(lon) * R_MERC, math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R_MERC


# ---------------------------------------------------------------- OpenStreetMap

def fetch_osm(frame: Frame, path: str):
    if not os.path.exists(path):
        url = (f"https://api.openstreetmap.org/api/0.6/map?bbox="
               f"{frame.w:.6f},{frame.s:.6f},{frame.e:.6f},{frame.n:.6f}")
        data = _get(url, timeout=300)
        with open(path, "wb") as f:
            f.write(data)
    return path


def parse_osm(path: str, frame: Frame):
    """-> list of features {kind: 'node'|'way'|'area', tags, pts: (N,2) local meters, holes: [...], id}."""
    root = ET.parse(path).getroot()
    nodes, node_tags = {}, {}
    for n in root.iter("node"):
        nodes[n.get("id")] = (float(n.get("lat")), float(n.get("lon")))
        t = {k.get("k"): k.get("v") for k in n.iter("tag")}
        if t:
            node_tags[n.get("id")] = t

    def pts(refs):
        ll = np.array([nodes[r] for r in refs if r in nodes])
        if len(ll) == 0:
            return np.zeros((0, 2))
        x, y = frame.to_local(ll[:, 0], ll[:, 1])
        return np.stack([x, y], 1)

    ways = {}
    feats = []
    for w in root.iter("way"):
        t = {k.get("k"): k.get("v") for k in w.iter("tag")}
        refs = [nd.get("ref") for nd in w.iter("nd")]
        ways[w.get("id")] = (t, refs)
        p = pts(refs)
        if len(p) < 2:
            continue
        closed = len(refs) > 3 and refs[0] == refs[-1]
        feats.append({"kind": "area" if closed and _is_area(t) else "way", "tags": t, "pts": p,
                      "holes": [], "id": "w" + w.get("id")})
    for r in root.iter("relation"):
        t = {k.get("k"): k.get("v") for k in r.iter("tag")}
        if t.get("type") != "multipolygon":
            continue
        outer, inner = [], []
        for m in r.iter("member"):
            if m.get("type") == "way" and m.get("ref") in ways:
                (inner if m.get("role") == "inner" else outer).append(ways[m.get("ref")][1])
        for ring in _join_rings(outer):
            feats.append({"kind": "area", "tags": t, "pts": pts(ring),
                          "holes": [pts(h) for h in _join_rings(inner)], "id": "r" + r.get("id")})
    for nid, t in node_tags.items():
        x, y = frame.to_local(*nodes[nid])
        feats.append({"kind": "node", "tags": t, "pts": np.array([[float(x), float(y)]]), "holes": [], "id": "n" + nid})
    return feats


def _is_area(t):
    if t.get("area") == "no":
        return False
    if t.get("area") == "yes":
        return True
    if "highway" in t and t.get("highway") not in ("pedestrian",):
        return False
    if t.get("barrier") in ("hedge", "wall", "fence", "retaining_wall") or t.get("natural") == "tree_row":
        return False
    return True


def _join_rings(ways):
    """Join way segments (lists of node refs) into closed rings."""
    segs = [list(w) for w in ways if len(w) > 1]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[::-1][1:]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[::-1][:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if ring[0] == ring[-1] and len(ring) > 3:
            rings.append(ring)
    return rings


# ---------------------------------------------------------------- USGS lidar (Entwine point tiles)

def find_ept(lat, lon, cache_dir):
    p = os.path.join(cache_dir, "usgs_resources.geojson")
    if not os.path.exists(p):
        with open(p, "wb") as f:
            f.write(_get(EPT_INDEX, timeout=300))
    best = None
    for feat in json.load(open(p))["features"]:
        g = feat["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        if any(_inside(poly[0], lon, lat) for poly in polys):
            pr = feat["properties"]
            if best is None or pr["name"][-4:] > best["name"][-4:]:      # newest survey year wins
                best = pr
    return best


def _inside(poly, x, y):
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def fetch_lidar(frame: Frame, cache_dir: str, ept_url: str | None = None, log=print):
    """All lidar points inside the frame -> npz with local x, y (m), z (m), cls, ret, nret."""
    out = os.path.join(cache_dir, "lidar.npz")
    if os.path.exists(out):
        return dict(np.load(out))
    import laspy
    if ept_url is None:
        res = find_ept((frame.s + frame.n) / 2, (frame.w + frame.e) / 2, cache_dir)
        if not res:
            raise RuntimeError("no USGS 3DEP lidar covers this place")
        ept_url = res["url"]
        log(f"lidar: {res['name']}")
    base = ept_url.rsplit("/", 1)[0]
    ept = json.loads(_get(ept_url))
    assert ept["srs"].get("horizontal") == "3857", ept["srs"]
    (bx0, by0, bz0, bx1, by1, bz1) = ept["bounds"]
    mx0, my0, mx1, my1 = frame.merc_bounds()

    def node_box(d, x, y):
        size = (bx1 - bx0) / 2 ** d
        return bx0 + x * size, by0 + y * size, bx0 + (x + 1) * size, by0 + (y + 1) * size

    def hits(d, x, y):
        a = node_box(d, x, y)
        return a[0] < mx1 and a[2] > mx0 and a[1] < my1 and a[3] > my0

    keys = []
    pending = ["0-0-0-0"]
    while pending:
        hk = pending.pop()
        h = json.loads(_get(f"{base}/ept-hierarchy/{hk}.json"))
        for k, n in h.items():
            d, x, y, _z = map(int, k.split("-"))
            if not hits(d, x, y):
                continue
            if n == -1:
                if k != hk:
                    pending.append(k)
            elif n > 0:
                keys.append(k)
    log(f"lidar: {len(keys)} tiles to fetch")
    os.makedirs(os.path.join(cache_dir, "laz"), exist_ok=True)

    def load(k):
        p = os.path.join(cache_dir, "laz", k + ".laz")
        if not os.path.exists(p):
            data = _get(f"{base}/ept-data/{k}.laz", timeout=300)
            with open(p + ".part", "wb") as f:
                f.write(data)
            os.replace(p + ".part", p)
        las = laspy.read(p)
        x, y = np.asarray(las.x), np.asarray(las.y)
        m = (x >= mx0) & (x < mx1) & (y >= my0) & (y < my1)
        return (x[m], y[m], np.asarray(las.z)[m], np.asarray(las.classification)[m],
                np.asarray(las.return_number)[m], np.asarray(las.number_of_returns)[m])

    parts = []
    with cf.ThreadPoolExecutor(8) as ex:
        for i, r in enumerate(ex.map(load, keys)):
            parts.append(r)
            if (i + 1) % 50 == 0:
                log(f"  {i + 1}/{len(keys)}")
    mx, my, z, cls, ret, nret = (np.concatenate(c) for c in zip(*parts))
    lx, ly = frame.merc_to_local(mx, my)
    d = {"x": lx.astype(np.float32), "y": ly.astype(np.float32), "z": z.astype(np.float32),
         "cls": cls.astype(np.uint8), "ret": ret.astype(np.uint8), "nret": nret.astype(np.uint8)}
    np.savez_compressed(out, **d)
    return d
