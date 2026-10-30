"""Textured isometric previews using Minecraft's own block textures.

Each block is split into its 2x2x2 half-block cells (so stairs and slabs keep their shape), the exposed
faces of those cells are stamped into the image with the matching quarter of the block's 16x16
texture, and a depth buffer keeps the nearest face per pixel. Plants and flowers are drawn as
cut-out sprites. Textures are downloaded once from github.com/InventivetalentDev/minecraft-assets
(1.21.1) into a cache folder.
"""
from __future__ import annotations

import io
import os
import urllib.request

import numpy as np
from PIL import Image

from .palette import MATERIALS
from .shapes import state_mask

ASSETS = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.1/assets/minecraft/textures/block/"
GRASS_TINT = (145, 189, 89)
FOLIAGE_TINT = (119, 171, 47)
TINTS = {"grass_block_top": GRASS_TINT, "short_grass": GRASS_TINT, "oak_leaves": FOLIAGE_TINT,
         "dark_oak_leaves": FOLIAGE_TINT, "birch_leaves": (128, 167, 85), "water_still": (63, 118, 228)}
PLANTS = {"short_grass", "dandelion", "poppy", "oxeye_daisy", "cornflower", "azure_bluet", "red_tulip",
          "white_tulip", "allium", "fern"}
RENAME = {"smooth_quartz": ("quartz_block_bottom", "quartz_block_bottom"),
          "smooth_sandstone": ("sandstone_top", "sandstone_top"),
          "smooth_stone": ("smooth_stone", "smooth_stone_slab_side"),
          "quartz_block": ("quartz_block_top", "quartz_block_side"),
          "sandstone": ("sandstone_top", "sandstone"), "water": ("water_still", "water_still"),
          "grass_block": ("grass_block_top", "grass_block_side"), "podzol": ("podzol_top", "podzol_side"),
          "dirt_path": ("dirt_path_top", "dirt_path_side"), "bricks": ("bricks", "bricks")}
_FULL = {}
for _m in MATERIALS:
    for _n in (_m.stairs, _m.slab):
        if _n:
            _FULL[_n] = _m.full


def _family(name):
    name = _FULL.get(name, name)
    if name.endswith("_slab") or name.endswith("_stairs"):
        base = name.rsplit("_", 1)[0]
        name = base + "s" if base + "s" in RENAME or base.endswith("brick") or base.endswith("tile") else base
    return name.replace("waxed_", "")


def _tex_names(state):
    name = state.split("[")[0].replace("minecraft:", "")
    props = dict(p.split("=") for p in state[:-1].split("[", 1)[1].split(",")) if "[" in state else {}
    if name.endswith("_pane"):
        return name[:-5], name[:-5]
    fam = _family(name)
    if fam in RENAME:
        return RENAME[fam]
    if fam.endswith("_log") or fam.endswith("_pillar"):
        end, side = fam + "_top", fam
        return (end, side) if props.get("axis", "y") == "y" else (side, side)
    return fam + "_top", fam


class Textures:
    def __init__(self, cache):
        self.cache = cache
        os.makedirs(cache, exist_ok=True)
        self.mem = {}

    def get(self, name):
        """-> (16, 16, 4) float RGBA or None."""
        if name in self.mem:
            return self.mem[name]
        p = os.path.join(self.cache, name + ".png")
        if not os.path.exists(p) and not os.path.exists(p + ".missing"):
            try:
                with urllib.request.urlopen(ASSETS + name + ".png", timeout=30) as r:
                    data = r.read()
                with open(p, "wb") as f:
                    f.write(data)
            except Exception:  # noqa: BLE001
                open(p + ".missing", "w").close()
        img = None
        if os.path.exists(p):
            im = Image.open(p).convert("RGBA")
            img = np.asarray(im, np.float32)[:16, :16] / 255.0          # first frame of animated strips
            base = os.path.basename(p)[:-4]
            if base in TINTS:
                img = img.copy()
                img[..., :3] *= np.array(TINTS[base]) / 255.0
        self.mem[name] = img
        return img

    def face(self, state, fallback_rgb):
        """(top, side) RGB textures (16,16,3) with transparency flattened, and an alpha mask for sprites."""
        t_name, s_name = _tex_names(state)
        out = []
        for n in (t_name, s_name):
            tx = self.get(n)
            if tx is None:
                tx = self.get(s_name) if n == t_name else None
            if tx is None:
                tx = np.ones((16, 16, 4), np.float32)
                tx[..., :3] = np.array(fallback_rgb) / 255.0
            out.append(tx)
        return out


def _stamp(face, s):
    """Pixel offsets (dx, dy) and face coordinates (a, b) in [0,1) for one half-block cell face of size s px."""
    pts = []
    for dy in range(-2 * s, 2 * s):
        for dx in range(-2 * s, 2 * s):
            px, py = dx + 0.5, dy + 0.5
            if face == "top":                     # P(x+u, y+1, z+v) - P(x,y,z) = ((u-v)s, (u+v)s/2 - s)
                a_ = px / s
                b_ = (py + s) * 2 / s
                u, v = (a_ + b_) / 2, (b_ - a_) / 2
                if 0 <= u < 1 and 0 <= v < 1:
                    pts.append((dx, dy, u, v))
            elif face == "east":                  # P(x+1, y+t, z+w): ((1-w)s, (1+w)s/2 - ts)
                w = 1 - px / s
                t = ((1 + w) * s / 2 - py) / s
                if 0 <= w < 1 and 0 <= t < 1:
                    pts.append((dx, dy, w, t))
            else:                                 # south: P(x+w, y+t, z+1): ((w-1)s, (w+1)s/2 - ts)
                w = 1 + px / s
                t = ((w + 1) * s / 2 - py) / s
                if 0 <= w < 1 and 0 <= t < 1:
                    pts.append((dx, dy, w, t))
    return np.array(pts, np.float32)


def render(C, states, path, s=4, cache="data/textures", sky=(205, 222, 238), fallback=None):
    """C: (Z, X, Y) palette indices; s: pixels per half block (even)."""
    from .sitepreview import color_table
    tx = Textures(cache)
    fb = color_table(states) if fallback is None else fallback
    used = np.unique(C)
    nst = len(states)
    masks = np.zeros(nst, np.uint8)
    plant = np.zeros(nst, bool)
    top_t = np.zeros((nst, 16, 16, 3), np.float32)
    side_t = np.zeros((nst, 16, 16, 3), np.float32)
    alpha = np.ones((nst, 16, 16), np.float32)
    for i in used:
        if i == 0:
            continue
        st = states[i].replace("minecraft:", "")
        name = st.split("[")[0]
        if name in PLANTS:
            plant[i] = True
            t = tx.get(name)
            if t is None:
                continue
            side_t[i], alpha[i] = t[..., :3], t[..., 3]
            continue
        masks[i] = state_mask(st)
        tp, sd = tx.face(st, fb[i])
        dark = np.array([0.16, 0.18, 0.15]) if "leaves" in name else np.array([0.18, 0.2, 0.24])
        top_t[i] = tp[..., :3] * tp[..., 3:] + dark * (1 - tp[..., 3:])
        side_t[i] = sd[..., :3] * sd[..., 3:] + dark * (1 - sd[..., 3:])
    Z, X, Y = C.shape
    sub = np.zeros((2 * Z, 2 * X, 2 * Y), np.uint16)
    m = masks[C]
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                bit = (m >> (dy * 4 + dz * 2 + dx)) & 1
                sub[dz::2, dx::2, dy::2] = np.where(bit > 0, C, 0)
    occ = sub > 0
    W = int((2 * X + 2 * Z) * s + 4 * s)
    Hh = int((2 * X + 2 * Z) * s / 2 + 2 * Y * s + 4 * s)
    OX, OY = 2 * Z * s + 2 * s, 2 * Y * s + 2 * s
    zbuf = np.full(Hh * W, -1e9, np.float32)
    cbuf = np.tile(np.array(sky, np.float32) / 255.0, (Hh * W, 1))
    shade = {"top": 1.0, "south": 0.8, "east": 0.64}

    def draw(zz, xx, yy, ids, face, cut=False):
        st = _stamp(face, s)
        for k in range(0, len(zz), 400_000):
            z_, x_, y_, i_ = zz[k:k + 400_000], xx[k:k + 400_000], yy[k:k + 400_000], ids[k:k + 400_000]
            ax = (x_ - z_) * s + OX
            ay = (x_ + z_) * s // 2 - y_ * s + OY
            px = (ax[:, None] + st[None, :, 0]).astype(np.int64)
            py = (ay[:, None] + st[None, :, 1]).astype(np.int64)
            a, b = st[None, :, 2], st[None, :, 3]
            if face == "top":
                col = ((x_ % 2)[:, None] + a) * 8
                row = ((z_ % 2)[:, None] + b) * 8
                dep = (x_[:, None] + a) + (y_[:, None] + 1) + (z_[:, None] + b)
                texs = top_t
            else:
                h = (z_ if face == "east" else x_) % 2
                col = (h[:, None] + a) * 8
                row = 16 - ((y_ % 2)[:, None] + b) * 8
                if face == "east":
                    dep = (x_[:, None] + 1) + (y_[:, None] + b) + (z_[:, None] + (1 - a))
                else:
                    dep = (x_[:, None] + a) + (y_[:, None] + b) + (z_[:, None] + 1)
                texs = side_t
            ci = np.clip(col.astype(int), 0, 15)
            ri = np.clip(row.astype(int), 0, 15)
            ii = np.broadcast_to(i_[:, None], ci.shape)
            c = texs[ii, ri, ci] * shade[face]
            ok = (px >= 0) & (px < W) & (py >= 0) & (py < Hh)
            if cut:
                ok &= alpha[ii, ri, ci] > 0.5
            pix = (py * W + px)[ok]
            d = dep[ok]
            c = c[ok]
            order = np.argsort(d, kind="stable")
            pix, d, c = pix[order], d[order], c[order]
            nearer = d > zbuf[pix]
            zbuf[pix[nearer]] = d[nearer]
            cbuf[pix[nearer]] = c[nearer]

    for face, axis in (("top", 2), ("south", 0), ("east", 1)):
        nb = np.zeros_like(occ)
        if axis == 2:
            nb[:, :, :-1] = occ[:, :, 1:]
        elif axis == 0:
            nb[:-1] = occ[1:]
        else:
            nb[:, :-1] = occ[:, 1:]
        zz, xx, yy = np.nonzero(occ & ~nb)
        draw(zz, xx, yy, sub[zz, xx, yy], face)
    # plants: two cut-out planes through the block centre (the south face of the front half-cells and
    # the east face of the west half-cells lie on the centre planes)
    pz, px_, py_ = np.nonzero(plant[C])
    if len(pz):
        ids = C[pz, px_, py_]
        for d in (0, 1):
            for dy in (0, 1):
                draw(2 * pz, 2 * px_ + d, 2 * py_ + dy, ids, "south", cut=True)
                draw(2 * pz + d, 2 * px_, 2 * py_ + dy, ids, "east", cut=True)
    img = np.clip(cbuf.reshape(Hh, W, 3) * 255, 0, 255).astype(np.uint8)
    im = Image.fromarray(img)
    bbox = Image.fromarray((zbuf.reshape(Hh, W) > -1e8).astype(np.uint8) * 255).getbbox()
    if bbox:
        im = im.crop((max(bbox[0] - 8, 0), max(bbox[1] - 8, 0), min(bbox[2] + 8, W), min(bbox[3] + 8, Hh)))
    im.save(path)
    return im
