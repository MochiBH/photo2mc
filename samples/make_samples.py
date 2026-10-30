"""Procedural test structures (real-world meters, +Y up), saved as .glb.

These stand in for photogrammetry / image-to-3D output so the block engine
can be tested on known geometry: gabled roof (straight stairs), hip corners
(corner stairs), a 51.8° pyramid, and a dome (curved stairs + slabs).
"""
import os
import numpy as np
import trimesh

OUT = os.path.dirname(os.path.abspath(__file__))


def colored(m, rgb):
    m.visual.face_colors = [*rgb, 255]
    return m


def box(size, center, rgb):
    return colored(trimesh.creation.box(extents=size,
                   transform=trimesh.transformations.translation_matrix(center)), rgb)


def gable(width, depth, rise, base_y, center_xz, rgb, overhang=0.6):
    """Triangular prism roof, ridge along Z."""
    w = width / 2 + overhang
    d = depth / 2 + overhang
    cx, cz = center_xz
    v = []
    for z in (-d, d):
        v += [[cx - w, base_y, cz + z], [cx + w, base_y, cz + z], [cx, base_y + rise, cz + z]]
    f = [[0, 2, 1], [3, 4, 5],           # gable ends
         [0, 1, 4], [0, 4, 3],           # bottom
         [1, 2, 5], [1, 5, 4],           # right slope
         [2, 0, 3], [2, 3, 5]]           # left slope
    m = trimesh.Trimesh(v, f, process=True)
    m.fix_normals()
    return colored(m, rgb)


def cottage():
    parts = [
        box((12, 6, 9), (0, 3, 0), (150, 70, 55)),                 # brick walls
        gable(12, 9, 5, 6, (0, 0), (60, 60, 64)),                   # slate roof
        box((1.6, 5, 1.6), (3.5, 8.5, 1.5), (128, 128, 128)),       # stone chimney
        box((1.6, 2.6, 0.4), (0, 1.3, 4.6), (100, 66, 36)),         # wooden door
        box((12.6, 0.6, 9.6), (0, 0.3, 0), (125, 125, 125)),        # stone plinth
    ]
    for x in (-3.8, 3.8):                                           # windows
        parts.append(box((2, 1.6, 0.3), (x, 3.4, 4.6), (190, 220, 235)))
    return trimesh.util.concatenate(parts)


def pyramid(base=230.3, height=146.6, rgb=(214, 196, 150)):
    b = base / 2
    v = [[-b, 0, -b], [b, 0, -b], [b, 0, b], [-b, 0, b], [0, height, 0]]
    f = [[0, 1, 2], [0, 2, 3], [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]]
    m = trimesh.Trimesh(v, f, process=True)
    m.fix_normals()
    return colored(m, rgb)


def domed_temple():
    """Cylinder drum + hemispherical dome + portico — Pantheon-like."""
    drum = colored(trimesh.creation.cylinder(radius=21.7, height=21.7, sections=96,
                   transform=trimesh.transformations.translation_matrix((0, 10.85, 0)) @
                   trimesh.transformations.rotation_matrix(np.pi / 2, (1, 0, 0))),
                   (205, 195, 175))
    dome = trimesh.creation.icosphere(subdivisions=5, radius=21.7)
    dome.vertices[:, 1] = np.maximum(dome.vertices[:, 1], 0) * 1.0
    dome.apply_translation((0, 21.7, 0))
    dome = colored(dome, (150, 150, 145))
    portico = box((34, 14, 16), (0, 7, 27), (215, 205, 185))
    pediment = gable(34, 16, 6, 14, (0, 27), (200, 190, 170), overhang=0.4)
    # rotate pediment ridge to run along Z (toward viewer): already along Z
    return trimesh.util.concatenate([drum, dome, portico, pediment])


if __name__ == "__main__":
    for name, fn in [("cottage", cottage), ("pyramid", pyramid), ("temple", domed_temple)]:
        m = fn()
        p = os.path.join(OUT, f"{name}.glb")
        m.export(p)
        print(name, m.bounds.round(1).tolist(), "->", p)
