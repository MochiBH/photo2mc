"""Minecraft building-block palette with perceptual (CIELAB) color matching.

Each material is a *family*: the full block plus its stairs and slab when
they exist, so a roof sloping through a brick wall becomes brick stairs.

Colors are MEASURED from the game's own textures (tools/gen_palette.py ->
palette_data.json): the linear-light average of each block's side and top
faces. Walls are matched against side colors and roofs/floors against top
colors, which matters for blocks like sandstone, grass, logs and copper.

Version target: "latest" uses everything in the newest release (e.g. concrete
and wool stairs); "1.21" restricts to blocks that exist in 1.21.1, so builds
also load on older servers.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import numpy as np

_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "palette_data.json")


@dataclass(frozen=True)
class Material:
    name: str                       # family name, e.g. "bricks"
    full: str                       # block id of the full block
    rgb: tuple[int, int, int]       # side face
    stairs: str | None = None
    slab: str | None = None
    tags: frozenset = field(default_factory=frozenset)
    top: tuple[int, int, int] | None = None
    contrast: float = 0.0           # texture busyness (0 smooth .. ~0.2 noisy)
    since: tuple = ("1.21", None, None)   # versions of (full, stairs, slab)

    @property
    def top_rgb(self):
        return self.top or self.rgb


def _load():
    if not os.path.exists(_DATA):
        raise FileNotFoundError(f"{_DATA} missing; run tools/gen_palette.py")
    d = json.load(open(_DATA))
    out = []
    for e in d["materials"]:
        s = e.get("since", {})
        out.append(Material(e["name"], e["full"], tuple(e["side"]), e.get("stairs"), e.get("slab"),
                            frozenset(e.get("tags", [])), tuple(e["top"]), e.get("contrast", 0.0),
                            (s.get("full", "1.21"), s.get("stairs"), s.get("slab"))))
    return out


MATERIALS: list[Material] = _load()
BY_NAME = {m.name: m for m in MATERIALS}


def for_version(m: Material, target: str = "latest") -> Material | None:
    """The material as it exists in the target version (None if it doesn't)."""
    if target == "latest":
        return m
    if m.since[0] == "26":
        return None
    return Material(m.name, m.full, m.rgb, m.stairs if m.since[1] == "1.21" else None,
                    m.slab if m.since[2] == "1.21" else None, m.tags, m.top, m.contrast, m.since)


# --------------------------------------------------------------------------
# color science
# --------------------------------------------------------------------------
def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """(..., 3) sRGB 0-255 -> CIELAB (D65)."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def delta_e2000(lab1, lab2):
    """CIEDE2000 colour difference (the standard 'how different does it look').
    ~1 = just noticeable, <5 = close match, >10 = clearly different."""
    L1, a1, b1 = lab1.T; L2, a2, b2 = lab2.T
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cm = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cm**7 / (Cm**7 + 25**7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p
    dh = h2p - h1p
    dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh))
    dh = np.where(C1p * C2p == 0, 0, dh)
    dH = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lm, Cpm = (L1 + L2) / 2, (C1p + C2p) / 2
    hs = h1p + h2p
    hm = np.where(C1p * C2p == 0, hs, np.where(np.abs(h1p - h2p) > 180,
                  np.where(hs < 360, (hs + 360) / 2, (hs - 360) / 2), hs / 2))
    T = (1 - 0.17 * np.cos(np.radians(hm - 30)) + 0.24 * np.cos(np.radians(2 * hm))
         + 0.32 * np.cos(np.radians(3 * hm + 6)) - 0.20 * np.cos(np.radians(4 * hm - 63)))
    dth = 30 * np.exp(-(((hm - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cpm**7 / (Cpm**7 + 25**7))
    Sl = 1 + 0.015 * (Lm - 50) ** 2 / np.sqrt(20 + (Lm - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cpm, 1 + 0.015 * Cpm * T
    Rt = -np.sin(np.radians(2 * dth)) * Rc
    return np.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


def lab_to_linear(lab):
    """CIELAB -> linear-light RGB (0..1), for mixing colours physically."""
    L, a, b = np.moveaxis(np.asarray(lab, float), -1, 0)
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    e, k = 216 / 24389, 24389 / 27
    xr = np.where(fx**3 > e, fx**3, (116 * fx - 16) / k)
    yr = np.where(L > k * e, fy**3, L / k)
    zr = np.where(fz**3 > e, fz**3, (116 * fz - 16) / k)
    xyz = np.stack([xr * 0.95047, yr, zr * 1.08883], -1)
    m = np.array([[3.2404542, -1.5371385, -0.4985314],
                  [-0.9692660, 1.8760108, 0.0415560],
                  [0.0556434, -0.2040259, 1.0572252]])
    return np.clip(xyz @ m.T, 0, 1)


def linear_to_lab(lin):
    c = np.clip(lin, 0, 1)
    srgb = np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)
    return srgb_to_lab(srgb * 255)


class Palette:
    """A (possibly restricted) set of materials with fast nearest-color lookup."""

    def __init__(self, materials: list[Material] | None = None,
                 include_tags: set[str] | None = None,
                 exclude: set[str] | None = None, target: str = "latest"):
        src = list(materials) if materials is not None else list(MATERIALS)
        mats = [x for x in (for_version(m, target) for m in src) if x is not None]
        if include_tags:
            mats = [m for m in mats if m.tags & include_tags]
        elif materials is None:
            mats = [m for m in mats if not m.tags & {"detail", "wool"}]
        if exclude:
            mats = [m for m in mats if m.name not in exclude]
        if not mats:
            raise ValueError("palette is empty after filtering")
        self.target = target
        self.materials = mats
        self.lab = srgb_to_lab(np.array([m.rgb for m in mats]))
        self.lab_top = srgb_to_lab(np.array([m.top_rgb for m in mats]))
        self.has_stairs = np.array([m.stairs is not None for m in mats])
        self.has_slab = np.array([m.slab is not None for m in mats])
        # builder's prior, in ΔE: real builds use stone, wood and metal; flat
        # dyed blocks only win when they are clearly the better colour match
        self.prior = np.array([4.0 if "color" in m.tags else 0.0 for m in mats])

    def distances(self, lab: np.ndarray, top: np.ndarray | None = None) -> np.ndarray:
        """(N, M) CIEDE2000 distance. `top` (N,) bool: compare that row
        against the materials' TOP face instead of the side face.
        Colours are deduplicated (0.5 ΔE grid) so millions of surface samples
        cost about as much as a few thousand."""
        lab = np.asarray(lab, float)
        top = np.zeros(len(lab), bool) if top is None else np.asarray(top, bool)
        key = np.c_[np.round(lab * 2), top]
        uk, inv = np.unique(key, axis=0, return_inverse=True)
        ulab, utop = uk[:, :3] / 2, uk[:, 3].astype(bool)
        M = len(self.materials)
        d = np.empty((len(uk), M))
        for ref, sel in ((self.lab, ~utop), (self.lab_top, utop)):
            if sel.any():
                q = ulab[sel]
                d[sel] = delta_e2000(np.repeat(q, M, 0), np.tile(ref, (len(q), 1))).reshape(len(q), M)
        return d[inv.ravel()]

    def nearest(self, lab: np.ndarray, mask: np.ndarray | None = None,
                shaped_bonus: float = 0.0, top: np.ndarray | None = None) -> np.ndarray:
        """Index of the nearest material for each Lab color (N,3).

        shaped_bonus (in ΔE units) favours families that have stairs AND
        slabs, so walls and roofs can use the same material as their sloped
        and half-height parts.
        """
        d = self.distances(lab, top) + self.prior
        if shaped_bonus:
            d = d + shaped_bonus * ~(self.has_stairs & self.has_slab)
        if mask is not None:
            d = np.where(mask[None, :], d, np.inf)
        return np.argmin(d, axis=1)

    def restrict_to(self, indices) -> "Palette":
        return Palette([self.materials[i] for i in sorted(set(indices))], target=self.target)
