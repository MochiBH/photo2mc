"""Mesh -> Minecraft blocks, with sub-block shape detection.

Core idea: voxelize at HALF-block resolution. Every Minecraft block then
covers a 2x2x2 group of sub-cells, and that 8-bit occupancy pattern maps
directly onto Minecraft's shapes:

    all 8 filled              -> full block
    bottom 4 only             -> bottom slab      (top 4 -> top slab)
    bottom 4 + top half       -> straight stairs  (facing = side of the top half)
    bottom 4 + 1 top quarter  -> outer-corner stairs
    bottom 4 + 3 top quarters -> inner-corner stairs
    (and the upside-down versions of all of these)

So roofs, pyramids, domes and arches get stairs and slabs where the real
geometry slopes, instead of jagged full-block steps.
"""
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import trimesh
from scipy import ndimage
from scipy.spatial import cKDTree

from .palette import Palette, srgb_to_lab

AIR, FULL, SLAB, STAIRS = 0, 1, 2, 3
CW = {"north": "east", "east": "south", "south": "west", "west": "north"}


# --------------------------------------------------------------------------
# 1. load & normalise
# --------------------------------------------------------------------------
def load_meshes(path: str, up: str = "y") -> list[trimesh.Trimesh]:
    """Load any mesh/scene (glb, gltf, obj, ply, stl...) as a list of world-space
    meshes in Minecraft orientation (+Y up)."""
    obj = trimesh.load(path, process=False)
    meshes = obj.dump() if isinstance(obj, trimesh.Scene) else [obj]
    meshes = [m for m in meshes if isinstance(m, trimesh.Trimesh) and len(m.faces)]
    if not meshes:
        raise ValueError(f"no triangle geometry found in {path}")
    if up == "z":  # Z-up (Blender/CAD/photogrammetry) -> Y-up, keep handedness
        R = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
        for m in meshes:
            m.apply_transform(R)
    return meshes


# --------------------------------------------------------------------------
# 2. occupancy at half-block resolution
# --------------------------------------------------------------------------
def _surface_points(meshes, spacing, max_points=8_000_000):
    """Dense colored samples of the surface, with outward normals."""
    pts, cols, nrm = [], [], []
    total_area = sum(m.area for m in meshes)
    budget = min(max_points, int(total_area / spacing**2) + 1000)
    for m in meshes:
        n = max(200, int(budget * m.area / max(total_area, 1e-9)))
        try:
            p, fi, c = trimesh.sample.sample_surface(m, n, sample_color=True, seed=0)
            c = np.asarray(c)[:, :3]
        except Exception:
            p, fi = trimesh.sample.sample_surface(m, n, seed=0)
            c = None
        if c is None or len(c) != len(p):
            c = np.full((len(p), 3), 128)
        pts.append(p)
        cols.append(c)
        nrm.append(m.face_normals[fi])
    return np.vstack(pts), np.vstack(cols).astype(np.float64), np.vstack(nrm)


def _parity_occupancy(tris, origin, dims, sub, chunk=4_000_000):
    """Exact inside test for a closed mesh: cast a vertical ray through every
    sub-cell column and count surface crossings ABOVE each cell centre
    (odd = inside). Counting from the top also works for open-bottom scans.
    Fully vectorised scanline rasteriser."""
    ox, oy, oz = origin
    jx, jz = 1.234567e-4 * sub, 2.345678e-4 * sub          # avoid edge ties
    add = np.zeros(dims, dtype=np.int32)
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    # columns whose centre lies in each triangle's xz bounding box
    mn = np.minimum(np.minimum(a, b), c); mx = np.maximum(np.maximum(a, b), c)
    i0 = np.clip(np.ceil((mn[:, 0] - ox - jx) / sub - 0.5), 0, dims[0] - 1).astype(np.int64)
    i1 = np.clip(np.floor((mx[:, 0] - ox - jx) / sub - 0.5), -1, dims[0] - 1).astype(np.int64)
    k0 = np.clip(np.ceil((mn[:, 2] - oz - jz) / sub - 0.5), 0, dims[2] - 1).astype(np.int64)
    k1 = np.clip(np.floor((mx[:, 2] - oz - jz) / sub - 0.5), -1, dims[2] - 1).astype(np.int64)
    nx = np.maximum(i1 - i0 + 1, 0); nz = np.maximum(k1 - k0 + 1, 0)
    cnt = nx * nz
    keep = np.flatnonzero(cnt)
    cs = np.cumsum(cnt[keep])
    start = 0
    while start < len(keep):
        base = cs[start - 1] if start else 0
        stop = max(start + 1, int(np.searchsorted(cs, base + chunk)))
        t = keep[start:stop]; start = stop
        ct = cnt[t]
        tid = np.repeat(t, ct)
        local = np.arange(ct.sum()) - np.repeat(np.cumsum(ct) - ct, ct)
        ix = i0[tid] + local // nz[tid]
        kz = k0[tid] + local % nz[tid]
        px = ox + (ix + 0.5) * sub + jx
        pz = oz + (kz + 0.5) * sub + jz
        A, B, C = a[tid], b[tid], c[tid]
        # barycentric coords in the xz plane
        d = (B[:, 2] - C[:, 2]) * (A[:, 0] - C[:, 0]) + (C[:, 0] - B[:, 0]) * (A[:, 2] - C[:, 2])
        ok = np.abs(d) > 1e-12
        d = np.where(ok, d, 1.0)
        w1 = ((B[:, 2] - C[:, 2]) * (px - C[:, 0]) + (C[:, 0] - B[:, 0]) * (pz - C[:, 2])) / d
        w2 = ((C[:, 2] - A[:, 2]) * (px - C[:, 0]) + (A[:, 0] - C[:, 0]) * (pz - C[:, 2])) / d
        w3 = 1 - w1 - w2
        hit = ok & (w1 >= 0) & (w2 >= 0) & (w3 >= 0)
        y = w1 * A[:, 1] + w2 * B[:, 1] + w3 * C[:, 1]
        # crossing at y is "above" every centre j with centre_j < y  ->  j <= kk
        kk = np.floor((y - oy) / sub - 0.5).astype(np.int64)
        hit &= kk >= 0
        kk = np.minimum(kk, dims[1] - 1)
        flat = np.ravel_multi_index((ix[hit], kk[hit], kz[hit]), dims)
        add += np.bincount(flat, minlength=add.size).reshape(dims).astype(np.int32)
    above = np.cumsum(add[:, ::-1, :], axis=1)[:, ::-1, :]
    return (above & 1).astype(bool)


def _vote_occupancy(pts, nrm, origin, dims, sub, open_bottom=True):
    """Fallback for non-watertight meshes (raw scans): shell from dense samples,
    flood-fill the interior, then decide shell cells by which side of the
    nearest surface patch their centre lies on."""
    idx = np.clip(np.floor((pts - origin) / sub).astype(int), 0, dims - 1)
    shell = np.zeros(dims, dtype=bool)
    shell[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    if open_bottom:
        # scans usually have no floor: cap the bottom so inside != outside
        padded = np.zeros((dims[0], dims[1] + 1, dims[2]), bool)
        padded[:, 1:, :] = shell
        padded[:, 0, :] = ndimage.binary_fill_holes(shell.any(axis=1))
        filled = ndimage.binary_fill_holes(padded)[:, 1:, :]
    else:
        filled = ndimage.binary_fill_holes(shell)
    inside = filled & ~shell
    sc = np.argwhere(shell)
    centers = origin + (sc + 0.5) * sub
    _, nn = cKDTree(pts).query(centers, k=6, workers=-1)
    side = ((centers[:, None, :] - pts[nn]) * nrm[nn]).sum(-1)   # <0 => inside
    inside[tuple(sc[(side < 0).mean(axis=1) > 0.5].T)] = True
    if inside.sum() < 0.25 * filled.sum():        # flipped normals
        inside = filled
    return inside


def grid_origin(meshes, block_size, lo):
    """Shift the block grid so the model's big walls land on block boundaries
    instead of cutting through the middle of blocks (which would make them
    ragged). Ground (min Y) always sits on a boundary.

    Per horizontal axis: take every face whose normal is along that axis and
    find the grid phase that best aligns their positions (area-weighted
    circular mean on the block lattice)."""
    sub = block_size
    origin = lo.astype(float).copy()
    for ax in (0, 2):
        pos, wts = [], []
        for m in meshes:
            n = m.face_normals
            sel = np.abs(n[:, ax]) > 0.95
            if sel.any():
                pos.append(m.triangles_center[sel, ax])
                wts.append(m.area_faces[sel])
        if not pos:
            continue
        pos, wts = np.concatenate(pos), np.concatenate(wts)
        ang = 2 * np.pi * pos / sub
        phase = np.arctan2((wts * np.sin(ang)).sum(), (wts * np.cos(ang)).sum())
        off = (phase / (2 * np.pi)) * sub          # a lattice point
        origin[ax] = off - np.ceil((off - lo[ax]) / sub + 1e-9) * sub
    origin[1] = lo[1]
    return origin - 1e-6 * block_size


def occupancy(meshes, block_size: float, open_bottom: bool = True):
    """Half-block occupancy: a sub-cell is solid iff its CENTRE is inside the
    model. That is what makes slopes resolve into clean stair patterns.

    Each closed part (walls, roof, tower...) is tested on its own with exact
    ray parity and the results are unioned, so overlapping parts and hidden
    internal faces can't punch holes. Open/broken parts use the vote fallback.

    Returns (grid (2X,2Y,2Z) bool, origin, surface points, colors)."""
    sub = block_size / 2.0
    lo = np.min([m.bounds[0] for m in meshes], axis=0)
    hi = np.max([m.bounds[1] for m in meshes], axis=0)
    origin = grid_origin(meshes, block_size, lo)
    nblocks = np.ceil((hi - origin) / block_size - 1e-6).astype(int) + 1
    dims = nblocks * 2

    pts, cols, nrm = _surface_points(meshes, spacing=sub / 3.0)

    geo = trimesh.util.concatenate([trimesh.Trimesh(m.vertices, m.faces, process=False) for m in meshes])
    geo.merge_vertices(digits_vertex=6)
    parts = geo.split(only_watertight=False) if len(geo.faces) < 3_000_000 else [geo]
    closed = [p for p in parts if p.is_watertight]
    open_ = [p for p in parts if not p.is_watertight and p.area > 0]

    grid = np.zeros(dims, dtype=bool)
    for p in closed:
        grid |= _parity_occupancy(p.triangles, origin, dims, sub)
    if open_:
        om = trimesh.util.concatenate(open_)
        p2, f2 = trimesh.sample.sample_surface(om, max(2000, int(om.area / (sub / 3) ** 2)), seed=1)
        grid |= _vote_occupancy(p2, om.face_normals[f2], origin, dims, sub, open_bottom)

    # keep only colour samples on the visible exterior (drop faces buried
    # inside other parts, e.g. the top of a wall hidden under the roof)
    probe = np.floor((pts + nrm * 0.75 * sub - origin) / sub).astype(int)
    inb = np.all((probe >= 0) & (probe < dims), axis=1)
    buried = np.zeros(len(pts), bool)
    buried[inb] = grid[tuple(probe[inb].T)]
    if (~buried).sum() > 0.2 * len(pts):
        pts, cols = pts[~buried], cols[~buried]
    return grid, origin, pts, cols


# --------------------------------------------------------------------------
# 3. 2x2x2 pattern -> block shape lookup table
# --------------------------------------------------------------------------
def _quad_dir(dx, dz):
    return ("east" if dx else "west"), ("south" if dz else "north")


def _corner_facing(dx, dz):
    """Facing F such that the quadrant (dx,dz) is the F/right-of-F corner."""
    xd, zd = _quad_dir(dx, dz)
    return zd if CW[zd] == xd else xd


def _stair_from_partial(q: set[tuple[int, int]]):
    """q = quadrants (dx,dz) occupied in the partial half. -> (facing, shape) or None."""
    if len(q) == 2:
        (a, b) = sorted(q)
        if a[1] == b[1]:                       # same dz -> north/south edge
            return ("south" if a[1] else "north"), "straight"
        if a[0] == b[0]:                       # same dx -> east/west edge
            return ("east" if a[0] else "west"), "straight"
        return None                            # diagonal: ambiguous
    if len(q) == 1:
        dx, dz = next(iter(q))
        return _corner_facing(dx, dz), "outer_right"
    if len(q) == 3:
        (mdx, mdz), = {(0, 0), (0, 1), (1, 0), (1, 1)} - q
        return _corner_facing(1 - mdx, 1 - mdz), "inner_right"
    return None


def _build_lut():
    """256 patterns -> (kind, half, facing, shape). bit = dy*4 + dz*2 + dx."""
    lut = []
    for p in range(256):
        cells = {(dx, dy, dz) for dx in (0, 1) for dy in (0, 1) for dz in (0, 1)
                 if p >> (dy * 4 + dz * 2 + dx) & 1}
        bot = {(dx, dz) for dx, dy, dz in cells if dy == 0}
        top = {(dx, dz) for dx, dy, dz in cells if dy == 1}
        b, t = len(bot), len(top)
        entry = None
        if b == 4 and t == 4:
            entry = (FULL, None, None, None)
        elif t == 0 and b >= 3:
            entry = (SLAB, "bottom", None, None)
        elif b == 0 and t >= 3:
            entry = (SLAB, "top", None, None)
        elif b == 4 and 1 <= t <= 3:
            st = _stair_from_partial(top)
            entry = (STAIRS, "bottom", *st) if st else (FULL, None, None, None)
        elif t == 4 and 1 <= b <= 3:
            st = _stair_from_partial(bot)
            entry = (STAIRS, "top", *st) if st else (FULL, None, None, None)
        else:
            entry = (FULL, None, None, None) if b + t >= 4 else (AIR, None, None, None)
        lut.append(entry)
    return lut


LUT = _build_lut()
LUT_KIND = np.array([e[0] for e in LUT], dtype=np.int8)


# --------------------------------------------------------------------------
# 4. the build
# --------------------------------------------------------------------------
@dataclass
class Build:
    size: tuple[int, int, int]          # (X, Y, Z) blocks
    coords: np.ndarray                  # (N,3) int block positions
    kinds: np.ndarray                   # (N,) AIR/FULL/SLAB/STAIRS
    states: list[str]                   # (N,) full blockstate strings
    rgb: np.ndarray                     # (N,3) display color
    materials: list[str]                # (N,) family name

    def counts(self) -> dict[str, int]:
        from collections import Counter
        return dict(Counter(s.split("[")[0] for s in self.states).most_common())


def _mode_filter(coords, mats, rounds=1):
    """Replace each block's material by the majority of its 3x3x3 neighbours
    (incl. itself). Removes salt-and-pepper noise from photo textures."""
    if len(coords) == 0:
        return mats
    key = {tuple(c): i for i, c in enumerate(coords)}
    offs = [(a, b, c) for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1)]
    nb = np.full((len(coords), len(offs)), -1, dtype=np.int64)
    for j, o in enumerate(offs):
        sh = coords + np.array(o)
        nb[:, j] = [key.get(tuple(s), -1) for s in sh]
    for _ in range(rounds):
        vals = np.where(nb >= 0, mats[np.clip(nb, 0, None)], -1)
        out = mats.copy()
        for i in range(len(mats)):
            v = vals[i][vals[i] >= 0]
            u, c = np.unique(v, return_counts=True)
            best = u[np.argmax(c)]
            # only switch if the majority is clear (keeps small details like doors)
            if c.max() >= 0.5 * len(v) and best != mats[i]:
                out[i] = best
        mats = out
    return mats


def classify_blocks(sub, shapes=True, hollow=True):
    """Half-block occupancy (2X,2Y,2Z) -> block shapes.
    Returns ((X,Y,Z), coords (N,3), kinds (N,), pattern codes (N,))."""
    X, Y, Z = (np.array(sub.shape) // 2)
    sub = sub[: X * 2, : Y * 2, : Z * 2]
    code = np.zeros((X, Y, Z), dtype=np.int64)
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                code |= sub[dx::2, dy::2, dz::2].astype(np.int64) << (dy * 4 + dz * 2 + dx)
    if shapes:
        kind = LUT_KIND[code].copy()
    else:
        bits = np.unpackbits(code.astype(np.uint8)[..., None], axis=-1).sum(-1)
        kind = np.where(bits >= 4, FULL, AIR).astype(np.int8)
        code = np.where(kind == FULL, 255, 0)
    if hollow:
        # drop full blocks completely enclosed by full blocks
        full = kind == FULL
        enclosed = full.copy()
        for ax in range(3):
            for s in (-1, 1):
                nb = np.roll(full, s, axis=ax)
                edge = [slice(None)] * 3
                edge[ax] = 0 if s == 1 else -1
                nb[tuple(edge)] = False
                enclosed &= nb
        kind[enclosed] = AIR
    solid = kind != AIR
    coords = np.argwhere(solid)
    if len(coords) == 0:
        raise ValueError("model produced no blocks — try a larger height")
    return (int(X), int(Y), int(Z)), coords, kind[solid], code[solid]


def make_states(materials, mats, kinds, codes):
    """Material index + shape -> blockstate strings. A family without the
    needed stairs/slab falls back to its full block."""
    states, rgb, names = [], [], []
    for i in range(len(kinds)):
        m = materials[mats[i]]
        k = kinds[i]
        if k == STAIRS and m.stairs:
            _, half, facing, shape = LUT[codes[i]]
            s = f"minecraft:{m.stairs}[facing={facing},half={half},shape={shape},waterlogged=false]"
        elif k == SLAB and m.slab:
            s = f"minecraft:{m.slab}[type={LUT[codes[i]][1]},waterlogged=false]"
        else:
            s = f"minecraft:{m.full}"
        states.append(s)
        rgb.append(m.rgb)
        names.append(m.name)
    return states, np.array(rgb), names


def build(meshes, height_blocks: int | None = None, block_size: float | None = None,
          palette: Palette | None = None, max_materials: int = 12,
          hollow: bool = True, shapes: bool = True, smooth: int = 1,
          open_bottom: bool = True, shaped_bonus: float = 6.0) -> Build:
    palette = palette or Palette()
    lo = np.min([m.bounds[0] for m in meshes], axis=0)
    hi = np.max([m.bounds[1] for m in meshes], axis=0)
    if block_size is None:
        if not height_blocks:
            raise ValueError("give height_blocks or block_size")
        block_size = (hi[1] - lo[1]) / height_blocks

    sub, origin, pts, cols = occupancy(meshes, block_size, open_bottom=open_bottom)
    (X, Y, Z), coords, kinds, codes = classify_blocks(sub, shapes=shapes, hollow=hollow)

    # ---- color: look at the surface samples around each block (in Lab)
    tree = cKDTree((pts - origin) / block_size)
    centers = coords + 0.5
    lab_pts = srgb_to_lab(cols)
    d, nn = tree.query(centers, k=32, distance_upper_bound=1.25, workers=-1)
    # only the nearest surface layer: stops a wall block from picking up the
    # roof or floor colour just because they are within reach
    valid = np.isfinite(d) & (d <= d[:, :1] + 0.3)
    has = valid.any(axis=1)
    if (~has).any():  # blocks far from any surface sample (deep interior)
        _, nn1 = tree.query(centers[~has], k=1, workers=-1)
        nn[~has, 0] = nn1
        valid[~has, 0] = True
    nn = np.where(valid, nn, 0)
    w = valid.astype(float)
    block_lab = (lab_pts[nn] * w[..., None]).sum(1) / w.sum(1, keepdims=True)
    used_s = np.unique(nn[valid])

    def assign(mask=None):
        """Vote: each nearby sample picks its nearest block, the block takes the
        majority. Unlike averaging, this never invents an in-between colour at
        a boundary (red wall + white window != pink granite). When the vote is
        split (noisy photo texture), fall back to the averaged colour."""
        M = len(palette.materials)
        smat = np.zeros(len(pts), dtype=np.int64)
        for i in range(0, len(used_s), 250_000):
            ch = used_s[i:i + 250_000]
            smat[ch] = palette.nearest(lab_pts[ch], mask=mask, shaped_bonus=shaped_bonus)
        votes = smat[nn]
        key = (np.arange(len(coords))[:, None] * M + votes)[valid]
        tally = np.bincount(key, minlength=len(coords) * M).reshape(len(coords), M)
        winner = tally.argmax(1)
        share = tally.max(1) / np.maximum(tally.sum(1), 1)
        avg = palette.nearest(block_lab, mask=mask, shaped_bonus=shaped_bonus)
        return np.where(share >= 0.45, winner, avg)

    # ---- pick materials, then limit the palette to the most-used ones
    mats = assign()
    if max_materials and len(np.unique(mats)) > max_materials:
        u, c = np.unique(mats, return_counts=True)
        order = np.argsort(-c)
        keep = list(u[order[:max_materials]])
        # also keep small-but-distinct details (doors, windows, trim): any
        # material with >=0.2% of blocks that's far from everything kept
        for i in order[max_materials:]:
            if c[i] >= 0.002 * len(mats):
                dE = np.sqrt(((palette.lab[keep] - palette.lab[u[i]]) ** 2).sum(-1)).min()
                if dE > 18:
                    keep.append(u[i])
        mask = np.zeros(len(palette.materials), bool)
        mask[keep] = True
        mats = assign(mask)
    if smooth:
        mats = _mode_filter(coords, mats, rounds=smooth)

    # stairs / slabs need a family that actually has that shape. Prefer one
    # already used in the build (coherent look) unless it's a clearly worse match.
    used = np.zeros(len(palette.materials), bool)
    used[np.unique(mats)] = True
    for k, has_shape in ((STAIRS, palette.has_stairs), (SLAB, palette.has_slab)):
        bad = (kinds == k) & ~has_shape[mats]
        if not bad.any():
            continue
        if not has_shape.any():
            kinds[bad] = FULL
            continue
        d = palette.distances(block_lab[bad])
        d_all = np.where(has_shape, d, np.inf)
        d_used = np.where(has_shape & used, d, np.inf)
        best_all, best_used = d_all.argmin(1), d_used.argmin(1)
        ok = d_used.min(1) <= d_all.min(1) + 6.0
        mats[bad] = np.where(ok, best_used, best_all)

    states, rgb, names = make_states(palette.materials, mats, kinds, codes)
    return Build((int(X), int(Y), int(Z)), coords, kinds, states, rgb, names)
