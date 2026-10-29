"""Structure spec (JSON) -> watertight primitive meshes.

A spec describes a structure the way an architect would sketch its massing:
a list of parts, each a simple shape with real-world size, position and a
Minecraft material. Claude writes these from photos (see vision.py); people
can write or edit them by hand too.

Coordinates (meters): y up, y=0 is the ground. x = right as seen in the
photo, z = toward the camera (the photographed facade faces +z).
"at" is the part's BASE CENTER: [x, y_bottom, z].

    {"name": "...", "parts": [
       {"shape": "box", "size": [w, h, d], "at": [0, 0, 0], "material": "stone_bricks"},
       {"shape": "gable_roof", "size": [w, h, d], "ridge": "x", "at": [0, 12, 0], "material": "deepslate_tiles"},
       {"shape": "box", "size": [1.2, 2, 1.5], "at": [-3, 4, 4.5], "material": "glass", "mode": "paint",
        "repeat": {"count": 4, "step": [2, 0, 0]}, "mirror": "x"}
    ]}

Shapes: box, cylinder (radius, height, [radius_top], [sides]), cone, pyramid,
gable_roof (ridge "x"|"z"), hip_roof, dome (radius, [height]), sphere,
revolve (profile [[r, y], ...]), extrude (footprint [[x, z], ...], height),
arch (width, height, depth, [axis] - box with a round top, for openings).

Modes: "solid" (default) adds material; "carve" removes it (doorways,
arches, courtyards); "paint" re-materials whatever solid surface it overlaps
(windows, bands, trim) without changing the shape.

Extras on any part: "rotate" (degrees about y), "repeat" {"count": n or
[nx, ny], "step": [dx,dy,dz] or [[..],[..]]}, "mirror": "x" | "z" | "xz".
"""
from __future__ import annotations

import copy
import numpy as np
import trimesh
from trimesh import transformations as tf

SHAPES = ["box", "cylinder", "cone", "pyramid", "gable_roof", "hip_roof", "dome",
          "sphere", "revolve", "extrude", "arch"]


def _closed(v, f):
    m = trimesh.Trimesh(np.asarray(v, float), np.asarray(f), process=True)
    m.fix_normals()
    return m


def _box(w, h, d):
    return trimesh.creation.box(extents=(w, h, d), transform=tf.translation_matrix((0, h / 2, 0)))


def _frustum(r0, r1, h, sides):
    """Cylinder/cone/frustum standing on y=0. sides=4 gives a square tower
    with flat faces toward x and z."""
    a = np.arange(sides) * 2 * np.pi / sides + (np.pi / sides if sides == 4 else 0)
    if sides == 4:
        r0, r1 = r0 * np.sqrt(2), r1 * np.sqrt(2)   # radius means half-width
    ring0 = np.c_[r0 * np.cos(a), np.zeros(sides), r0 * np.sin(a)]
    if r1 <= 1e-6:
        v = np.vstack([ring0, [[0, 0, 0], [0, h, 0]]])
        b, t = sides, sides + 1
        f = [[b, (i + 1) % sides, i] for i in range(sides)] + [[i, (i + 1) % sides, t] for i in range(sides)]
        return _closed(v, f)
    ring1 = np.c_[r1 * np.cos(a), np.full(sides, h), r1 * np.sin(a)]
    v = np.vstack([ring0, ring1, [[0, 0, 0], [0, h, 0]]])
    b, t = 2 * sides, 2 * sides + 1
    f = []
    for i in range(sides):
        j = (i + 1) % sides
        f += [[i, j, sides + j], [i, sides + j, sides + i], [b, j, i], [t, sides + i, sides + j]]
    return _closed(v, f)


def _pyramid(w, h, d, top=0.0):
    x, z = w / 2, d / 2
    v = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [0, h, 0]]
    f = [[0, 2, 1], [0, 3, 2], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]
    return _closed(v, f)


def _gable(w, h, d, ridge="x"):
    if ridge == "x":   # ridge runs left-right, sloped faces toward +z/-z
        x, z = w / 2, d / 2
        v = [[-x, 0, -z], [-x, 0, z], [-x, h, 0], [x, 0, -z], [x, 0, z], [x, h, 0]]
    else:
        x, z = w / 2, d / 2
        v = [[-x, 0, -z], [x, 0, -z], [0, h, -z], [-x, 0, z], [x, 0, z], [0, h, z]]
    f = [[0, 1, 2], [3, 5, 4], [0, 3, 4], [0, 4, 1], [1, 4, 5], [1, 5, 2], [2, 5, 3], [2, 3, 0]]
    return _closed(v, f)


def _hip(w, h, d):
    x, z = w / 2, d / 2
    r = max(0.0, (max(w, d) - min(w, d)) / 2)        # half ridge length
    if w >= d:
        top = [[-r, h, 0], [r, h, 0]]
    else:
        top = [[0, h, -r], [0, h, r]]
    v = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]] + top
    m = trimesh.convex.convex_hull(np.array(v, float))
    return m


def _revolve(profile, sides=64):
    """profile: [[r, y], ...] bottom to top. Closed on the axis automatically."""
    pr = np.asarray(profile, float)
    pts = list(pr)
    if pr[0, 0] > 1e-6:
        pts.insert(0, [0.0, pr[0, 1]])
    if pr[-1, 0] > 1e-6:
        pts.append([0.0, pr[-1, 1]])
    pts = np.array(pts)
    m = trimesh.creation.revolve(pts, sections=sides)
    # trimesh revolves around Z with profile in (r, z): rotate Z-up -> Y-up
    m.apply_transform(tf.rotation_matrix(-np.pi / 2, (1, 0, 0)))
    m.merge_vertices()
    m.fix_normals()
    return m


def _dome(r, h=None, sides=64):
    h = r if h is None else h
    t = np.linspace(0, np.pi / 2, 24)
    return _revolve(np.c_[r * np.cos(t), h * np.sin(t)], sides)


def _sphere(r):
    m = trimesh.creation.icosphere(subdivisions=4, radius=r)
    m.apply_translation((0, r, 0))
    return m


def _extrude(footprint, h):
    from shapely.geometry import Polygon
    poly = Polygon([(x, -z) for x, z in footprint])     # extrude works in XY; map z->-y
    if not poly.is_valid:
        poly = poly.buffer(0)
    m = trimesh.creation.extrude_polygon(poly, h)
    m.apply_transform(tf.rotation_matrix(-np.pi / 2, (1, 0, 0)))
    return m


def _arch(w, h, d, axis="z"):
    """Doorway/arch shape: box of height h - w/2 topped with a half cylinder.
    axis z = opening passes front-to-back."""
    r = w / 2
    body_h = max(h - r, 0.01)
    body = _box(w, body_h, d)
    cyl = trimesh.creation.cylinder(radius=r, height=d, sections=48)   # along z
    cyl.apply_translation((0, body_h, 0))
    m = trimesh.util.concatenate([body, cyl])
    if axis == "x":
        m.apply_transform(tf.rotation_matrix(np.pi / 2, (0, 1, 0)))
    return m


def make_mesh(p: dict) -> trimesh.Trimesh:
    s = p["shape"]
    if s == "box":
        m = _box(*p["size"])
    elif s in ("cylinder", "cone"):
        r = float(p["radius"])
        rt = 0.0 if s == "cone" else float(p.get("radius_top", r))
        m = _frustum(r, rt, float(p["height"]), int(p.get("sides", 64)))
    elif s == "pyramid":
        m = _pyramid(*p["size"])
    elif s == "gable_roof":
        m = _gable(*p["size"], ridge=p.get("ridge", "x"))
    elif s == "hip_roof":
        m = _hip(*p["size"])
    elif s == "dome":
        m = _dome(float(p["radius"]), p.get("height"))
    elif s == "sphere":
        m = _sphere(float(p["radius"]))
    elif s == "revolve":
        m = _revolve(p["profile"], int(p.get("sides", 64)))
    elif s == "extrude":
        m = _extrude(p["footprint"], float(p["height"]))
    elif s == "arch":
        m = _arch(float(p["width"]), float(p["height"]), float(p["depth"]), p.get("axis", "z"))
    else:
        raise ValueError(f"unknown shape {s!r} (known: {', '.join(SHAPES)})")
    if p.get("rotate"):
        m.apply_transform(tf.rotation_matrix(np.radians(float(p["rotate"])), (0, 1, 0)))
    m.apply_translation(np.asarray(p.get("at", (0, 0, 0)), float))
    return m


def expand(parts: list[dict]) -> list[dict]:
    """Apply repeat and mirror so every entry is one concrete part."""
    out = []
    for p in parts:
        p = copy.deepcopy(p)          # never modify the caller's spec
        base = [p]
        rep = p.get("repeat")
        if rep:
            counts = rep["count"] if isinstance(rep["count"], list) else [rep["count"]]
            steps = rep["step"] if isinstance(rep["step"][0], list) else [rep["step"]]
            grid = [np.zeros(3)]
            for n, st in zip(counts, steps):
                grid = [g + k * np.asarray(st, float) for g in grid for k in range(int(n))]
            base = []
            for g in grid:
                q = copy.deepcopy(p)
                q["at"] = (np.asarray(p.get("at", (0, 0, 0)), float) + g).tolist()
                base.append(q)
        mir = p.get("mirror", "")
        allp = list(base)
        for axis in [a for a in "xz" if a in mir]:
            i = "xyz".index(axis)
            more = []
            for q in allp:
                r = copy.deepcopy(q)
                at = list(r.get("at", (0, 0, 0)))
                at[i] = -at[i]
                r["at"] = at
                if r.get("rotate"):
                    r["rotate"] = -r["rotate"]
                if r["shape"] == "extrude":
                    r["footprint"] = [[(-x if axis == "x" else x), (-z if axis == "z" else z)]
                                      for x, z in r["footprint"]]
                more.append(r)
            allp += more
        for q in allp:
            q.pop("repeat", None)
            q.pop("mirror", None)
            out.append(q)
    # drop exact duplicates created by mirroring parts that sit on the axis
    seen, uniq = set(), []
    for q in out:
        key = repr(sorted((k, str(v)) for k, v in q.items()))
        if key not in seen:
            seen.add(key)
            uniq.append(q)
    return uniq


def spec_meshes(spec: dict):
    """-> list of (mesh, material, mode) in spec order."""
    res = []
    for p in expand(spec["parts"]):
        res.append((make_mesh(p), p.get("material", "stone"), p.get("mode", "solid")))
    return res
