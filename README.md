# photo2mc

Turn real-world structures into Minecraft builds, from photos, phone scans or 3D models. Builds use stairs and slabs wherever the real geometry slopes.

## Quick start

```
pip install trimesh pillow numpy scipy shapely mapbox-earcut anthropic
export ANTHROPIC_API_KEY=sk-ant-...            # only needed for photos

python photo2mc.py photo eiffel.jpg --out out/eiffel
python photo2mc.py photo front.jpg side.jpg back.jpg --hint "church, about 40 m to the steeple tip" --rounds 2 --out out/church
python photo2mc.py spec out/eiffel.spec.json --block-size 0.5 --out out/eiffel_2x    # edit the spec, rebuild for free
python photo2mc.py scan polycam_export.glb --out out/house
python photo2mc.py model chapel.obj --up z --height 60 --out out/chapel
```

Every command writes `<out>.schem`, `<out>_datapack.zip`, `<out>.html` (3D viewer with layer slider and material counts) and `<out>.png`.

## Three ways in

| Command | Input | How it works | Best for |
|---|---|---|---|
| `photo` | 1+ photos | Claude identifies the structure, uses real documented dimensions for landmarks (or scale cues like doors and storeys otherwise), and writes a **structure spec**: primitive parts at real size with Minecraft materials. Then it builds, renders the build from the photo's camera angle, compares it to the photo and corrects the spec (`--rounds`). | Well-known landmarks, buildings, anything from one photo |
| `scan` | Phone scan / photogrammetry (Polycam, Scaniverse, RealityScan, COLMAP) | Finds the ground plane (RANSAC), levels the scan, squares walls to the grid, cuts away ground and clutter (cars, trees), then colour-matches blocks. | A real place you can walk around |
| `model` | Any clean 3D model | Straight to the block engine. Also works for output of image-to-3D tools (TRELLIS, Hunyuan3D, Tripo, Meshy). | Downloaded or generated models |

Photos give the cleanest Minecraft builds: materials are chosen for what surfaces *are* (glass windows, wood doors, copper roofs), and hidden sides come from symmetry and the model's knowledge of the landmark. Scans give the most faithful geometry for irregular, one-of-a-kind places.

### Structure specs

A spec is plain JSON you can read and edit (`samples/taj_mahal.json` is an example). Coordinates are meters, `y` up, `x` to the right in the photo, `z` toward the camera; `at` is each part's base center.

Shapes: `box`, `cylinder` (taper, polygon sides), `cone`, `pyramid`, `gable_roof`, `hip_roof`, `dome`, `sphere`, `revolve` (any lathe profile: onion domes, minarets, spires), `extrude` (any footprint), `arch`.
Modes: `solid`, `carve` (openings, recesses), `paint` (windows, doors, bands).
Extras: `rotate`, `repeat` (rows/grids of windows, columns), `mirror` (`x`, `z`, `xz`).

## How it works

1. **Half-block voxelization.** Each closed part of the model is filled with exact ray parity (vertical rays through every half-block cell). Open meshes from scans fall back to a surface-normal vote.
2. **Grid alignment.** The grid is shifted so the model's main walls land on block boundaries, not through the middle of blocks.
3. **Shape detection.** Each block covers 2×2×2 half-cells. That 8-bit pattern maps directly to a full block, top/bottom slab, straight stairs, or inner/outer corner stairs (including upside-down) with the right `facing`/`shape`. The lookup table is cross-checked against vanilla stair-model rules (`shapes.py`).
4. **Materials.** Surface samples vote on the nearest block in CIELAB, so boundaries never blend into a fake in-between color. Families with matching stairs and slabs are preferred so a roof and its slope use the same material. The palette is limited to the most-used blocks, with small distinct details (doors, windows) kept. A 3×3×3 majority filter cleans texture noise.
5. **Export.** Sponge Schematic v2, a vanilla datapack with runs merged into `fill` commands, and a viewer.

## Files

- `photo2mc.py` — command line for everything.
- `mcbuild/vision.py` — photos → spec with Claude, plus the compare-and-correct loop.
- `mcbuild/parts.py` — spec shapes → meshes. `mcbuild/semantic.py` — spec → build.
- `mcbuild/scan.py` — ground detection, levelling, wall squaring, clutter removal.
- `mcbuild/palette.py` — ~80 building blocks with stair/slab families; `calibrate_from_textures()` swaps in exact texture averages from a Minecraft jar.
- `mcbuild/voxelize.py` — occupancy, shape table, coloring.
- `mcbuild/shapes.py` — what Minecraft renders for a blockstate.
- `mcbuild/export.py` — `.schem`, datapack, viewer JSON.
- `mcbuild/render.py` — quick isometric PNG.
- `samples/make_samples.py` — procedural cottage, Great Pyramid, domed temple.
- `viewer/` — the 3D viewer page.

## Known limits

- Details thinner than half a block (window glass, railings, thin spires) are dropped or thickened.
- `scan` and `model` match by colour, so windows there aren't glass; use `photo` when that matters.
- `photo` makes one Claude API call to write the spec plus one per `--rounds` (more if a spec needs fixing). Default model is `claude-opus-5-5`; set `--model` or `PHOTO2MC_MODEL` to change it.
- Very lattice-like structures (Eiffel Tower ironwork) come out as solid massing; openings have to be carved explicitly.
