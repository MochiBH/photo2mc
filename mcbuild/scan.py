"""Clean up photogrammetry / phone-scan meshes before building.

Scans from Polycam, Scaniverse, RealityScan, COLMAP etc. arrive tilted,
often Z-up, with a slab of ground and neighbouring clutter (cars, trees,
the next building). This finds the ground plane, levels the scan onto it,
cuts the ground away and keeps only the structure.
"""
from __future__ import annotations

import numpy as np
import trimesh
from scipy import ndimage


def _sample(meshes, n=60000, seed=0):
    total = sum(m.area for m in meshes)
    pts = []
    for m in meshes:
        k = max(50, int(n * m.area / max(total, 1e-12)))
        p, _ = trimesh.sample.sample_surface(m, k, seed=seed)
        pts.append(p)
    return np.vstack(pts)


def find_ground(meshes, iters=800, tol_frac=0.006, seed=0):
    """RANSAC for the ground: the large plane with the most support whose
    points lie at the BOTTOM of the scan (a big wall is also a plane, but
    things stand on the ground, not beside it).
    Returns (unit normal pointing up into the structure, offset d) with
    plane n·p = d."""
    rng = np.random.default_rng(seed)
    pts = _sample(meshes)
    diag = np.linalg.norm(pts.max(0) - pts.min(0))
    tol = tol_frac * diag
    best, best_score = None, -1
    for _ in range(iters):
        a, b, c = pts[rng.choice(len(pts), 3, replace=False)]
        n = np.cross(b - a, c - a)
        L = np.linalg.norm(n)
        if L < 1e-12:
            continue
        n /= L
        d = n @ a
        dist = pts @ n - d
        inl = np.abs(dist) < tol
        cnt = inl.sum()
        if cnt < 0.05 * len(pts):
            continue
        # orient toward the bulk of the scan
        side = np.sign(np.median(dist[~inl])) if (~inl).any() else 1.0
        n, d, dist = n * side, d * side, dist * side
        below = (dist < -3 * tol).mean()        # ground has ~nothing under it
        score = cnt * (1 - 4 * below)
        if score > best_score:
            best, best_score = (n, d), score
    if best is None:
        raise ValueError("couldn't find a ground plane; pass --up instead")
    # refine with least squares on inliers
    n, d = best
    inl = np.abs(pts @ n - d) < tol
    q = pts[inl]
    c = q.mean(0)
    _, _, vt = np.linalg.svd(q - c, full_matrices=False)
    n2 = vt[-1] * np.sign(vt[-1] @ n)
    rms = float(np.sqrt(np.mean((q @ n2 - n2 @ c) ** 2)))
    return n2, n2 @ c, rms


def level(meshes, normal, d):
    """Rotate so the ground normal is +Y and move the ground to y=0."""
    R = trimesh.geometry.align_vectors(normal, [0, 1, 0])
    T = np.eye(4)
    T[1, 3] = -d
    M = T @ R
    for m in meshes:
        m.apply_transform(M)
    return M


def _keep_faces(m, mask):
    if mask.all():
        return m
    if not mask.any():
        return None
    return m.submesh([np.flatnonzero(mask)], append=True)


def isolate(meshes, ground_tol=None, min_height=None, margin=1.0):
    """After levelling: drop the ground and anything not attached to the main
    structure (by footprint), keep the rest."""
    lo = np.min([m.bounds[0] for m in meshes], axis=0)
    hi = np.max([m.bounds[1] for m in meshes], axis=0)
    diag = np.linalg.norm(hi - lo)
    ground_tol = ground_tol if ground_tol is not None else 0.01 * diag
    min_height = min_height if min_height is not None else 0.04 * (hi[1] - 0)

    # footprint of everything that rises clearly above the ground
    pts = _sample(meshes, 80000)
    up = pts[pts[:, 1] > min_height]
    if len(up) == 0:
        raise ValueError("nothing above the ground plane")
    res = max(diag / 300, 1e-3)
    gx = np.floor((up[:, 0] - lo[0]) / res).astype(int)
    gz = np.floor((up[:, 2] - lo[2]) / res).astype(int)
    occ = np.zeros((gx.max() + 1, gz.max() + 1), bool)
    occ[gx, gz] = True
    occ = ndimage.binary_closing(occ, iterations=2)
    lab, n = ndimage.label(occ)
    if n == 0:
        raise ValueError("no structure found above the ground")
    sizes = ndimage.sum(occ, lab, range(1, n + 1))
    main = lab == (1 + int(np.argmax(sizes)))
    main = ndimage.binary_dilation(main, iterations=max(1, int(margin / res)))

    out = []
    for m in meshes:
        c = m.triangles_center
        ix = np.floor((c[:, 0] - lo[0]) / res).astype(int)
        iz = np.floor((c[:, 2] - lo[2]) / res).astype(int)
        inside = (ix >= 0) & (iz >= 0) & (ix < main.shape[0]) & (iz < main.shape[1])
        keep = np.zeros(len(c), bool)
        keep[inside] = main[ix[inside], iz[inside]]
        # ground faces: low and roughly horizontal
        flat = np.abs(m.face_normals[:, 1]) > 0.8
        keep &= ~(flat & (c[:, 1] < ground_tol))
        keep &= c[:, 1] > -ground_tol
        km = _keep_faces(m, keep)
        if km is not None:
            out.append(km)
    if not out:
        raise ValueError("everything was removed — try --keep-ground")
    return out


def align_yaw(meshes):
    """Rotate about the vertical so the dominant walls face x and z.
    Walls are faces with near-horizontal normals; their directions have
    4-fold symmetry, so average exp(4i*theta) weighted by area."""
    acc = 0j
    for m in meshes:
        n = m.face_normals
        w = m.area_faces * (np.abs(n[:, 1]) < 0.3)
        acc += (w * np.exp(4j * np.arctan2(n[:, 2], n[:, 0]))).sum()
    if abs(acc) < 1e-12:
        return 0.0
    ang = np.angle(acc) / 4
    R = trimesh.transformations.rotation_matrix(ang, (0, 1, 0))   # undo the yaw
    for m in meshes:
        m.apply_transform(R)
    return float(np.degrees(ang))


def clean_scan(meshes, keep_ground=False, square_up=True, log=print):
    n, d, rms = find_ground(meshes)
    tilt = np.degrees(np.arccos(np.clip(abs(n[1]), -1, 1)))
    log(f"ground plane found ({tilt:.1f}° from the file's Y axis); levelling")
    level(meshes, n, d)
    if square_up:
        a = align_yaw(meshes)
        log(f"rotated {a:+.1f}° so the walls line up with the block grid")
    if keep_ground:
        return meshes
    out = isolate(meshes, ground_tol=max(4 * rms, 1e-4))
    lo = np.min([m.bounds[0] for m in out], axis=0)
    hi = np.max([m.bounds[1] for m in out], axis=0)
    log(f"kept the main structure: {np.round(hi - lo, 2).tolist()} (model units)")
    return out
