# photo2mc

Turns real-world structures into Minecraft builds from photos, phone scans or 3D models. Python, no GPU needed. See README.md for user-facing docs.

## Commands

```
pip install -r requirements.txt
python tests/run_tests.py                                   # fast checks, ~30 s
python samples/make_samples.py                              # regenerate sample .glb files
python photo2mc.py spec samples/taj_mahal.json --out out/taj
python photo2mc.py scan samples/fake_scan.glb --block-size 0.5 --out out/scan
python photo2mc.py model samples/cottage.glb --block-size 0.5 --out out/cottage
python photo2mc.py photo some_photo.jpg --out out/x         # needs ANTHROPIC_API_KEY
python viewer/make_viewer.py out/viewer.html                # multi-build demo viewer
```

Outputs go in `out/` (git-ignored): `.schem`, `_datapack.zip`, `.html` viewer, `.png` render, and for `photo` the `.spec.json` versions.

## Layout

- `photo2mc.py` — CLI (photo / spec / scan / model).
- `mcbuild/voxelize.py` — core engine. Half-block occupancy (exact vertical-ray parity per closed component; normal-vote fallback for open meshes), `grid_origin` wall alignment, 2×2×2 pattern → shape LUT, `classify_blocks`, `make_states`, colour-matched `build()`.
- `mcbuild/shapes.py` — independent blockstate → sub-cell mask (vanilla stair model rules). Used by renderer, viewer and as a cross-check of the LUT.
- `mcbuild/palette.py` — materials as families (full + stairs + slab), CIELAB matching. Tag `detail` (glass etc.) is excluded from colour matching by default.
- `mcbuild/parts.py` — structure spec → watertight primitive meshes; `expand()` handles repeat/mirror (must not mutate its input — that was a real bug).
- `mcbuild/semantic.py` — spec → build with per-part materials; modes solid / carve / paint.
- `mcbuild/vision.py` — Claude prompt + tool schema, `SpecWriter`, `photos_to_build` with render-and-compare refinement rounds.
- `mcbuild/scan.py` — RANSAC ground plane, levelling, `align_yaw` (4-fold wall direction), footprint-based clutter removal.
- `mcbuild/export.py` — Sponge Schematic v2 (hand-written NBT), vanilla datapack, viewer JSON.
- `mcbuild/render.py` — matplotlib painter's-algorithm isometric PNG, any azimuth/elevation.
- `viewer/` — three.js r128 viewer template + `make_viewer.py`.

## Conventions

- Minecraft axes: +x east, +y up, +z south. Spec/photo convention: x = right in the photo, z = toward the camera, so the photographed facade faces +z (south).
- Spec units are meters; `at` = base center [x, y_bottom, z].
- Sub-cell bit index = dy*4 + dz*2 + dx. Stair `facing` is the side the tall half is on; `outer_right` = the quadrant at facing ∩ clockwise(facing).
- Every closed part is voxelized on its own and unioned, so overlapping parts and hidden faces are fine.

## Status / next steps

- The live Claude call in `vision.py` has only been exercised with a stand-in client (no API key in the original workspace). First real run: check the tool-use response parses and the spec validates; tune SYSTEM prompt from results. Model id defaults to `claude-opus-5-5` (env `PHOTO2MC_MODEL`).
- Ideas: semantic material pass for scan/model builds (cluster colours → ask Claude which blocks), image-to-3D provider clients (TRELLIS / Hunyuan3D / Tripo) feeding `model`, landmark fetch from Google Photorealistic 3D Tiles, glass panes with connection states, `calibrate_from_textures()` against a real client jar.
