"""Stadium detail for site builds (written for SMU's Gerald J. Ford Stadium, general for any football bowl).

- Field: wide white sideline border, yard lines every 5 yards, hash marks every yard, yard numbers,
  blue end zones with lettering (red, white outline), a midfield logo, goal posts.
- Seats: the lidar rake is seat rows; lower bowl red, upper rows blue (handled in site._fill_buildings
  via `seat_colour`), and the press box's field face is glass suites in white bands with a sign.
- Light towers at OSM lighting masts, heights from the lidar.
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .pixfont import text as pixtext

YD = 0.9144


def _font(px):
    import matplotlib
    path = os.path.join(matplotlib.get_data_path(), "fonts", "ttf", "DejaVuSans-Bold.ttf")
    return ImageFont.truetype(path, px)


def text_bitmap(text, height, stroke=1, glyph_scale=1.0):
    """-> array (rows, cols): 0 background, 1 letter, 2 outline. `height` = cap height in cells."""
    f = _font(int(height * 1.38 * glyph_scale))
    l, t, r, b = f.getbbox(text, stroke_width=stroke)
    im = Image.new("L", (r - l + 4, b - t + 4), 0)
    d = ImageDraw.Draw(im)
    d.text((2 - l, 2 - t), text, font=f, fill=255, stroke_width=stroke, stroke_fill=120)
    a = np.asarray(im)
    out = np.zeros(a.shape, np.uint8)
    out[a > 60] = 2
    out[a > 190] = 1
    rows = np.nonzero(out.any(1))[0]
    cols = np.nonzero(out.any(0))[0]
    return out[rows.min():rows.max() + 1, cols.min():cols.max() + 1]


class Stadium:
    def __init__(self, site, pitch, end_text="MUSTANGS", logo="♞", masts=True):
        self.s = site
        pts = pitch["pts"]
        c = pts.mean(0)
        _, v = np.linalg.eigh(np.cov((pts - c).T))
        u, n = v[:, 1], v[:, 0]
        if u[1] < 0:
            u = -u                                   # u points north-ish
        if n[0] < 0:
            n = -n                                   # n points east-ish
        pu, pn = (pts - c) @ u, (pts - c) @ n
        self.c = c + u * (pu.max() + pu.min()) / 2 + n * (pn.max() + pn.min()) / 2
        self.u, self.n = u, n
        self.k = min(1.0, (pu.max() - pu.min()) / 112.0, (pn.max() - pn.min()) / 52.0)
        self._field(end_text, logo)
        self._goalposts()
        if masts:
            self._towers()

    # field coordinates of every block in the pitch area
    def _coords(self, pad=10.0):
        s = self.s
        half = 60 * self.k + pad
        corners = np.array([self.c + self.u * a + self.n * b for a in (-half, half) for b in (-half, half)])
        cols, rows = s._px(corners, s.bs)
        r0, r1 = max(int(rows.min()), 0), min(int(rows.max()) + 1, s.NZ)
        c0, c1 = max(int(cols.min()), 0), min(int(cols.max()) + 1, s.NX)
        rr, cc = np.mgrid[r0:r1, c0:c1]
        x = (cc + 0.5) * s.bs - self.c[0]
        y = (s.Hm - (rr + 0.5) * s.bs) - self.c[1]
        a = x * self.u[0] + y * self.u[1]
        b = x * self.n[0] + y * self.n[1]
        return (slice(r0, r1), slice(c0, c1)), a, b

    def _field(self, end_text, logo):
        s = self.s
        S = s.S
        sl, a, b = self._coords()
        k = self.k
        gl, el, sd = 50 * YD * k, 60 * YD * k, 26.67 * YD * k         # goal line, end line, sideline (from centre)
        band = 6 * 0.3048
        surf = s.surf[sl]
        inside = (np.abs(a) <= el + band) & (np.abs(b) <= sd + band)
        new = np.full(surf.shape, S["grass_block"], np.uint8)
        lw = s.bs * 0.51
        white = np.zeros(surf.shape, bool)
        white |= (np.abs(b) > sd) & (np.abs(b) <= sd + band) & (np.abs(a) <= el + band)       # sideline border
        white |= (np.abs(a) > el) & (np.abs(a) <= el + band) & (np.abs(b) <= sd + band)       # end line border
        for i in range(-10, 11):                                                              # 5-yard lines
            white |= (np.abs(a - i * 5 * YD * k) < lw * (2 if abs(i) == 10 else 1)) & (np.abs(b) <= sd)
        for j in range(-49, 50):                                                              # hash marks
            if j % 5 == 0:
                continue
            on = np.abs(a - j * YD * k) < lw
            for hb in (20 * 0.3048, -20 * 0.3048):
                white |= on & (np.abs(b - hb * k) < 0.33)
            white |= on & (np.abs(b) > sd - 0.66) & (np.abs(b) <= sd)
        endzone = (np.abs(a) > gl + lw) & (np.abs(a) <= el) & (np.abs(b) <= sd)
        new[endzone] = S["blue_concrete"]
        new[white] = S["white_concrete"]
        # end zone lettering: tops toward the end line, reading left to right from the field
        bm = text_bitmap(end_text, height=int(round(5.5 / s.bs)), stroke=2)
        for sgn in (1, -1):
            depth = (np.abs(a) - gl) * (np.sign(a) == sgn)
            centre_d = (el - gl) / 2
            row = np.round((centre_d - depth) / s.bs + bm.shape[0] / 2).astype(int)
            col = np.round((b * sgn) / s.bs + bm.shape[1] / 2).astype(int)
            ok = endzone & (np.sign(a) == sgn) & (row >= 0) & (row < bm.shape[0]) & (col >= 0) & (col < bm.shape[1])
            px = bm[row[ok], col[ok]]
            sub = new[ok]
            sub[px == 1] = S["red_concrete"]
            sub[px == 2] = S["white_concrete"]
            new[ok] = sub
        # yard numbers: bottoms toward the sideline, 9 yards in, 2 yards tall
        for side in (1, -1):
            for yl in (-40, -30, -20, -10, 0, 10, 20, 30, 40):
                txt = str(50 - abs(yl)) if yl else "50"
                nb = pixtext(txt, gap=2).astype(np.uint8)
                top_b = side * (sd - 9 * YD * k)                  # distance of the number tops from centre
                rowf = (side * b - abs(top_b)) / s.bs              # 0 at the tops, growing toward the sideline
                colf = (-side * (a - yl * YD * k)) / s.bs + nb.shape[1] / 2
                row = np.round(rowf).astype(int)
                col = np.round(colf).astype(int)
                ok = (row >= 0) & (row < nb.shape[0]) & (col >= 0) & (col < nb.shape[1]) & (np.abs(b) <= sd)
                px = nb[row[ok], col[ok]]
                sub = new[ok]
                sub[px == 1] = S["white_concrete"]
                new[ok] = sub
        # midfield logo (a horse), red with a white outline, upright for the press-box side
        lb = text_bitmap(logo, height=int(round(12 / s.bs)), stroke=2)
        row = np.round(b / s.bs + lb.shape[0] / 2).astype(int)
        col = np.round(-a / s.bs + lb.shape[1] / 2).astype(int)
        ok = (row >= 0) & (row < lb.shape[0]) & (col >= 0) & (col < lb.shape[1])
        px = lb[row[ok], col[ok]]
        sub = new[ok]
        sub[px == 1] = S["red_concrete"]
        sub[px == 2] = S["white_concrete"]
        new[ok] = sub
        surf[inside] = new[inside]
        s.surf[sl] = surf
        # no lawn flowers or tufts anywhere in the bowl
        for bw in s.feats:
            if bw["kind"] == "area" and bw["tags"].get("leisure") == "stadium":
                im = Image.new("L", (s.NX, s.NZ), 0)
                cc_, rr_ = s._px(bw["pts"], s.bs)
                ImageDraw.Draw(im).polygon(list(zip(cc_.tolist(), rr_.tolist())), fill=1)
                s.lawn &= ~(np.asarray(im) > 0)
        self.gl, self.el, self.sd = gl, el, sd

    def _goalposts(self):
        s = self.s
        for sgn in (1, -1):
            base = self.c + self.u * sgn * (self.el + 0.3)
            r, c = self._rc(base)
            blocks = [(0, 0, y, "white_concrete") for y in range(1, 10)]
            blocks += [(0, 0, y, "blue_wool") for y in (1, 2)]
            half = int(round(9.25 * 0.3048 / s.bs))
            for o in range(-half, half + 1):
                dr, dc = self._step(o)
                blocks.append((dr, dc, 10, "white_concrete"))
                if abs(o) == half:
                    blocks += [(dr, dc, y, "white_concrete") for y in range(11, 31)]
            s.street.objects.append((r, c, "custom", blocks))

    def _step(self, o):
        """Block offset of o blocks along the field's cross axis (n)."""
        return int(round(-self.n[1] * o)), int(round(self.n[0] * o))

    def _rc(self, p):
        cols, rows = self.s._px(np.asarray(p, float).reshape(1, 2), self.s.bs)
        return int(rows[0]), int(cols[0])

    def _towers(self):
        """Light towers at OSM lighting masts near the field; height from the lidar."""
        s = self.s
        for f in s.feats:
            t = f["tags"]
            if f["kind"] != "node" or t.get("man_made") != "mast" or t.get("tower:type") != "lighting":
                continue
            p = f["pts"][0]
            if np.hypot(*(p - self.c)) > 150:
                continue
            r, c = self._rc(p)
            r05 = min(max(int((s.Hm - p[1]) / 0.5), 0), s.dsm_all.shape[0] - 1)
            c05 = min(max(int(p[0] / 0.5), 0), s.dsm_all.shape[1] - 1)
            win = s.dsm_all[max(r05 - 6, 0):r05 + 7, max(c05 - 6, 0):c05 + 7]
            top = np.nanmax(win) if np.isfinite(win).any() else s.g05[r05, c05] + 35
            h = int((top - s.g05[r05, c05]) / s.bs)
            if h < 40:
                h = 110
            d = self.c - p
            facing_x = abs(d[0]) > abs(d[1])
            blocks = [(0, 0, y, "andesite_wall[east=none,north=none,south=none,up=true,waterlogged=false,west=none]")
                      for y in range(1, h - 5)]
            blocks += [(0, 0, 1, "polished_andesite"), (0, 0, 2, "polished_andesite")]
            for o in range(-4, 5):
                for dy in range(h - 6, h):
                    dr, dc = (o, 0) if facing_x else (0, o)
                    lamp = (dy - (h - 6)) % 2 == 1 and abs(o) < 4
                    blocks.append((dr, dc, dy, "sea_lantern" if lamp else "iron_bars[east=true,north=false,south=false,waterlogged=false,west=true]"
                                   if not facing_x else "iron_bars[east=false,north=true,south=true,waterlogged=false,west=false]"))
            s.street.objects.append((r, c, "custom", blocks))


def seat_colour(height_blocks):
    """Lower bowl red, upper rows blue (Ford Stadium)."""
    return "blue_concrete" if height_blocks > 28 else "mangrove_planks"


def press_box_block(rel, col, sign):
    """Field face of the press box: a white sign band, then glass suite bands with white floor slabs.
    rel = height above the seats below (blocks), col = position along the face. -> block name."""
    if rel < 9:
        if sign is not None and 1 <= rel <= 7:
            r = 7 - rel
            if 0 <= r < sign.shape[0] and 0 <= col < sign.shape[1] and sign[r, col] == 1:
                return "red_concrete"
        return "smooth_quartz"
    return "gray_stained_glass" if (rel - 9) % 11 < 8 else "smooth_quartz"
