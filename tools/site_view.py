"""Textured view of part of a saved world.

    python tools/site_view.py out/smu 540 690 870 1080 out/smu_dallas_hall.png [--scale 4] [--y0 -64]

x0 z0 x1 z1 are block coordinates (x east, z south). Reads the region files back (so it shows what was
actually saved) and draws them with Minecraft's block textures (downloaded once into data/textures/).
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402

from mcbuild.texrender import render  # noqa: E402
from mcbuild.world import read_area  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("world")
ap.add_argument("box", nargs=4, type=int, metavar=("x0", "z0", "x1", "z1"))
ap.add_argument("out")
ap.add_argument("--scale", type=int, default=4, help="pixels per half block (even)")
ap.add_argument("--y0", type=int, default=None, help="lowest y to draw (default: 4 below the lowest ground)")
a = ap.parse_args()
x0, z0, x1, z1 = a.box
C, states = read_area(a.world, x0, z0, x1, z1, -64, 320)
solid = C != 0
top = int(np.nonzero(solid.any((0, 1)))[0].max()) + 1
if a.y0 is None:
    ground = np.argmax(~solid, axis=2)                     # first air above the bedrock/stone column
    y_lo = max(int(np.percentile(ground, 2)) - 4, 0)
else:
    y_lo = a.y0 + 64
render(C[:, :, y_lo:top], states, a.out, s=a.scale, cache=os.path.join(HERE, "data", "textures"))
print("wrote", a.out)
