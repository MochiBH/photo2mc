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
from mcbuild.vision import manual_prompt
mp = manual_prompt(block_size=0.5)
check("manual prompt (no API key)", "SPEC FILE" in mp and "0.5 m per block" in mp and "submit_structure tool" not in mp)
check("validate names missing fields", validate({"parts": [{"shape": "box", "at": [0, 0, 0]}]}) == ["part 0 (box): missing field 'size'"])

# 9. measured palette: real ids, versions, CIEDE2000 reference values
from mcbuild.palette import MATERIALS, Palette, delta_e2000, srgb_to_lab
check("palette size", len(MATERIALS) > 200 and sum(m.stairs is not None for m in MATERIALS) > 80)
ref = delta_e2000(np.array([[50, 2.6772, -79.7751]]), np.array([[50, 0, -82.7485]]))[0]
check("CIEDE2000 reference pair", abs(ref - 2.0425) < 1e-3, f"{ref:.4f}")
old = Palette(target="1.21")
check("1.21 target drops 26.x blocks", all(m.since[0] == "1.21" for m in old.materials)
      and not any(m.stairs and "concrete" in m.stairs for m in old.materials))

# 10. colour accuracy with texture mixing beats single blocks on the temple
b1 = build(load_meshes(os.path.join(S, "temple.glb")), block_size=1.0, dither=False)
b2 = build(load_meshes(os.path.join(S, "temple.glb")), block_size=1.0, dither=True)
check("mixing improves colour match", b2.color_error["median"] < b1.color_error["median"],
      f"{b1.color_error['median']:.1f} -> {b2.color_error['median']:.1f}")

# 11. thin blocks connect correctly
thin = {"name": "t", "parts": [
    {"shape": "box", "size": [6, 3, 6], "at": [0, 0, 0], "material": "bricks"},
    {"shape": "box", "size": [2, 1, 1.4], "at": [0, 1, 3], "material": "glass_pane", "mode": "paint"},
    {"shape": "box", "size": [8, 1, 0.1], "at": [0, 0, 5], "material": "oak_fence"},
    {"shape": "box", "size": [8, 1, 0.3], "at": [0, 0, -5], "material": "cobblestone_wall"}]}
bt = build_from_spec(thin, block_size=1.0)
fences = [s_ for s_ in bt.states if "oak_fence" in s_]
mid = [s_ for s_ in fences if "east=true" in s_ and "west=true" in s_]
walls = [s_ for s_ in bt.states if "cobblestone_wall" in s_]
check("fence row connects", len(fences) == 8 and len(mid) == 6, f"{len(fences)} fences")
check("wall row: posts at the ends only", sum("up=true" in w for w in walls) == 2 and len(walls) == 8)
check("pane windows in wall", sum("glass_pane" in s_ for s_ in bt.states) == 2)

# 12. landmark specs all build (small scale for speed)
lib = os.path.join(S, "landmarks")
bad = []
for f in sorted(os.listdir(lib)):
    sp = json.load(open(os.path.join(lib, f)))
    try:
        if validate(sp):
            bad.append(f)
        build_from_spec(sp, height_blocks=30)
    except Exception as e:  # noqa: BLE001
        bad.append(f"{f}: {e}")
check("landmark library builds", not bad and len(os.listdir(lib)) >= 11, str(bad))

# 13. survival materials
from mcbuild.recipes import raw_materials
raw, steps = raw_materials({"minecraft:stone_brick_stairs": 10, "minecraft:quartz_block": 3, "minecraft:oak_fence": 3})
check("raw materials", raw.get("cobblestone") == 10 and raw.get("nether_quartz") == 12 and raw.get("oak_log", 0) >= 2, str(raw))
from mcbuild.guide import guide_data
gd = guide_data(bt, "t")
check("guide layers", len(gd["layers"]) == bt.size[1] and sum(len(l) for l in gd["layers"]) == len(bt.coords))

# 14. semantic regions with a stand-in client
from mcbuild.regions import find_regions, ask_claude, apply_assignment
bc = build(load_meshes(os.path.join(S, "cottage.glb")), block_size=0.5)
rid, regs = find_regions(bc)
roof = next(r["id"] for r in regs if r["stairs_or_slabs_pct"] > 10)
stub = types.SimpleNamespace(messages=types.SimpleNamespace(create=lambda **kw: types.SimpleNamespace(content=[
    types.SimpleNamespace(type="tool_use", input={"analysis": "", "regions": [{"id": roof, "material": "waxed_oxidized_cut_copper"}]})])))
with tempfile.TemporaryDirectory() as d:
    asg = ask_claude(bc, rid, regs, client=stub, workdir=d)
bs = apply_assignment(bc, rid, asg)
check("semantic remap keeps stair shapes", any("waxed_oxidized_cut_copper_stairs[facing" in s_ for s_ in bs.states))

# 15. whole-site pipeline on synthetic map + lidar, written as a world and read back
from mcbuild.geo import Frame
from mcbuild.site import Site, build_world, rotate_state
from mcbuild.world import read_chunk
fr = Frame(32.0, -96.0, 32.0006, -95.9993)            # ~66 x 66 m
rng = np.random.default_rng(0)
gx, gy = rng.uniform(0, fr.width, 60000), rng.uniform(0, fr.height, 60000)
inb = (np.abs(gx - 25) < 8) & (np.abs(gy - 30) < 6)
tree = np.hypot(gx - 50, gy - 45) < 4
z = np.full(len(gx), 100.0) + 0.01 * gx
z = np.where(inb, 112.0, z)
z = np.where(tree, 100 + 10 - 1.5 * np.hypot(gx - 50, gy - 45), z)
lid = {"x": gx.astype(np.float32), "y": gy.astype(np.float32), "z": z.astype(np.float32),
       "cls": np.where(inb | tree, 1, 2).astype(np.uint8), "ret": np.ones(len(gx), np.uint8),
       "nret": np.where(tree, 2, 1).astype(np.uint8)}
sq = lambda x0, y0, x1, y1: np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], float)
feats = [{"kind": "area", "tags": {"building": "university", "name": "Test Hall"}, "pts": sq(17, 24, 33, 36), "holes": [], "id": "w1"},
         {"kind": "area", "tags": {"amenity": "university"}, "pts": sq(0, 0, 66, 66), "holes": [], "id": "w2"},
         {"kind": "way", "tags": {"highway": "residential"}, "pts": np.array([[0, 10], [66, 10]], float), "holes": [], "id": "w3"},
         {"kind": "way", "tags": {"highway": "footway"}, "pts": np.array([[25, 10], [25, 24]], float), "holes": [], "id": "w4"},
         {"kind": "node", "tags": {"amenity": "fountain"}, "pts": np.array([[50, 20]], float), "holes": [], "id": "n5"}]
site = Site(fr, feats, lid, campus_id="w2", log=lambda *a: None)
A, fluid = site.region(0, 0)
names = {site.pal.states[i].split("[")[0].split(":")[1] for i in np.unique(A)}
check("site: building, windows, roof, road, path", {"bricks", "gray_stained_glass_pane", "smooth_quartz", "smooth_stone",
                                                   "gray_concrete"} <= names, str(sorted(names)))
check("site: tree, fountain", {"oak_log", "water", "quartz_pillar"} & names >= {"water", "quartz_pillar"}
      and any(n.endswith("_leaves") for n in names) and any(n.endswith("_log") for n in names) and len(fluid) == 1)
k = next(i for i, B in enumerate(site.blds) if B["name"] == "Test Hall")
top_y = site.yb(112.0)
col = A[int(site.blds[k]["cz"]), int(site.blds[k]["cx"])]
roof_y = np.flatnonzero(col)[-1] - 64
check("site: roof at lidar height", abs(roof_y - top_y) <= 1, f"{roof_y} vs {top_y}")
check("rotate_state", rotate_state("minecraft:oak_stairs[facing=north,half=top]", 1) == "minecraft:oak_stairs[facing=east,half=top]"
      and rotate_state("minecraft:glass_pane[east=true,north=false,south=false,west=true]", 1)
      == "minecraft:glass_pane[east=false,north=true,south=true,west=false]")
with tempfile.TemporaryDirectory() as d:
    img, stats = build_world(site, d, "test", "Test Hall", log=lambda *a: None)
    c = read_chunk(os.path.join(d, "region", "r.0.0.mca"), 3, 3)
    import nbtlib
    lv = nbtlib.load(os.path.join(d, "level.dat"))
    check("world: chunk + level.dat readable", c is not None and int(c["DataVersion"]) == 3955 and len(c["sections"]) >= 1
          and str(lv["Data"]["LevelName"]) == "test" and stats["chunks"] > 0)

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
