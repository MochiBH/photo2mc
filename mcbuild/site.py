"""Whole sites (a campus, a few city blocks) from OpenStreetMap + USGS lidar -> Minecraft world.

Pipeline
  rasters (0.5 m and block resolution)
    ground   lidar ground points -> filled terrain
    surface  OSM roads, paths, lawns, pitches, parking, water -> top block
    buildings OSM footprints; roof heights from single-return lidar inside each footprint
              (multi-return points are tree canopy over the roof), snapped to the roof's planes;
              lidar structures with no footprint (stadium stands, canopies) become plain buildings
    trees    remaining lidar above ground with multi-returns -> canopy height model -> tree tops,
             crowns (watershed), trunks and branches
  regions (512 x 512 blocks) are filled from the rasters and written one at a time.

Facades follow a style per building (campus Georgian brick with white limestone trim, houses,
commercial, garages): base course, storeys of trimmed windows, corner quoins, cornice, slate or
flat roof with parapet. Roof slopes use the voxel engine's half-block stair/slab table.
"""
from __future__ import annotations

import hashlib
import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

from .palette import MATERIALS, for_version
from .trees import grow, species_for
from .voxelize import AIR, FULL, LUT, LUT_KIND, SLAB, STAIRS
from .world import Y_MIN

FAM = {m.name: for_version(m, "1.21") for m in MATERIALS}
Y0 = -50                      # block y of the lowest ground in the site


def _hash(r, c, y, salt):
    """Deterministic per-block noise from global coordinates."""
    r = np.asarray(r, np.int64).astype(np.uint64)
    c = np.asarray(c, np.int64).astype(np.uint64)
    y = np.asarray(y, np.int64).astype(np.uint64)
    with np.errstate(over="ignore"):
        h = (r * np.uint64(73856093)) ^ (c * np.uint64(19349663)) ^ (y * np.uint64(83492791)) \
            ^ (np.uint64(int(salt) % 2 ** 32) * np.uint64(2654435761))
        h = (h ^ (h >> np.uint64(13))) * np.uint64(1274126177)
        h = h ^ (h >> np.uint64(16))
    return (h & np.uint64(2 ** 62 - 1)).astype(np.int64)


def _h(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


class Palette:
    def __init__(self):
        self.states = ["minecraft:air"]
        self.idx = {"minecraft:air": 0}
        self._shape = {}

    def __call__(self, s: str) -> int:
        if ":" not in s.split("[")[0]:
            s = "minecraft:" + s
        i = self.idx.get(s)
        if i is None:
            i = self.idx[s] = len(self.states)
            self.states.append(s)
        return i

    def shaped(self, fam: str, code: int) -> int:
        """Palette index for family `fam` with half-block pattern `code` (0 = air)."""
        key = (fam, code)
        if key not in self._shape:
            kind, half, facing, shape = LUT[code]
            m = FAM[fam]
            if kind == AIR:
                s = "minecraft:air"
            elif kind == STAIRS and m.stairs:
                s = f"{m.stairs}[facing={facing},half={half},shape={shape},waterlogged=false]"
            elif kind == SLAB and m.slab:
                s = f"{m.slab}[type={half},waterlogged=false]"
            else:
                s = m.full
            self._shape[key] = self(s)
        return self._shape[key]


FLOWERS = ["dandelion", "poppy", "oxeye_daisy", "cornflower", "azure_bluet", "red_tulip", "white_tulip", "allium"]
# close variants scattered through large single-block surfaces (fraction of blocks)
TEXTURE = {
    "bricks": [("terracotta", 0.05), ("granite", 0.025)],
    "stone_bricks": [("cracked_stone_bricks", 0.08), ("mossy_stone_bricks", 0.04)],
    "deepslate_tiles": [("cracked_deepslate_tiles", 0.10), ("deepslate_bricks", 0.04)],
    "smooth_stone": [("stone", 0.06), ("andesite", 0.03)],
    "light_gray_concrete": [("light_gray_concrete_powder", 0.08), ("andesite", 0.05), ("stone", 0.03)],
    "gray_concrete": [("gray_concrete_powder", 0.10), ("tuff", 0.04), ("cobbled_deepslate", 0.02)],
    "polished_andesite": [("andesite", 0.06)],
    "red_terracotta": [("terracotta", 0.06)],
    "oak_leaves[distance=1,persistent=true,waterlogged=false]":
        [("dark_oak_leaves[distance=1,persistent=true,waterlogged=false]", 0.08)],
    "dark_oak_leaves[distance=1,persistent=true,waterlogged=false]":
        [("oak_leaves[distance=1,persistent=true,waterlogged=false]", 0.08)],
}
LEAVES = ["oak_leaves", "dark_oak_leaves", "azalea_leaves", "birch_leaves"]
LOGS = ["oak_log", "dark_oak_log", "oak_log", "birch_log"]

STYLES = {
    "campus": dict(wall=["bricks"], base="stone_bricks", trim="smooth_quartz", roof=["deepslate_tiles"],
                   flat="smooth_stone", glass="gray_stained_glass_pane", fh=12, ww=4, wh=7, sp=10, wy=3),
    "house": dict(wall=["bricks", "bricks", "stone_bricks", "white_terracotta", "smooth_sandstone", "mud_bricks"],
                  base="stone_bricks", trim="smooth_quartz",
                  roof=["deepslate_tiles", "cobbled_deepslate", "spruce_planks", "dark_oak_planks"],
                  flat="smooth_stone", glass="gray_stained_glass_pane", fh=9, ww=3, wh=5, sp=9, wy=3),
    "commercial": dict(wall=["stone_bricks", "smooth_sandstone", "light_gray_terracotta", "bricks", "polished_andesite"],
                       base="polished_andesite", trim="smooth_quartz", roof=["deepslate_tiles"],
                       flat="smooth_stone", glass="light_gray_stained_glass_pane", fh=12, ww=5, wh=7, sp=8, wy=3),
    # seating bowls: the lidar rake becomes rows of red seats (stairs), radial aisles in grey
    "stadium": dict(wall=["bricks"], base="stone_bricks", trim="smooth_quartz", roof=["mangrove_planks"],
                    flat="smooth_stone", glass="gray_stained_glass_pane", fh=12, ww=4, wh=7, sp=10, wy=3),
    "garage": dict(wall=["polished_andesite"], base="polished_andesite", trim="smooth_stone", roof=["polished_andesite"],
                   flat="polished_andesite", glass=None, fh=9, ww=6, wh=4, sp=8, wy=3),
    "structure": dict(wall=["polished_andesite"], base="polished_andesite", trim="polished_andesite",
                      roof=["polished_andesite"], flat="polished_andesite", glass=None, fh=0, ww=0, wh=0, sp=1, wy=0),
    "roof": dict(wall=["polished_andesite"], base="polished_andesite", trim="smooth_quartz", roof=["smooth_stone"],
                 flat="smooth_stone", glass=None, fh=0, ww=0, wh=0, sp=1, wy=0),
}

# surface classes -> top block
SURF = ["grass_block[snowy=false]", "light_gray_concrete", "gray_concrete", "smooth_stone", "bricks",
        "stone_bricks", "water[level=0]", "sand", "red_terracotta", "moss_block", "green_terracotta",
        "yellow_concrete", "white_concrete", "dirt_path", "gravel", "polished_andesite", "coarse_dirt",
        "red_concrete", "stone", "andesite", "blue_concrete"]
S = {n.split("[")[0]: i for i, n in enumerate(SURF)}
S_GRASS, S_CONC, S_ASPH, S_WALK, S_BRICK, S_STONE, S_WATER = 0, 1, 2, 3, 4, 5, 6

ROAD_W = {"motorway": 15, "trunk": 12, "primary": 12, "secondary": 11, "tertiary": 9, "residential": 7,
          "unclassified": 7, "living_street": 5, "service": 4.5, "motorway_link": 6, "trunk_link": 6,
          "primary_link": 6, "secondary_link": 6, "tertiary_link": 6, "track": 3, "construction": 6}
PATH_W = {"footway": 2.4, "path": 1.8, "cycleway": 2.4, "steps": 2.4, "pedestrian": 4, "bridleway": 2,
          "corridor": 0}


def _surface_block(t, default):
    s = t.get("surface", "")
    if s in ("asphalt",):
        return S_ASPH
    if s in ("paving_stones", "bricks", "sett", "cobblestone", "unhewn_cobblestone"):
        return S_BRICK
    if s in ("gravel", "fine_gravel", "pebblestone"):
        return S["gravel"]
    if s in ("dirt", "ground", "unpaved", "compacted", "earth", "mud"):
        return S["dirt_path"]
    if s in ("grass", "grass_paver"):
        return S_GRASS
    if s in ("artificial_turf",):
        return S["moss_block"]
    if s in ("sand",):
        return S["sand"]
    if s in ("concrete", "concrete:plates", "concrete:lanes") and default == S_ASPH:
        return S_CONC
    return default


class Site:
    def __init__(self, frame, feats, lidar, block=1 / 3, campus_id=None, log=print):
        self.frame, self.bs, self.log = frame, block, log
        self.W, self.Hm = frame.width, frame.height
        self.NX, self.NZ = int(self.W / block), int(self.Hm / block)
        self.pal = Palette()
        self.feats = feats
        self.campus = next((f for f in feats if f["id"] == campus_id), None) if campus_id else None
        self._ground(lidar)
        self._dsm(lidar)
        self._surface()
        self._buildings()
        self._structures()
        self._finish_buildings()
        self._vegetation()
        self._extras()
        from .street import Streetscape
        self.S = S
        self.street = Streetscape(self)
        self._stadiums()

    def _stadiums(self):
        """Ford-Stadium-style detail for every football pitch inside a stadium outline."""
        from .stadium import Stadium, text_bitmap
        self.stadiums = []
        bowls = [f for f in self.feats if f["kind"] == "area" and f["tags"].get("leisure") == "stadium"]
        for f in self.feats:
            t = f["tags"]
            if f["kind"] == "area" and t.get("leisure") == "pitch" and t.get("sport") == "american_football":
                c = f["pts"].mean(0)
                if any(_inside(bw["pts"], *c) for bw in bowls):
                    self.stadiums.append(Stadium(self, f))
        # press box: the tall step face in stadium buildings
        stad_k = np.array([B["style"] == "stadium" for B in self.blds] + [False])
        deck = getattr(self, "_deck", None)
        if deck is not None:
            face = stad_k[self.bid] & (deck - self.step_lo.astype(np.int32) > 15) & (deck - self.base_y > 40)
            if face.sum() > 20:
                rows = np.nonzero(face)[0]
                from .pixfont import text as pixtext
                self.pressbox = {"rc": int(np.median(rows)), "sign": pixtext("SMU MUSTANGS").astype(np.uint8)}

    # ------------------------------------------------------------ coordinates
    def _px(self, pts, res):
        """local meters (x east, y north) -> raster (col, row) floats at resolution res."""
        return pts[:, 0] / res, (self.Hm - pts[:, 1]) / res

    def yb(self, z):
        """height (m) -> block y."""
        return (Y0 + np.floor((np.asarray(z) - self.z0) / self.bs + 1e-6)).astype(np.int32)

    # ------------------------------------------------------------ lidar rasters
    def _grid(self, lid, mask, res, how):
        nx, ny = int(math.ceil(self.W / res)), int(math.ceil(self.Hm / res))
        c = np.clip((lid["x"][mask] / res).astype(int), 0, nx - 1)
        r = np.clip(((self.Hm - lid["y"][mask]) / res).astype(int), 0, ny - 1)
        z = lid["z"][mask]
        if how == "max":
            g = np.full(ny * nx, -np.inf, np.float32)
            np.maximum.at(g, r * nx + c, z)
            g[np.isinf(g)] = np.nan
        elif how == "mean":
            s = np.bincount(r * nx + c, z, ny * nx)
            n = np.bincount(r * nx + c, None, ny * nx)
            with np.errstate(invalid="ignore", divide="ignore"):
                g = (s / n).astype(np.float32)
        else:                                      # count
            g = np.bincount(r * nx + c, None, ny * nx).astype(np.float32)
        return g.reshape(ny, nx)

    def _ground(self, lid):
        self.log("ground...")
        g1 = self._grid(lid, lid["cls"] == 2, 1.0, "mean")
        w = np.isfinite(g1).astype(np.float32)
        v = np.nan_to_num(g1)
        sm = ndi.gaussian_filter(v * w, 3) / np.maximum(ndi.gaussian_filter(w, 3), 1e-6)
        fine = ndi.gaussian_filter(v * w, 0.8) / np.maximum(ndi.gaussian_filter(w, 0.8), 1e-6)
        wf = ndi.gaussian_filter(w, 0.8)
        g = np.where(wf > 0.5, fine, sm)
        far = ndi.gaussian_filter(w, 3) < 1e-3
        if far.any():
            idx = ndi.distance_transform_edt(far, return_distances=False, return_indices=True)
            g = g[tuple(idx)]
        self.g1 = g.astype(np.float32)                                # 1 m grid, meters
        self.z0 = float(np.percentile(g, 0.1))
        # block-resolution ground y
        cols = (np.arange(self.NX) + 0.5) * self.bs - 0.5
        rows = (np.arange(self.NZ) + 0.5) * self.bs - 0.5
        rr, cc = np.meshgrid(rows, cols, indexing="ij")
        gz = ndi.map_coordinates(self.g1, [rr, cc], order=1, mode="nearest")
        self.ground_y = self.yb(gz).astype(np.int16)
        self.log(f"  ground {self.z0:.1f}..{g.max():.1f} m -> y {self.ground_y.min()}..{self.ground_y.max()}")

    def _dsm(self, lid):
        self.log("surface model...")
        ng = np.isin(lid["cls"], (1, 17))
        self.dsm_all = self._grid(lid, ng, 0.5, "max")
        self.dsm_single = self._grid(lid, ng & (lid["nret"] == 1), 0.5, "max")
        nall = self._grid(lid, ng, 1.0, "count")
        nmul = self._grid(lid, ng & (lid["nret"] > 1), 1.0, "count")
        frac = ndi.uniform_filter(nmul, 3) / np.maximum(ndi.uniform_filter(nall, 3), 1e-6)
        self.multi05 = np.kron(frac, np.ones((2, 2), np.float32))[:self.dsm_all.shape[0], :self.dsm_all.shape[1]]
        ny, nx = self.dsm_all.shape
        rr, cc = np.meshgrid((np.arange(ny) + 0.5) * 0.5 - 0.5, (np.arange(nx) + 0.5) * 0.5 - 0.5, indexing="ij")
        self.g05 = ndi.map_coordinates(self.g1, [rr, cc], order=1, mode="nearest").astype(np.float32)

    # ------------------------------------------------------------ OSM rasterising
    def _draw(self, res, mode="L", init=0):
        im = Image.new(mode, (int(math.ceil(self.W / res)) if res != self.bs else self.NX,
                              int(math.ceil(self.Hm / res)) if res != self.bs else self.NZ), init)
        return im, ImageDraw.Draw(im)

    def _poly(self, draw, f, res, fill, hole=0):
        c, r = self._px(f["pts"], res)
        if len(c) >= 3:
            draw.polygon(list(zip(c.tolist(), r.tolist())), fill=fill)
        for h in f["holes"]:
            hc, hr = self._px(h, res)
            if len(hc) >= 3:
                draw.polygon(list(zip(hc.tolist(), hr.tolist())), fill=hole)

    def _line(self, draw, f, res, fill, width_m):
        c, r = self._px(f["pts"], res)
        w = max(1, int(round(width_m / res)))
        xy = list(zip(c.tolist(), r.tolist()))
        draw.line(xy, fill=fill, width=w)
        if w > 2:
            rad = w / 2
            for x, y in xy:
                draw.ellipse([x - rad, y - rad, x + rad, y + rad], fill=fill)

    def _surface(self):
        self.log("surfaces...")
        im, d = self._draw(self.bs)
        F = self.feats
        order = []
        for f in F:
            t = f["tags"]
            if f["kind"] != "area":
                continue
            if t.get("landuse") in ("grass", "meadow", "recreation_ground", "village_green", "cemetery") or \
                    t.get("leisure") in ("park", "garden", "golf_course") or t.get("natural") in ("grassland", "scrub", "wood"):
                order.append((0, f, S_GRASS))
            elif t.get("amenity") == "parking" and t.get("parking", "surface") == "surface":
                order.append((1, f, _surface_block(t, S_ASPH)))
            elif t.get("leisure") == "track":
                order.append((2, f, S["red_terracotta"]))
            elif t.get("leisure") == "pitch":
                sp = t.get("sport", "")
                if sp in ("tennis", "basketball", "volleyball", "pickleball") and t.get("surface") != "grass":
                    blk = S["sand"] if t.get("surface") == "sand" else S["green_terracotta"] if sp == "tennis" else S_ASPH
                else:
                    blk = _surface_block(t, S_GRASS)
                order.append((2, f, blk))
            elif t.get("highway") == "pedestrian" or t.get("area:highway") or t.get("place") == "square":
                order.append((3, f, _surface_block(t, S_WALK)))
            elif t.get("amenity") in ("parking_space",):
                continue
        # masks for markings and decoration: pitches (no flowers), parking (stall lines), roads (curbs), beds
        masks = {k: self._draw(self.bs) for k in ("pitch", "parking", "road", "bed", "marks")}
        for _, f, blk in sorted(order, key=lambda o: o[0]):
            self._poly(d, f, self.bs, blk)
            t = f["tags"]
            if t.get("leisure") in ("pitch", "track"):
                self._poly(masks["pitch"][1], f, self.bs, 1)
            if t.get("leisure") == "pitch" and blk in (S_GRASS, S["moss_block"]):
                self._pitch_lines(d, f, t.get("sport", ""))
            if t.get("amenity") == "parking":
                self._poly(masks["parking"][1], f, self.bs, 1)
        for f in F:
            if f["kind"] == "area" and f["tags"].get("landuse") == "flowerbed":
                self._poly(d, f, self.bs, S_GRASS)
                self._poly(masks["bed"][1], f, self.bs, 1)
        # roads, then paths on top
        for f in F:
            t = f["tags"]
            hw = t.get("highway")
            if f["kind"] == "way" and hw in ROAD_W and t.get("tunnel") != "yes":
                aisle = t.get("service") == "parking_aisle"
                w = _num(t.get("width")) or ROAD_W[hw] * (0.75 if aisle else 1)
                self._line(d, f, self.bs, _surface_block(t, S_ASPH), w)
                self._line(masks["road"][1], f, self.bs, 1, w)
                if aisle:
                    self._stalls(masks["marks"][1], f["pts"], w)
        for f in F:
            t = f["tags"]
            hw = t.get("highway")
            if f["kind"] == "way" and hw in ROAD_W and hw in ("primary", "secondary", "tertiary") and t.get("oneway") != "yes":
                self._line(d, f, self.bs, S["yellow_concrete"], self.bs)
        for f in F:
            t = f["tags"]
            hw = t.get("highway")
            if f["kind"] == "way" and PATH_W.get(hw) and t.get("tunnel") != "yes" and t.get("indoor") != "yes":
                w = _num(t.get("width")) or PATH_W[hw]
                if t.get("footway") == "crossing" or t.get("crossing"):
                    self._zebra(masks["marks"][1], f["pts"])
                    continue
                self._line(d, f, self.bs, S_STONE if hw == "steps" else _surface_block(t, S_WALK), w)
        # water last (pools, ponds)
        water = []
        for f in F:
            t = f["tags"]
            if f["kind"] == "area" and (t.get("natural") == "water" or t.get("leisure") in ("swimming_pool",)
                                        or t.get("amenity") == "fountain" or t.get("water")):
                self._poly(d, f, self.bs, S_WATER)
                water.append(f)
        for f in F:
            if f["kind"] == "node" and f["tags"].get("amenity") == "fountain":
                c, r = self._px(f["pts"], self.bs)
                rad = 2.5 / self.bs
                d.ellipse([c[0] - rad, r[0] - rad, c[0] + rad, r[0] + rad], fill=S_WATER)
        self.surf = np.array(im, np.uint8)
        m = {k: np.array(v[0], np.uint8) > 0 for k, v in masks.items()}
        self.road = m["road"]
        paved = np.isin(self.surf, (S_ASPH, S_CONC))
        stall = m["marks"] & paved & (m["parking"] | self.road)
        self.surf[stall] = S["white_concrete"]
        self.lawn = (self.surf == S_GRASS) & ~m["pitch"]
        self.bed = m["bed"] & (self.surf == S_GRASS)
        # curbs: road cells next to a sidewalk or lawn that isn't itself part of the road
        side = np.isin(self.surf, (S_WALK, S_GRASS, S_BRICK)) & ~self.road
        nb = np.zeros_like(side)
        for sh in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb |= np.roll(side, sh, (0, 1))
        self.curb = self.road & np.isin(self.surf, (S_ASPH, S_CONC)) & nb & ~m["parking"]
        self._water_levels()

    def _pitch_lines(self, draw, f, sport):
        """Field markings in white (and coloured end zones) on the pitch's own axes."""
        pts = f["pts"]
        c = pts.mean(0)
        w, v = np.linalg.eigh(np.cov((pts - c).T))
        u, n = v[:, 1], v[:, 0]                        # long axis, short axis
        L = float(np.ptp((pts - c) @ u))
        Wd = float(np.ptp((pts - c) @ n))
        c = c + u * float(((pts - c) @ u).max() + ((pts - c) @ u).min()) / 2 \
            + n * float(((pts - c) @ n).max() + ((pts - c) @ n).min()) / 2

        def quad(a0, a1, b0, b1, fill):
            q = np.array([c + u * a + n * b for a, b in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))])
            col, row = self._px(q, self.bs)
            draw.polygon(list(zip(col.tolist(), row.tolist())), fill=fill)

        lw = self.bs * 1.01                            # one block wide
        white, end = S["white_concrete"], S["red_concrete"]
        if sport == "american_football":
            k = min(1.0, L / 112.0, Wd / 50.0)
            gl, el, sd = 45.72 * k, 54.86 * k, 24.38 * k
            for sgn in (-1, 1):
                quad(sgn * gl, sgn * el, -sd, sd, end)                 # end zones
            for i in range(-10, 11):                                   # yard lines every 5 yards
                a = i * 4.572 * k
                quad(a - lw / 2, a + lw / 2, -sd, sd, white)
            for a0, a1, b0, b1 in ((-el, el, -sd - lw, -sd), (-el, el, sd, sd + lw),
                                   (-el - lw, -el, -sd, sd), (el, el + lw, -sd, sd)):
                quad(a0, a1, b0, b1, white)
        elif sport == "soccer" and L > 30:
            hl, hw = L / 2 - 1.0, Wd / 2 - 1.0
            for a0, a1, b0, b1 in ((-hl, hl, -hw - lw, -hw), (-hl, hl, hw, hw + lw), (-hl - lw, -hl, -hw, hw),
                                   (hl, hl + lw, -hw, hw), (-lw / 2, lw / 2, -hw, hw)):
                quad(a0, a1, b0, b1, white)
            r = min(9.15, hw * 0.4)
            ring = np.array([c + u * r * np.cos(t_) + n * r * np.sin(t_) for t_ in np.linspace(0, 2 * np.pi, 80)])
            col, row = self._px(ring, self.bs)
            draw.line(list(zip(col.tolist(), row.tolist())), fill=white, width=1)

    def _stalls(self, draw, pts, aisle_w, pitch=2.7, depth=5.4):
        """Parking stall lines on both sides of a parking aisle."""
        for a, b in zip(pts[:-1], pts[1:]):
            d = b - a
            L = float(np.hypot(*d))
            if L < 3:
                continue
            d /= L
            n = np.array([-d[1], d[0]])
            for t in np.arange(1.0, L - 0.5, pitch):
                p = a + d * t
                for sgn in (-1, 1):
                    q0 = p + n * sgn * (aisle_w / 2 + 0.3)
                    q1 = p + n * sgn * (aisle_w / 2 + depth)
                    c, r = self._px(np.array([q0, q1]), self.bs)
                    draw.line(list(zip(c.tolist(), r.tolist())), fill=1, width=1)

    def _zebra(self, draw, pts, width=3.0, bar=0.6):
        """Zebra crossing: bars along the road, one every 2 x bar along the walking line."""
        for a, b in zip(pts[:-1], pts[1:]):
            d = b - a
            L = float(np.hypot(*d))
            if L < 0.5:
                continue
            d /= L
            n = np.array([-d[1], d[0]])
            for t in np.arange(bar / 2, L, 2 * bar):
                p = a + d * t
                q = np.array([p - n * width / 2, p + n * width / 2])
                c, r = self._px(q, self.bs)
                draw.line(list(zip(c.tolist(), r.tolist())), fill=1, width=max(1, int(round(bar / self.bs))))

    def _water_levels(self):
        """Each water body gets one level (below the lowest bank) so it can't spill."""
        wm = self.surf == S_WATER
        lab, n = ndi.label(wm)
        self.water_y = np.full(self.surf.shape, -999, np.int16)
        self.fountain_rim = np.zeros(self.surf.shape, bool)
        self.fountains = []
        if not n:
            return
        ring = ndi.binary_dilation(wm, iterations=1) & ~wm
        rlab = ndi.grey_dilation(lab, size=3) * ring
        bank = ndi.minimum(self.ground_y.astype(np.int32), rlab, np.arange(1, n + 1))
        inner = ndi.minimum(self.ground_y.astype(np.int32), lab, np.arange(1, n + 1))
        lvl = np.minimum(np.asarray(bank), np.asarray(inner)) - 1
        self.water_y[wm] = np.asarray(lvl)[lab[wm] - 1]
        # fountains: rim ring and a jet in the middle
        self.fountain_rim = ring & (ndi.grey_dilation(lab, size=3) > 0)
        self.fountains = []
        for f in self.feats:
            if f["tags"].get("amenity") == "fountain":
                c, r = self._px(f["pts"].mean(0, keepdims=True), self.bs)
                ci, ri = int(c[0]), int(r[0])
                if 0 <= ri < self.NZ and 0 <= ci < self.NX and wm[ri, ci]:
                    self.fountains.append((ri, ci, int(self.water_y[ri, ci])))
        is_f = np.zeros(n + 1, bool)
        for ri, ci, _ in self.fountains:
            is_f[lab[ri, ci]] = True
        self.fountain_rim &= is_f[ndi.grey_dilation(lab, size=3)]

    # ------------------------------------------------------------ buildings
    def _style(self, t, centre):
        b = t.get("building", "yes")
        on_campus = self.campus is not None and _inside(self.campus["pts"], *centre)
        if b in ("parking",) or t.get("amenity") == "parking":
            return "garage"
        if b in ("roof", "carport"):
            return "roof"
        if b in ("stadium", "grandstand") or t.get("leisure") == "stadium":
            return "stadium"
        if on_campus:
            return "campus"
        if b in ("house", "detached", "semidetached_house", "residential", "terrace", "garage", "garages",
                 "shed", "bungalow", "apartments"):
            return "house"
        return "commercial"

    def _buildings(self):
        self.log("buildings...")
        self.blds = []
        im, d = self._draw(self.bs, "I", 0)
        im05, d05 = self._draw(0.5, "I", 0)
        for f in self.feats:
            t = f["tags"]
            if f["kind"] != "area" or "building" not in t or t.get("building") in ("no", "construction"):
                continue
            if t.get("location") == "underground" or t.get("layer", "0").startswith("-"):
                continue
            centre = f["pts"].mean(0)
            k = len(self.blds) + 1
            self.blds.append({"id": f["id"], "name": t.get("name", ""), "tags": t, "style": self._style(t, centre),
                              "levels": _num(t.get("building:levels")), "height": _num(t.get("height"))})
            self._poly(d, f, self.bs, k)
            self._poly(d05, f, 0.5, k)
        self.bid = np.array(im, np.int32) - 1
        self.bid05 = np.array(im05, np.int32) - 1

    def _structures(self):
        """Lidar objects with no OSM footprint that look built (flat, single returns): stands, canopies."""
        h = self.dsm_all - self.g05
        bm = ndi.binary_dilation(self.bid05 >= 0, iterations=3)
        dsm = np.nan_to_num(self.dsm_all, nan=-1e3)
        rough = np.sqrt(np.maximum(ndi.uniform_filter(dsm ** 2, 3) - ndi.uniform_filter(dsm, 3) ** 2, 0))
        cand = (np.nan_to_num(h) > 2.5) & ~bm & (self.multi05 < 0.12) & (rough < 0.5)
        cand = ndi.binary_opening(cand, iterations=2)
        lab, n = ndi.label(cand)
        if not n:
            return
        area = ndi.sum(cand, lab, np.arange(1, n + 1)) * 0.25
        keep = np.flatnonzero(area >= 40) + 1
        base = len(self.blds)
        remap = np.zeros(n + 1, np.int32) - 1
        for j, k in enumerate(keep):
            remap[k] = base + j
            self.blds.append({"id": f"lidar{k}", "name": "", "tags": {}, "style": "structure", "levels": None,
                              "height": None})
        s = remap[lab]
        self.bid05 = np.where(s >= 0, s, self.bid05)
        rows = ((np.arange(self.NZ) + 0.5) * self.bs / 0.5).astype(int).clip(0, s.shape[0] - 1)
        cols = ((np.arange(self.NX) + 0.5) * self.bs / 0.5).astype(int).clip(0, s.shape[1] - 1)
        sb = s[np.ix_(rows, cols)]
        self.bid = np.where((sb >= 0) & (self.bid < 0), sb, self.bid)
        self.log(f"  {len(keep)} lidar structures without a footprint")

    def _finish_buildings(self):
        """Roof heights (0.5 m), base, eave, flat/pitched for every building."""
        self.log("roofs...")
        nb = len(self.blds)
        b05 = self.bid05
        roof = np.where(np.isfinite(self.dsm_single), self.dsm_single, self.dsm_all)
        roof = np.where(self.multi05 > 0.35, np.nan, roof)               # canopy over the roof
        out = np.full(b05.shape, np.nan, np.float32)
        objs = ndi.find_objects(b05 + 1)
        g1 = self.g1
        for k in range(nb):
            B = self.blds[k]
            sl = objs[k] if k < len(objs) else None
            if sl is None:
                B["skip"] = True
                continue
            sl = (slice(max(sl[0].start - 2, 0), sl[0].stop + 2), slice(max(sl[1].start - 2, 0), sl[1].stop + 2))
            m = b05[sl] == k
            ground = self.g05[sl][m]
            base_z = float(np.percentile(ground, 5))
            v = roof[sl][m]
            ok = np.isfinite(v) & (v > base_z + 2.0)
            B["base_z"] = base_z
            if ok.mean() < 0.35 or ok.sum() < 6:
                # not in the 2018 lidar (newer, or small): use tags or a default
                hgt = B["height"] or (B["levels"] * (3.0 if B["style"] == "house" else 4.0) if B["levels"] else
                                      (6.0 if B["style"] == "house" else 3.0 if B["style"] == "roof" else 12.0))
                vals = np.full(m.sum(), base_z + hgt, np.float32)
                B["lidar"] = False
            else:
                vals = v.copy()
                vals[~ok] = np.nan
                vals = _fill_nearest_1d(m, vals)
                vals = _snap_planes(vals)
                B["lidar"] = True
            sub = out[sl]
            sub[m] = vals
            out[sl] = sub
            B["flat"] = bool(np.percentile(vals, 90) - np.percentile(vals, 10) < 1.2)
            B["top_z"] = float(vals.max())
        # median smoothing per building keeps edges, removes lidar speckle
        med = ndi.median_filter(np.nan_to_num(out, nan=-1e3), size=3)
        out = np.where((b05 >= 0) & np.isfinite(out) & (med > -100), med, out)
        valid = np.isfinite(out)
        idx = ndi.distance_transform_edt(~valid, return_distances=False, return_indices=True)
        self.roof05 = out[tuple(idx)].astype(np.float32)
        # block-level attributes
        bid = self.bid
        inb = bid >= 0
        base_y = np.zeros(max(nb, 1), np.int32)
        for k, B in enumerate(self.blds):
            if B.get("skip"):
                continue
            base_y[k] = int(self.yb(B["base_z"]))
            B["base_y"] = int(base_y[k])
            st = STYLES[B["style"]]
            hh = _h(B["id"])
            B["wall"] = st["wall"][hh % len(st["wall"])]
            B["roof"] = st["roof"][(hh // 7) % len(st["roof"])]
        self.base_y = np.where(inb, base_y[np.maximum(bid, 0)], 0).astype(np.int16)
        # boundary codes: 1 north, 2 south, 4 west, 8 east = neighbour outside this building
        code = np.zeros(bid.shape, np.uint8)
        pad = np.pad(bid, 1, constant_values=-1)
        for bit, (dr, dc) in ((1, (-1, 0)), (2, (1, 0)), (4, (0, -1)), (8, (0, 1))):
            nbh = pad[1 + dr:1 + dr + bid.shape[0], 1 + dc:1 + dc + bid.shape[1]]
            code |= np.where(inb & (nbh != bid), bit, 0).astype(np.uint8)
        diag = np.zeros(bid.shape, bool)
        for dr, dc in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
            nbh = pad[1 + dr:1 + dr + bid.shape[0], 1 + dc:1 + dc + bid.shape[1]]
            diag |= inb & (nbh != bid)
        self.bcode = code
        nbits = np.unpackbits(code[..., None], axis=-1).sum(-1)
        self.corner = inb & ((nbits >= 2) | ((nbits == 0) & diag) |
                             (((code & 3) > 0) & ((code & 12) > 0)))
        # straight wall runs (window candidates): same single normal 2 blocks each way along the wall
        single = inb & (nbits == 1)
        st2 = np.zeros(bid.shape, bool)
        for axis_bits, (dr, dc) in ((3, (0, 1)), (12, (1, 0))):
            m = single & ((code & axis_bits) > 0)
            ok = m.copy()
            for s in (1, 2):
                for sg in (-1, 1):
                    sh = (sg * s * dr, sg * s * dc)
                    ok &= np.roll(single, sh, (0, 1)) & (np.roll(code, sh, (0, 1)) == code) & \
                        (np.roll(bid, sh, (0, 1)) == bid)
            st2 |= ok
        self.straight = st2
        # ground inside buildings = their floor
        self.ground_y = np.where(inb, self.base_y, self.ground_y).astype(np.int16)
        # eave per building from boundary roof heights
        rows = ((np.arange(self.NZ) + 0.5) * self.bs / 0.5).astype(int).clip(0, self.roof05.shape[0] - 1)
        cols = ((np.arange(self.NX) + 0.5) * self.bs / 0.5).astype(int).clip(0, self.roof05.shape[1] - 1)
        roofb = self.roof05[np.ix_(rows, cols)]
        bnd = inb & (code > 0)
        for k, B in enumerate(self.blds):
            if B.get("skip"):
                continue
            v = roofb[bnd & (bid == k)]
            if len(v) == 0:
                B["skip"] = True
                continue
            ez = float(np.percentile(v, 50 if B["flat"] else 40))
            B["eave_y"] = int(self.yb(ez))
        self.eave_y = np.zeros(max(nb, 1), np.int32)
        self.flat = np.zeros(max(nb, 1), bool)
        self.skip = np.zeros(max(nb, 1), bool)
        for k, B in enumerate(self.blds):
            self.eave_y[k] = B.get("eave_y", 0)
            self.flat[k] = B.get("flat", True)
            self.skip[k] = bool(B.get("skip"))
        # centre (block coords) for symmetric window layout
        cm = ndi.center_of_mass(inb, bid + 1, np.arange(1, nb + 1)) if nb else []
        for k, B in enumerate(self.blds):
            c = cm[k] if k < len(cm) else (0, 0)
            B["cz"], B["cx"] = (int(round(c[0])), int(round(c[1]))) if np.all(np.isfinite(c)) else (0, 0)
        # deck (top full block) per column, and the lowest same-building neighbour deck, so steps in
        # a roof get a wall face instead of a gap
        deck = np.where(inb, self.yb(roofb) - 1, -32768).astype(np.int32)
        nmin = deck.copy()
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            same = np.roll(bid, (dr, dc), (0, 1)) == bid
            nmin = np.where(same & inb, np.minimum(nmin, np.roll(deck, (dr, dc), (0, 1))), nmin)
        self.step_lo = nmin.astype(np.int16)
        self._deck = deck
        # locally flat roof (deck varies by at most one block within 3 blocks): concourses, press-box roofs
        dsm_ = ndi.gaussian_filter(np.where(inb, deck, 0).astype(np.float32), 2.5)
        wsum = ndi.gaussian_filter(inb.astype(np.float32), 2.5)
        dsm_ = dsm_ / np.maximum(wsum, 1e-3)
        gz, gx = np.gradient(dsm_)
        fl = inb & (np.hypot(gz, gx) < 0.18) & (wsum > 0.6)
        fl = ndi.binary_closing(ndi.binary_opening(fl, iterations=2), iterations=3) & inb
        for target in (True, False):                    # drop islands and fill holes under ~20 m2
            m = fl if target else (inb & ~fl)
            lab, n = ndi.label(m)
            if n:
                size = ndi.sum(m, lab, np.arange(1, n + 1))
                small = np.zeros(n + 1, bool)
                small[1:] = size < 180
                fl = np.where(small[lab] & m, not target, fl)
        self.flat_local = fl & inb
        # cornice: outside cells next to a wall, at the eave (or lower, where the wall is lower)
        cor = np.full(bid.shape, -32768, np.int32)
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nbh = np.roll(bid, (dr, dc), (0, 1))
            nd = np.roll(deck, (dr, dc), (0, 1))
            k = np.maximum(nbh, 0)
            m = (nbh >= 0) & (bid < 0) & ~self.skip[k]
            ey = np.minimum(self.eave_y[k] - 1, nd)
            ok = m & (ey - np.roll(self.base_y, (dr, dc), (0, 1)) >= 5)
            cor = np.where(ok, np.maximum(cor, ey), cor)
        self.cornice_y = cor.astype(np.int16)
        lid = sum(1 for B in self.blds if B.get("lidar"))
        self.log(f"  {nb} buildings ({lid} with lidar roofs)")

    # ------------------------------------------------------------ trees
    def _vegetation(self):
        self.log("trees...")
        h = np.nan_to_num(self.dsm_all - self.g05)
        bm = ndi.binary_dilation(self.bid05 >= 0, iterations=1)
        # cars and lamp posts: low, single-return objects on paved ground
        rows = np.minimum(((np.arange(h.shape[0]) + 0.5) * 0.5 / self.bs).astype(int), self.NZ - 1)
        cols = np.minimum(((np.arange(h.shape[1]) + 0.5) * 0.5 / self.bs).astype(int), self.NX - 1)
        surf05 = self.surf[np.ix_(rows, cols)]
        paved = np.isin(surf05, (S_ASPH, S_CONC, S_WALK, S_BRICK, S_STONE))
        veg = (h > 0.6) & ~bm & ~((h < 3.0) & paved & (self.multi05 < 0.3)) & ~((h > 2.5) & (self.multi05 < 0.05))
        veg &= ~(surf05 == S_WATER)
        veg = ndi.binary_opening(veg, iterations=1)
        lab, n = ndi.label(veg)
        if n:
            sz = ndi.sum(veg, lab, np.arange(1, n + 1))
            veg &= (sz >= 6)[np.maximum(lab - 1, 0)] & (lab > 0)
        chm = np.where(veg, h, 0).astype(np.float32)
        chs = ndi.gaussian_filter(chm, 1.0)
        tops = veg & (chs == ndi.maximum_filter(chs, size=13)) & (chs > 4.0)
        mk, nt = ndi.label(tops)
        cen = np.array(ndi.center_of_mass(tops, mk, np.arange(1, nt + 1))).reshape(-1, 2)
        # canopy patches taller than a shrub but with no detected top get one tree at their highest point
        patch, npch = ndi.label(veg)
        if npch:
            has = np.zeros(npch + 1, bool)
            has[patch[tops]] = True
            pmax = np.asarray(ndi.maximum(chs, patch, np.arange(1, npch + 1)))
            need = np.flatnonzero(~has[1:] & (pmax > 3.0)) + 1
            if len(need):
                pos = np.array(ndi.maximum_position(chs, patch, need), float).reshape(-1, 2)
                cen = np.vstack([cen, pos])
                nt = len(cen)
        markers = np.zeros(chm.shape, np.int32)
        if nt:
            markers[cen[:, 0].astype(int), cen[:, 1].astype(int)] = np.arange(1, nt + 1)
        # each canopy cell belongs to the nearest tree top in the same canopy patch
        crowns = np.zeros(chm.shape, np.int32)
        if nt:
            near = ndi.distance_transform_edt(markers == 0, return_distances=False, return_indices=True)
            crowns = markers[near[0], near[1]]
            patch, _ = ndi.label(veg)
            crowns = np.where(veg & (patch == patch[near[0], near[1]]), crowns, 0)
        th = np.zeros(nt + 1, np.float32)
        if nt:
            th[1:] = chm[cen[:, 0].astype(int), cen[:, 1].astype(int)]
            area = ndi.sum(np.ones_like(chm), crowns, np.arange(1, nt + 1)) * 0.25
        T = th[crowns]
        base = np.where(crowns > 0, np.maximum(0.3 * T, 1.5), 0.3)
        # rounded underside: mirror the canopy top about the crown's mid-height
        mid = (T + base) / 2
        under = np.where(chm > mid, mid - 0.8 * (chm - mid), chm - 1.0)
        bot = np.where(crowns > 0, np.clip(under, base, np.maximum(chm - 1.0, base)), 0.35)
        bot = np.maximum(0.35, np.minimum(bot, chm - 0.7))
        shrub = veg & (crowns == 0)
        chm = np.where(shrub, np.minimum(chm, 2.5), chm)                 # trees get blob crowns; shrubs follow the canopy model
        self.leaf_top = np.where(shrub, self.g05 + chm, np.nan).astype(np.float32)
        self.leaf_bot = np.where(shrub, self.g05 + bot, np.nan).astype(np.float32)
        kind = np.array([0] + [(_h(f"t{i}") % 10) for i in range(1, nt + 1)], np.int32)
        kind = np.where(kind < 6, 0, np.where(kind < 9, 1, 3))
        self.leaf_kind = np.where(crowns > 0, kind[crowns], 2).astype(np.uint8)
        self.leaf_kind[veg & (crowns == 0) & (chm > 3)] = 0
        self.trees = []
        for i in range(nt):
            r05, c05 = cen[i]
            H = float(th[i + 1])
            if area[i] < 2.5 or H < 3.0:            # poles, wires, lidar noise
                continue
            g = float(self.g05[int(r05), int(c05)])
            self.trees.append({
                "r": int((r05 + 0.5) * 0.5 / self.bs), "c": int((c05 + 0.5) * 0.5 / self.bs),
                "y0": int(self.yb(g)) + 1, "y1": int(self.yb(g + max(0.3 * H, 1.5) + 0.35 * (H - max(0.3 * H, 1.5)))),
                "w": 1 if H < 9 else 2 if H < 17 else 3, "kind": int(kind[i + 1]),
                "rad": float(np.clip(max(1.15 * math.sqrt(area[i] / math.pi), 0.25 * H), 1.2, 0.6 * H)), "H": H,
                "base": float(g + max(0.3 * H, 1.5)), "top": float(g + H), "seed": _h(f"tree{i}")})
        for t in self.trees:
            t["species"] = species_for(t["H"], t["rad"], t["seed"])
            if t["species"] == "live_oak":
                t["rad"] *= 1.1
            t["y_top"] = int(self.yb(t["top"]))
        self.log(f"  {len(self.trees)} trees, canopy {veg.sum() * 0.25 / 1e4:.1f} ha")

    def _extras(self):
        """Hedges and garden walls as thin raised lines."""
        im, d = self._draw(self.bs)
        for f in self.feats:
            t = f["tags"]
            if f["kind"] in ("way", "area") and t.get("barrier") == "hedge":
                self._line(d, f, self.bs, 1, _num(t.get("width")) or 1.0)
            elif f["kind"] in ("way", "area") and t.get("barrier") in ("wall", "retaining_wall"):
                self._line(d, f, self.bs, 2, 0.34)
        self.extra = np.array(im, np.uint8)
        self.extra[self.bid >= 0] = 0

    # ------------------------------------------------------------ regions
    def y_top(self):
        tops = [B["top_z"] for B in self.blds if not B.get("skip")]
        t = max(tops + [float(np.nanmax(self.leaf_top)) if np.isfinite(self.leaf_top).any() else self.z0])
        return int(self.yb(t)) + 4

    def region(self, rx, rz):
        """Blocks for region (rx, rz): array (512 z, 512 x, H) of palette indices, layer 0 = Y_MIN."""
        P = self.pal
        H = (self.y_top() - Y_MIN + 16) // 16 * 16
        r0, c0 = rz * 512, rx * 512
        r1, c1 = min(r0 + 512, self.NZ), min(c0 + 512, self.NX)
        if r0 >= self.NZ or c0 >= self.NX:
            return None, []
        A = np.zeros((512, 512, H), np.uint16)
        nz, nx = r1 - r0, c1 - c0
        sl = (slice(r0, r1), slice(c0, c1))
        yy = np.arange(H, dtype=np.int32) + Y_MIN
        g = self.ground_y[sl].astype(np.int32)
        surf = self.surf[sl]
        wy = self.water_y[sl].astype(np.int32)
        a = A[:nz, :nx]
        # terrain
        a[:, :, 0] = P("bedrock")
        a[(yy[None, None, :] > Y_MIN) & (yy[None, None, :] <= (g - 4)[..., None])] = P("stone")
        a[(yy[None, None, :] > (g - 4)[..., None]) & (yy[None, None, :] < g[..., None])] = P("dirt")
        top = np.array([P(s) for s in SURF], np.uint16)[surf]
        water = surf == S_WATER
        top = np.where(water, P("stone_bricks"), top)
        topy = np.where(water, wy - 2, g)
        rr, cc = np.indices((nz, nx))
        a[rr, cc, (topy - Y_MIN).clip(0, H - 1)] = top
        for k in (0, 1):
            m = water & (wy > -999)
            a[rr[m], cc[m], (wy[m] - k - Y_MIN)] = P("water[level=0]")
        # clear anything above the water level (banks cut down)
        for k in range(1, 4):
            m = water & (g >= wy + k)
            a[rr[m], cc[m], (wy[m] + k - Y_MIN).clip(0, H - 1)] = 0
        rim = self.fountain_rim[sl]
        for k in (1, 2):
            a[rr[rim], cc[rim], (g[rim] + k - Y_MIN)] = P("smooth_quartz") if k == 1 else P("smooth_quartz_slab[type=bottom,waterlogged=false]")
        fluid = []
        for (fr, fc, fy) in self.fountains:
            if r0 <= fr < r1 and c0 <= fc < c1:
                lr, lc = fr - r0, fc - c0
                for dr in (0, 1):
                    for dc in (0, 1):
                        for y in range(fy - 1, fy + 5):
                            a[lr + dr, lc + dc, y - Y_MIN] = P("quartz_pillar[axis=y]")
                a[lr, lc, fy + 5 - Y_MIN] = P("water[level=0]")
                fluid.append((fc, fy + 5, fr))
        # extras
        ex = self.extra[sl]
        for val, blk, hgt in ((1, "oak_leaves[distance=1,persistent=true,waterlogged=false]", 4), (2, "bricks", 5),
                              (3, "azalea_leaves[distance=1,persistent=true,waterlogged=false]", 3)):
            m = ex == val
            if val == 3:                                  # foundation shrubs: some flowering, a soft top edge
                hh = _hash(rr + r0, cc + c0, 0, 23) % 100
                for k in range(1, hgt + 1):
                    mk = m & ~((k == hgt) & (hh < 30))
                    a[rr[mk], cc[mk], (g[mk] + k - Y_MIN).clip(0, H - 1)] = np.where(
                        hh[mk] < 18, P("flowering_azalea_leaves[distance=1,persistent=true,waterlogged=false]"), P(blk))
                continue
            for k in range(1, hgt + 1):
                a[rr[m], cc[m], (g[m] + k - Y_MIN).clip(0, H - 1)] = P(blk)
        self._fill_buildings(a, sl, yy, H)
        self._fill_trees(a, r0, c0, nz, nx, H)
        for m, ycut in getattr(self, "carves", []):
            mm = m[r0:r0 + nz, c0:c0 + nx]
            if mm.any():
                a[mm, max(ycut - Y_MIN, 0):] = 0
        _paste_heroes(self, a, r0, c0, nz, nx, H)
        self._decorate(a, r0, c0, nz, nx, g)
        self._objects(a, r0, c0, nz, nx, g, H)
        self._texture(a, r0, c0)
        return A, fluid

    def _objects(self, a, r0, c0, nz, nx, g, H):
        """Street furniture from the streetscape list (lamps, benches, signs...)."""
        from .street import object_blocks
        P = self.pal
        for (r, c, kind, info) in self.street.objects:
            if not (r0 - 10 <= r < r0 + nz + 10 and c0 - 10 <= c < c0 + nx + 10):
                continue
            h = int(_hash(r, c, 0, 31))
            gy = int(self.ground_y[min(max(r, 0), self.NZ - 1), min(max(c, 0), self.NX - 1)])
            for dr, dc, dy, st in object_blocks(kind, info, h):
                lr, lc = r + dr - r0, c + dc - c0
                y = gy + dy - Y_MIN
                if 0 <= lr < nz and 0 <= lc < nx and 0 < y < H:
                    cur = a[lr, lc, y]
                    if cur == 0 or self.pal.states[cur].split("[")[0].split(":")[1] in ("short_grass",) or \
                            self.pal.states[cur].split("[")[0].endswith(("leaves", "tulip", "poppy", "dandelion",
                                                                          "allium", "bluet", "daisy", "cornflower")):
                        a[lr, lc, y] = P(st)

    def _decorate(self, a, r0, c0, nz, nx, g):
        """Curbs, lawn grass and flowers, flower beds, bare earth under trees (on top of the terrain)."""
        P = self.pal
        sl = (slice(r0, r0 + nz), slice(c0, c0 + nx))
        rr, cc = np.indices((nz, nx))
        gy = g - Y_MIN
        top = a[rr, cc, gy]
        above = a[rr, cc, gy + 1]
        h = _hash(rr + r0, cc + c0, g, 7) % 1000
        free = (above == 0)
        # curb: a half-block lip at the road edge
        m = self.curb[sl] & free
        a[rr[m], cc[m], gy[m] + 1] = P("smooth_stone_slab[type=bottom,waterlogged=false]")
        grass = top == P(SURF[S_GRASS])
        leaves = {P(f"{lv}[distance=1,persistent=true,waterlogged=false]") for lv in LEAVES}
        shade = np.isin(a, list(leaves)).any(axis=2)
        # bare patches under trees, grass and flowers in open lawns, beds full of flowers
        m = grass & shade & (h < 150)
        a[rr[m], cc[m], gy[m]] = np.where(h[m] < 100, P("coarse_dirt"), P("podzol[snowy=false]"))
        flowers = np.array([P(f) for f in FLOWERS], np.uint16)
        lawn = grass & ~shade & free & self.lawn[sl]
        m = lawn & (h < 35)
        a[rr[m], cc[m], gy[m] + 1] = P("short_grass")
        m = lawn & (h >= 35) & (h < 40)
        kind = _hash(rr + r0, cc + c0, g, 17) % len(flowers)
        a[rr[m], cc[m], gy[m] + 1] = flowers[kind[m]]
        m = grass & free & self.bed[sl] & (h < 450)
        a[rr[m], cc[m], gy[m] + 1] = flowers[kind[m]]

    def _texture(self, a, r0, c0):
        """Scatter close variants through big single-block surfaces, as builders do."""
        P = self.pal
        for base, variants in TEXTURE.items():
            bid = self.pal.idx.get("minecraft:" + base)
            if bid is None:
                continue
            r, c, y = np.nonzero(a == bid)
            if not len(r):
                continue
            # clustered noise: half from 2x2x2 cells, half per block, so variants form small patches
            fine = _hash(r + r0, c + c0, y, 13)
            h = np.where(fine % 2 == 0, _hash((r + r0) // 2, (c + c0) // 2, y // 2, 11), fine // 2) % 1000
            lo = 0
            for name, frac in variants:
                hi = lo + int(frac * 1000)
                m = (h >= lo) & (h < hi)
                a[r[m], c[m], y[m]] = P(name)
                lo = hi

    def _fill_buildings(self, a, sl, yy, H):
        P = self.pal
        bid = self.bid[sl]
        nz, nx = bid.shape
        inb = (bid >= 0) & ~self.skip[np.maximum(bid, 0)]
        if not inb.any():
            self._cornice(a, sl, H)
            return
        r0, c0 = sl[0].start, sl[1].start
        # half-block roof heights for the 4 sub-cells of each block
        rr, cc = np.nonzero(inb)
        sub_r = (r0 + rr)[:, None] * 2 + np.array([0, 0, 1, 1])[None, :]     # dz
        sub_c = (c0 + cc)[:, None] * 2 + np.array([0, 1, 0, 1])[None, :]     # dx
        zr = (sub_r + 0.5) * (self.bs / 2) / 0.5 - 0.5
        zc = (sub_c + 0.5) * (self.bs / 2) / 0.5 - 0.5
        rz = ndi.map_coordinates(self.roof05, [zr.ravel(), zc.ravel()], order=1, mode="nearest").reshape(-1, 4)
        L = np.round((rz - self.z0) * 6).astype(np.int32) + 2 * Y0           # half-block top (exclusive)
        b = bid[rr, cc]
        base = self.base_y[sl][rr, cc].astype(np.int32)
        L = np.maximum(L, 2 * (base + 2)[:, None])
        lo = L.min(1) // 2                                                   # first block with a partial top
        hi = (L.max(1) + 1) // 2                                             # exclusive
        code_b = self.bcode[sl][rr, cc]
        corner = self.corner[sl][rr, cc]
        straight = self.straight[sl][rr, cc]
        bnd = code_b > 0
        styles = [STYLES[B["style"]] for B in self.blds]
        flat = self.flat[b]
        eave = self.eave_y[b]
        # roof surface blocks with half-block shapes
        roof_fam = np.array([B.get("roof", "deepslate_tiles") if not B.get("flat") else STYLES[B["style"]]["flat"]
                             for B in self.blds], dtype=object)
        wall_fam = np.array([B.get("wall", "bricks") for B in self.blds], dtype=object)
        # stadium aisles: radial lines 2 blocks wide, about every 9 m around the bowl
        stad = np.array([B["style"] == "stadium" for B in self.blds])[b]
        flat_l = self.flat_local[sl][rr, cc]
        aisle = np.zeros(len(b), bool)
        if stad.any():
            cz_ = np.array([B.get("cz", 0) for B in self.blds])[b]
            cx_ = np.array([B.get("cx", 0) for B in self.blds])[b]
            dz, dx = (rr + r0) - cz_, (cc + c0) - cx_
            rho = np.hypot(dz, dx) + 1e-6
            n = 48
            frac = (np.arctan2(dz, dx) / (2 * np.pi) * n) % 1.0
            aisle = stad & (np.minimum(frac, 1 - frac) * 2 * np.pi * rho / n < 1.0)
        for k in range(int((hi - lo).max()) + 1):
            y = lo + k
            m = y < hi
            if not m.any():
                continue
            code = np.zeros(m.sum(), np.int64)
            Lm = L[m]
            for dy in (0, 1):
                for q, (dz, dx) in enumerate(((0, 0), (0, 1), (1, 0), (1, 1))):
                    filled = (2 * y[m] + dy) < Lm[:, q]
                    code |= filled.astype(np.int64) << (dy * 4 + dz * 2 + dx)
            # only the top layer is roof; partial blocks lower down are the side of a step -> wall
            lower = y[m] < hi[m] - 2
            # material: 0 roof, 1 wall (side of a step), 2 stadium aisle, 3 flat part of a stadium
            # 4 = upper-deck seats (blue)
            upper = stad[m] & ((hi[m] - base[m]) > 29)
            high = stad[m] & ((hi[m] - base[m]) > 54)
            mc = np.where(lower, 1, np.where(stad[m] & (flat_l[m] | high), 3, np.where(aisle[m], 2, np.where(upper, 4, 0))))
            key = (b[m].astype(np.int64) * 8 + mc) * 256 + code
            uk, inv = np.unique(key, return_inverse=True)
            fams = lambda k: (roof_fam[k // 2048], wall_fam[k // 2048], "polished_andesite", "smooth_stone",
                              "blue_concrete")[(k // 256) % 8]
            idx = np.array([P.shaped(fams(k), int(k % 256)) for k in uk], np.uint16)[inv]
            ok = (y[m] - Y_MIN >= 0) & (y[m] - Y_MIN < H)
            a[rr[m][ok], cc[m][ok], (y[m] - Y_MIN)[ok]] = idx[ok]
        # deck under the roof surface, floor
        deck = lo - 1
        fam_full = np.array([P(FAM[f].full) for f in roof_fam[b]], np.uint16)
        a[rr, cc, deck - Y_MIN] = fam_full
        a[rr, cc, base - Y_MIN] = P("polished_andesite")
        # steps inside the roof: wall face down to the lowest neighbouring deck
        slo = self.step_lo[sl][rr, cc].astype(np.int32)
        sm = ~bnd & (slo + 1 < deck)
        if sm.any():
            n = deck[sm] - (slo[sm] + 1)
            rep = np.repeat(np.flatnonzero(sm), n)
            ys = slo[sm][np.repeat(np.arange(sm.sum()), n)] + 1 + \
                (np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n))
            wall_ids = np.array([P(FAM[B.get("wall", "bricks")].full) for B in self.blds], np.uint16)
            ok = ys > base[rep]
            vals = np.where(deck[rep] - slo[rep] > 3, wall_ids[b[rep]], fam_full[rep])
            # stadium press box: the tall face above the seats is glass suites with a sign band
            pb = getattr(self, "pressbox", None)
            if pb is not None:
                big = stad[rep] & (deck[rep] - slo[rep] > 15) & (ys - base[rep] > 30)
                if big.any():
                    from .stadium import press_box_block
                    rel = ys - slo[rep] - 1
                    col = pb["rc"] - (rr[rep] + r0) + pb["sign"].shape[1] // 2
                    for i in np.flatnonzero(big):
                        vals[i] = P(press_box_block(int(rel[i]), int(col[i]), pb["sign"]))
            a[rr[rep][ok], cc[rep][ok], ys[ok] - Y_MIN] = vals[ok]
        # walls on the boundary: from base+1 up to the deck
        wr, wc = rr[bnd], cc[bnd]
        wb, wbase, wtop = b[bnd], base[bnd], deck[bnd]
        n = np.maximum(wtop - wbase - 1, 0)
        if n.sum():
            rep = np.repeat(np.arange(len(wr)), n)
            ys = wbase[rep] + 1 + (np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n))
            vals = self._facade(wb[rep], ys, wbase[rep], wr[rep] + r0, wc[rep] + c0, code_b[bnd][rep],
                                corner[bnd][rep], straight[bnd][rep], np.minimum(eave[bnd][rep] + 12, wtop[rep]),
                                styles, self.street.door[sl][wr, wc][rep])
            a[wr[rep], wc[rep], ys - Y_MIN] = vals
        # flat roofs: parapet on the boundary
        pm = bnd & flat
        if pm.any():
            trim = np.array([P(FAM[STYLES[self.blds[k]["style"]]["trim"]].full) for k in b[pm]], np.uint16)
            yv = hi[pm]
            a[rr[pm], cc[pm], (yv - Y_MIN).clip(0, H - 1)] = trim
        self._cornice(a, sl, H)

    def _cornice(self, a, sl, H):
        P = self.pal
        cy = self.cornice_y[sl].astype(np.int32)
        m = cy > -32768
        if not m.any():
            return
        rr, cc = np.nonzero(m)
        y = cy[m] - Y_MIN
        ok = (y > 0) & (y < H)
        rr, cc, y = rr[ok], cc[ok], y[ok]
        free = a[rr, cc, y] == 0
        a[rr[free], cc[free], y[free]] = P("smooth_quartz_slab[type=top,waterlogged=false]")

    def _facade(self, b, y, base, r, c, code, corner, straight, eave, styles, door=None):
        """Block for each wall position (vectorised)."""
        P = self.pal
        out = np.zeros(len(b), np.uint16)
        sty = [styles[k] for k in range(len(styles))]
        wall = np.array([P(FAM[B.get("wall", "bricks")].full) for B in self.blds], np.uint16)[b]
        basem = np.array([P(FAM[s["base"]].full) for s in sty], np.uint16)[b]
        trim = np.array([P(FAM[s["trim"]].full) for s in sty], np.uint16)[b]
        fh = np.array([s["fh"] for s in sty])[b]
        ww = np.array([s["ww"] for s in sty])[b]
        wh = np.array([s["wh"] for s in sty])[b]
        sp = np.array([s["sp"] for s in sty])[b]
        wy = np.array([s["wy"] for s in sty])[b]
        glass = np.array([s["glass"] or "" for s in sty], dtype=object)[b]
        garage = np.array([s is STYLES["garage"] for s in sty])[b]
        roofonly = np.array([s is STYLES["roof"] for s in sty])[b]
        out[:] = wall
        rel = y - base
        out[rel <= 2] = basem[rel <= 2]
        # windows
        ns = (code & 3) > 0                         # faces north/south -> runs along x
        cx = np.array([B.get("cx", 0) for B in self.blds])[b]
        cz = np.array([B.get("cz", 0) for B in self.blds])[b]
        t = np.where(ns, c - cx, r - cz)
        u = (t + ww // 2) % np.maximum(sp, 1)
        fh_safe = np.maximum(fh, 1)
        row = rel % fh_safe
        storey_top = base + (rel // fh_safe) * fh_safe + wy + wh
        can = straight & (fh > 0) & (storey_top < eave - 1) & (rel >= wy)
        inwin = can & (u < ww) & (row >= wy) & (row < wy + wh)
        frame = can & ((u == ww) | (u == sp - 1)) & (row >= wy - 1) & (row <= wy + wh)
        sill = can & (u < ww) & ((row == wy - 1) | (row == wy + wh))
        out[frame | sill] = trim[frame | sill]
        gl = inwin & ~garage
        if gl.any():
            gi = np.flatnonzero(gl)
            key = b[gi].astype(np.int64) * 2 + ns[gi]
            uk, inv = np.unique(key, return_inverse=True)
            vals = []
            for k in uk:
                g, along_x = glass[np.flatnonzero(b == k // 2)[0]], bool(k % 2)
                ew, nsx = ("true", "false") if along_x else ("false", "true")
                vals.append(P(f"{g}[east={ew},north={nsx},south={nsx},waterlogged=false,west={ew}]"))
            out[gi] = np.array(vals, np.uint16)[inv]
        out[inwin & garage] = 0
        # sash windows: a white meeting rail across the middle of each window
        rail = inwin & ~garage & (row == wy + wh // 2)
        out[rail] = trim[rail]
        # doorways: dark double door, white surround, glass fanlight, slab hood
        if door is not None:
            dm = door > 0
            off = np.abs(door.astype(int) - 3)
            mid = dm & (off <= 1)
            edge = dm & (off == 2)
            r1 = (rel >= 1) & (rel <= 7)
            out[mid & r1] = P("dark_oak_planks")
            out[edge & (rel >= 1) & (rel <= 9)] = trim[edge & (rel >= 1) & (rel <= 9)]
            fan = mid & (rel == 8)
            if fan.any():
                ew = ((code & 3) > 0)[fan]
                out[fan] = np.where(ew, P("gray_stained_glass_pane[east=true,north=false,south=false,waterlogged=false,west=true]"),
                                    P("gray_stained_glass_pane[east=false,north=true,south=true,waterlogged=false,west=false]"))
            out[mid & (rel == 9)] = trim[mid & (rel == 9)]
        # corner quoins
        q = corner & (rel > 2) & (((rel // 2) % 2) == 0)
        out[q] = trim[q]
        # roof-only structures: pillars at corners, open elsewhere
        out[roofonly & ~corner] = 0
        return out

    def _fill_trees(self, a, r0, c0, nz, nx, H):
        P = self.pal
        rows = (((np.arange(nz) + r0) + 0.5) * self.bs / 0.5).astype(int).clip(0, self.leaf_top.shape[0] - 1)
        cols = (((np.arange(nx) + c0) + 0.5) * self.bs / 0.5).astype(int).clip(0, self.leaf_top.shape[1] - 1)
        top = self.leaf_top[np.ix_(rows, cols)]
        bot = self.leaf_bot[np.ix_(rows, cols)]
        kind = self.leaf_kind[np.ix_(rows, cols)]
        m = np.isfinite(top)
        if m.any():
            rr, cc = np.nonzero(m)
            yt = self.yb(top[m])
            yb_ = np.maximum(self.yb(bot[m]), self.ground_y[r0:r0 + nz, c0:c0 + nx][m] + 1)
            n = np.maximum(yt - yb_ + 1, 0)
            # sparse holes so crowns aren't solid lumps
            rep = np.repeat(np.arange(len(rr)), n)
            ys = yb_[rep] + (np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n))
            leaves = np.array([P(f"{lv}[distance=1,persistent=true,waterlogged=false]") for lv in LEAVES], np.uint16)
            vals = leaves[kind[m][rep]]
            gr, gc = rr[rep], cc[rep]
            ok = (ys - Y_MIN > 0) & (ys - Y_MIN < H)
            gr, gc, ys, vals = gr[ok], gc[ok], ys[ok], vals[ok]
            hole = ((gr * 73856093 ^ gc * 19349663 ^ ys * 83492791) % 13) == 0
            free = (a[gr, gc, ys - Y_MIN] == 0) & ~hole
            a[gr[free], gc[free], ys[free] - Y_MIN] = vals[free]
        for t in self.trees:
            if not (r0 - 60 <= t["r"] < r0 + nz + 60 and c0 - 60 <= t["c"] < c0 + nx + 60):
                continue
            logs, axis, lv, leaf, log = grow(t, self.bs, _hash)
            # leaves fill air only; wood replaces air and leaves (its own or a neighbour's)
            lr, lc, ly = lv[:, 2] - r0, lv[:, 0] - c0, lv[:, 1] - Y_MIN
            ok = (lr >= 0) & (lr < nz) & (lc >= 0) & (lc < nx) & (ly > 0) & (ly < H)
            lr, lc, ly = lr[ok], lc[ok], ly[ok]
            free = a[lr, lc, ly] == 0
            a[lr[free], lc[free], ly[free]] = P(f"{leaf}[distance=1,persistent=true,waterlogged=false]")
            wr, wc, wy = logs[:, 2] - r0, logs[:, 0] - c0, logs[:, 1] - Y_MIN
            ok = (wr >= 0) & (wr < nz) & (wc >= 0) & (wc < nx) & (wy > 0) & (wy < H)
            wr, wc, wy, ax = wr[ok], wc[ok], wy[ok], axis[ok]
            if not len(wr):
                continue
            cur = a[wr, wc, wy]
            leafy = np.array([self.pal.states[i].split("[")[0].endswith("leaves") for i in range(len(self.pal.states))])
            put = (cur == 0) | leafy[cur]
            ids = np.array([P(f"{log}[axis={x}]") for x in "xyz"], np.uint16)
            a[wr[put], wc[put], wy[put]] = ids[ax[put]]


# ------------------------------------------------------------ helpers
def _num(v):
    if v is None:
        return None
    try:
        return float(str(v).split()[0].replace("m", "").replace(",", "."))
    except ValueError:
        return None


def _inside(poly, x, y):
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1:
            c = not c
    return c


def _fill_nearest_1d(mask2d, vals):
    """vals are the masked cells of a 2D window; fill NaNs from the nearest valid masked cell."""
    full = np.full(mask2d.shape, np.nan, np.float32)
    full[mask2d] = vals
    bad = ~np.isfinite(full)
    if bad.all():
        return np.nan_to_num(vals)
    idx = ndi.distance_transform_edt(bad, return_distances=False, return_indices=True)
    return full[tuple(idx)][mask2d]


def _snap_planes(v, bin_=0.2, tol=0.3):
    """Pull heights onto the roof's dominant levels (flat roofs, penthouses) to remove lidar noise."""
    if len(v) < 20:
        return v
    lo, hi = float(v.min()), float(v.max())
    nb = max(int((hi - lo) / bin_) + 1, 1)
    hist, edges = np.histogram(v, bins=nb, range=(lo, lo + nb * bin_))
    centres = (edges[:-1] + edges[1:]) / 2
    sm = np.convolve(hist, [1, 2, 1], "same")
    peaks = [i for i in range(nb) if sm[i] >= 0.06 * len(v) * 4 and sm[i] == sm[max(i - 2, 0):i + 3].max()]
    if not peaks:
        return v
    out = v.copy()
    for i in peaks:
        sel = (v >= edges[max(i - 1, 0)]) & (v < edges[min(i + 2, nb)])
        lvl = float(np.median(v[sel])) if sel.any() else centres[i]
        out[np.abs(v - lvl) < tol] = lvl
    return out


def build_world(site: Site, out_dir: str, name: str, spawn_name: str | None = None, log=print):
    """Write every region of the site to a world folder; returns (top-down map image, stats)."""
    import os
    import time
    from .sitepreview import color_table
    from .world import WorldWriter
    nrx, nrz = -(-site.NX // 512), -(-site.NZ // 512)
    # palette must be complete before the writer parses it, so the writer re-reads it per region
    top = np.zeros((site.NZ, site.NX, 3), np.uint8)
    hgt = np.zeros((site.NZ, site.NX), np.int16)
    stats = {"blocks": 0, "chunks": 0}
    t0 = time.time()
    writer = None
    for rz in range(nrz):
        for rx in range(nrx):
            A, fluid = site.region(rx, rz)
            if A is None:
                continue
            writer = WorldWriter(out_dir, site.pal.states)
            n = writer.write_region(rx, rz, A.transpose(1, 2, 0), fluid_ticks=fluid)
            stats["chunks"] += n
            nz_, nx_ = min(512, site.NZ - rz * 512), min(512, site.NX - rx * 512)
            sub = A[:nz_, :nx_]
            solid = sub != 0
            ti = sub.shape[2] - 1 - np.argmax(solid[:, :, ::-1], axis=2)
            ids = np.take_along_axis(sub, ti[..., None], 2)[..., 0]
            top[rz * 512:rz * 512 + nz_, rx * 512:rx * 512 + nx_] = color_table(site.pal.states)[ids].astype(np.uint8)
            hgt[rz * 512:rz * 512 + nz_, rx * 512:rx * 512 + nx_] = ti
            stats["blocks"] += int((sub[:, :, 1:] != 0).sum())
            log(f"  region {rx},{rz}: {n} chunks  [{time.time() - t0:.0f}s]")
    # spawn: in front of the named building, else the middle
    r, c = site.NZ // 2, site.NX // 2
    if spawn_name:
        k = next((i for i, B in enumerate(site.blds) if B["name"] == spawn_name), None)
        if k is not None:
            rows = np.nonzero((site.bid == k).any(1))[0]
            r, c = int(rows.max()) + 30, site.blds[k]["cx"]
    sy = int(hgt[min(r, site.NZ - 1), min(c, site.NX - 1)]) + Y_MIN + 1
    writer.write_level(name, (c, sy, r))
    stats["spawn"] = (c, sy, r)
    # hill-shaded map
    h = hgt.astype(np.float32)
    light = np.clip(1.0 + 0.12 * (-np.gradient(h, axis=1) - np.gradient(h, axis=0)), 0.6, 1.3)
    img = Image.fromarray(np.clip(top * light[..., None], 0, 255).astype(np.uint8))
    return img, stats


# ------------------------------------------------------------ hero buildings
ROT_FACING = ["north", "east", "south", "west"]


def rotate_state(s: str, quarter: int) -> str:
    """Rotate a block state clockwise (seen from above) by quarter turns."""
    quarter %= 4
    if not quarter or "[" not in s:
        return s
    name, props = s[:-1].split("[", 1)
    kv = dict(p.split("=", 1) for p in props.split(","))
    if "facing" in kv and kv["facing"] in ROT_FACING:
        kv["facing"] = ROT_FACING[(ROT_FACING.index(kv["facing"]) + quarter) % 4]
    if "axis" in kv and kv["axis"] in ("x", "z") and quarter % 2:
        kv["axis"] = "z" if kv["axis"] == "x" else "x"
    sides = {d: kv[d] for d in ROT_FACING if d in kv}
    for d, v in sides.items():
        kv[ROT_FACING[(ROT_FACING.index(d) + quarter) % 4]] = v
    return name + "[" + ",".join(f"{k}={v}" for k, v in kv.items()) + "]"


def add_hero(site: Site, building_name, spec: dict, quarter: int = 0, at=None, extras=None, keep=False, log=print):
    """Replace lidar massing with a detailed spec build.

    building_name: one OSM building name, or a list of names, whose massing the spec replaces.
    at: None -> centre the spec on the (first) building's footprint; or (x, y) local metres where the
        spec's origin (0, 0) goes (spec x = east, spec z = south).
    extras: optional dict for the ground around it, in spec coordinates (metres):
        "ground": [{"shape": "rect"|"ellipse", "x", "z", "w", "d", "surface": SURF name}, ...] painted in order,
        "lamps"/"benches": [[x, z(, facing)], ...], "trees": [[x, z, height, radius, species], ...],
        "clear": [x0, z0, x1, z1] area where 2018 lidar trees and shrubs are removed.
    quarter: clockwise quarter turns (0 = spec front faces south)."""
    from .semantic import build_from_spec, spec_meshes
    names = [building_name] if isinstance(building_name, str) else list(building_name)
    ks = [i for i, B in enumerate(site.blds) if B["name"] in names]
    if not ks and not keep:
        raise KeyError(building_name)
    b = build_from_spec(spec, block_size=site.bs, target="1.21")
    x, y, z = b.coords[:, 0], b.coords[:, 1], b.coords[:, 2]
    X, Z = b.size[0], b.size[2]
    for _ in range(quarter % 4):                 # clockwise from above: (x, z) -> (Z-1-z, x)
        x, z = (Z - 1 - z), x
        X, Z = Z, X
    states = [rotate_state(s, quarter) for s in b.states]
    if at is None:
        rows, cols = np.nonzero(site.bid == ks[0])          # align bounding-box centres
        r0 = (rows.min() + rows.max() + 1) // 2 - Z // 2
        c0 = (cols.min() + cols.max() + 1) // 2 - X // 2
        y0 = site.blds[ks[0]]["base_y"] + 1
    else:
        meshes = [m for m, _, mode in spec_meshes(spec) if mode == "solid"]
        lo = np.min([m.bounds[0] for m in meshes], axis=0)
        c0 = int(round((at[0] + lo[0]) / site.bs))
        r0 = int(round((site.Hm - (at[1] - lo[2])) / site.bs))
        rr_, cc_ = int(round((site.Hm - at[1]) / site.bs)), int(round(at[0] / site.bs))
        y0 = int(site.ground_y[min(max(rr_, 0), site.NZ - 1), min(max(cc_, 0), site.NX - 1)]) + 1
    idx = np.array([site.pal(s) for s in states], np.uint16)
    site.heroes = getattr(site, "heroes", [])
    site.heroes.append({"k": ks[0] if ks else -1, "r": r0 + z, "c": c0 + x, "y": y0 + y, "ids": idx})
    for k in ([] if keep else ks):
        site.skip[k] = True
        ring = ndi.binary_dilation(site.bid == k, iterations=1) & (site.bid != k)
        site.cornice_y[ring] = -32768
    if extras and at is not None:
        _hero_extras(site, extras, at, y0)
    log(f"  hero {names[0]}: {len(idx)} blocks, {X}x{b.size[1]}x{Z}")


def _hero_extras(site, ex, at, y0):
    """Ground, lamps, benches and trees around a hero, given in its spec coordinates."""
    to_rc = lambda x, z: (int(round((site.Hm - (at[1] - z)) / site.bs)), int(round((at[0] + x) / site.bs)))
    if "clear" in ex:
        x0, z0, x1, z1 = ex["clear"]
        (ra, ca), (rb, cb) = to_rc(x0, z0), to_rc(x1, z1)
        r_lo, r_hi, c_lo, c_hi = min(ra, rb), max(ra, rb), min(ca, cb), max(ca, cb)
        site.trees = [t for t in site.trees if not (r_lo <= t["r"] <= r_hi and c_lo <= t["c"] <= c_hi)]
        f = site.bs / 0.5
        site.leaf_top[int(r_lo * f):int(r_hi * f) + 1, int(c_lo * f):int(c_hi * f) + 1] = np.nan
        site.extra[r_lo:r_hi + 1, c_lo:c_hi + 1] = 0
        site.cornice_y[r_lo:r_hi + 1, c_lo:c_hi + 1] = -32768
        site.street.objects = [o for o in site.street.objects
                               if not (r_lo <= o[0] <= r_hi and c_lo <= o[1] <= c_hi)]
        for k, B in enumerate(site.blds):                    # anything else that stood there in 2018
            if r_lo <= B.get("cz", -1) <= r_hi and c_lo <= B.get("cx", -1) <= c_hi:
                site.skip[k] = True
    for gnd in ex.get("ground", []):
        im = Image.new("L", (site.NX, site.NZ), 0)
        d = ImageDraw.Draw(im)
        (ra, ca) = to_rc(gnd["x"] - gnd["w"] / 2, gnd["z"] - gnd["d"] / 2)
        (rb, cb) = to_rc(gnd["x"] + gnd["w"] / 2, gnd["z"] + gnd["d"] / 2)
        box = [min(ca, cb), min(ra, rb), max(ca, cb), max(ra, rb)]
        (d.ellipse if gnd["shape"] == "ellipse" else d.rectangle)(box, fill=1)
        m = np.asarray(im) > 0
        site.surf[m] = site.S[gnd["surface"]]
        site.lawn[m] = gnd["surface"] == "grass_block" and gnd.get("lawn", True)
        site.ground_y[m & (site.bid < 0)] = y0 - 1
    for cv in ex.get("carve", []):                       # clear everything above y inside a polygon
        im = Image.new("L", (site.NX, site.NZ), 0)
        pts = [to_rc(x, z)[::-1] for x, z in cv["poly"]]
        ImageDraw.Draw(im).polygon(pts, fill=1)
        site.carves = getattr(site, "carves", []) + [(np.asarray(im) > 0, y0 + int(round(cv["y"] / site.bs)))]
    for p in ex.get("lamps", []):
        site.street.objects.append((*to_rc(p[0], p[1]), "lamp", None))
    for p in ex.get("benches", []):
        site.street.objects.append((*to_rc(p[0], p[1]), "bench", p[2] if len(p) > 2 else "north"))
    from .pixfont import text as pixtext
    for sg in ex.get("signs", []):                       # raised letters mounted on a wall face
        bm = pixtext(sg["text"])
        r, c = to_rc(sg["x"], sg["z"])
        out = {"west": (0, -1, 1), "east": (0, 1, -1), "north": (-1, 0, -1), "south": (1, 0, 1)}[sg.get("facing", "west")]
        base = int(round(sg.get("y", 1) / site.bs))
        blocks = []
        for row, col in zip(*np.nonzero(bm)):
            o = (col - bm.shape[1] // 2) * out[2]
            dr, dc = (o, out[1]) if out[0] == 0 else (out[0], o)
            blocks.append((dr, dc, base + (bm.shape[0] - row), "black_concrete"))
        site.street.objects.append((r, c, "custom", blocks))
    from .trees import species_for
    for i, (x, z, h, rad, sp) in enumerate(ex.get("trees", [])):
        r, c = to_rc(x, z)
        g = site.z0 + (y0 - 1 - Y0) * site.bs
        site.trees.append({"r": r, "c": c, "y0": y0, "H": h, "rad": rad, "base": g + 0.3 * h, "top": g + h,
                           "seed": _h(f"hero_tree{i}{x}{z}"), "species": sp or species_for(h, rad, i),
                           "y_top": int(site.yb(g + h)), "kind": 0})


def _paste_heroes(site, a, r0, c0, nz, nx, H):
    for h in getattr(site, "heroes", []):
        m = (h["r"] >= r0) & (h["r"] < r0 + nz) & (h["c"] >= c0) & (h["c"] < c0 + nx) & \
            (h["y"] - Y_MIN > 0) & (h["y"] - Y_MIN < H)
        if m.any():
            a[h["r"][m] - r0, h["c"][m] - c0, h["y"][m] - Y_MIN] = h["ids"][m]
