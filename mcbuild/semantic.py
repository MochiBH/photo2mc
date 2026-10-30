"""Build from a structure spec, where every part already knows its material.

Uses the same half-block engine as mesh conversion (exact ray-parity fill,
2x2x2 shape table, wall alignment), but materials come from the spec instead
of colour matching, so windows are glass, roofs are roof tiles, and so on.
"""
from __future__ import annotations

import difflib
import warnings
import numpy as np
import trimesh

from .palette import BY_NAME, Material, for_version
from .parts import spec_meshes
from .voxelize import (Build, FULL, STAIRS, SLAB, CONNECT, _parity_occupancy, classify_blocks,
                       grid_origin, make_states)
from .connect import CONNECTABLES, Connectable, connection_states

THIN_FALLBACK = {"pane": "glass_pane", "bars": "iron_bars", "fence": "oak_fence", "wall": "cobblestone_wall"}


def resolve_material(name: str):
    """Spec material name -> Material (block family) or Connectable (thin)."""
    name = name.replace("minecraft:", "").strip()
    if name in CONNECTABLES:
        return CONNECTABLES[name]
    if name.endswith(("_pane", "_fence", "_wall", "_bars")) or name in ("pane", "fence", "wall", "bars"):
        close = difflib.get_close_matches(name, list(CONNECTABLES), n=1, cutoff=0.5)
        pick = close[0] if close else THIN_FALLBACK.get(name.split("_")[-1], "glass_pane")
        warnings.warn(f"material {name!r} not found, using {pick!r}")
        return CONNECTABLES[pick]
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
                    hollow: bool = True, shapes: bool = True, target: str = "latest") -> Build:
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
        if isinstance(m, Connectable):
            if target != "latest" and m.since == "26":
                m = CONNECTABLES[THIN_FALLBACK[m.kind]]
        else:
            m = for_version(m, target) or for_version(BY_NAME["stone"], target)
        if m.name not in mid:
            mid[m.name] = len(mats)
            mats.append(m)
        return mid[m.name]

    occ = np.zeros(dims, bool)
    matg = np.full(dims, -1, np.int16)
    paint = np.full(dims, -1, np.int16)
    thin = np.full(tuple(nblocks), -1, np.int16)      # block-level thin parts

    def window(mesh):
        """Sub-cell window (block-aligned) around a part, so each part is voxelized only where it is."""
        i0 = np.floor((mesh.bounds[0] - origin) / sub).astype(int) - 2
        i1 = np.ceil((mesh.bounds[1] - origin) / sub).astype(int) + 2
        i0 = np.clip(i0 // 2 * 2, 0, dims)
        i1 = np.clip(-(-i1 // 2) * 2, 0, dims)
        return i0, i1

    def touched_blocks(mesh, g, i0, i1):
        """Blocks a thin part passes through at all (it may be far thinner
        than half a block, so 'centre inside' would miss it)."""
        t = np.zeros(tuple(nblocks), bool)
        gb = tuple(i1 // 2 - i0 // 2)
        t[tuple(slice(a // 2, b // 2) for a, b in zip(i0, i1))] = \
            g.reshape(gb[0], 2, gb[1], 2, gb[2], 2).sum(axis=(1, 3, 5)) >= 4
        n = max(500, int(mesh.area / (block_size / 4) ** 2))
        pts, fi = trimesh.sample.sample_surface(mesh, min(n, 2_000_000), seed=0)
        # nudge inward so faces lying exactly on a block boundary (the top of
        # a 1 m fence) don't spill into the next block
        pts = pts - mesh.face_normals[fi] * (1e-3 * block_size)
        # along any axis where the part is thinner than a block, keep it to
        # the single row containing its centre plane
        ext = mesh.extents / block_size
        ctr = mesh.bounds.mean(0)
        for ax in range(3):
            if ext[ax] < 0.9:
                pts[:, ax] = ctr[ax]
        ij = np.floor((pts - origin) / block_size).astype(int)
        ok = np.all((ij >= 0) & (ij < nblocks), axis=1)
        t[tuple(ij[ok].T)] = True
        return t

    for mesh, mname, mode in parts:
        i0, i1 = window(mesh)
        if np.any(i1 <= i0):
            continue
        g = _occ(mesh, origin + i0 * sub, tuple(i1 - i0), sub)
        sl = tuple(slice(a, b) for a, b in zip(i0, i1))
        if mode == "carve":
            occ[sl] &= ~g
            gb = tuple(i1 // 2 - i0 // 2)
            tb = thin[tuple(slice(a // 2, b // 2) for a, b in zip(i0, i1))]
            tb[g.reshape(gb[0], 2, gb[1], 2, gb[2], 2).any(axis=(1, 3, 5))] = -1
        elif mode == "paint":
            paint[sl][g] = idx(mname)
        else:
            i = idx(mname)
            if isinstance(mats[i], Connectable):
                thin[touched_blocks(mesh, g, i0, i1)] = i
            else:
                occ[sl] |= g
                matg[sl][g] = i

    (X, Y, Z), coords, kinds, codes = classify_blocks(occ, shapes=shapes, hollow=hollow) if occ.any() else \
        ((int(nblocks[0]), int(nblocks[1]), int(nblocks[2])), np.zeros((0, 3), int), np.zeros(0, np.int8), np.zeros(0, int))

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
    # material has the shape this block needs. Painting a wall with a pane
    # material turns those wall blocks into panes (inset windows).
    pv = block_vals(paint)
    ptally = np.zeros((len(coords), M), int)
    for j in range(8):
        ok = pv[:, j] >= 0
        np.add.at(ptally, (np.flatnonzero(ok), pv[ok, j]), 1)
    painted = ptally.sum(1) > 0
    pmat = ptally.argmax(1)
    is_thin = np.array([isinstance(m, Connectable) for m in mats])
    has_st = np.array([m.stairs is not None for m in mats])
    has_sl = np.array([m.slab is not None for m in mats])
    can = (kinds == FULL) | ((kinds == STAIRS) & has_st[pmat] & ~is_thin[pmat]) | \
          ((kinds == SLAB) & has_sl[pmat] & ~is_thin[pmat])
    apply = painted & can
    blk = np.where(apply, pmat, blk)
    kinds = kinds.copy()
    kinds[apply & is_thin[pmat]] = CONNECT

    # thin parts fill only where nothing solid is
    if (thin >= 0).any():
        have = np.zeros(tuple(nblocks), bool)
        if len(coords):
            have[tuple(coords.T)] = True
        add = np.argwhere((thin >= 0) & ~have)
        coords = np.vstack([coords, add]) if len(coords) else add
        kinds = np.concatenate([kinds, np.full(len(add), CONNECT, np.int8)])
        codes = np.concatenate([codes, np.zeros(len(add), codes.dtype)])
        blk = np.concatenate([blk, thin[tuple(add.T)].astype(blk.dtype)])

    states, rgb, names = make_states(mats, blk, kinds, codes)
    conn = kinds == CONNECT
    if conn.any():
        ids = np.array([mats[b].id if conn[i] else "" for i, b in enumerate(blk)], dtype=object)
        ckind = np.array([mats[b].kind if conn[i] else "" for i, b in enumerate(blk)], dtype=object)
        full = (kinds == FULL)
        for i, st in connection_states(coords, ids, ckind, conn, full).items():
            states[i] = st
    return Build((X, Y, Z), coords, kinds, states, rgb, names)
