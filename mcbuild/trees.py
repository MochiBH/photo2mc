"""Grown trees: trunk with flare and roots, forked limbs, and leaf clumps at the branch tips.

Each lidar tree (position, height, crown radius) gets a species that matches its shape and Dallas
streets: broad live oaks, vase-shaped elms, round oaks, a few birches, and crape myrtles for the
small ones. The crown is the union of leaf clumps around the branch tips (plus one at the top), with
ragged edges, so it is lumpy and gappy like a real canopy and the limbs show through underneath.
"""
from __future__ import annotations

import math

import numpy as np

SPECIES = {
    #             leaves             logs                 fork  limb angle   limbs   reach         flat  clump size
    "live_oak": ("dark_oak_leaves", "dark_oak_log", 0.22, (8, 28), (5, 7), (0.50, 0.80), 0.55, (0.42, 0.55)),
    "elm": ("oak_leaves", "oak_log", 0.38, (48, 66), (4, 6), (0.45, 0.75), 0.68, (0.40, 0.52)),
    "oak": ("oak_leaves", "spruce_log", 0.33, (28, 48), (4, 6), (0.40, 0.70), 0.75, (0.42, 0.56)),
    "birch": ("birch_leaves", "birch_log", 0.45, (55, 72), (3, 4), (0.30, 0.55), 0.85, (0.45, 0.60)),
    "myrtle": ("cherry_leaves", "stripped_cherry_log", 0.0, (58, 74), (3, 5), (0.35, 0.60), 0.8, (0.45, 0.62)),
}


def species_for(height_m: float, radius_m: float, seed: int) -> str:
    ratio = radius_m / max(height_m, 1e-3)
    if height_m < 7.0 and seed % 10 < 5:
        return "myrtle"
    if ratio >= 0.42 and height_m < 16:
        return "live_oak"
    if height_m >= 12 and ratio < 0.38:
        return "elm"
    if seed % 12 == 0:
        return "birch"
    return "oak"


_BALLS = {}


def _ball(r):
    """Integer offsets within radius r (at least the centre cell)."""
    key = round(r * 4) / 4
    if key not in _BALLS:
        n = int(math.ceil(key))
        g = np.mgrid[-n:n + 1, -n:n + 1, -n:n + 1].reshape(3, -1).T
        d = np.sqrt((g ** 2).sum(1))
        _BALLS[key] = g[d <= max(key, 0.0) + 1e-6] if key >= 0.5 else np.zeros((1, 3), int)
    return _BALLS[key]


def _limb(p0, p1, r0, r1, out_pts, out_axis):
    """Tapered log from p0 to p1 (x, y, z in blocks)."""
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    d = p1 - p0
    L = float(np.linalg.norm(d))
    if L < 1e-6:
        return
    axis = int(np.argmax(np.abs(d)))                    # 0 = x, 1 = y, 2 = z
    n = max(int(L / 0.4) + 1, 2)
    for i in range(n):
        t = i / (n - 1)
        c = np.round(p0 + d * t).astype(int)
        b = _ball(r0 + (r1 - r0) * t)
        out_pts.append(c + b)
        out_axis.append(np.full(len(b), axis, np.int8))


def grow(t, bs, hashf):
    """-> (log cells (N,3) as (x=col, y, z=row), log axis (N,), leaf cells (M,3), leaf name, log name)."""
    leaf, log, fork_f, elev, nlimb, reach, flat, clump = SPECIES[t["species"]]
    rng = np.random.default_rng(t["seed"])
    x0, z0, y0, ytop = float(t["c"]), float(t["r"]), float(t["y0"]), float(t["y_top"])
    Hb = max(ytop - y0, 4.0)
    Rb = max(t["rad"] / bs, 2.0)
    rt = float(np.clip(0.25 + 0.016 * Hb, 0.5, 1.8))
    pts, axs = [], []
    starts = []
    if t["species"] == "myrtle":                         # multi-stemmed from the ground
        k = int(rng.integers(3, 6))
        for i in range(k):
            a = 2 * math.pi * i / k + rng.uniform(-0.5, 0.5)
            starts.append((np.array([x0 + 0.6 * math.cos(a), y0, z0 + 0.6 * math.sin(a)]), a, 0.5))
        fork = np.array([x0, y0, z0])
    else:
        lean = rng.normal(0, 0.025, 2)
        hf = fork_f * Hb
        fork = np.array([x0 + lean[0] * hf, y0 + hf, z0 + lean[1] * hf])
        _limb((x0, y0 - 1, z0), fork, rt * 1.05, rt * 0.85, pts, axs)
        _limb((x0, y0 - 1, z0), (x0, y0 + 1.5, z0), rt + 0.9, rt + 0.4, pts, axs)          # flare
        for i in range(int(rng.integers(3, 5))):                                         # surface roots
            a = rng.uniform(0, 2 * math.pi)
            L = rt + rng.uniform(1.5, 3.0)
            _limb((x0, y0, z0), (x0 + L * math.cos(a), y0 - 0.6, z0 + L * math.sin(a)), 0.6, 0.45, pts, axs)
        k = int(rng.integers(*nlimb))
        for i in range(k):
            starts.append((fork, 2 * math.pi * i / k + rng.uniform(-0.45, 0.45), rt * 0.7))
    clumps = []
    for p, az, r_start in starts:
        el = math.radians(rng.uniform(*elev))
        d = Rb * rng.uniform(*reach)
        rise = min(d * math.tan(el), max(ytop - p[1] - 0.8 * Rb * clump[0] * flat - 1, 1.0))
        e = p + np.array([d * math.cos(az), rise, d * math.sin(az)])
        _limb(p, e, r_start, 0.45, pts, axs)
        tips = [e, p + (e - p) * 0.6]                    # clumps at the tip and along the limb
        for j in range(int(rng.integers(2, 5))):         # side branches
            s = rng.uniform(0.4, 0.9)
            q = p + (e - p) * s
            a2 = az + rng.uniform(-1.0, 1.0)
            L2 = d * rng.uniform(0.3, 0.5)
            el2 = el + math.radians(rng.uniform(5, 20))
            q2 = q + np.array([L2 * math.cos(a2) * math.cos(el2), L2 * math.sin(el2), L2 * math.sin(a2) * math.cos(el2)])
            _limb(q, q2, 0.45, 0.45, pts, axs)
            tips.append(q2)
        for tip in tips:
            rh = Rb * rng.uniform(*clump)
            rv = rh * flat
            clumps.append((tip + np.array([0, rv * 0.35, 0]), rh, rv))
    rh = Rb * 0.62                                       # crown top so the tree reaches its lidar height
    rv = rh * flat
    clumps.append((np.array([fork[0], ytop - rv, fork[2]]), rh, rv))
    # leaves: union of clumps, ragged at the edges, never above the lidar top or far outside the crown
    leaves = []
    for c, rh, rv in clumps:
        n = int(math.ceil(rh)) + 1
        m = int(math.ceil(rv)) + 1
        g = np.mgrid[-n:n + 1, -m:m + 1, -n:n + 1].reshape(3, -1).T + np.round(c).astype(int)
        v = ((g[:, 0] - c[0]) / rh) ** 2 + ((g[:, 1] - c[1]) / rv) ** 2 + ((g[:, 2] - c[2]) / rh) ** 2
        h = hashf(g[:, 2], g[:, 0], g[:, 1], t["seed"] % 997) % 100
        keep = (v <= 0.8) | ((v <= 1.05) & (h < 60)) | ((v <= 1.2) & (h < 15))
        leaves.append(g[keep])
    lv = np.unique(np.vstack(leaves), axis=0) if leaves else np.zeros((0, 3), int)
    dist = np.hypot(lv[:, 0] - x0, lv[:, 2] - z0)
    lv = lv[(lv[:, 1] <= ytop) & (dist <= Rb * 1.2 + 1) & (lv[:, 1] > y0)]
    logs = np.vstack(pts) if pts else np.zeros((0, 3), int)
    axis = np.concatenate(axs) if axs else np.zeros(0, np.int8)
    return logs, axis, lv, leaf, log
