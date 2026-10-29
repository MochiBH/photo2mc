"""Quick isometric PNG of a build (what Minecraft will show, stairs included)."""
from __future__ import annotations

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

from .shapes import state_mask, mask_boxes


VIEWS = {"se": (45, 38), "sw": (-45, 38), "ne": (135, 38), "nw": (-135, 38), "front": (20, 15)}


def render_iso(b, path, view="se", size=9, title=None, azimuth=None, elevation=None):
    """azimuth: degrees from the front (+z) toward the right (+x);
    elevation: degrees above the horizon. Defaults come from `view`."""
    az, el = VIEWS.get(view, (45, 38))
    az = az if azimuth is None else azimuth
    el = el if elevation is None else elevation
    a, e = np.radians(az + 1e-3), np.radians(el)
    cam = np.array([np.sin(a) * np.cos(e), np.sin(e), np.cos(a) * np.cos(e)])
    sx = 1 if cam[0] > 0 else -1
    sz = 1 if cam[2] > 0 else -1
    right = np.cross([0, 1, 0], cam); right /= np.linalg.norm(right)
    up = np.cross(cam, right)

    full = {tuple(c) for c, s in zip(b.coords.tolist(), b.states) if "[" not in s}
    polys, cols, depth = [], [], []
    light = {"x": 0.8, "y": 1.0, "z": 0.68}
    for (x, y, z), s, rgb in zip(b.coords.tolist(), b.states, b.rgb):
        # skip blocks hidden behind full neighbours on all three visible sides
        if (x + sx, y, z) in full and (x, y + 1, z) in full and (x, y, z + sz) in full:
            continue
        for (x0, y0, z0, x1, y1, z1) in mask_boxes(state_mask(s)):
            X0, X1, Y0, Y1, Z0, Z1 = x + x0, x + x1, y + y0, y + y1, z + z0, z + z1
            xf = X1 if sx > 0 else X0
            zf = Z1 if sz > 0 else Z0
            faces = [
                ("y", [(X0, Y1, Z0), (X1, Y1, Z0), (X1, Y1, Z1), (X0, Y1, Z1)]),
                ("x", [(xf, Y0, Z0), (xf, Y1, Z0), (xf, Y1, Z1), (xf, Y0, Z1)]),
                ("z", [(X0, Y0, zf), (X1, Y0, zf), (X1, Y1, zf), (X0, Y1, zf)]),
            ]
            for ax, q in faces:
                q = np.array(q, float)
                polys.append(np.c_[q @ right, q @ up])
                cols.append(np.clip(np.array(rgb) / 255 * light[ax], 0, 1))
                depth.append((q.mean(0) @ cam))
    order = np.argsort(depth)
    fig, axp = plt.subplots(figsize=(size, size), dpi=110)
    axp.add_collection(PolyCollection([polys[i] for i in order], facecolors=[cols[i] for i in order],
                                      edgecolors=[tuple(c * 0.85) for c in (cols[i] for i in order)],
                                      linewidths=0.15))
    allp = np.vstack(polys)
    axp.set_xlim(allp[:, 0].min() - 1, allp[:, 0].max() + 1)
    axp.set_ylim(allp[:, 1].min() - 1, allp[:, 1].max() + 1)
    axp.set_aspect("equal"); axp.axis("off")
    fig.patch.set_facecolor("#cfe3f2")
    if title:
        axp.set_title(title, fontsize=13)
    fig.savefig(path, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
