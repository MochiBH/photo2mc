"""Build from a structure spec, where every part already knows its material.

Uses the same half-block engine as mesh conversion (exact ray-parity fill,
2x2x2 shape table, wall alignment), but materials come from the spec instead
of colour matching, so windows are glass, roofs are roof tiles, and so on.
"""
from __future__ import annotations

import difflib
import warnings
import numpy as np

from .palette import BY_NAME, Material
from .parts import spec_meshes
from .voxelize import (Build, FULL, STAIRS, SLAB, _parity_occupancy, classify_blocks,
                       grid_origin, make_states)


def resolve_material(name: str) -> Material:
    name = name.replace("minecraft:", "").strip()
    if name in BY_NAME:
        return BY_NAME[name]
    # accept stair/slab names and common aliases ("brick_stairs" -> bricks)
    for m in BY_NAME.values():
        if name in (m.stairs, m.slab, m.full):
            return m
    close = difflib.get_close_matches(name, list(BY_NAME), n=1, cutoff=0.6)
    if close:
        warnings.warn(f"material {name!r} not in palette, using {close[0]!r}")
        return BY_NAME[close[0]]
    warnings.warn(f"material {name!r} not in palette, using 'stone'")
    return BY_NAME["stone"]


def _occ(mesh, origin, dims, sub):
    """Union of the exact fills of each closed component."""
    g = np.zeros(dims, bool)
    comps = mesh.split(only_watertight=False) if len(mesh.faces) < 200_000 else [mesh]
    for c in comps:
        if len(c.faces) >= 4:
            g |= _parity_occupancy(c.triangles, origin, dims, sub)
    return g


def build_from_spec(spec: dict, block_size: float | None = None, height_blocks: int | None = None,
                    hollow: bool = True, shapes: bool = True) -> Build:
    parts = spec_meshes(spec)
    solids = [m for m, _, mode in parts if mode == "solid"]
    if not solids:
        raise ValueError("spec has no solid parts")
    lo = np.min([m.bounds[0] for m in solids], axis=0)
    hi = np.max([m.bounds[1] for m in solids], axis=0)
    lo[1] = min(lo[1], 0.0)
    if block_size is None:
        if not height_blocks:
            raise ValueError("give block_size or height_blocks")
        block_size = (hi[1] - lo[1]) / height_blocks
    sub = block_size / 2
    origin = grid_origin(solids, block_size, lo)
    nblocks = np.ceil((hi - origin) / block_size - 1e-6).astype(int) + 1
    dims = nblocks * 2

    mats: list[Material] = []
    mid = {}
    def idx(name):
        m = resolve_material(name)
        if m.name not in mid:
            mid[m.name] = len(mats)
            mats.append(m)
        return mid[m.name]

    occ = np.zeros(dims, bool)
    matg = np.full(dims, -1, np.int16)
    paint = np.full(dims, -1, np.int16)
    for mesh, mname, mode in parts:
        g = _occ(mesh, origin, dims, sub)
        if mode == "carve":
            occ &= ~g
        elif mode == "paint":
            paint[g] = idx(mname)
        else:
            occ |= g
            matg[g] = idx(mname)

    (X, Y, Z), coords, kinds, codes = classify_blocks(occ, shapes=shapes, hollow=hollow)

    # material of each block = majority of its solid sub-cells
    M = max(len(mats), 1)
    def block_vals(grid):
        v = np.stack([grid[2 * coords[:, 0] + dx, 2 * coords[:, 1] + dy, 2 * coords[:, 2] + dz]
                      for dx in (0, 1) for dy in (0, 1) for dz in (0, 1)], axis=1)
        return v
    mv = block_vals(matg)
    tally = np.zeros((len(coords), M), int)
    for j in range(8):
        ok = mv[:, j] >= 0
        np.add.at(tally, (np.flatnonzero(ok), mv[ok, j]), 1)
    blk = tally.argmax(1)

    # paint: any painted sub-cell in the block repaints it, if the paint
    # material has the shape this block needs
    pv = block_vals(paint)
    ptally = np.zeros((len(coords), M), int)
    for j in range(8):
        ok = pv[:, j] >= 0
        np.add.at(ptally, (np.flatnonzero(ok), pv[ok, j]), 1)
    painted = ptally.sum(1) > 0
    pmat = ptally.argmax(1)
    has_st = np.array([m.stairs is not None for m in mats])
    has_sl = np.array([m.slab is not None for m in mats])
    can = (kinds == FULL) | ((kinds == STAIRS) & has_st[pmat]) | ((kinds == SLAB) & has_sl[pmat])
    blk = np.where(painted & can, pmat, blk)

    states, rgb, names = make_states(mats, blk, kinds, codes)
    return Build((X, Y, Z), coords, kinds, states, rgb, names)
