"""Embed one or more builds into a single self-contained 3D viewer page.

    python viewer/make_viewer.py out/viewer.html
"""
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from mcbuild import load_meshes, build                       # noqa: E402
from mcbuild.shapes import state_mask                         # noqa: E402
from mcbuild.voxelize import STAIRS, SLAB                     # noqa: E402


def viewer_entry(b, name, desc):
    mats, mindex = [], {}
    blocks = []
    for (x, y, z), s, rgb in zip(b.coords.tolist(), b.states, b.rgb.tolist()):
        bid = s.split("[")[0].replace("minecraft:", "")
        if bid not in mindex:
            mindex[bid] = len(mats)
            mats.append([bid, "%02x%02x%02x" % tuple(rgb)])
        blocks.append([x, y, z, state_mask(s), mindex[bid]])
    counts = Counter(m for *_, m in blocks)
    bom = [[mats[i][0], mats[i][1], n] for i, n in counts.most_common()]
    return {"name": name, "desc": desc, "size": list(b.size), "mats": mats, "blocks": blocks, "bom": bom,
            "kinds": {"stairs": int((b.kinds == STAIRS).sum()), "slabs": int((b.kinds == SLAB).sum())}}


def make(entries, out):
    tpl = open(os.path.join(HERE, "template.html")).read()
    html = tpl.replace("/*DATA*/null", json.dumps(entries, separators=(",", ":")))
    with open(out, "w") as f:
        f.write(html)
    return out


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out/viewer.html"
    S = os.path.join(os.path.dirname(HERE), "samples")
    specs = [
        ("Cottage", "cottage.glb", dict(block_size=0.5),
         "12 m brick cottage, 2 blocks per meter. Gabled slate roof becomes deepslate tile stairs; door and windows come through as separate materials."),
        ("Great Pyramid", "pyramid.glb", dict(height_blocks=60),
         "Real proportions (230 m base, 51.8° faces) scaled to 60 blocks tall. The slope resolves to sandstone stairs on every step."),
        ("Domed temple", "temple.glb", dict(block_size=1.0),
         "Pantheon-like drum, dome and portico at 1 block per meter. Tests curved surfaces and a shallow pediment."),
    ]
    entries = []
    from mcbuild.semantic import build_from_spec
    from mcbuild.scan import clean_scan
    spec = json.load(open(os.path.join(S, "taj_mahal.json")))
    b = build_from_spec(spec, block_size=1.0)
    entries.append(viewer_entry(b, "Taj Mahal", "Built from a structure spec, the format Claude writes from a photo: 21 parts at real dimensions, 1 block per meter. Materials come from the spec, so doors are wood and window recesses are glass."))
    for name, f, kw, desc in specs:
        b = build(load_meshes(os.path.join(S, f)), **kw)
        entries.append(viewer_entry(b, name, desc))
        print(name, b.size, len(b.coords))
    b = build(clean_scan(load_meshes(os.path.join(S, "fake_scan.glb")), log=lambda *a: None), block_size=0.5)
    entries.append(viewer_entry(b, "Cleaned scan", "A simulated phone scan of the cottage: Z-up, rotated 8°, noisy, with ground, a car and a tree. Scan cleanup found the ground, squared the walls and kept only the house."))
    print(make(entries, out), os.path.getsize(out) // 1024, "KB")
