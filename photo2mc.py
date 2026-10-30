#!/usr/bin/env python3
"""photo2mc — real structures to Minecraft builds.

  photo   one or more photos  -> Claude writes a structure spec -> build
  spec    a structure spec (.json) -> build        (edit a spec and rebuild)
  landmark  a ready-made landmark from the library (Eiffel Tower, Big Ben, ...)
  scan    a phone scan / photogrammetry mesh -> level, strip ground -> build
  model   any clean 3D model (.glb/.obj/...) -> build

Examples
  python photo2mc.py photo eiffel.jpg --out out/eiffel
  python photo2mc.py photo front.jpg side.jpg --hint "my parents' house" --rounds 2 --out out/house
  python photo2mc.py spec out/eiffel.spec.json --block-size 0.5 --out out/eiffel_big
  python photo2mc.py scan polycam_export.glb --out out/church
  python photo2mc.py model chapel.obj --up z --height 60 --out out/chapel

Every command writes  <out>.schem  <out>_datapack.zip  <out>.html (3D viewer)
<out>_guide.html (layer-by-layer survival guide + materials)  <out>.png
and, for photo, <out>.spec.json (edit it and run `spec` to rebuild).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "viewer"))

from mcbuild.voxelize import FULL, STAIRS, SLAB  # noqa: E402


def write_all(b, out, title, desc):
    from mcbuild.export import write_schem, write_datapack
    from mcbuild.render import render_iso
    from make_viewer import viewer_entry, make
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    name = os.path.basename(out)
    write_schem(b, out + ".schem")
    ncmd = write_datapack(b, out + "_datapack.zip", name=name)
    make([viewer_entry(b, title, desc)], out + ".html")
    from mcbuild.guide import write_guide
    write_guide(b, out + "_guide.html", title)
    render_iso(b, out + ".png", title=title)
    k = b.kinds
    print(f"\n{title}: {b.size[0]}×{b.size[1]}×{b.size[2]} blocks, {len(k):,} placed "
          f"({(k == STAIRS).sum():,} stairs, {(k == SLAB).sum():,} slabs), {ncmd:,} commands")
    for blk, n in list(b.counts().items())[:12]:
        print(f"  {n:7,d}  {blk}")
    if getattr(b, "color_error", None):
        e = b.color_error
        print(f"\ncolour match (CIEDE2000): median {e['median']:.1f}, 90th percentile {e['p90']:.1f}, "
              f"{e['share_under_5'] * 100:.0f}% of blocks under 5 (close match)")
    print(f"\nwrote {out}.schem, {out}_datapack.zip, {out}.html (3D), {out}_guide.html (survival guide), {out}.png")


def scale_args(p):
    p.add_argument("--height", type=int, help="target height in blocks")
    p.add_argument("--block-size", type=float, help="meters (model units) per block")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)

    p = sp.add_parser("photo", help="photos -> build via Claude vision")
    p.add_argument("photos", nargs="+")
    p.add_argument("--hint", default="", help="anything that helps: name, real height, what's hidden")
    p.add_argument("--rounds", type=int, default=1, help="compare-and-correct rounds (0-3)")
    p.add_argument("--model", default=None, help="Claude model id")
    scale_args(p)

    p = sp.add_parser("spec", help="structure spec JSON -> build")
    p.add_argument("spec")
    scale_args(p)

    p = sp.add_parser("landmark", help="build a landmark from the library (no argument lists them)")
    p.add_argument("name", nargs="?")
    scale_args(p)

    for name, hlp in (("scan", "phone scan / photogrammetry mesh -> build"), ("model", "clean 3D model -> build")):
        p = sp.add_parser(name, help=hlp)
        p.add_argument("mesh")
        p.add_argument("--up", choices=["y", "z"], default="y")
        p.add_argument("--max-materials", type=int, default=12)
        p.add_argument("--materials", default="", help="only these tags: stone,wood,metal,color,earth,roof,detail,wool")
        p.add_argument("--no-mix", action="store_true", help="one block per colour (no two-block texture mixing)")
        p.add_argument("--semantic", action="store_true",
                       help="ask Claude what each colour region really is (glass, roof, door...) and use the right blocks")
        p.add_argument("--photo", nargs="*", default=[], help="photo(s) of the real structure to help --semantic")
        if name == "scan":
            p.add_argument("--keep-ground", action="store_true")
            p.add_argument("--no-square", action="store_true", help="don't rotate walls onto the grid")
        else:
            p.add_argument("--square", action="store_true", help="rotate so the walls line up with the grid")
        scale_args(p)

    for p in sp.choices.values():
        p.add_argument("--out", default="out/build")
        p.add_argument("--mc", choices=["latest", "1.21"], default="latest",
                       help="target version: latest (26.x, e.g. concrete stairs) or 1.21 (loads on 1.21.1+)")
        p.add_argument("--solid", action="store_true", help="fill the interior (default hollow)")

    a = ap.parse_args(argv)
    t0 = time.time()
    if a.cmd == "landmark":
        lib = os.path.join(HERE, "samples", "landmarks")
        names = sorted(f[:-5] for f in os.listdir(lib) if f.endswith(".json"))
        if not a.name or a.name not in names:
            print("landmarks:", ", ".join(names))
            return
        a.cmd, a.spec = "spec", os.path.join(lib, a.name + ".json")
        if a.out == "out/build":
            a.out = os.path.join("out", a.name)

    if a.cmd in ("photo", "spec"):
        from mcbuild.semantic import build_from_spec
        from mcbuild.vision import photos_to_build, _auto_block, DEFAULT_MODEL
        if a.cmd == "photo":
            if not os.environ.get("ANTHROPIC_API_KEY"):
                sys.exit("Set ANTHROPIC_API_KEY first (console.anthropic.com -> API keys).")
            b, spec, versions = photos_to_build(
                a.photos, rounds=a.rounds, block_size=a.block_size, height_blocks=a.height,
                hint=a.hint, model=a.model or DEFAULT_MODEL, workdir=os.path.dirname(a.out) or ".", target=a.mc)
            os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
            with open(a.out + ".spec.json", "w") as f:
                json.dump(spec, f, indent=1)
            for i, v in enumerate(versions):
                with open(f"{a.out}.spec_v{i + 1}.json", "w") as f:
                    json.dump(v, f, indent=1)
            print("\n" + spec.get("analysis", "")[:1200])
        else:
            spec = json.load(open(a.spec))
            kw = {"block_size": a.block_size} if a.block_size else \
                 {"height_blocks": a.height} if a.height else \
                 {"block_size": spec.get("recommended_block_size") or _auto_block(spec)}
            b = build_from_spec(spec, hollow=not a.solid, target=a.mc, **kw)
        title = spec.get("name", "Build")
        desc = f"Built from {'photo' if a.cmd == 'photo' else 'spec'}: {len(spec.get('parts', []))} parts."
    else:
        from mcbuild import load_meshes, build, Palette
        meshes = load_meshes(a.mesh, up=a.up)
        if a.cmd == "scan":
            from mcbuild.scan import clean_scan
            meshes = clean_scan(meshes, keep_ground=a.keep_ground, square_up=not a.no_square)
        elif a.square:
            from mcbuild.scan import align_yaw
            align_yaw(meshes)
        if not (a.height or a.block_size):
            a.height = 60
        pal = Palette(include_tags=set(filter(None, a.materials.split(","))) or None, target=a.mc)
        b = build(meshes, height_blocks=a.height, block_size=a.block_size, palette=pal,
                  max_materials=a.max_materials, hollow=not a.solid, open_bottom=True, dither=not a.no_mix)
        if a.semantic:
            if not os.environ.get("ANTHROPIC_API_KEY"):
                sys.exit("--semantic needs ANTHROPIC_API_KEY.")
            from mcbuild.regions import find_regions, ask_claude, apply_assignment
            rid, regs = find_regions(b)
            print(f"asking Claude about {len(regs)} regions...")
            asg = ask_claude(b, rid, regs, photos=a.photo, workdir=os.path.dirname(a.out) or ".")
            for r in asg.get("regions", []):
                cur = regs[r["id"]]["current_block"] if r["id"] < len(regs) else "?"
                if r["material"] != cur:
                    print(f"  region {r['id']}: {cur} -> {r['material']}  ({r.get('what_it_is', '')})")
            b = apply_assignment(b, rid, asg, target=a.mc)
        title = os.path.splitext(os.path.basename(a.mesh))[0].replace("_", " ").title()
        desc = f"Converted from {os.path.basename(a.mesh)}."

    write_all(b, a.out, title, desc)
    print(f"done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
