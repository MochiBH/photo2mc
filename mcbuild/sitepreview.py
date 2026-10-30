"""Fast previews of big block arrays: top-down map and oblique (bird's-eye) splat render."""
from __future__ import annotations

import numpy as np
from PIL import Image

from .palette import MATERIALS

SPECIAL = {
    "grass_block": (98, 150, 58), "oak_leaves": (64, 112, 40), "dark_oak_leaves": (48, 88, 30),
    "azalea_leaves": (92, 128, 50), "birch_leaves": (110, 140, 70), "water": (52, 92, 196),
    "oak_log": (110, 88, 54), "dark_oak_log": (66, 50, 32), "birch_log": (210, 205, 195), "dirt": (134, 96, 67),
    "stone": (125, 125, 125), "bedrock": (60, 60, 60), "sand": (219, 207, 163), "gravel": (131, 127, 126),
    "dirt_path": (148, 122, 65), "coarse_dirt": (119, 85, 59), "quartz_pillar": (235, 230, 222),
}


def color_table(states):
    by = {}
    for m in MATERIALS:
        for n in (m.full, m.stairs, m.slab):
            if n:
                by[n] = tuple(int(v) for v in m.rgb)
    out = np.zeros((len(states), 3), np.float32)
    for i, s in enumerate(states):
        n = s.split("[")[0].replace("minecraft:", "")
        if n in SPECIAL:
            out[i] = SPECIAL[n]
        elif n in by:
            out[i] = by[n]
        elif "glass_pane" in n:
            out[i] = (70, 78, 86) if "gray" in n else (150, 160, 170)
        elif n.endswith("_slab") or n.endswith("_stairs"):
            out[i] = by.get(n.rsplit("_", 1)[0] + "s", by.get(n.rsplit("_", 1)[0], (128, 128, 128)))
        else:
            out[i] = (128, 128, 128)
    return out


def topdown(A, states, shade=True):
    """A: (Z, X, H) palette indices -> RGB image (one pixel per column, hill-shaded)."""
    nz = A != 0
    H = A.shape[2]
    top = H - 1 - np.argmax(nz[:, :, ::-1], axis=2)
    has = nz.any(2)
    idx = np.take_along_axis(A, top[..., None], 2)[..., 0]
    col = color_table(states)[idx]
    col[~has] = (20, 20, 24)
    if shade:
        h = top.astype(np.float32)
        gx = np.gradient(h, axis=1)
        gz = np.gradient(h, axis=0)
        light = np.clip(1.0 + 0.18 * (-gx - gz), 0.55, 1.35)
        col *= light[..., None]
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))


def oblique(A, states, scale=2, yaw="se"):
    """Bird's-eye splat render of A (Z, X, H) from the south-east, 30 degrees up."""
    Z, X, H = A.shape
    if yaw == "sw":
        A = A[:, ::-1]
    solid = A != 0
    # exposed blocks only (any face to air)
    exp = solid.copy()
    inner = solid.copy()
    for ax in range(3):
        for sh in (1, -1):
            inner &= np.roll(solid, sh, ax)
    exp &= ~inner
    z, x, y = np.nonzero(exp)
    ids = A[z, x, y]
    above_air = ~solid[z, x, np.minimum(y + 1, H - 1)] | (y == H - 1)
    south_air = ~solid[np.minimum(z + 1, Z - 1), x, y] | (z == Z - 1)
    east_air = ~solid[z, np.minimum(x + 1, X - 1), y] | (x == X - 1)
    shade = np.where(above_air, 1.0, np.where(south_air, 0.78, np.where(east_air, 0.64, 0.5)))
    col = color_table(states)[ids] * shade[:, None]
    sx = ((x - z) + Z) * scale
    sy = ((x + z) * 0.5 - y * 1.1 + H * 1.1) * scale
    depth = x + z + y * 0.01
    order = np.argsort(depth, kind="stable")
    W = int((X + Z) * scale + scale * 2)
    Hh = int(((X + Z) * 0.5 + H * 1.1) * scale + scale * 3)
    img = np.full((Hh, W, 3), (205, 222, 238), np.float32)
    for dy in range(scale + 1):
        for dx in range(scale):
            yy = (sy[order] + dy).astype(int)
            xx = (sx[order] + dx).astype(int)
            ok = (yy >= 0) & (yy < Hh) & (xx >= 0) & (xx < W)
            img[yy[ok], xx[ok]] = col[order][ok]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
