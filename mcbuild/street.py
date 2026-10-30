"""Streetscape: everything between the buildings that makes a campus read as real.

Surface marks (painted into the site's surface raster):
  zebra crossings at OSM crossing nodes, stop bars at stop signs, double yellow centre lines on two-way
  collectors, dashed lane lines on multi-lane roads, joints in concrete streets, slab seams in sidewalks.
Objects (placed block by block per region):
  lamp posts with lanterns along campus paths (and at OSM street lamps), benches facing the nearest path,
  bike racks, picnic tables, bins, stop signs, a flagpole.
Building details (used by the facade code):
  doors with a white surround and fanlight on the wall that faces the nearest path (or OSM entrances),
  foundation shrubs along campus walls.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROAD_KINDS = {"residential", "tertiary", "secondary", "primary", "unclassified", "living_street", "service",
              "trunk", "motorway", "secondary_link", "tertiary_link", "primary_link"}


def _polyline_offset(pts, off):
    """Offset a polyline sideways by `off` meters (left positive)."""
    out = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        d = b - a
        n = np.array([-d[1], d[0]]) / (np.hypot(*d) + 1e-9)
        out.append(pts[i] + n * off)
    return np.array(out)


def _dashes(pts, dash, gap):
    """Split a polyline into dash segments."""
    segs = []
    carry = 0.0
    on = True
    for a, b in zip(pts[:-1], pts[1:]):
        L = float(np.hypot(*(b - a)))
        t = 0.0
        while t < L:
            step = (dash if on else gap) - carry
            t1 = min(L, t + step)
            if on:
                segs.append((a + (b - a) * (t / L), a + (b - a) * (t1 / L)))
            carry = carry + (t1 - t)
            if t1 - t >= step - 1e-9:
                on, carry = not on, 0.0
            t = t1
    return segs


class Streetscape:
    def __init__(self, site):
        self.s = site
        self.objects = []                 # (row, col, kind, info)
        self.door = np.zeros(site.bid.shape, np.int8)       # 0, or 1..5 = position across a doorway (3 = centre)
        S = site.S
        self._roads = [f for f in site.feats if f["kind"] == "way" and f["tags"].get("highway") in ROAD_KINDS
                       and f["tags"].get("tunnel") != "yes"]
        self._paint(S)
        self._lamps()
        self._nodes()
        self._doors()
        self._shrubs()

    # ------------------------------------------------------------------ helpers
    def _road_at(self, p):
        """Nearest road way to point p: (direction unit vector, width m, tags) or None."""
        best = None
        for f in self._roads:
            pts = f["pts"]
            for a, b in zip(pts[:-1], pts[1:]):
                d = b - a
                L2 = float(d @ d)
                if L2 < 1e-6:
                    continue
                t = float(np.clip((p - a) @ d / L2, 0, 1))
                dist = float(np.hypot(*(a + d * t - p)))
                if best is None or dist < best[0]:
                    best = (dist, d / math.sqrt(L2), f)
        if best is None or best[0] > 8:
            return None
        from .site import ROAD_W, _num
        t = best[2]["tags"]
        w = _num(t.get("width")) or ROAD_W.get(t.get("highway"), 7)
        return best[1], w, t

    def _rc(self, p):
        c, r = self.s._px(np.asarray(p, float).reshape(1, 2), self.s.bs)
        return int(r[0]), int(c[0])

    # ------------------------------------------------------------------ surface paint
    def _paint(self, S):
        s = self.s
        im = Image.new("L", (s.NX, s.NZ), 0)
        d = ImageDraw.Draw(im)
        line = lambda q, v, w=1: d.line([tuple(x) for x in zip(*s._px(np.asarray(q), s.bs))], fill=v, width=w)
        from .site import ROAD_W, _num
        for f in self._roads:
            t = f["tags"]
            hw = t["highway"]
            w = _num(t.get("width")) or ROAD_W.get(hw, 7)
            pts = f["pts"]
            two_way = t.get("oneway") not in ("yes", "1", "-1")
            lanes = int(_num(t.get("lanes")) or (2 if two_way else 1))
            if hw in ("secondary", "tertiary", "primary") and two_way:          # double yellow
                for off in (-0.25, 0.25):
                    line(_polyline_offset(pts, off), 1)
            if lanes >= 3 or (lanes >= 2 and not two_way):                      # dashed lane lines
                per_side = lanes // 2 if two_way else lanes
                lane_w = w / max(lanes, 1)
                for k in range(1, per_side):
                    for sgn in ((-1, 1) if two_way else (1,)):
                        off = sgn * k * lane_w if two_way else (k - lanes / 2) * lane_w
                        for a, b in _dashes(_polyline_offset(pts, off), 3.0, 9.0):
                            line([a, b], 2)
            if True:                                                            # concrete joints across lanes
                for a, b in zip(pts[:-1], pts[1:]):
                    dvec = b - a
                    L = float(np.hypot(*dvec))
                    if L < 1:
                        continue
                    u = dvec / L
                    n = np.array([-u[1], u[0]])
                    for tt in np.arange(2.25, L, 4.5):
                        p = a + u * tt
                        line([p - n * w / 2, p + n * w / 2], 3)
        for f in s.feats:                                                       # sidewalk seams
            t = f["tags"]
            if f["kind"] != "way" or t.get("highway") not in ("footway", "path", "pedestrian", "cycleway"):
                continue
            if t.get("footway") == "crossing":
                continue
            w = _num(t.get("width")) or 2.4
            pts = f["pts"]
            for a, b in zip(pts[:-1], pts[1:]):
                dvec = b - a
                L = float(np.hypot(*dvec))
                if L < 1:
                    continue
                u = dvec / L
                n = np.array([-u[1], u[0]])
                for tt in np.arange(0.75, L, 1.5):
                    p = a + u * tt
                    line([p - n * w / 2, p + n * w / 2], 4)
        # crossings and stop bars at OSM nodes
        for f in s.feats:
            if f["kind"] != "node":
                continue
            t = f["tags"]
            p = f["pts"][0]
            if t.get("highway") == "crossing" and t.get("crossing") != "unmarked":
                rd = self._road_at(p)
                if rd:
                    u, w, _ = rd
                    nrm = np.array([-u[1], u[0]])
                    for k in np.arange(-w / 2 + 0.3, w / 2, 1.2):
                        q = p + nrm * k
                        line([q - u * 1.5, q + u * 1.5], 5, max(1, int(round(0.6 / s.bs))))
            elif t.get("highway") == "stop":
                rd = self._road_at(p)
                if rd:
                    u, w, _ = rd
                    nrm = np.array([-u[1], u[0]])
                    line([p - nrm * w / 2, p + nrm * w / 2], 5, max(1, int(round(0.45 / s.bs))))
                    self.objects.append((*self._rc(p + nrm * (w / 2 + 1.0)), "stop_sign", None))
        m = np.array(im, np.uint8)
        paved = np.isin(s.surf, (S["gray_concrete"], S["light_gray_concrete"]))
        walk = np.isin(s.surf, (S["smooth_stone"],))
        s.surf[(m == 1) & paved & s.road] = S["yellow_concrete"]
        s.surf[(m == 2) & paved & s.road] = S["white_concrete"]
        s.surf[(m == 3) & (s.surf == S["light_gray_concrete"]) & s.road] = S["andesite"]
        s.surf[(m == 4) & walk] = S["stone"]
        s.surf[(m == 5) & paved & s.road] = S["white_concrete"]

    # ------------------------------------------------------------------ lamps
    def _lamps(self, spacing=20.0):
        s = self.s
        S = s.S
        taken = set()
        for f in s.feats:
            t = f["tags"]
            if f["kind"] == "node" and t.get("highway") == "street_lamp":
                self.objects.append((*self._rc(f["pts"][0]), "lamp", None))
        if s.campus is None:
            return
        from .site import _inside, _num
        for f in s.feats:
            t = f["tags"]
            if f["kind"] != "way" or t.get("highway") not in ("footway", "pedestrian", "path"):
                continue
            if t.get("footway") == "crossing" or t.get("indoor") == "yes":
                continue
            w = _num(t.get("width")) or 2.4
            pts = f["pts"]
            acc = spacing / 2
            side = 1
            for a, b in zip(pts[:-1], pts[1:]):
                dvec = b - a
                L = float(np.hypot(*dvec))
                if L < 0.5:
                    continue
                u = dvec / L
                n = np.array([-u[1], u[0]])
                tt = spacing - acc
                while tt < L:
                    p = a + u * tt + n * side * (w / 2 + 0.7)
                    side = -side
                    if _inside(s.campus["pts"], *p):
                        r, c = self._rc(p)
                        key = (r // 30, c // 30)                 # no two lamps within ~10 m
                        if 0 <= r < s.NZ and 0 <= c < s.NX and key not in taken and s.bid[r, c] < 0 \
                                and s.surf[r, c] == S["grass_block"]:
                            taken.add(key)
                            self.objects.append((r, c, "lamp", None))
                    tt += spacing
                acc = (acc + L) % spacing

    # ------------------------------------------------------------------ OSM point features
    def _nodes(self):
        s = self.s
        S = s.S
        walk = np.isin(s.surf, (S["smooth_stone"], S["bricks"], S["stone_bricks"]))
        dist, (ir, ic) = ndi.distance_transform_edt(~walk, return_indices=True)
        for f in s.feats:
            if f["kind"] != "node":
                continue
            t = f["tags"]
            r, c = self._rc(f["pts"][0])
            if not (0 <= r < s.NZ and 0 <= c < s.NX) or s.bid[r, c] >= 0:
                continue
            # direction towards the nearest path (benches face it)
            dr, dc = ir[r, c] - r, ic[r, c] - c
            face = ("south" if dr > 0 else "north") if abs(dr) >= abs(dc) else ("east" if dc > 0 else "west")
            if t.get("amenity") == "bench":
                self.objects.append((r, c, "bench", face))
            elif t.get("leisure") == "picnic_table":
                self.objects.append((r, c, "picnic", face))
            elif t.get("amenity") == "bicycle_parking":
                self.objects.append((r, c, "bikes", face))
            elif t.get("amenity") == "waste_basket":
                self.objects.append((r, c, "bin", None))
            elif t.get("man_made") == "flagpole":
                self.objects.append((r, c, "flagpole", None))

    # ------------------------------------------------------------------ doors
    def _doors(self):
        """One main door per building on the wall that faces the nearest path, plus mapped entrances."""
        s = self.s
        S = s.S
        bid = s.bid
        straight = s.straight
        walk = np.isin(s.surf, (S["smooth_stone"], S["bricks"], S["stone_bricks"], S["light_gray_concrete"]))
        walk &= bid < 0
        dist = ndi.distance_transform_edt(~walk)
        cand = straight & ~s.corner
        rr, cc = np.nonzero(cand)
        b = bid[rr, cc]
        best = {}
        dv = dist[rr, cc]
        order = np.argsort(dv)
        for i in order:
            k = int(b[i])
            if k not in best and dv[i] < 25 and s.blds[k]["style"] in ("campus", "commercial", "stadium"):
                best[k] = (int(rr[i]), int(cc[i]))
        mapped = []
        for f in s.feats:
            if f["kind"] == "node" and f["tags"].get("entrance") in ("main", "yes"):
                r, c = self._rc(f["pts"][0])
                win = bid[max(r - 3, 0):r + 4, max(c - 3, 0):c + 4]
                if (win >= 0).any():
                    rs, cs = np.nonzero(cand[max(r - 3, 0):r + 4, max(c - 3, 0):c + 4])
                    if len(rs):
                        j = int(np.argmin((rs - 3) ** 2 + (cs - 3) ** 2))
                        mapped.append((max(r - 3, 0) + int(rs[j]), max(c - 3, 0) + int(cs[j])))
        for r, c in list(best.values()) + mapped:
            code = s.bcode[r, c]
            along = (0, 1) if code & 3 else (1, 0)
            k = bid[r, c]
            for o in range(-2, 3):
                rr_, cc_ = r + along[0] * o, c + along[1] * o
                if 0 <= rr_ < bid.shape[0] and 0 <= cc_ < bid.shape[1] and bid[rr_, cc_] == k and s.bcode[rr_, cc_] == code:
                    self.door[rr_, cc_] = o + 3
            # a paved landing in front of the door
            out = {1: (-1, 0), 2: (1, 0), 4: (0, -1), 8: (0, 1)}.get(int(code))
            if out:
                for o in range(-2, 3):
                    for dd in (1, 2, 3):
                        rr_, cc_ = r + along[0] * o + out[0] * dd, c + along[1] * o + out[1] * dd
                        if 0 <= rr_ < bid.shape[0] and 0 <= cc_ < bid.shape[1] and bid[rr_, cc_] < 0 \
                                and s.surf[rr_, cc_] == S["grass_block"]:
                            s.surf[rr_, cc_] = S["smooth_stone"]

    # ------------------------------------------------------------------ planting
    def _shrubs(self):
        """Foundation shrubs: a 2-block band along campus walls on lawn, broken at doors and corners."""
        s = self.s
        S = s.S
        campus_b = np.array([B["style"] in ("campus",) and not B.get("skip") for B in s.blds] + [False])
        wall = (s.bid >= 0) & (s.bcode > 0) & campus_b[s.bid]
        near = ndi.binary_dilation(wall, iterations=2) & (s.bid < 0)
        doorzone = ndi.binary_dilation(self.door > 0, iterations=4)
        band = near & (s.surf == S["grass_block"]) & ~doorzone & ~ndi.binary_dilation(s.corner, iterations=1)
        s.extra[band & (s.extra == 0)] = 3


# ---------------------------------------------------------------------- object models
def object_blocks(kind, info, h):
    """Blocks of a street object relative to its ground cell: list of (dr, dc, dy, state). h = per-object hash."""
    out = []
    if kind == "custom":
        return info
    if kind == "lamp":
        out.append((0, 0, 1, "polished_blackstone"))
        for y in range(2, 12):
            out.append((0, 0, y, "polished_blackstone_wall[east=none,north=none,south=none,up=true,waterlogged=false,west=none]"))
        out.append((0, 0, 12, "lantern[hanging=false,waterlogged=false]"))
    elif kind == "bench":
        facing = {"north": "south", "south": "north", "east": "west", "west": "east"}[info]   # backrest away from path
        along = (0, 1) if info in ("north", "south") else (1, 0)
        for o in (-1, 0, 1, 2):
            out.append((along[0] * o, along[1] * o, 1,
                        f"spruce_stairs[facing={facing},half=bottom,shape=straight,waterlogged=false]"))
        if h % 2 == 0:
            out.append((along[0] * 4, along[1] * 4, 1, "cauldron"))                         # bin beside it
    elif kind == "picnic":
        along = (0, 1) if info in ("north", "south") else (1, 0)
        across = (1, 0) if along == (0, 1) else (0, 1)
        for o in range(-1, 3):
            out.append((along[0] * o, along[1] * o, 1, "spruce_fence[east=false,north=false,south=false,waterlogged=false,west=false]"
                        if o in (-1, 2) else "air"))
            out.append((along[0] * o, along[1] * o, 2, "spruce_slab[type=bottom,waterlogged=false]"))
            for sgn in (-2, 2):
                out.append((along[0] * o + across[0] * sgn, along[1] * o + across[1] * sgn, 1,
                            "spruce_slab[type=bottom,waterlogged=false]"))
    elif kind == "bikes":
        along = (0, 1) if info in ("north", "south") else (1, 0)
        for o in range(0, 7, 2):
            out.append((along[0] * o, along[1] * o, 1, "iron_bars[east=false,north=false,south=false,waterlogged=false,west=false]"))
            out.append((along[0] * o, along[1] * o, 2, "iron_bars[east=false,north=false,south=false,waterlogged=false,west=false]"))
    elif kind == "bin":
        out.append((0, 0, 1, "cauldron"))
    elif kind == "stop_sign":
        for y in range(1, 7):
            out.append((0, 0, y, "iron_bars[east=false,north=false,south=false,waterlogged=false,west=false]"))
        for dy in (7, 8):
            out.append((0, 0, dy, "red_concrete"))
    elif kind == "flagpole":
        for y in range(1, 34):
            out.append((0, 0, y, "iron_bars[east=false,north=false,south=false,waterlogged=false,west=false]"))
        for dy in range(28, 33):
            for dc in range(1, 8):
                red = (dy - 28) % 2 == 0 and not (dy >= 30 and dc <= 3)
                out.append((0, dc, dy, "blue_wool" if (dy >= 30 and dc <= 3) else ("red_wool" if red else "white_wool")))
    return out
