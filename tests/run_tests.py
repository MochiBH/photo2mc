"""Fast end-to-end checks. Run: python tests/run_tests.py"""
import json
import os
import sys
import tempfile
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import numpy as np  # noqa: E402
import trimesh  # noqa: E402

from mcbuild import load_meshes, build  # noqa: E402
from mcbuild.voxelize import LUT, STAIRS, _parity_occupancy  # noqa: E402
from mcbuild.shapes import stair_mask  # noqa: E402
from mcbuild.parts import expand  # noqa: E402
from mcbuild.semantic import build_from_spec  # noqa: E402
from mcbuild.scan import clean_scan  # noqa: E402
from mcbuild.export import write_schem  # noqa: E402
from mcbuild.vision import photos_to_build, validate  # noqa: E402

S = os.path.join(ROOT, "samples")
results = []


def check(name, cond, detail=""):
    results.append(cond)
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail else ""))


# 1. stair lookup table agrees with vanilla stair model rules
st = [(p, e) for p, e in enumerate(LUT) if e[0] == STAIRS]
check("stair LUT matches model rules", len(st) == 24 and all(stair_mask(e[2], e[1], e[3]) == p for p, e in st))

# 2. parity voxelizer is exact on a sphere
m = trimesh.creation.icosphere(5, radius=10)
g = _parity_occupancy(m.triangles, np.array([-11, -11, -11.]), np.array([44, 44, 44]), 0.5)
check("parity fill volume", abs(g.sum() - m.volume / 0.125) / g.sum() < 0.01, f"{g.sum()} cells")

# 3. spec expansion never mutates its input
spec = json.load(open(os.path.join(S, "taj_mahal.json")))
check("expand is repeatable", len(expand(spec["parts"])) == len(expand(spec["parts"])) == 71)

# 4. spec build
b = build_from_spec(spec, block_size=1.0)
c = b.counts()
check("taj build", b.size == (102, 74, 102) and c.get("minecraft:black_stained_glass", 0) > 0, str(b.size))

# 5. mesh build: pyramid faces become stairs
b = build(load_meshes(os.path.join(S, "pyramid.glb")), height_blocks=40)
check("pyramid stairs", "minecraft:sandstone_stairs" in b.counts())

# 6. scan cleanup recovers the cottage footprint (10.2 x 13.2 m, either way round)
ms = clean_scan(load_meshes(os.path.join(S, "fake_scan.glb")), log=lambda *a: None)
lo = np.min([x.bounds[0] for x in ms], 0); hi = np.max([x.bounds[1] for x in ms], 0)
fp = sorted([hi[0] - lo[0], hi[2] - lo[2]])
check("scan isolate", abs(fp[0] - 10.2) < 0.6 and abs(fp[1] - 13.2) < 0.6, f"{np.round(fp, 2)}")

# 7. schematic round-trips
try:
    import nbtlib
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "t.schem")
        write_schem(b, p)
        r = nbtlib.load(p)
        r = r if "Version" in r else r["Schematic"]
        check("schem readable", int(r["Version"]) == 2 and int(r["Width"]) == b.size[0])
except ImportError:
    print("skip schem readable (pip install nbtlib)")

# 8. vision loop with a stand-in client
spec["camera"] = {"azimuth_deg": 20, "elevation_deg": 12}
client = types.SimpleNamespace(messages=types.SimpleNamespace(
    create=lambda **kw: types.SimpleNamespace(content=[types.SimpleNamespace(type="tool_use", input=spec)])))
with tempfile.TemporaryDirectory() as d:
    img = os.path.join(d, "x.png")
    from PIL import Image
    Image.new("RGB", (64, 64), "white").save(img)
    bb, final, vers = photos_to_build([img], rounds=1, client=client, workdir=d, log=lambda *a: None)
check("vision loop (stub)", len(vers) == 2 and validate(final) == [])

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
