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
from mcbuild.shapes import state_boxes                        # noqa: E402
from mcbuild.voxelize import STAIRS, SLAB                     # noqa: E402


def viewer_entry(b, name, desc):
    mats, mindex = [], {}
    shapes, sindex = [], {}
    blocks = []
    for (x, y, z), s, rgb in zip(b.coords.tolist(), b.states, b.rgb.tolist()):
        bid = s.split("[")[0].replace("minecraft:", "")
        if bid not in mindex:
            mindex[bid] = len(mats)
            mats.append([bid, "%02x%02x%02x" % tuple(rgb)])
        bx = tuple(tuple(round(v, 4) for v in box) for box in state_boxes(s))
        if bx not in sindex:
            sindex[bx] = len(shapes)
            shapes.append([list(b) for b in bx])
        blocks.append([x, y, z, sindex[bx], mindex[bid]])
    counts = Counter(m for *_, m in blocks)
    bom = [[mats[i][0], mats[i][1], n] for i, n in counts.most_common()]
    return {"name": name, "desc": desc, "size": list(b.size), "mats": mats, "shapes": shapes, "blocks": blocks, "bom": bom,
            "kinds": {"stairs": int((b.kinds == STAIRS).sum()), "slabs": int((b.kinds == SLAB).sum())}}


def make(entries, out):
    tpl = open(os.path.join(HERE, "template.html")).read()
    html = tpl.replace("/*DATA*/null", json.dumps(entries, separators=(",", ":")))
    with open(out, "w") as f:
        f.write(html)
    return out


def landmark_entries(names=None, log=print):
    from mcbuild.semantic import build_from_spec
    lib = os.path.join(os.path.dirname(HERE), "samples", "landmarks")
    order = ["eiffel_tower", "big_ben", "st_basils_cathedral", "taj_mahal", "colosseum", "space_needle",
             "leaning_tower_of_pisa", "parthenon", "arc_de_triomphe", "empire_state_building", "great_pyramid"]
    out = []
    for n in names or order:
        sp = json.load(open(os.path.join(lib, n + ".json")))
        bs = sp.get("recommended_block_size", 1.0)
        b = build_from_spec(sp, block_size=bs)
        per_m = 1 / bs
        scale = f"{per_m:g} blocks per meter" if per_m >= 1 else f"1 block = {bs:g} m"
        out.append(viewer_entry(b, sp["name"].split(" (")[0], f"{sp['notes']} Scale: {scale}."))
        log(n, b.size, len(b.coords))
    return out


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out/viewer.html"
    entries = landmark_entries()
    print(make(entries, out), os.path.getsize(out) // 1024, "KB")
