"""Command line: 3D model -> Minecraft build.

    python -m mcbuild.convert model.glb --height 60 --out out/eiffel

Writes  out/eiffel.schem, out/eiffel_datapack.zip, out/eiffel.json
"""
from __future__ import annotations

import argparse
import os
import time

from .palette import Palette
from .voxelize import load_meshes, build, STAIRS, SLAB, FULL
from .export import write_schem, write_datapack, write_preview_json


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("model", help="glb / gltf / obj / ply / stl")
    ap.add_argument("--height", type=int, help="target height in blocks")
    ap.add_argument("--block-size", type=float, help="model units per block (e.g. 1.0 for real-scale meters)")
    ap.add_argument("--up", choices=["y", "z"], default="y", help="model's up axis (glTF=y, Blender/scans often z)")
    ap.add_argument("--max-materials", type=int, default=12, help="limit distinct block types (0 = no limit)")
    ap.add_argument("--materials", default="", help="only these tags: stone,wood,metal,color,earth,roof")
    ap.add_argument("--exclude", default="", help="comma-separated material names to never use")
    ap.add_argument("--solid", action="store_true", help="keep the interior filled (default: hollow shell)")
    ap.add_argument("--no-shapes", action="store_true", help="full blocks only, no stairs/slabs")
    ap.add_argument("--closed-bottom", action="store_true", help="mesh is watertight; don't cap the bottom")
    ap.add_argument("--out", default="out/build", help="output path prefix")
    a = ap.parse_args(argv)
    if not (a.height or a.block_size):
        ap.error("give --height or --block-size")

    t0 = time.time()
    meshes = load_meshes(a.model, up=a.up)
    pal = Palette(include_tags=set(filter(None, a.materials.split(","))) or None,
                  exclude=set(filter(None, a.exclude.split(","))) or None)
    b = build(meshes, height_blocks=a.height, block_size=a.block_size, palette=pal,
              max_materials=a.max_materials, hollow=not a.solid, shapes=not a.no_shapes,
              open_bottom=not a.closed_bottom)

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    name = os.path.basename(a.out)
    write_schem(b, a.out + ".schem")
    ncmd = write_datapack(b, a.out + "_datapack.zip", name=name)
    write_preview_json(b, a.out + ".json")

    k = b.kinds
    print(f"{name}: {b.size[0]}x{b.size[1]}x{b.size[2]} blocks, {len(k)} placed "
          f"({(k == FULL).sum()} full, {(k == STAIRS).sum()} stairs, {(k == SLAB).sum()} slabs), "
          f"{ncmd} commands, {time.time() - t0:.1f}s")
    for blk, n in list(b.counts().items())[:15]:
        print(f"  {n:6d}  {blk}")
    return b


if __name__ == "__main__":
    main()
